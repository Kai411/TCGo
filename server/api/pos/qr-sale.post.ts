// Start a counter sale paid to the shop's own QR: record the sale and hold
// the stock while the customer scans and pays.
//
// The QR is the seller's own static one (DuitNow, TNG, a bank's), saved in
// Seller settings. Money goes straight from the customer to the shop; TCGo
// never sees it and cannot confirm it. So the sale stays `awaiting_payment`
// until the seller checks their own app and taps "Mark as paid"
// (mark-paid.post.ts), or backs out (cancel.post.ts).
//
// Order matters. The hold is taken before the QR goes on screen, so there is
// no window where a customer is paying for a card that has just sold online.
//
// Prices come from the request because haggling is the whole point of a
// counter sale, but `listPrice` is read from inventory so the discount the
// dashboard reports is the real one and not one the client made up.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { getUserProfile } from "~/server/utils/user-profile";
import {
  reserveItems,
  releaseExpiredReservations,
  StockUnavailableError,
} from "~/server/utils/pos-reservations";
import { posTotals, round2 } from "~/shared/pos-sale";
import type { PosSaleLine } from "~/shared/pos-sale";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as {
    lines?: Array<{ itemId: string; soldPrice: number }>;
  };

  if (!Array.isArray(body.lines) || !body.lines.length) {
    throw createError({ statusCode: 400, message: "Nothing to charge" });
  }
  if (body.lines.length > 200) {
    throw createError({ statusCode: 400, message: "Too many items in one sale" });
  }

  const db = getAdminFirestore();

  const profile = ((await getUserProfile(db, caller.uid)) ?? {}) as any;
  if (!profile.posPaymentQr) {
    throw createError({
      statusCode: 409,
      message: "Add your shop's payment QR in Seller settings first, or take cash.",
    });
  }

  await releaseExpiredReservations(db, caller.uid).catch(() => {});

  // ── Build the sale from inventory, not from what the client sent ──────
  const itemIds = body.lines.map((l) => l.itemId);
  const snaps = await Promise.all(
    itemIds.map((id) => db.collection("inventory").doc(id).get()),
  );

  const lines: PosSaleLine[] = [];
  for (const [i, snap] of snaps.entries()) {
    if (!snap.exists) {
      throw createError({ statusCode: 404, message: "An item in this sale no longer exists" });
    }
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
  if (totals.total <= 0) {
    throw createError({ statusCode: 400, message: "A QR payment needs a total above RM 0" });
  }

  const now = Date.now();
  const saleRef = db.collection("posSales").doc();
  await saleRef.set({
    sellerUid: caller.uid,
    lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    total: totals.total,
    // An explicit zero, as on cash: the money goes to the shop's own QR, so
    // there is nothing TCGo can bill against.
    platformFee: 0,
    platformFeeRate: 0,
    status: "awaiting_payment",
    method: "shop_qr",
    createdAt: now,
    updatedAt: now,
  });

  // ── Hold the stock ────────────────────────────────────────────────────
  let reservedUntil: number;
  try {
    ({ reservedUntil } = await reserveItems(db, {
      saleId: saleRef.id,
      sellerUid: caller.uid,
      itemIds,
    }));
  } catch (e: any) {
    await saleRef.update({
      status: "cancelled",
      failedReason: e?.message || "Stock unavailable",
      updatedAt: Date.now(),
    });
    if (e instanceof StockUnavailableError) {
      // 409 + the offending items, so the POS can highlight them in place.
      throw createError({
        statusCode: 409,
        message: e.message,
        data: { blocked: e.blocked },
      });
    }
    throw e;
  }
  await saleRef.update({ reservedUntil });

  return {
    saleId: saleRef.id,
    total: totals.total,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    reservedUntil,
  };
});
