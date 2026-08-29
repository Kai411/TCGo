// Delyva (DelyvaX) client — courier aggregator used for live shipping quotes.
//
// Verified against the live API on 2026-08-24:
//   base    https://api.delyva.app/v1.0
//   auth    X-Delyvax-Access-Token: <apiKey>
//           (NOT `Authorization: Bearer` — that returns "jwt malformed")
//   quote   POST /service/instantQuote  → { data: { services: [...] } }
//   order   POST /order, GET /order/{id}, POST /order/{id}/cancel
//   secret  GET /user → data.apiSecret  (for webhook signature verification)
//
// A 0.3kg parcel KL→Penang returns 17 services (SPX, J&T, Ninja Van, DHL
// eCommerce, ABX, City-Link) between RM 5.00 and RM 6.90; KL→Kota Kinabalu
// between RM 10.90 and RM 19.05.
//
// Booking (from the published Postman collection, v1.0):
//   POST /order                     create + confirm when `process: true`
//   GET  /order/{id}/label          consignment note / AWB
//   POST /order/{id}/cancel         cancel
//   GET  /order/track/{consignmentNo}?companyId=   tracking history
//
// `process: true` matters: without it the order is created as a *draft* and
// nothing is booked or charged. That's why a malformed POST /order looks like
// a success — it quietly banks a draft.

// Production base. Point NUXT_DELYVA_API_BASE at the sandbox
// (https://trydx.delyva.app portal) to test bookings without spending real
// wallet credit — sandbox credentials are separate from production ones.
export const DELYVA_BASE = "https://api.delyva.app/v1.0";

const delyvaBase = (): string => {
  const config = useRuntimeConfig();
  return ((config.delyvaApiBase as string) || DELYVA_BASE).replace(/\/+$/, "");
};

export interface DelyvaAddress {
  address1: string;
  city: string;
  /** Full state name, e.g. "Pulau Pinang" — not the stored short code. */
  state: string;
  postcode: string;
  country: string;
}

const delyvaConfig = () => {
  const config = useRuntimeConfig();
  const apiKey = config.delyvaApiKey as string;
  const customerId = config.delyvaCustomerId as string;
  const companyId = config.delyvaCompanyId as string;
  if (!apiKey) {
    throw createError({ statusCode: 500, message: "Delyva not configured" });
  }
  return { apiKey, customerId, companyId };
};

