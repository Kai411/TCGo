import { requireCaller } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { createOrders } from "~/server/utils/orders";

// Place orders for the given cards: one order per seller, merged into any
// pending order the buyer already has with that seller. Prices and shipping
// are read from the card documents.
export default defineEventHandler(async (event) => {
  const { token } = await requireCaller(event);
  const body = await readBody<{ cardIds?: unknown; region?: unknown; buyerName?: unknown }>(event);
  const cardIds = Array.isArray(body?.cardIds)
    ? body.cardIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const region = body?.region === "EM" ? "EM" : "WM";
  const buyerName = typeof body?.buyerName === "string" ? body.buyerName : undefined;

  const orders = await createOrders(
    getAdminFirestore(),
    { uid: token.uid, email: token.email, name: token.name },
    { cardIds, region, buyerName },
  );
  return { orders };
});
