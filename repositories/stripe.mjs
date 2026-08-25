import Stripe from "stripe";
import { httpError } from "../utils/httpError.mjs";

let stripeClient = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw httpError(500, "Stripe is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function constructStripeEvent(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw httpError(500, "Stripe webhook is not configured");
  }
  if (!signature) {
    throw httpError(400, "Missing Stripe-Signature header");
  }

  try {
    return getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    throw httpError(400, `Webhook signature verification failed: ${error.message}`);
  }
}
