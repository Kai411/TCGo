import Stripe from "stripe";

let _stripe: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!_stripe) {
    const config = useRuntimeConfig();
    _stripe = new Stripe(config.stripeSecretKey as string);
  }
  return _stripe;
};
