import { requireCaller } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { transitionOrder, USER_TARGETS } from "~/server/utils/orders";
import type { CompiledOrderStatus } from "~/utils/orders";

// Move an order to a new status as its buyer, seller or an admin.
// Body: { to, trackingNumber?, carrier?, reason? }
export default defineEventHandler(async (event) => {
  const caller = await requireCaller(event);
  const id = getRouterParam(event, "id")!;
  const body = await readBody<Record<string, unknown>>(event);
  const to = body?.to as CompiledOrderStatus;
  if (!USER_TARGETS.includes(to)) {
    throw createError({ statusCode: 400, message: "Unsupported status" });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const order = await transitionOrder(getAdminFirestore(), id, to, caller, {
    trackingNumber: str(body.trackingNumber),
    carrier: str(body.carrier),
    reason: str(body.reason),
  });
  return { order };
});
