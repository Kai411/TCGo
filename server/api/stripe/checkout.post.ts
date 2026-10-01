import { getStripe } from "~/server/utils/stripe";
import { requireUser } from "~/server/utils/auth";

// Premium membership checkout. Stripe is only used for the subscription;
// marketplace orders are paid through Billplz (/api/orders/:id/pay).
export default defineEventHandler(async (event) => {
  const token = await requireUser(event);
  if (!token.email) {
    throw createError({ statusCode: 400, message: "Your account has no email address" });
  }

  const config = useRuntimeConfig();
  const pricePremium = config.stripePricePremium as string;
  if (!pricePremium) {
    throw createError({ statusCode: 500, message: "Stripe price not configured" });
  }
  const siteUrl = (config.public.siteUrl as string) || getRequestURL(event).origin;

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: token.email,
    line_items: [{ price: pricePremium, quantity: 1 }],
    metadata: { uid: token.uid, type: "subscription" },
    subscription_data: { metadata: { uid: token.uid } },
    success_url: `${siteUrl}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/membership/cancel`,
    allow_promotion_codes: true,
  });

  return { url: session.url };
});
