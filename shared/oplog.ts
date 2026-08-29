// The operations log — two different things kept deliberately separate.
//
// An ERROR is the platform failing: Billplz rejected a bill, Delyva wouldn't
// quote, a payout bounced. Nobody chose it, and it needs fixing.
//
// An ACTION is a person choosing something: sending a payout, resetting a
// password, upholding a report. Nothing is wrong, but months later you need to
// know who did it.
//
// Mixing them produces a feed where the important failures are buried under
// routine clicks, so they live in separate collections and separate tabs.

export type LogArea =
  | "payment"
  | "payout"
  | "shipping"
  | "kyc"
  | "email"
  | "auth"
  | "staff"
  | "order"
  | "system";

export const LOG_AREAS: { key: LogArea; label: string }[] = [
  { key: "payment", label: "Payments" },
  { key: "payout", label: "Payouts" },
  { key: "shipping", label: "Shipping" },
  { key: "kyc", label: "Identity" },
  { key: "email", label: "Email" },
  { key: "auth", label: "Sign-in" },
  { key: "staff", label: "Staff" },
  { key: "order", label: "Orders" },
  { key: "system", label: "System" },
];

export type LogSeverity = "warning" | "error" | "critical";

export const SEVERITY_ORDER: LogSeverity[] = ["warning", "error", "critical"];

export interface ErrorLog {
  id: string;
  at: number;
  area: LogArea;
  severity: LogSeverity;
  /** Short stable identifier for this failure, e.g. "billplz.bill_create_failed". */
  code: string;
  message: string;
  /** Non-sensitive context: ids, amounts, status codes. Never card or bank data. */
  context?: Record<string, unknown>;
  /** What the operator should do about it, when there's a known answer. */
  hint?: string;
  orderId?: string | null;
  userUid?: string | null;
  payoutId?: string | null;
  resolvedAt?: number | null;
  resolvedBy?: string | null;
}

export interface ActionLog {
  id: string;
  at: number;
  area: LogArea;
  /** Verb phrase, e.g. "payout.executed", "staff.created". */
  action: string;
  /** Staff ID (A0001) or a marketplace uid for legacy admin actions. */
  actor: string;
  actorName?: string | null;
  /** What was acted on, for filtering: an order id, payout id, staff id. */
  subject?: string | null;
  summary: string;
  detail?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Keys whose values must never reach a log document.
 *
 * Logs are the one place where "just record everything, we'll need it later"
 * feels reasonable and is actively harmful: they're long-lived, widely read,
 * and rarely audited. Anything matching is dropped before the write.
 */
const REDACT = [
  "password",
  "passwordhash",
  "identitynumber",
  "ic",
  "bankaccountnumber",
  "token",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "sessiontoken",
  "signature",
];

/** How deep to descend before collapsing to a marker. */
const MAX_DEPTH = 2;

const shouldRedact = (key: string): boolean => {
  const k = key.toLowerCase().replace(/[^a-z]/g, "");
  return REDACT.some((r) => k.includes(r));
};

/**
 * Strip secrets and bound the size of a context object.
 *
 * Depth-limited because an accidentally-passed error object can carry a whole
 * request/response tree, and a log entry that costs a page of Firestore
 * document is a log entry someone eventually turns off.
 */
export const sanitiseContext = (
  input: unknown,
  depth = 0,
): Record<string, unknown> | undefined => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (n++ >= 30) break;
    if (shouldRedact(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v === null || v === undefined) continue;
    if (typeof v === "string") out[k] = v.length > 500 ? v.slice(0, 500) + "…" : v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = `[${v.length} items]`;
    else if (depth < MAX_DEPTH) {
      const nested = sanitiseContext(v, depth + 1);
      // A marker, not a drop: past the depth limit the key still tells the
      // reader something was there. Returning undefined here would propagate
      // upward and discard the whole context, so an error object nested one
      // level too deep would log with no context at all — the opposite of
      // what a log is for.
      out[k] = nested ?? "[nested]";
    } else {
      out[k] = "[nested]";
    }
  }
  return Object.keys(out).length ? out : undefined;
};
