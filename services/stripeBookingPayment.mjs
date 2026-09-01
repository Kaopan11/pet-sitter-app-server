import { bookingsRepository } from "../repositories/bookings.repository.mjs";
import { getStripe } from "../repositories/stripe.mjs";
import { httpError } from "../utils/httpError.mjs";

const defaultDeps = {
  capture: (paymentToken) => getStripe().paymentIntents.capture(paymentToken),
  cancel: (paymentToken) => getStripe().paymentIntents.cancel(paymentToken),
  updatePaymentStatus: (paymentToken, status, paidAt) =>
    bookingsRepository.updatePaymentStatusByToken(paymentToken, status, paidAt),
};

/** T03 — capture หลัง owner authorize · mark paid ทันที (webhook ยังทำงานซ้ำได้) */
export async function captureStripePaymentIntent(paymentToken, deps = defaultDeps) {
  if (!paymentToken) {
    throw httpError(400, "Stripe payment is not ready for capture");
  }

  const intent = await deps.capture(paymentToken);
  if (intent.status !== "succeeded") {
    throw httpError(402, "Payment capture was not completed");
  }

  await deps.updatePaymentStatus(
    paymentToken,
    "paid",
    new Date().toISOString()
  );
}

/** T03 — ยกเลิก PI ที่ยังไม่ capture */
export async function cancelStripePaymentIntent(paymentToken, deps = defaultDeps) {
  if (!paymentToken) {
    return;
  }

  try {
    await deps.cancel(paymentToken);
  } catch (error) {
    const code = error?.code ?? error?.raw?.code;
    if (
      code === "payment_intent_unexpected_state" ||
      code === "resource_missing"
    ) {
      return;
    }
    throw httpError(402, error.message || "Failed to cancel Stripe payment");
  }
}
