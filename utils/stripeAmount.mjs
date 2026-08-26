import { httpError } from "./httpError.mjs";

/** Convert THB total (baht) to Stripe amount in satang. */
export function toStripeAmount(totalPriceBaht) {
  const n = Number(totalPriceBaht);
  if (!Number.isFinite(n) || n <= 0) {
    throw httpError(400, "Invalid total price for Stripe");
  }
  return Math.round(n * 100);
}
