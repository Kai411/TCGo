import type Stripe from "stripe";
import { getStripe } from "~/server/utils/stripe";
import { getAdminFirestore } from "~/server/utils/firebase-admin";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const stripe = getStripe();

  const rawBody = await readRawBody(event);
  const sig = getHeader(event, "stripe-signature");

  if (!rawBody || !sig) {
    throw createError({ statusCode: 400, message: "Missing body or signature" });
  }

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      config.stripeWebhookSecret as string,
    );
  } catch {
    throw createError({ statusCode: 400, message: "Invalid Stripe signature" });
  }

  const db = getAdminFirestore();

  // Stripe delivers at least once; skip events we've already applied.
  const seen = db.collection("stripeEvents").doc(stripeEvent.id);
  if ((await seen.get()).exists) return { received: true, duplicate: true };

  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};

      if (meta.type === "subscription" && meta.uid) {
        const subId = session.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subId);
        await db.collection("users").doc(meta.uid).update({
          tier: "premium",
          stripeCustomerId: session.customer,
          stripeSubscriptionId: subId,
          subscriptionStatus: sub.status,
          currentPeriodEnd: sub.current_period_end * 1000,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      }

      break;
    }

    case "customer.subscription.updated": {
      const sub = stripeEvent.data.object as Stripe.Subscription;
      const snap = await db
        .collection("users")
        .where("stripeSubscriptionId", "==", sub.id)
        .limit(1)
        .get();
      if (!snap.empty) {
        // past_due keeps Premium while Stripe retries the card (see roadmap).
        const isActive =
          sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
        await snap.docs[0].ref.update({
          tier: isActive ? "premium" : "free",
          subscriptionStatus: sub.status,
          currentPeriodEnd: sub.current_period_end * 1000,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = stripeEvent.data.object as Stripe.Subscription;
      const snap = await db
        .collection("users")
        .where("stripeSubscriptionId", "==", sub.id)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          tier: "free",
          subscriptionStatus: "canceled",
          cancelAtPeriodEnd: false,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = stripeEvent.data.object as Stripe.Invoice;
      const snap = await db
        .collection("users")
        .where("stripeCustomerId", "==", invoice.customer)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({ subscriptionStatus: "past_due" });
      }
      break;
    }
  }

  await seen.set({ type: stripeEvent.type, processedAt: Date.now() });
  return { received: true };
});
