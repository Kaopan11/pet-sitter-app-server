import { bookingsRepository } from "../repositories/bookings.repository.mjs";
import { constructStripeEvent } from "../repositories/stripe.mjs";
import { httpError } from "../utils/httpError.mjs";

export const stripeWebhookService = {
  async handleEvent(rawBody, signature) {
    const event = constructStripeEvent(rawBody, signature);

    if (
      event.type !== "payment_intent.succeeded" &&
      event.type !== "payment_intent.payment_failed"
    ) {
      return { received: true, ignored: true, type: event.type };
    }

    const paymentIntent = event.data.object;
    const paymentToken = paymentIntent.id;
    if (!paymentToken) {
      throw httpError(400, "PaymentIntent id missing");
    }

    const nextStatus =
      event.type === "payment_intent.succeeded" ? "paid" : "failed";
    const paidAt =
      event.type === "payment_intent.succeeded" ? new Date().toISOString() : null;

    const updated = await bookingsRepository.updatePaymentStatusByToken(
      paymentToken,
      nextStatus,
      paidAt
    );

    if (!updated) {
      // ไม่ throw 500 — Stripe จะ retry; อาจเป็น PI ที่ไม่ใช่ของเรา
      return { received: true, matched: false, type: event.type };
    }

    return {
      received: true,
      matched: true,
      type: event.type,
      bookingId: updated.booking_id,
      paymentStatus: updated.status,
    };
  },
};
