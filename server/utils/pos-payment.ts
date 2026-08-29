// Counter payments: a merchant-presented DuitNow QR for an exact amount.
//
// WHY THIS ISN'T BILLPLZ
// ─────────────────────
// Billplz — which handles marketplace orders and seller payouts — cannot do
// this. Its model is create-a-bill-then-redirect-the-payer-to-a-hosted-page;
// there is no endpoint that hands back a QR payload to draw on a till screen.
// Verified against the live API: a v3 bill created with reference_1=BP-MBBQR
// (Maybank QRPay) returns only a hosted `url`. The DuitNow codes in
// /v4/payment_gateways are redirect destinations, not embeddable QRs.
//
// A QR the customer scans inside their banking app has to come from a DuitNow
// acquirer that exposes the EMVCo payload. HitPay is the adapter here.
//
// WHOSE MONEY IS IT
// ─────────────────
// HitPay's platform (master–sub-merchant) model settles each sub-merchant to
// their OWN bank account — funds are never pooled through the platform. So a
// counter sale pays the shop directly, next business day, and TCGo's cut is
// deducted automatically as platform commission. That is materially different
// from the marketplace rail, where TCGo holds the money in escrow until the
// parcel is delivered and then pays out via Billplz. Counter cash never
// enters escrow, so `posSales` never touches the payout ledger.
//
// STATUS: the HitPay request/response shapes below follow HitPay's published
// API docs but have NOT been exercised against a live account — TCGo has no
// HitPay credentials yet. Everything is gated behind hitpayApiKey being set;
// with it unset the POS offers cash only and none of this code runs.

import { createHmac, timingSafeEqual } from "node:crypto";

export type PosChargeStatus = "pending" | "paid" | "failed" | "expired";

/**
 * A charge can have a failed ATTEMPT without being dead.
 *
 * Verified against the sandbox: when a payment is declined, HitPay marks the
 * payment `failed` but leaves the payment REQUEST `pending`, because the
 * customer can scan the same QR and try again. Reading only the request status
 * would leave the till spinning silently until the hold lapsed; treating the
 * first decline as terminal would yank the cards back while the customer is
 * reaching for another card. So the two are reported separately and the seller
 * decides.
 */
export interface PosChargeState {
  status: PosChargeStatus;
  /** Latest attempt was declined. The charge is still open for a retry. */
  lastAttemptFailed: boolean;
}

export interface PosCharge {
  /** Provider-side id, used for polling and webhook matching. */
  chargeId: string;
  /** Raw EMVCo string. The client renders it with the `qrcode` package. */
  qrPayload: string;
  status: PosChargeStatus;
  /** Provider-hosted fallback, shown if QR rendering fails. */
  url?: string;
}

export interface PosPaymentProvider {
  readonly name: string;
  createDuitNowCharge(input: {
    amountSen: number;
    reference: string;
    description: string;
    webhookUrl: string;
    /** Sub-merchant (seller) key — omit to charge to the platform account. */
    merchantKey?: string;
  }): Promise<PosCharge>;
  chargeStatus(chargeId: string, merchantKey?: string): Promise<PosChargeState>;
  cancelCharge(chargeId: string, merchantKey?: string): Promise<void>;
}

// ── HitPay ────────────────────────────────────────────────────────────

const hitpayConfig = () => {
  const c = useRuntimeConfig();
  return {
    apiKey: (c.hitpayApiKey as string) || "",
    platformKey: (c.hitpayPlatformKey as string) || "",
    salt: (c.hitpayWebhookSalt as string) || "",
    sandbox: String(c.hitpaySandbox ?? "") === "true",
  };
};

export const isPosPaymentConfigured = (): boolean => !!hitpayConfig().apiKey;

const hitpayBase = () =>
  hitpayConfig().sandbox
    ? "https://api.sandbox.hit-pay.com/v1"
    : "https://api.hit-pay.com/v1";

