// Cash at the counter — no provider involved.
//
// This is the old "Mark paid" button, moved server-side so a cash sale records
// the same posSales row as a QR sale. Without that, discounts given on cash
// sales would be invisible to the dashboard, which is most of them.
//
// Availability is still checked: the card may have sold online while the
// seller was counting notes.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import {
  checkStockAvailability,
  settleItems,
  releaseExpiredReservations,
} from "~/server/utils/pos-reservations";
import { posTotals, round2 } from "~/shared/pos-sale";
import type { PosSaleLine } from "~/shared/pos-sale";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as {
    lines?: Array<{ itemId: string; soldPrice: number }>;
  };

  if (!Array.isArray(body.lines) || !body.lines.length) {
    throw createError({ statusCode: 400, message: "Nothing to sell" });
  }
  if (body.lines.length > 200) {
    throw createError({ statusCode: 400, message: "Too many items in one sale" });
  }

  const db = getAdminFirestore();
  await releaseExpiredReservations(db, caller.uid).catch(() => {});

  const itemIds = body.lines.map((l) => l.itemId);
  const blocked = await checkStockAvailability(db, itemIds, caller.uid);
  if (blocked.length) {
    throw createError({
      statusCode: 409,
      message:
        blocked.length === 1
          ? `${blocked[0]!.cardName} is no longer available.`
          : `${blocked.length} items are no longer available.`,
      data: { blocked },
    });
  }

  const snaps = await Promise.all(
    itemIds.map((id) => db.collection("inventory").doc(id).get()),
  );

  const lines: PosSaleLine[] = [];
  for (const [i, snap] of snaps.entries()) {
    if (!snap.exists) throw createError({ statusCode: 404, message: "Item no longer exists" });
    const item = snap.data() as any;
    if (item.userUid !== caller.uid) {
      throw createError({ statusCode: 403, message: "That item isn't yours to sell" });
    }
    const asked = Number(body.lines![i]!.soldPrice);
    if (!Number.isFinite(asked) || asked < 0) {
      throw createError({ statusCode: 400, message: "Invalid price" });
    }
    lines.push({
      itemId: snap.id,
      cardId: item.listingId ?? null,
      cardName: item.cardName ?? "Card",
      sub: [item.setName, item.number].filter(Boolean).join(" · "),
      image: item.primaryImage ?? "",
      listPrice: round2(Number(item.listPrice) || 0),
      soldPrice: round2(asked),
    });
  }

  const totals = posTotals(lines);
  const now = Date.now();

  const saleRef = db.collection("posSales").doc();
  await saleRef.set({
    sellerUid: caller.uid,
    lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    total: totals.total,
    status: "paid",
    method: "cash",
    createdAt: now,
    updatedAt: now,
    paidAt: now,
  });

  await settleItems(db, {
    saleId: saleRef.id,
    lines: lines.map((l) => ({ itemId: l.itemId, soldPrice: l.soldPrice })),
  });

  return {
    saleId: saleRef.id,
    total: totals.total,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    count: lines.length,
  };
});