const delyvaPost = async <T>(path: string, body: unknown): Promise<T> => {
  const { apiKey } = delyvaConfig();
  const res = await fetch(`${delyvaBase()}${path}`, {
    method: "POST",
    headers: {
      "X-Delyvax-Access-Token": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[delyva]", path, res.status, text.slice(0, 400));
    let message = "Shipping provider error";
    try {
      message = JSON.parse(text)?.error?.message || message;
    } catch {}
    throw createError({ statusCode: 502, message: `Delyva: ${message}` });
  }
  return JSON.parse(text) as T;
};

interface DelyvaQuoteResponse {
  data?: {
    services?: Array<{
      price?: { amount?: number; currency?: string };
      duration?: unknown;
      service?: {
        id?: number;
        code?: string;
        name?: string;
        serviceCompany?: { name?: string } | null;
      };
    }>;
  };
}

// Delyva doesn't expose a "requires drop-off" boolean; the convention across
// every service returned is a "(DROP)" suffix on the display name and a D in
// the code prefix (e.g. JNTDMY vs JNTMY). Name is the reliable signal.
const isDropoffOnly = (name: string) => /\(\s*DROP\s*\)/i.test(name);

import type { CourierRate } from "~/shared/shipping-quote";

export const delyvaQuote = async (input: {
  origin: DelyvaAddress;
  destination: DelyvaAddress;
  weightKg: number;
}): Promise<CourierRate[]> => {
  const { customerId } = delyvaConfig();
  const data = await delyvaPost<DelyvaQuoteResponse>("/service/instantQuote", {
    customerId,
    origin: input.origin,
    destination: input.destination,
    weight: { value: input.weightKg, unit: "kg" },
    itemType: "PARCEL",
  });

  return (data?.data?.services ?? [])
    .map((s) => {
      const name = s.service?.name ?? "";
      return {
        serviceId: String(s.service?.id ?? ""),
        serviceCode: s.service?.code ?? "",
        // Brand comes from the service name with the "(DROP)" suffix removed.
        // serviceCompany.name is unreliable for this: it keeps the suffix and
        // sometimes names the parent ("KEX" for ABX Express), which is not
        // what a seller or buyer recognises.
        courier: name.replace(/\s*\(\s*DROP\s*\)\s*/i, " ").trim(),
        serviceName: name,
        price: Number(s.price?.amount ?? 0),
        dropoffOnly: isDropoffOnly(name),
        etd: "",
      } satisfies CourierRate;
    })
    // COD variants duplicate every service at the same price and aren't
    // relevant to a prepaid marketplace.
    .filter((r) => r.serviceId && r.price > 0 && !/\(COD\)/i.test(r.serviceName))
    .sort((a, b) => a.price - b.price);
};

// ── Booking ───────────────────────────────────────────────────────────

const delyvaGet = async <T>(path: string): Promise<T> => {
  const { apiKey } = delyvaConfig();
  const res = await fetch(`${delyvaBase()}${path}`, {
    headers: { "X-Delyvax-Access-Token": apiKey },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[delyva]", path, res.status, text.slice(0, 400));
    let message = "Shipping provider error";
    try {
      message = JSON.parse(text)?.error?.message || message;
    } catch {}
    throw createError({ statusCode: 502, message: `Delyva: ${message}` });
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
};

export interface DelyvaContact {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  /** Full state name — same convention as the quote call. */
  state: string;
  postcode: string;
  country: string;
}

export interface DelyvaInventoryItem {
  name: string;
  type: "PARCEL";
  price: { amount: string; currency: "MYR" };
  weight: { value: number; unit: "kg" };
  dimension: { width: number; height: number; length: number; unit: "cm" };
  quantity: number;
  description?: string;
}

export interface DelyvaOrderResult {
  orderId: string;
  status: string;
  statusCode: number;
  invoiceId: string | null;
}

// The published example shows `data.orderId`, but the live API returns
// `data.id` and no `orderId` key at all (verified against a real draft).
// Reading only `orderId` would mean booking succeeds, the wallet is charged,
// and we then throw — releasing the idempotency claim so the seller can book
// a second time. Accept either.
const orderIdOf = (d: any): string =>
  String(d?.id ?? d?.orderId ?? "");

// Create AND confirm a shipment. Charges the Delyva wallet — never call this
// without an idempotency guard upstream.
export const delyvaCreateOrder = async (input: {
  serviceCode: string;
  origin: DelyvaContact;
  destination: DelyvaContact;
  inventory: DelyvaInventoryItem[];
  /** ISO8601 with offset, e.g. 2026-08-26T12:00:00+0800 */
  scheduledAt: string;
  /** false saves a draft — no courier, no charge. Used to validate payloads. */
  process?: boolean;
}): Promise<DelyvaOrderResult> => {
  const { customerId } = delyvaConfig();
  const res = await delyvaPost<{ data?: DelyvaOrderResult }>("/order", {
    customerId,
    // Create and confirm in one call. Without this the order sits as a draft
    // and no courier is booked.
    process: input.process !== false,
    serviceCode: input.serviceCode,
    origin: {
      scheduledAt: input.scheduledAt,
      inventory: input.inventory,
      contact: input.origin,
    },
    destination: {
      inventory: input.inventory,
      contact: input.destination,
    },
  });
  const data: any = res?.data;
  const orderId = orderIdOf(data);
  if (!orderId) {
    console.error("[delyva] order response missing id:", JSON.stringify(data).slice(0, 300));
    throw createError({ statusCode: 502, message: "Delyva did not return an order id" });
  }
  return {
    orderId,
    status: String(data?.status ?? ""),
    statusCode: Number(data?.statusCode ?? 0),
    invoiceId: data?.invoiceId ?? null,
  };
};

// The consignment note / AWB.
//
// This endpoint returns the PDF *document*, not a link to one — verified
// against a live booking (content-type: application/pdf). An earlier version
// of this treated the response as a URL, so the browser navigated to a
// megabyte of PDF bytes as if they were a path. Always stream the bytes.
export const delyvaLabelPdf = async (
  orderId: string,
): Promise<{ body: Buffer; contentType: string }> => {
  const { apiKey } = delyvaConfig();
  const res = await fetch(`${delyvaBase()}/order/${orderId}/label`, {
    headers: { "X-Delyvax-Access-Token": apiKey },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    let message = "Label not available";
    try {
      message = JSON.parse(buf.toString("utf8"))?.error?.message || message;
    } catch {}
    console.error("[delyva] label", orderId, res.status, message);
    throw createError({ statusCode: 502, message: `Delyva: ${message}` });
  }
  return {
    body: buf,
    contentType: res.headers.get("content-type") || "application/pdf",
  };
};

// The consignment number is the courier's tracking number. Delyva queues
// orders, so it isn't in the create response — it appears on the order a few
// seconds later.
export const delyvaConsignmentNo = async (orderId: string): Promise<string> => {
  const res = await delyvaGet<any>(`/order/${orderId}`);
  return String(res?.data?.consignmentNo ?? "");
};

export interface DelyvaOrderState {
  status: string;
  /** Delyva's terminal-failure code. */
  failed: boolean;
  consignmentNo: string;
  /** Human-readable cause when `failed` — e.g. insufficient wallet credit. */
  failedReason: string;
}

/**
 * Full post-booking state, not just the tracking number.
 *
 * POST /order returns 200 with status "processing" even when the booking is
 * about to fail: Delyva charges the wallet asynchronously, so an empty balance
 * surfaces a moment later as status "failed" (statusCode 99) with a
 * `failedReason`. Polling only for `consignmentNo` cannot tell "not ready yet"
 * apart from "never happening", which is how a failed booking got recorded as
 * a successful one.
 */
export const delyvaOrderState = async (
  orderId: string,
): Promise<DelyvaOrderState> => {
  const res = await delyvaGet<any>(`/order/${orderId}`);
  const d = res?.data ?? {};
  const status = String(d.status ?? "");
  return {
    status,
    failed: status === "failed" || Number(d.statusCode) === 99,
    consignmentNo: String(d.consignmentNo ?? ""),
    failedReason: String(d.failedReason ?? ""),
  };
};

export const delyvaCancelOrder = async (orderId: string) =>
  await delyvaPost<{ data?: unknown }>(`/order/${orderId}/cancel`, {});

export const delyvaOrder = async (orderId: string) =>
  await delyvaGet<any>(`/order/${orderId}`);

// Tracking with ETA.
//
// POST /order/track (resultType=latestFirst) returns the latest status plus
// the full `histories` array, and — only when statusCode is 400 (in transit to
// pickup) or 600 (in transit for dropoff) — an `arrival` estimate. Delyva
// returns arrival: null otherwise, and distance/duration of -1 when it can't
// calculate. `arrival.accuracy` is 1 for a confident estimate, 0 for a rough
// one, so we surface that rather than presenting every estimate as equal.
export interface DelyvaTrackEvent {
  statusCode: number;
  statusText: string | null;
  description: string | null;
  location: string | null;
  createdAt: string;
}

export interface DelyvaTracking {
  consignmentNo: string;
  statusCode: number;
  statusText: string | null;
  description: string | null;
  origin: string | null;
  destination: string | null;
  events: DelyvaTrackEvent[];
  /** Seconds until arrival, when Delyva can estimate one. */
  etaSeconds: number | null;
  etaAccurate: boolean;
}

/**
 * Where a shipment is, in terms the order model understands.
 *
 * Codes verified against live consignments rather than guessed — the observed
 * ladder is 100 "Record created" → 110 "Order ready" → 500 "Collected" →
 * 600 "In transit" → 700 "Delivered", with 900 cancelled and 99 failed.
 *
 * "Collected" is the moment the parcel leaves the seller: that, not the label
 * being bought, is what "shipped" means to a buyer.
 */
export type DelyvaStage = "pending" | "shipped" | "delivered" | "cancelled";

export const delyvaStage = (statusCode: number): DelyvaStage => {
  const code = Number(statusCode);
  if (!Number.isFinite(code)) return "pending";
  if (code >= 900 || code === 99) return "cancelled";
  if (code >= 700) return "delivered";
  if (code >= 500) return "shipped";
  return "pending";
};

export const delyvaTrack = async (consignmentNo: string): Promise<DelyvaTracking> => {
  const { companyId } = delyvaConfig();
  const res = await delyvaPost<any>("/order/track", {
    ...(companyId ? { companyId } : {}),
    consignmentNo,
    resultType: "latestFirst",
  });
  const d = res?.data ?? {};
  const durationValue = Number(d?.arrival?.duration?.value ?? -1);
  return {
    consignmentNo: String(d.consignmentNo ?? consignmentNo),
    statusCode: Number(d.statusCode ?? 0),
    statusText: d.statusText ?? null,
    description: d.description ?? null,
    origin: d.origin ?? null,
    destination: d.destination ?? null,
    events: (d.histories ?? []).map((h: any) => ({
      statusCode: Number(h.statusCode ?? 0),
      statusText: h.statusText ?? null,
      description: h.description ?? null,
      location: h.location && h.location !== "-" ? h.location : null,
      createdAt: String(h.createdAt ?? ""),
    })),
    // -1 is Delyva's "couldn't calculate", not a real duration.
    etaSeconds: durationValue > 0 ? durationValue : null,
    etaAccurate: Number(d?.arrival?.accuracy ?? 0) === 1,
  };
};
