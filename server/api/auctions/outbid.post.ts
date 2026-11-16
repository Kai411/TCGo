// Tell bidders they've been outbid.
//
// /api/auctions/bid now does this itself after every bid. This route stays
// for pages opened before that change, and for a manual nudge; it trusts
// nothing from the caller beyond the auction id (see server/utils/auction-outbid.ts).

import { requireUser } from "~/server/utils/auth";
import { tellOutbidders } from "~/server/utils/auction-outbid";

export default defineEventHandler(async (event) => {
  await requireUser(event);
  const { auctionId } = (await readBody(event)) as { auctionId?: string };
  const id = String(auctionId || "");
  if (!id || /[.#$\[\]\/]/.test(id)) throw createError({ statusCode: 400, message: "auctionId required" });
  return { ok: true, told: await tellOutbidders(id) };
});
