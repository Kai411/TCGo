// A seller's concluded sales, both channels.
//
// Server-side because posSales has no Firestore rule granting client reads —
// deliberately: it's written entirely by the POS routes through the Admin SDK,
// and a sale carries what every card actually went for, which is the seller's
// margin and nobody else's business.
//
// Returns the window's sales plus the summaries the page renders, computed
// here so the list and the headline figures can never disagree.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { loadSellerSales } from "~/server/utils/seller-sales";
import {
  summariseByMethod,
  summariseByPeriod,
  summariseSales,
  topCards,
} from "~/shared/sales-summary";
import type { PosSale } from "~/shared/pos-sale";

/** Enough for a busy month at a counter; paged below that. */
const MAX_SCAN = 500;
const PAGE = 50;

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const q = getQuery(event);
  const before = Number(q.before) || null;
  const status = typeof q.status === "string" && q.status !== "all" ? q.status : null;

  const db = getAdminFirestore();
  const all = await loadSellerSales(db, caller.uid);

  // Summaries cover everything, not the filtered page — narrowing to
  // "cancelled" shouldn't make the day's takings read zero.
  const filtered = status ? all.filter((s) => s.status === status) : all;
  const start = before ? filtered.findIndex((s) => (s.paidAt ?? s.createdAt) < before) : 0;
  const page = filtered.slice(Math.max(0, start), Math.max(0, start) + PAGE);

  return {
    sales: page.map((s) => ({
      // chargeId and qrPayload are provider plumbing — the browser has no use
      // for either, and a live QR payload is a thing worth not shipping round.
      id: s.id,
      lines: s.lines,
      subtotal: s.subtotal,
      discountTotal: s.discountTotal,
      total: s.total,
      status: s.status,
      method: s.method,
      createdAt: s.createdAt,
      paidAt: s.paidAt ?? null,
      failedReason: s.failedReason ?? null,
      origin: s.origin,
      // The page filters on channel and links online rows at orderId. Omitting
      // them made the channel filter match nothing and every online sale link
      // to a counter receipt that doesn't exist.
      channel: s.channel,
      orderId: s.orderId ?? null,
      buyerName: s.buyerName ?? null,
    })),
    periods: summariseByPeriod(all),
    window: summariseSales(all),
    byMethod: summariseByMethod(all),
    topCards: topCards(all),
    nextBefore:
      page.length === PAGE
        ? page[page.length - 1]!.paidAt ?? page[page.length - 1]!.createdAt
        : null,
    truncated: false,
  };
});
