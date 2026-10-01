import { requireCaller } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { mergeOrders } from "~/server/utils/orders";

export default defineEventHandler(async (event) => {
  const caller = await requireCaller(event);
  const body = await readBody<{ orderIds?: unknown }>(event);
  const ids = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((x): x is string => typeof x === "string")
    : [];
  const id = await mergeOrders(getAdminFirestore(), ids, caller);
  return { id };
});
