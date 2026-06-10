// Billplz payment callback. Verifies the X-Signature, then promotes the
// matching compiled order to `paid`:
//   - status: paid + paidAt
//   - platformFee / sellerPayout / payoutStatus fields (payout rail)
//   - every card in the order marked sold (+ linked inventory items synced)
//
// Uses the Admin SDK (bypasses Firestore rules) — the same pattern as the
// Stripe webhook.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { verifyBillplzSignature } from "~/server/utils/billplz";

// Platform commission on the item subtotal. 0 during beta — the field
// plumbing exists so turning this on later is a one-line change.
const PLATFORM_FEE_PERCENT = 0;

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, string>;
  const get = (k: string) => body[`billplz[${k}]`] ?? "";

  const config = useRuntimeConfig();
  const xSignatureKey = config.billplzXSignatureKey as string;
  if (xSignatureKey) {
    if (!verifyBillplzSignature(body, xSignatureKey)) {
      console.error("[billplz webhook] bad signature");
      throw createError({ statusCode: 403, message: "Invalid signature" });
    }
  } else {
    console.warn("[billplz webhook] NUXT_BILLPLZ_X_SIGNATURE_KEY not set — skipping verification");
  }

  const billId = get("id");
  const paid = get("paid") === "true";
  if (!billId) throw createError({ statusCode: 400, message: "Missing bill id" });
  if (!paid) return { ok: true, ignored: "not paid" };

  const db = getAdminFirestore();
  const orders = await db
    .collection("compiledOrders")
    .where("billplzBillId", "==", billId)
    .limit(1)
    .get();
  if (orders.empty) {
    console.error("[billplz webhook] no order for bill", billId);
    return { ok: true, ignored: "order not found" };
  }
  const orderRef = orders.docs[0].ref;
  const order = orders.docs[0].data() as any;

  // Idempotent — callbacks can retry.
  if (order.status !== "pending") return { ok: true, ignored: `status ${order.status}` };

  const now = Date.now();
  // PLATFORM_FEE_PERCENT is a fraction (e.g. 0.08 = 8%) applied to the item
  // subtotal; shipping passes through to the seller untouched.
  const platformFee =
    Math.round((order.subtotal || 0) * PLATFORM_FEE_PERCENT * 100) / 100;
  const sellerPayout = Math.round(((order.total || 0) - platformFee) * 100) / 100;

  const batch = db.batch();
  batch.update(orderRef, {
    status: "paid",
    paidAt: now,
    platformFee,
    sellerPayout,
    payoutStatus: "pending",
    billplzPaidAt: get("paid_at") || null,
  });
  // Lock the sold cards (mirrors the client-side markConfirmed behavior).
  for (const item of order.items ?? []) {
    if (item?.cardId) {
      batch.update(db.collection("cards").doc(item.cardId), {
        sold: true,
        soldAt: now,
        status: "sold",
      });
    }
  }
  await batch.commit();

  // Sync linked inventory items (listingId → sold, online channel).
  for (const item of order.items ?? []) {
    if (!item?.cardId) continue;
    const inv = await db
      .collection("inventory")
      .where("listingId", "==", item.cardId)
      .get();
    await Promise.all(
      inv.docs.map((d) =>
        d.ref.update({
          status: "sold",
          soldAt: now,
          saleChannel: "online",
          updatedAt: now,
        }),
      ),
    );
  }

  return { ok: true };
});
