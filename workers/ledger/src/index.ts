// tcgo-ledger: the only thing that talks to the ledger database.
//
// Netlify functions call it with signed, named actions; it never accepts raw
// SQL, and it holds no Billplz API key, so it can record money but never send
// it. Design: https://claude.ai/artifact/4Yk63zjf7reDKwEK2kMAdV (section 0).

import type { D1Like } from "./d1.ts";
import { verifyBillplzParams, verifyRequest } from "./crypto.ts";
import { shadowPayment, summary, validateShadowInput } from "./shadow.ts";

export interface Env {
  DB: D1Like;
  /** Shared with Netlify as NUXT_LEDGER_WORKER_SECRET. */
  LEDGER_WORKER_SECRET: string;
  /** Same value as Netlify's NUXT_BILLPLZ_X_SIGNATURE_KEY. */
  BILLPLZ_X_SIGNATURE_KEY: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const MAX_BODY = 64 * 1024;

export const handle = async (request: Request, env: Env, now = Date.now()): Promise<Response> => {
  const url = new URL(request.url);

  // Unsigned and data-free, so kai can check the Worker is up.
  if (request.method === "GET" && url.pathname === "/health") return json(200, { ok: true });
  if (request.method !== "POST") return json(405, { error: "method not allowed" });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: "body too large" });
  const auth = await verifyRequest(
    env.LEDGER_WORKER_SECRET,
    request.headers.get("x-tcgo-timestamp"),
    request.headers.get("x-tcgo-signature"),
    raw,
    now,
  );
  if (!auth.ok) return json(401, { error: auth.reason });

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid json" });
  }

  try {
    if (url.pathname === "/v1/shadow-payment") {
      // A leaked Netlify secret alone can't record a payment: Billplz's own
      // signature on the forwarded callback must check out too.
      const bill = await verifyBillplzParams(body?.callback, env.BILLPLZ_X_SIGNATURE_KEY);
      if (!bill.ok) return json(403, { error: bill.reason });
      const { x_signature: _sig, ...signed } = bill.params;
      if (signed.paid !== "true") return json(400, { error: "callback is not a paid bill" });
      const input = {
        billId: signed.id,
        paidSen: body?.paidSen,
        billplzPaidAt: signed.paid_at ?? "",
        callback: signed,
        order: body?.order,
      };
      const invalid = validateShadowInput(input);
      if (invalid) return json(400, { error: invalid });
      return json(200, await shadowPayment(env.DB, input, now));
    }

    if (url.pathname === "/v1/summary") {
      const from = Number(body?.fromMs);
      const to = Number(body?.toMs);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 40 * 864e5) {
        return json(400, { error: "fromMs/toMs must span at most 40 days" });
      }
      return json(200, await summary(env.DB, from, to));
    }

    return json(404, { error: "unknown action" });
  } catch (e: any) {
    const message = String(e?.message ?? e);
    // A concurrent retry of the same callback loses the race on a unique key.
    if (/UNIQUE constraint failed: (provider_events\.dedupe_key|payments\.provider_bill_id|ledger_transactions\.source_key)/.test(message)) {
      return json(200, { outcome: "already_recorded", orderId: "", conflicts: [] });
    }
    // Rule names from the schema's asserts and triggers are safe to return;
    // anything else stays in the Worker's logs.
    const rule = message.match(/(ledger_unbalanced|ledger_append_only|ledger_party_mismatch|illegal_order_transition|order_amounts_frozen|listing_unavailable|order_state_changed)/);
    console.error("[ledger] action failed", url.pathname, message);
    return json(rule ? 409 : 500, { error: rule ? rule[1] : "ledger error" });
  }
};

export default { fetch: (request: Request, env: Env) => handle(request, env) };
