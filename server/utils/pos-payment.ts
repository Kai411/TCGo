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
// counter sale pays the shop directly (T+2 in Malaysia), and never enters
// escrow. That is materially different from the marketplace rail, where TCGo
// holds the money until the parcel is delivered and then pays out via
// Billplz — which is why `posSales` never touches the payout ledger.
//
// TCGo TAKES NO CUT OF A COUNTER SALE.
//
// The POS is paid for by subscription: it is the Vendor plan (see
// shared/pricing.ts, POS_MONTHLY). Plan.rate is commission on ONLINE sales
// only. At the counter the seller keeps everything except HitPay's own
// 1.2% DuitNow QR fee, which HitPay deducts from their settlement.
//
// Two things follow, and both are easy to break by accident:
//
//   1. Never send `platform_commission_amount` on a counter charge.
//   2. Leave the Commission Rate in the HitPay dashboard (Settings →
//      Platform) at ZERO. X-PLATFORM-KEY is sent for the platform
//      relationship and unified webhooks, but that same header is what
//      applies a dashboard commission rate — so setting one there would
//      start skimming every counter sale in the country with no code
//      change and nothing in this repo to show for it.
//
// HitPay charges the platform itself nothing: no licensing fee, no monthly,
// no per-transaction cost to TCGo.
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

/**
 * How a seller's HitPay account is reached.
 *
 * HitPay documents two ways to connect a sub-merchant, and they authenticate
 * differently: a merchant who pastes their own API key is sent as
 * X-BUSINESS-API-KEY, while one who goes through the OAuth "Connect your
 * HitPay account" flow is sent as a Bearer token. Both are paired with the
 * platform's own X-PLATFORM-KEY, which is what attaches commission.
 *
 * OAuth is the better of the two — the token is scoped, revocable from the
 * merchant's own dashboard, and no key ever changes hands — so it wins when
 * both are present. Neither set means the platform account is charged.
 */
export interface MerchantCredential {
  /** Sub-merchant's own API key (direct integration). */
  apiKey?: string;
  /** OAuth access token (Connect Merchant Accounts). */
  accessToken?: string;
}

export interface PosPaymentProvider {
  readonly name: string;
  createDuitNowCharge(input: {
    amountSen: number;
    reference: string;
    description: string;
    webhookUrl: string;
    /** Omit to charge the platform account. */
    merchant?: MerchantCredential;
  }): Promise<PosCharge>;
  chargeStatus(chargeId: string, merchant?: MerchantCredential): Promise<PosChargeState>;
  cancelCharge(chargeId: string, merchant?: MerchantCredential): Promise<void>;
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

/**
 * Is TCGo operating as a HitPay platform (many shops), or as a single
 * account (its own)?
 *
 * The distinction decides whether an unconnected seller is acceptable.
 * In single-account mode there is only one shop and its key is in
 * config. In platform mode, charging an unconnected seller would put
 * their counter takings in TCGo's account.
 */
export const isPlatformMode = (): boolean => !!hitpayConfig().platformKey;

const hitpayBase = () =>
  hitpayConfig().sandbox
    ? "https://api.sandbox.hit-pay.com/v1"
    : "https://api.hit-pay.com/v1";

const hitpayHeaders = (merchant?: MerchantCredential): Record<string, string> => {
  const { apiKey, platformKey } = hitpayConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  if (merchant?.accessToken) {
    // OAuth-connected seller: the token identifies the merchant, so no
    // business key is sent at all.
    headers.Authorization = `Bearer ${merchant.accessToken}`;
  } else {
    // Either the seller's own key, or — when they haven't connected an
    // account — the platform's. Falling back is deliberate but it means the
    // PLATFORM is paid, not the shop; see isSellerConnected().
    headers["X-BUSINESS-API-KEY"] = merchant?.apiKey || apiKey;
  }

  // Attaches platform commission and unified webhooks. Works alongside
  // either authentication method.
  if (platformKey) headers["X-PLATFORM-KEY"] = platformKey;
  return headers;
};

/**
 * Is this seller's money going to their own bank?
 *
 * False means a counter sale would settle into the PLATFORM's account
 * instead of the shop's — fine while TCGo is testing against its own
 * account, wrong for anybody else, so callers can refuse rather than
 * quietly collect someone else's takings.
 */
export const isSellerConnected = (merchant?: MerchantCredential): boolean =>
  !!(merchant?.accessToken || merchant?.apiKey);

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

  async createDuitNowCharge({ amountSen, reference, description, webhookUrl, merchant }) {
    const res = await fetch(`${hitpayBase()}/payment-requests`, {
      method: "POST",
      headers: hitpayHeaders(merchant),
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

  async chargeStatus(chargeId, merchant) {
    const res = await fetch(`${hitpayBase()}/payment-requests/${encodeURIComponent(chargeId)}`, {
      headers: hitpayHeaders(merchant),
    });
    if (res.status === 401) {
      // HitPay documents 401 as the disconnection signal: the merchant
      // revoked the app from Developers -> Connected Apps.
      throw new Error("This shop's HitPay account is no longer connected.");
    }
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

  async cancelCharge(chargeId, merchant) {
    // Best-effort: an already-paid request can't be cancelled, and that race
    // is resolved by the webhook, not here.
    await fetch(`${hitpayBase()}/payment-requests/${encodeURIComponent(chargeId)}`, {
      method: "DELETE",
      headers: hitpayHeaders(merchant),
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
