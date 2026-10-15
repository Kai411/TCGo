// Start a counter payment: record the sale, hold the stock, get a DuitNow QR.
//
// Order matters. The hold is taken BEFORE the charge exists, so there is no
// window where a customer is looking at a live QR for a card that has just
// been sold online. If the provider then refuses, the hold is released again —
// a seller who can't take payment must not be left with locked stock.
//
// Prices come from the request because haggling is the whole point of a
// counter sale, but `listPrice` is read from inventory so the discount the
// dashboard reports is the real one and not one the client made up.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import {
  reserveItems,
  releaseItems,
  releaseExpiredReservations,
  StockUnavailableError,
} from "~/server/utils/pos-reservations";
import {
  posPaymentProvider,
  isPosPaymentConfigured,
  isPlatformMode,
  isSellerConnected,
} from "~/server/utils/pos-payment";
import { sellerMerchant } from "~/server/utils/pos-merchant";
import { posTotals, toSen, round2 } from "~/shared/pos-sale";
import { posPlatformFee, POS_PLATFORM_RATE } from "~/shared/pricing";
import type { PosSaleLine, PosPaymentMethod } from "~/shared/pos-sale";
import { noteError } from "~/server/utils/oplog";

interface Body {
  lines?: Array<{ itemId: string; soldPrice: number }>;
  method?: PosPaymentMethod;
}

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as Body;
  const method: PosPaymentMethod = body.method ?? "duitnow_qr";

  if (method === "tap_to_pay") {
    throw createError({ statusCode: 400, message: "Tap to pay isn't available yet" });
  }
  if (!Array.isArray(body.lines) || !body.lines.length) {
    throw createError({ statusCode: 400, message: "Nothing to charge" });
  }
  if (body.lines.length > 200) {
    throw createError({ statusCode: 400, message: "Too many items in one sale" });
  }
  if (method === "duitnow_qr" && !isPosPaymentConfigured()) {
    throw createError({
      statusCode: 503,
      message: "QR payments aren't set up for this shop yet. Take cash and mark the sale paid.",
    });
  }

  const db = getAdminFirestore();
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

  // TCGo's 0.8% of this sale. Recorded on the row alongside the rate it was
  // struck at, for the same reason online orders carry platformFeeRate: the
  // fee a sale was charged is history, and re-deriving it from a constant
  // would restate every past sale the day that constant moves.
  const platformFee = posPlatformFee(totals.total);

  const now = Date.now();
  const saleRef = db.collection("posSales").doc();
  await saleRef.set({
    sellerUid: caller.uid,
    lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    total: totals.total,
    platformFee,
    platformFeeRate: POS_PLATFORM_RATE,
    status: "awaiting_payment",
    method,
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

  // ── Ask the acquirer for a QR ─────────────────────────────────────────
  const config = useRuntimeConfig();
  const siteUrl = (config.public.siteUrl as string) || getRequestURL(event).origin;

  // The seller's own HitPay account, so the money lands in their bank
  // rather than TCGo's.
  const merchant = await sellerMerchant(db, caller.uid);

  // Once TCGo runs as a platform, an unconnected seller must NOT be
  // charged: the money would settle into the platform's account instead
  // of the shop's. Refusing is the only safe answer — taking the payment
  // and reconciling later means holding someone else's takings.
  //
  // In single-account mode (no platform key) there is only one shop and
  // its key is the configured one, so this doesn't apply.
  if (isPlatformMode() && !isSellerConnected(merchant)) {
    // Release before refusing — the hold is already taken by this point.
    await releaseItems(db, saleRef.id).catch(() => {});
    await saleRef.update({
      status: "cancelled",
      failedReason: "Shop has no HitPay account connected",
      updatedAt: Date.now(),
    });
    throw createError({
      statusCode: 409,
      message:
        "Connect your HitPay account before taking QR payments, so the money reaches your bank. Take cash for now.",
    });
  }

  try {
    const charge = await posPaymentProvider().createDuitNowCharge({
      amountSen: toSen(totals.total),
      // Split only when the money is landing in someone else's account.
      // On the platform's own account there is nothing to split.
      commissionSen: isSellerConnected(merchant) ? toSen(platformFee) : 0,
      reference: saleRef.id,
      description: `${lines.length} card${lines.length === 1 ? "" : "s"} · TCGo counter sale`,
      webhookUrl: `${siteUrl}/api/pos/webhook`,
      merchant,
    });

    await saleRef.update({ chargeId: charge.chargeId, updatedAt: Date.now() });

    return {
      saleId: saleRef.id,
      chargeId: charge.chargeId,
      qrPayload: charge.qrPayload,
      url: charge.url ?? null,
      total: totals.total,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      platformFee,
      reservedUntil,
    };
  } catch (e: any) {
    // No QR means no payment. Give the stock back immediately rather than
    // leaving it locked for the full reservation window.
    await releaseItems(db, saleRef.id).catch(() => {});
    await saleRef.update({
      status: "failed",
      failedReason: e?.message || "Payment provider error",
      updatedAt: Date.now(),
    });
    noteError({
      area: "payment",
      severity: "error",
      code: "pos.charge_create_failed",
      message: `Couldn't create a counter-payment QR: ${e?.message || e}`,
      userUid: caller.uid,
      error: e,
      context: { saleId: saleRef.id, totalMyr: totals.total },
      hint: "The seller has a customer waiting. Stock was released. Check the HitPay merchant account has DuitNow QR enabled.",
    });
    throw createError({
      statusCode: 502,
      message: "Couldn't reach the payment provider. Take cash, or try again.",
    });
  }
});
