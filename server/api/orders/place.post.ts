// Place orders from the cart (or a Buy Now), one per seller. Ledger stage 2:
// the browser sends only which cards it wants; prices come from the listings,
// postage from a server quote to the buyer's saved delivery address, and the
// order documents are written here. Firestore rules no longer let a browser
// create an order or touch its money fields.
//
// A buyer who already has an unpaid order with a seller gets the new cards
// added to it instead of a second order, as before.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { getUserProfile } from "~/server/utils/user-profile";
import { quoteShippingForBuyer, type BuyerShippingQuote } from "~/server/utils/shipping";
import { billplzDeleteBill } from "~/server/utils/billplz";
import { isAvailable } from "~/shared/card-availability";
import { isSellingSuspended } from "~/shared/moderation";
import { regionForState, shippingQuoteKey } from "~/shared/shipping";
import { lineItemsFromListings, roundRM, type ListingPriceView } from "~/shared/order-price";

const MAX_CARDS = 40;

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as { cardIds?: unknown };
  const cardIds = Array.isArray(body?.cardIds)
    ? [...new Set(body.cardIds.filter((id): id is string => typeof id === "string" && !!id && id.length <= 128))]
    : [];
  if (!cardIds.length || cardIds.length > MAX_CARDS) {
    throw createError({ statusCode: 400, message: `Choose between 1 and ${MAX_CARDS} cards` });
  }

  const db = getAdminFirestore();
  const buyer = (await getUserProfile(db, caller.uid)) as any;
  if (!buyer?.deliveryPostcode || !buyer?.deliveryState) {
    throw createError({ statusCode: 400, message: "Add a delivery address before placing an order" });
  }
  const destination = {
    address1: buyer.deliveryAddress1 || "",
    city: buyer.deliveryCity || "",
    state: buyer.deliveryState,
    postcode: String(buyer.deliveryPostcode),
  };

  // ── The listings ────────────────────────────────────────────────────
  const snaps = await db.getAll(...cardIds.map((id) => db.collection("cards").doc(id)));
  const listings = new Map<string, ListingPriceView>();
  for (const s of snaps) {
    const card = s.data() as any;
    if (!s.exists || !isAvailable(card)) {
      throw createError({
        statusCode: 409,
        message: `${card?.cardName ?? "A card in your cart"} is no longer available.`,
        data: { unavailable: [s.id] },
      });
    }
    if (card.sellerUid === caller.uid) {
      throw createError({ statusCode: 400, message: "You can't buy your own listing." });
    }
    listings.set(s.id, card);
  }

  const bySeller = new Map<string, string[]>();
  for (const id of cardIds) {
    const seller = String((listings.get(id) as any).sellerUid ?? "");
    if (!seller) throw createError({ statusCode: 409, message: "A card in your cart has no seller." });
    bySeller.set(seller, [...(bySeller.get(seller) ?? []), id]);
  }

  // Sellers TCGo has suspended can't take orders.
  const sellerProfiles = await db.getAll(...[...bySeller.keys()].map((uid) => db.collection("users").doc(uid)));
  for (const s of sellerProfiles) {
    if (isSellingSuspended(s.data() as any)) {
      throw createError({ statusCode: 403, message: "One of these sellers can't take orders right now." });
    }
  }

  // The buyer's unpaid cart orders, to add to rather than duplicate.
  const mine = await db.collection("compiledOrders").where("buyerUid", "==", caller.uid).get();
  const openBySeller = new Map<string, { id: string; [k: string]: any }>();
  for (const d of mine.docs) {
    const o = d.data() as any;
    if (o.status === "pending" && !o.auctionId && !openBySeller.has(o.sellerUid)) {
      openBySeller.set(o.sellerUid, { ...o, id: d.id });
    }
  }

  // ── Price every order before writing any ────────────────────────────
  const region = regionForState(destination.state);
  const addressKey = shippingQuoteKey(destination);
  const planned: { sellerUid: string; open: any | null; items: any[]; subtotal: number; quote: BuyerShippingQuote }[] = [];
  for (const [sellerUid, ids] of bySeller) {
    const open = openBySeller.get(sellerUid) ?? null;
    const wanted = [...(open?.items ?? []).map((i: any) => ({ cardId: i?.cardId })), ...ids.map((cardId) => ({ cardId }))];
    // Cards already on the open order are re-read too: their price is the
    // listing's, not whatever the order document says.
    const missing = wanted.map((w) => w.cardId).filter((id) => id && !listings.has(id));
    if (missing.length) {
      const extra = await db.getAll(...missing.map((id: string) => db.collection("cards").doc(id)));
      for (const s of extra) if (s.exists && isAvailable(s.data() as any)) listings.set(s.id, s.data() as any);
    }
    const priced = lineItemsFromListings(
      wanted.filter((w) => listings.has(w.cardId)),
      listings,
      sellerUid,
    );
    if (!priced.ok) throw createError({ statusCode: 409, message: "A card in your cart can't be ordered right now." });

    const quoted = await quoteShippingForBuyer(db, {
      buyerUid: caller.uid,
      sellerUid,
      itemCount: priced.items.length,
      destination,
    });
    if (!quoted.available) {
      throw createError({
        statusCode: 400,
        message:
          quoted.reason === "no_pickup_address"
            ? "A seller in your cart hasn't set a pickup address yet."
            : "No courier serves one of these sellers to your address right now.",
      });
    }
    planned.push({ sellerUid, open, items: priced.items, subtotal: priced.subtotal, quote: quoted.quote });
  }

  // ── Write ───────────────────────────────────────────────────────────
  const now = Date.now();
  const buyerName = buyer.customName || buyer.displayName || caller.name || "Buyer";
  const batch = db.batch();
  const results: any[] = [];
  const staleBills: string[] = [];
  for (const p of planned) {
    const shipping = roundRM(p.quote.shipping);
    const money = {
      items: p.items,
      subtotal: p.subtotal,
      shippingWM: shipping,
      shippingEM: shipping,
      region,
      shipping,
      total: roundRM(p.subtotal + shipping),
      shippingQuoted: true,
      shippingQuotedFor: addressKey,
      shippingCourier: p.quote.courier,
      shippingServiceId: p.quote.serviceId,
      shippingServiceCode: p.quote.serviceCode,
      shippingQuotedRate: p.quote.quotedRate,
      shippingWeightKg: p.quote.weightKg,
      // Recorded so the payment webhook folds this into the parcel the buyer
      // already paid postage on (server/utils/join-parcel.ts re-checks it).
      joinsOrderId: p.quote.joinsOrderId,
      pricedBy: "server",
    };
    if (p.open) {
      // An earlier bill was for the smaller order; it must not be payable.
      if (p.open.billplzBillId) staleBills.push(p.open.billplzBillId);
      const patch = { ...money, billplzBillId: null, billplzAmountSen: null };
      batch.update(db.collection("compiledOrders").doc(p.open.id), patch);
      results.push({ ...p.open, ...patch });
    } else {
      const ref = db.collection("compiledOrders").doc();
      const sellerName = String((listings.get(p.items[0].cardId) as any)?.seller ?? "Seller");
      const order = {
        id: ref.id,
        buyerUid: caller.uid,
        buyerName,
        buyerEmail: caller.email || buyer.email || "",
        sellerUid: p.sellerUid,
        sellerName,
        ...money,
        status: "pending",
        paymentMethod: "billplz",
        createdAt: now,
      };
      batch.set(ref, order);
      results.push(order);
    }
  }
  await batch.commit();
  await Promise.all(staleBills.map((id) => billplzDeleteBill(id).catch(() => {})));

  return { orders: results };
});
