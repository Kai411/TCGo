import { getStripe } from "~/server/utils/stripe";

interface LineItem {
  orderId: string;
  name: string;
  price: number;
  shipping: number;
  imageUrl?: string;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { type, uid, email, items } = body as {
    type: "subscription" | "payment";
    uid: string;
    email: string;
    items?: LineItem[];
  };

  if (!uid || !email) {
    throw createError({ statusCode: 400, message: "uid and email required" });
  }

  const config = useRuntimeConfig();
  const stripe = getStripe();
  const requestUrl = getRequestURL(event);
  const siteUrl = (config.public.siteUrl as string) || requestUrl.origin;

  if (type === "subscription") {
    const pricePremium = config.stripePricePremium as string;
    if (!pricePremium) {
      throw createError({ statusCode: 500, message: "Stripe price not configured" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: pricePremium, quantity: 1 }],
      metadata: { uid, type: "subscription" },
      success_url: `${siteUrl}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/membership/cancel`,
      allow_promotion_codes: true,
    });

    return { url: session.url };
  }

  if (type === "payment") {
    if (!items?.length) {
      throw createError({ statusCode: 400, message: "items required for payment" });
    }

    const orderIds = items.map((i) => i.orderId).join(",");

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "myr",
        product_data: {
          name: item.name,
          ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
        },
        unit_amount: Math.round((item.price + item.shipping) * 100),
      },
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      metadata: { uid, type: "payment", orderIds },
      payment_intent_data: { metadata: { uid, orderIds } },
      success_url: `${siteUrl}/orders?session_id={CHECKOUT_SESSION_ID}&success=1`,
      cancel_url: `${siteUrl}/cart?cancelled=1`,
    });

    return { url: session.url };
  }

  throw createError({ statusCode: 400, message: "Invalid type" });
});
