import { requireAdmin } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { sweepFees } from "~/server/utils/payouts";

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  return await sweepFees(getAdminFirestore(), admin.uid);
});
