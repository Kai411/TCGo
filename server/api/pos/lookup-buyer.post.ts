// Resolve a scanned buyer QR to an email address, for a receipt.
//
// This hands one person's email to another person, so it is deliberately
// narrow:
//
//   - The caller must be signed in. An unauthenticated scan gets nothing.
//   - It returns the email and a display name. Nothing else on the profile —
//     not the address, not the phone, not what they have bought before.
//   - Every lookup is logged with both uids, so "who asked for this address"
//     has an answer.
//
// The buyer consented by showing the code — that is what a QR at a counter
// is — but consent to one receipt is not consent to a contact list, which is
// why this returns a single record and never a search.

import { getAdminFirestore, getAdminAuth } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { parseBuyerQr } from "~/shared/buyer-qr";
import { noteAction } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { code } = (await readBody(event)) as { code?: string };

  const uid = parseBuyerQr(code);
  if (!uid) {
    throw createError({
      statusCode: 400,
      message: "That isn't a TCGo customer code.",
    });
  }

  const db = getAdminFirestore();
  const auth = getAdminAuth();

  // Auth is the authority on the address — the profile document mirrors it and
  // could be stale, and a receipt sent to a stale address is one the customer
  // never sees.
  const user = await auth.getUser(uid).catch(() => null);
  if (!user?.email) {
    throw createError({
      statusCode: 404,
      message: "That code doesn't match a TCGo account with an email address.",
    });
  }

  const snap = await db.collection("users").doc(uid).get();
  const profile = (snap.data() ?? {}) as Record<string, unknown>;
  const name =
    (typeof profile.customName === "string" && profile.customName) ||
    user.displayName ||
    "";

  noteAction({
    area: "pos",
    action: "pos.buyer_looked_up",
    actor: caller.uid,
    subject: uid,
    summary: "Scanned a customer code to send a receipt.",
    event,
  });

  return { uid, email: user.email, name };
});
