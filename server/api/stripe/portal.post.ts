import { getStripe } from "~/server/utils/stripe";
import { requireUser } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";

// Opens the Stripe Customer Portal for the signed-in user's own customer id,
// read from their profile (written only by the webhook).
export default defineEventHandler(async (event) => {
  const token = await requireUser(event);
  const snap = await getAdminFirestore().collection("users").doc(token.uid).get();
  const customerId = snap.get("stripeCustomerId") as string | undefined;
  if (!customerId) {
    throw createError({ statusCode: 404, message: "No subscription on this account" });
  }

  const config = useRuntimeConfig();
  const siteUrl = (config.public.siteUrl as string) || getRequestURL(event).origin;
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/profile`,
  });

  return { url: session.url };
});