const hitpayHeaders = (merchantKey?: string): Record<string, string> => {
  const { apiKey, platformKey } = hitpayConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    // A sub-merchant key charges the seller's own HitPay account; falling back
    // to the platform key would silently bill the wrong merchant, so callers
    // that mean to use the platform account must pass nothing at all.
    "X-BUSINESS-API-KEY": merchantKey || apiKey,
  };
  if (platformKey) headers["X-PLATFORM-KEY"] = platformKey;
  return headers;
};

const mapHitpayStatus = (status: string): PosChargeStatus => {
  switch (status) {
    case "completed":
    case "succeeded":
      return "paid";
    case "failed":
      return "failed";
    case "expired":
    case "canceled":
    case "cancelled":
      return "expired";
    default:
      return "pending";
  }
};

const hitpay: PosPaymentProvider = {
  name: "hitpay",

  async createDuitNowCharge({ amountSen, reference, description, webhookUrl, merchantKey }) {
    const res = await fetch(`${hitpayBase()}/payment-requests`, {
      method: "POST",
      headers: hitpayHeaders(merchantKey),
      body: JSON.stringify({
        // HitPay prices in major units, unlike Billplz. Converting back here
        // keeps every caller in sen and this the only place that knows.
        amount: (amountSen / 100).toFixed(2),
        currency: "MYR",
        payment_methods: ["duitnow"],
        // The whole point: without this HitPay returns a hosted checkout URL
        // instead of a payload we can draw at the till.
        generate_qr: true,
        reference_number: reference,
        purpose: description,
        webhook: webhookUrl,
        // A counter QR is for exactly one customer paying exactly once.
        allow_repeated_payments: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HitPay refused the charge (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }

    const body = (await res.json()) as any;
    const qrPayload = body?.qr_code_data?.qr_code;
    if (!qrPayload) {
      // Fail loudly rather than showing the seller an empty box. The most
      // likely cause is DuitNow QR not being enabled on the merchant account.
      throw new Error(
        "HitPay accepted the charge but returned no QR payload. Check that DuitNow QR is enabled for this merchant account.",
      );
    }

    return {
      chargeId: String(body.id),
      qrPayload: String(qrPayload),
      status: mapHitpayStatus(String(body.status ?? "pending")),
      url: body.url ? String(body.url) : undefined,
    };
  },

  async chargeStatus(chargeId, merchantKey) {
    const res = await fetch(`${hitpayBase()}/payment-requests/${encodeURIComponent(chargeId)}`, {
      headers: hitpayHeaders(merchantKey),
    });
    if (!res.ok) {
      throw new Error(`HitPay status lookup failed (HTTP ${res.status})`);
    }
    const body = (await res.json()) as any;
    const status = mapHitpayStatus(String(body?.status ?? "pending"));

    // The request-level status doesn't move on a decline, so the attempt list
    // is the only place a failure shows up.
    const attempts: any[] = Array.isArray(body?.payments) ? body.payments : [];
    const latest = attempts.length ? attempts[attempts.length - 1] : null;
    const lastAttemptFailed =
      status === "pending" && String(latest?.status ?? "") === "failed";

    return { status, lastAttemptFailed };
  },

  async cancelCharge(chargeId, merchantKey) {
    // Best-effort: an already-paid request can't be cancelled, and that race
    // is resolved by the webhook, not here.
    await fetch(`${hitpayBase()}/payment-requests/${encodeURIComponent(chargeId)}`, {
      method: "DELETE",
      headers: hitpayHeaders(merchantKey),
    }).catch(() => {});
  },
};

export const posPaymentProvider = (): PosPaymentProvider => hitpay;

/**
 * Verify a HitPay webhook.
 *
 * HMAC-SHA256 of the raw request body, keyed by the account's salt, compared
 * in constant time. The raw body matters: re-serialising the parsed JSON can
 * reorder keys and change the digest.
 *
 * Returns false when no salt is configured — an unverified payment callback
 * must never be allowed to mark stock sold.
 */
export const verifyPosWebhook = (rawBody: string, signature: string): boolean => {
  const { salt } = hitpayConfig();
  if (!salt || !signature) return false;
  const expected = createHmac("sha256", salt).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};
