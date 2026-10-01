import type { CompiledOrder } from "~/utils/orders";
import { summariseItems, toSen } from "~/utils/orders";
import { requireUser } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { createBill, getBill } from "~/server/utils/billplz";

// Start (or resume) Buyer Protection checkout for a confirmed order. Returns
// the Billplz bill URL to redirect to. The order only becomes "paid" when the
// signed Billplz callback arrives, never from the redirect.
const LOCK_MS = 60_000;

export default defineEventHandler(async (event) => {
  const token = await requireUser(event);
  const id = getRouterParam(event, "id")!;
  const db = getAdminFirestore();
  const ref = db.collection("compiledOrders").doc(id);

  // Claim the right to create a bill so two taps can't create two bills.
  const order = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
    const o = { ...(snap.data() as CompiledOrder), id: snap.id };
    if (o.buyerUid !== token.uid) throw createError({ statusCode: 403, message: "Not your order" });
    if (o.status !== "confirmed") {
      throw createError({ statusCode: 409, message: "The seller needs to confirm this order first" });
    }
    if (o.billplzBillId) return o;
    const lockedAt = (snap.get("billplzCreatingAt") as number | undefined) ?? 0;
    if (Date.now() - lockedAt < LOCK_MS) {
      throw createError({ statusCode: 409, message: "Payment is already being set up, try again shortly" });
    }
    tx.update(ref, { billplzCreatingAt: Date.now() });
    return o;
  });

  if (order.billplzBillId) {
    const bill = await getBill(order.billplzBillId);
    if (bill.paid) return { url: null, alreadyPaid: true };
    if (bill.state === "due") return { url: bill.url };
    throw createError({ statusCode: 409, message: "This bill was cancelled, contact support" });
  }

  // Price check against the live listings: catches orders written before the
  // server owned order creation, and listings repriced after ordering.
  const cardSnaps = await db.getAll(...order.items.map((i) => db.collection("cards").doc(i.cardId)));
  for (const [i, s] of cardSnaps.entries()) {
    const c = s.data();
    const item = order.items[i];
    if (!c || c.sellerUid !== order.sellerUid || toSen(Number(c.price)) !== toSen(item.price)) {
      await ref.update({ billplzCreatingAt: 0 });
      throw createError({
        statusCode: 409,
        message: `${item.cardName}'s listing changed since you ordered. Ask the seller to re-confirm.`,
      });
    }
  }
  const { total } = summariseItems(order.items, order.region);
  const amountSen = toSen(total);

  const config = useRuntimeConfig();
  const siteUrl = (config.public.siteUrl as string) || getRequestURL(event).origin;
  let bill;
  try {
    bill = await createBill({
      email: order.buyerEmail || token.email || "",
      name: order.buyerName || token.name || "TCGo buyer",
      amountSen,
      description: `TCGo order ${order.id.slice(0, 8)} from ${order.sellerName}`,
      callbackUrl: `${siteUrl}/api/payments/billplz/callback`,
      redirectUrl: `${siteUrl}/orders/${order.id}`,
      orderId: order.id,
    });
  } catch (e) {
    await ref.update({ billplzCreatingAt: 0 });
    throw createError({ statusCode: 502, message: "Couldn't reach the payment provider" });
  }

  await ref.update({
    paymentMethod: "billplz",
    billplzBillId: bill.id,
    billplzBillUrl: bill.url,
    amountSen,
    billplzCreatingAt: 0,
  });
  return { url: bill.url };
});
