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

export const DELYVA_BASE = "https://api.delyva.app/v1.0";

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
  const res = await fetch(`${DELYVA_BASE}${path}`, {
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
        courier: s.service?.serviceCompany?.name || name.replace(/\s*\(DROP\)\s*/i, "").trim(),
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
  const res = await fetch(`${DELYVA_BASE}${path}`, {
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
  const res = await fetch(`${DELYVA_BASE}/order/${orderId}/label`, {
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

export const delyvaCancelOrder = async (orderId: string) =>
  await delyvaPost<{ data?: unknown }>(`/order/${orderId}/cancel`, {});

export const delyvaOrder = async (orderId: string) =>
  await delyvaGet<any>(`/order/${orderId}`);

export const delyvaTrack = async (consignmentNo: string) => {
  const { companyId } = delyvaConfig();
  const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  return await delyvaGet<any>(`/order/track/${encodeURIComponent(consignmentNo)}${q}`);
};
