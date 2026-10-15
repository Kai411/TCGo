// One counter sale — the receipt.
//
// Ownership is checked against the document's own sellerUid rather than any
// id the caller supplies, so a guessed sale id returns 404 rather than
// somebody else's takings.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { loadSellerSale } from "~/server/utils/seller-sales";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const id = getRouterParam(event, "id") || "";
  if (!id || id.includes("/")) {
    throw createError({ statusCode: 400, message: "Sale id required" });
  }

  // Union of receipt and inventory, so a hand-marked sale ("item:<id>") opens
  // just like a POS receipt does.
  const sale = await loadSellerSale(getAdminFirestore(), caller.uid, id);

  // Same response for "doesn't exist" and "isn't yours" — a distinct 403
  // would confirm the id belongs to a real sale.
  if (!sale) throw createError({ statusCode: 404, message: "Sale not found" });

  return {
    id: sale.id,
    lines: sale.lines,
    subtotal: sale.subtotal,
    discountTotal: sale.discountTotal,
    total: sale.total,
    status: sale.status,
    method: sale.method,
    createdAt: sale.createdAt,
    paidAt: sale.paidAt ?? null,
    failedReason: sale.failedReason ?? null,
    origin: sale.origin,
    channel: sale.channel,
    orderId: sale.orderId ?? null,
  };
});
