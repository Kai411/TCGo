// Pure pieces of the ledger shadow (stage 1 of the ledger design). No Nuxt
// globals, so the test runner can import it as is.
//
// Firestore orders hold ringgit as floats; the ledger holds whole sen. The
// conversion happens once, here.

export const toSen = (rm: unknown): number => {
  const n = Number(rm);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export interface ShadowFees {
  platformFee: number;
  feeRate: number;
  sstAmount: number;
  sellerPayout: number;
}

/** The order as server/ledger/shadow.ts expects it. */
export const buildShadowOrder = (orderId: string, order: any, fees: ShadowFees) => {
  const isAuction = !!order?.auctionId;
  const subtotalSen = toSen(order?.subtotal);
  const items = isAuction
    ? [{ listingId: `auction:${order.auctionId}`, cardName: String(order.items?.[0]?.cardName ?? "Auction"), unitPriceSen: subtotalSen }]
    : (order?.items ?? [])
        .filter((i: any) => typeof i?.cardId === "string" && i.cardId)
        .map((i: any) => ({
          listingId: i.cardId,
          cardName: String(i.cardName ?? "Card"),
          unitPriceSen: toSen(i.price),
        }));
  return {
    firestoreId: orderId,
    source: isAuction ? "auction" : "cart",
    auctionId: isAuction ? String(order.auctionId) : null,
    buyerUid: String(order?.buyerUid ?? ""),
    sellerUid: String(order?.sellerUid ?? ""),
    items,
    subtotalSen,
    shippingSen: toSen(order?.shipping),
    totalSen: toSen(order?.total),
    deliveryAddress: order?.deliveryAddress ?? {},
    feeRateBp: Math.round((Number(fees.feeRate) || 0) * 10000),
    platformFeeSen: toSen(fees.platformFee),
    sstSen: toSen(fees.sstAmount),
    sellerNetSen: toSen(fees.sellerPayout),
  };
};
