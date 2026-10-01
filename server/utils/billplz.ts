import { createHmac, timingSafeEqual } from "node:crypto";

// Thin Billplz client. Billplz is the only payment provider for marketplace
// orders (Stripe Connect isn't available in Malaysia); money flows:
//
//   buyer ──Bill──► TCGo holding account ──Payment Order──► seller
//                                         └─Payment Order──► TCGo (fee sweep)
//
// Config (Netlify env):
//   NUXT_BILLPLZ_API_KEY                      secret key from Billplz settings
//   NUXT_BILLPLZ_X_SIGNATURE_KEY              X Signature key (callbacks + checksums)
//   NUXT_BILLPLZ_COLLECTION_ID                collection buyer bills go into
//   NUXT_BILLPLZ_PAYMENT_ORDER_COLLECTION_ID  collection for seller/fee payouts
//   NUXT_BILLPLZ_SANDBOX                      "true" to use billplz-sandbox.com

interface BillplzConfig {
  apiKey: string;
  xSignatureKey: string;
  collectionId: string;
  paymentOrderCollectionId: string;
  baseUrl: string;
}

const getConfig = (): BillplzConfig => {
  const c = useRuntimeConfig();
  const apiKey = c.billplzApiKey as string;
  const xSignatureKey = c.billplzXSignatureKey as string;
  if (!apiKey || !xSignatureKey) {
    throw createError({ statusCode: 500, message: "Billplz is not configured" });
  }
  const sandbox = String(c.billplzSandbox) === "true";
  return {
    apiKey,
    xSignatureKey,
    collectionId: c.billplzCollectionId as string,
    paymentOrderCollectionId: c.billplzPaymentOrderCollectionId as string,
    baseUrl: sandbox ? "https://www.billplz-sandbox.com" : "https://www.billplz.com",
  };
};

const request = async <T>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> => {
  const cfg = getConfig();
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") body.set(k, String(v));
  }
  return (await $fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.apiKey}:`).toString("base64")}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body.toString() : undefined,
  })) as T;
};

export interface BillplzBill {
  id: string;
  collection_id: string;
  paid: boolean;
  state: "due" | "paid" | "deleted";
  amount: number; // sen
  paid_amount: number; // sen
  url: string;
  reference_1?: string | null;
}

export const createBill = (input: {
  email: string;
  name: string;
  amountSen: number;
  description: string;
  callbackUrl: string;
  redirectUrl: string;
  orderId: string;
}) => {
  const cfg = getConfig();
  return request<BillplzBill>("POST", "/api/v3/bills", {
    collection_id: cfg.collectionId,
    email: input.email,
    name: input.name.slice(0, 255),
    amount: input.amountSen,
    description: input.description.slice(0, 200),
    callback_url: input.callbackUrl,
    redirect_url: input.redirectUrl,
    reference_1_label: "Order",
    reference_1: input.orderId,
  });
};

export const getBill = (billId: string) =>
  request<BillplzBill>("GET", `/api/v3/bills/${encodeURIComponent(billId)}`);

// Billplz X Signature: every field except x_signature as `${key}${value}`,
// sorted case-insensitively, joined with "|", HMAC-SHA256 with the X Signature
// key, hex encoded.
export const verifyXSignature = (fields: Record<string, unknown>): boolean => {
  const given = String(fields.x_signature ?? "");
  if (!given) return false;
  const source = Object.entries(fields)
    .filter(([k]) => k !== "x_signature")
    .map(([k, v]) => `${k}${v ?? ""}`)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .join("|");
  const expected = createHmac("sha256", getConfig().xSignatureKey).update(source).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
};

export interface BillplzPaymentOrder {
  id: string;
  status: "enquiring" | "executing" | "reviewing" | "completed" | "refunded" | string;
  total: number;
}

export interface PayoutAccount {
  bankCode: string; // Billplz SWIFT-style bank code, e.g. MBBEMYKL
  accountNumber: string;
  holderName: string;
  identityNumber: string; // MyKad / SSM number, required by Payment Order
  email?: string;
}

// Billplz Payment Order (v5). The checksum is an HMAC-SHA512 over
// collection id + account number + total + epoch with the X Signature key.
// Confirm the exact field order in the sandbox before going live.
export const createPaymentOrder = (input: {
  account: PayoutAccount;
  totalSen: number;
  description: string;
  referenceId: string;
}) => {
  const cfg = getConfig();
  if (!cfg.paymentOrderCollectionId) {
    throw createError({ statusCode: 500, message: "Billplz payment order collection not set" });
  }
  const epoch = Math.floor(Date.now() / 1000);
  const checksum = createHmac("sha512", cfg.xSignatureKey)
    .update(
      `${cfg.paymentOrderCollectionId}${input.account.accountNumber}${input.totalSen}${epoch}`,
    )
    .digest("hex");
  return request<BillplzPaymentOrder>("POST", "/api/v5/payment_orders", {
    payment_order_collection_id: cfg.paymentOrderCollectionId,
    bank_code: input.account.bankCode,
    bank_account_number: input.account.accountNumber,
    identity_number: input.account.identityNumber,
    name: input.account.holderName,
    description: input.description.slice(0, 200),
    total: input.totalSen,
    email: input.account.email,
    reference_id: input.referenceId,
    epoch,
    checksum,
  });
};

export const getPaymentOrder = (id: string) =>
  request<BillplzPaymentOrder>("GET", `/api/v5/payment_orders/${encodeURIComponent(id)}`);
