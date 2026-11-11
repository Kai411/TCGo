import { getStripe } from "~/server/utils/stripe";
import { requireUser } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";

// Opens the Stripe Customer Portal for the signed-in user's own customer id,
// read from their profile (written only by the webhook). `returnTo` picks
// which of our own pages Stripe sends them back to; anything else is ignored.
const RETURN_PATHS = new Set(["/profile", "/account"]);

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const snap = await getAdminFirestore().collection("users").doc(user.uid).get();
  const customerId = snap.get("stripeCustomerId") as string | undefined;
  if (!customerId) {
    throw createError({ statusCode: 404, message: "No subscription on this account" });
  }

  const body = await readBody<{ returnTo?: string } | undefined>(event).catch(() => undefined);
  const returnTo = RETURN_PATHS.has(body?.returnTo ?? "") ? body!.returnTo! : "/profile";

  const config = useRuntimeConfig();
  const siteUrl = (config.public.siteUrl as string) || getRequestURL(event).origin;
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}${returnTo}`,
  });

  return { url: session.url };
});
