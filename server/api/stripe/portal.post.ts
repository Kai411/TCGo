import { getStripe } from "~/server/utils/stripe";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { customerId } = body as { customerId: string };

  if (!customerId) {
    throw createError({ statusCode: 400, message: "customerId required" });
  }

  const config = useRuntimeConfig();
  const stripe = getStripe();
  const siteUrl = (config.public.siteUrl as string) || "https://tcgo.shop";

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/profile`,
  });

  return { url: session.url };
});
