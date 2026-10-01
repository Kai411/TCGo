import { requireAdmin } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { releasePayout } from "~/server/utils/payouts";

// Pay the seller for a delivered (or dispute-resolved) Buyer Protection order.
// Body: { force?: boolean } — force skips the Buyer Protection waiting period.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = getRouterParam(event, "id")!;
  const body = (await readBody<{ force?: boolean }>(event).catch(() => null)) ?? {};
  return await releasePayout(getAdminFirestore(), id, admin.uid, { force: body.force === true });
});
