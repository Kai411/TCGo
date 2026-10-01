import { requireCaller } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { updateRegion } from "~/server/utils/orders";

export default defineEventHandler(async (event) => {
  const caller = await requireCaller(event);
  const id = getRouterParam(event, "id")!;
  const body = await readBody<{ region?: unknown }>(event);
  if (body?.region !== "WM" && body?.region !== "EM") {
    throw createError({ statusCode: 400, message: "region must be WM or EM" });
  }
  const order = await updateRegion(getAdminFirestore(), id, body.region, caller);
  return { order };
});
