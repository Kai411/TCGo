// Didit verification webhook — the ONLY authoritative source of a KYC decision.
//
// The hosted flow's completion callback and the SDK's onComplete tell you the
// user finished, not that they passed; both run in a browser the user
// controls. Nothing here trusts either.
//
// Order matters and is enforced below: freshness → signature → idempotency →
// apply → 2xx. Doing idempotency before the signature check would let an
// unauthenticated caller burn event ids.

import crypto from "node:crypto";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { noteError } from "~/server/utils/oplog";
import {
  DIDIT_WEBHOOK_MAX_SKEW_SECONDS,
  kycStatusFor,
} from "~/shared/didit";

/**
 * Whole-number floats (1.0) → integers (1), recursively, matching Didit's
 * server-side canonicalisation.
 *
 * In JavaScript this is inert: JSON.parse("1.0") already yields 1 and
 * Number.isInteger(1) is true, so the guard never fires. It's kept because it
 * documents the canonical form the HMAC is computed over — if this ever runs
 * somewhere with a real float/int distinction, the intent survives.
 */
const shortenFloats = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)]),
    );
  }
  if (typeof v === "number" && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
};

/** Recursive lexicographic key sort. Array order is significant and preserved. */
const sortKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const secret = config.diditWebhookSecret as string;
  if (!secret) {
    console.error("[didit webhook] NUXT_DIDIT_WEBHOOK_SECRET not set — refusing");
    throw createError({ statusCode: 500, message: "Webhook not configured" });
  }

  const raw = (await readRawBody(event, "utf8")) || "";
  const signature = getHeader(event, "x-signature-v2") || "";
  const timestamp = Number(getHeader(event, "x-timestamp"));

  // 1. Freshness. Bounded both ways — a far-future timestamp is as suspicious
  //    as an old one, and would otherwise never expire.
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(Date.now() / 1000 - timestamp) > DIDIT_WEBHOOK_MAX_SKEW_SECONDS
  ) {
    throw createError({ statusCode: 401, message: "Stale timestamp" });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw createError({ statusCode: 400, message: "Malformed body" });
  }

  // 2. Canonicalise exactly as Didit signed it, then 3. constant-time compare.
  const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));
  const expected = crypto
    .createHmac("sha256", secret)
    .update(canonical, "utf8")
    .digest("hex");

  // timingSafeEqual throws on a length mismatch, so the length guard has to
  // come first — it leaks only the length, which is fixed for hex SHA-256.
  const ok =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!ok) {
    console.error("[didit webhook] bad signature", { sessionId: parsed?.session_id });
    noteError({
      area: "kyc",
      severity: "critical",
      code: "didit.bad_signature",
      message: "A Didit webhook arrived with an invalid signature and was rejected.",
      context: { sessionId: parsed?.session_id },
      hint: "Either the webhook secret is out of step with Didit's dashboard, or someone is posting forged verification results.",
    });
    throw createError({ statusCode: 401, message: "Invalid signature" });
  }

  const db = getAdminFirestore();
  const eventId: string | undefined = parsed.event_id;
  const uid: string | undefined = parsed.vendor_data;
  const status: string = parsed.status;

  // 4. Idempotency. `create` fails if the document exists, which makes the
  //    claim atomic without a transaction — Didit retries twice on non-2xx and
  //    can also redeliver from the console.
  if (eventId) {
    try {
      await db.collection("webhookEvents").doc(`didit_${eventId}`).create({
        provider: "didit",
        sessionId: parsed.session_id ?? null,
        status: status ?? null,
        receivedAt: Date.now(),
      });
    } catch {
      return { ok: true, deduped: true };
    }
  }

  // 5. Apply. vendor_data is our Firebase uid — set server-side at session
  //    creation, so it can't be spoofed by the client.
  const next = kycStatusFor(status);
  if (!uid || next === null) {
    return { ok: true, ignored: `status ${status}` };
  }

  // A vendor_data Firestore can't address is a permanent failure: Didit would
  // retry twice and then drop the delivery, and every retry would fail the
  // same way. Log it and 2xx so the retry budget isn't spent on something
  // only a code change can fix. (Firestore reserves __*__ ids and forbids "/".)
  if (uid.includes("/") || /^__.*__$/.test(uid) || uid.length > 1500) {
    console.error("[didit webhook] unusable vendor_data, dropping", {
      sessionId: parsed.session_id,
    });
    noteError({
      area: "kyc",
      severity: "error",
      code: "didit.unusable_vendor_data",
      message: "A Didit verification result carried a uid we can't address, so it was dropped.",
      context: { sessionId: parsed.session_id },
      hint: "That person's verification will never apply. Have them start again.",
    });
    return { ok: true, ignored: "unusable vendor_data" };
  }

  const now = Date.now();
  const patch: Record<string, unknown> = {
    kycStatus: next,
    kycStatusAt: now,
    kycSessionId: parsed.session_id ?? null,
  };

  if (next === "verified") {
    patch.kycVerifiedAt = now;
    // Store the verified name only. It's genuinely useful — it's what the
    // payout account holder should match — whereas the document images, IC,
    // race and religion Didit also returns are things we have no business
    // keeping. Didit holds the evidence; we keep the pointer and the decision.
    const idv = parsed.decision?.id_verifications?.[0];
    if (idv) {
      const fullName = [idv.first_name, idv.last_name].filter(Boolean).join(" ").trim();
      if (fullName) patch.kycVerifiedName = fullName;
      if (idv.document_type) patch.kycDocumentType = idv.document_type;
      if (idv.issuing_state) patch.kycIssuingState = idv.issuing_state;
    }
  }

  if (next === "declined") {
    // Keep the reason terse and non-sensitive; the full decision stays at Didit.
    const warnings = parsed.decision?.id_verifications?.[0]?.warnings;
    patch.kycDeclineReason =
      Array.isArray(warnings) && warnings.length
        ? String(warnings[0]?.risk ?? warnings[0]?.description ?? "").slice(0, 200)
        : null;
  }

  // Merge so a webhook for a user who somehow has no profile document can't
  // fail the whole delivery and trigger pointless retries.
  await db.collection("users").doc(uid).set(patch, { merge: true });

  // 6. 2xx promptly. Nothing slow happens above; if that changes, queue it.
  return { ok: true, status: next };
});
