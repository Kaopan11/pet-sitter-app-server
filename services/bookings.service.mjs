import { bookingsRepository } from "../repositories/bookings.repository.mjs";
import { petsRepository } from "../repositories/pets.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";
import { getStripe } from "../repositories/stripe.mjs";
import {
  resolveBookingDateRange,
  resolveBookingPricing,
  resolveBookingTimes,
} from "./bookingsCreate.mjs";
import {
  shouldMarkCashPaidOnStatusChange,
  shouldCaptureStripeOnConfirm,
  shouldCancelStripePayment,
} from "./payoutEligibility.mjs";
import {
  captureStripePaymentIntent,
  cancelStripePaymentIntent,
} from "./stripeBookingPayment.mjs";
import { toStripeAmount } from "../utils/stripeAmount.mjs";
import { reviewsRepository } from "../repositories/reviews.repository.mjs";
import { reportsRepository } from "../repositories/reports.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import { isOwnerProfileComplete } from "../middlewares/validateUsers.mjs";
import { notificationsService } from "./notifications.service.mjs";

const ALLOWED_TRANSITIONS = {
  waiting_confirm: ["waiting_service", "cancelled"],
  waiting_service: ["in_service"],
  in_service: ["success"],
};

const PAYMENT_METHODS = new Set(["cash", "stripe"]);

function normalizePetIds(petIds) {
  if (!Array.isArray(petIds) || petIds.length === 0) {
    throw httpError(400, "At least one pet is required");
  }

  const normalized = [];
  for (const id of petIds) {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) {
      throw httpError(400, "Invalid petIds");
    }
    normalized.push(n);
  }

  return [...new Set(normalized)];
}

function parsePetTypes(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const bookingsService = {
  async getMyBookings(sitterId, search, status, limit, offset) {
    return bookingsRepository.findManyBySitterId(
      sitterId,
      search,
      status,
      limit,
      offset
    );
  },

  async getMyBookingById(sitterId, bookingId) {
    const booking = await bookingsRepository.findByIdAndSitterId(
      sitterId,
      bookingId
    );

    if (!booking) {
      throw httpError(404, "Booking not found");
    }

    return booking;
  },

  async updateMyBookingStatus(sitterId, bookingId, nextStatus) {
    const booking = await bookingsRepository.findByIdAndSitterId(
      sitterId,
      bookingId
    );

    if (!booking) {
      throw httpError(404, "Booking not found");
    }

    const allowed = ALLOWED_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw httpError(400, "Invalid status transition");
    }

    // T03 — cancel ก่อนเปลี่ยน status
    if (
      shouldCancelStripePayment({
        paymentMethod: booking.payment_method,
        nextStatus,
      })
    ) {
      await cancelStripePaymentIntent(booking.payment_token);
    }

    // T03 — capture ก่อนเปลี่ยน status (fail แล้วไม่อัปเดต booking)
    if (
      shouldCaptureStripeOnConfirm({
        paymentMethod: booking.payment_method,
        nextStatus,
      })
    ) {
      await captureStripePaymentIntent(booking.payment_token);
    }

    const updated = await bookingsRepository.updateStatusByIdAndSitterId(
      sitterId,
      bookingId,
      nextStatus
    );

    const ownerId = booking.owner_id ?? booking.pet_owner?.id;
    if (nextStatus === "waiting_service" && ownerId) {
      await notificationsService.notifyOwnerBookingConfirmed({
        ownerId,
        sitterId,
        bookingId: booking.id,
      });
    }

    if (nextStatus === "cancelled" && ownerId) {
      await notificationsService.notifyOwnerSitterCancelled({
        ownerId: booking.owner_id,
        sitterId,
        bookingId: booking.id,
      });
    }

    // T02 — cash + in_service → mark payments.paid (earnings eligible)
    if (
      shouldMarkCashPaidOnStatusChange({
        paymentMethod: booking.payment_method,
        nextStatus,
      })
    ) {
      await bookingsRepository.markPaymentPaidByBookingId(bookingId);
    }

    return updated;
  },

  async getOwnerBookings(ownerId, search, status, limit, offset) {
    return bookingsRepository.findManyByOwnerId(
      ownerId,
      search,
      status,
      limit,
      offset
    );
  },

  async getOwnerBookingById(ownerId, bookingId) {
    const booking = await bookingsRepository.findByIdAndOwnerId(
      ownerId,
      bookingId
    );

    if (!booking) {
      throw httpError(404, "Booking not found");
    }

    return booking;
  },

  async cancelOwnerBooking(ownerId, bookingId) {
    const booking = await bookingsRepository.findByIdAndOwnerId(
      ownerId,
      bookingId
    );

    if (!booking) {
      throw httpError(404, "Booking not found");
    }

    if (booking.status !== "waiting_confirm") {
      throw httpError(400, "Can only cancel a booking that is waiting for confirmation");
    }

    if (
      shouldCancelStripePayment({
        paymentMethod: booking.payment_method,
        nextStatus: "cancelled",
      })
    ) {
      await cancelStripePaymentIntent(booking.payment_token);
    }

    const updated = await bookingsRepository.updateStatusByIdAndOwnerId(
      ownerId,
      bookingId,
      "cancelled"
    );

    await notificationsService.notifySitterOwnerCancelled({
      ownerId,
      sitterId: booking.sitter_id,
      bookingId: booking.id,
    });

    return updated;
  },

  async rescheduleOwnerBooking(ownerId, bookingId, body) {
    const booking = await bookingsRepository.findByIdAndOwnerId(
      ownerId,
      bookingId
    );

    if (!booking) {
      throw httpError(404, "Booking not found");
    }

    if (booking.status !== "waiting_confirm") {
      throw httpError(
        400,
        "Can only change the date of a booking that is waiting for confirmation"
      );
    }

    const { startDate, endDate } = resolveBookingDateRange(body);
    const { startTime, endTime } = resolveBookingTimes({
      startDate,
      endDate,
      startTime: body?.startTime,
      endTime: body?.endTime,
    });

    const overlapping = await bookingsRepository.hasOverlappingBooking({
      sitterId: booking.sitter_id,
      startDate,
      endDate,
      startTime,
      endTime,
      excludeBookingId: bookingId,
    });
    if (overlapping) {
      throw httpError(
        409,
        "This date and time is already booked. Please choose another slot."
      );
    }

    const { duration, durationUnit, totalPrice } = resolveBookingPricing({
      startDate,
      endDate,
      startTime,
      endTime,
      petCount: booking.pet_count,
    });

    // Stripe already authorized the original amount — capture later pulls that
    // exact amount, so a card-paid booking can only move to a slot priced the
    // same. Raising or silently under-capturing an existing PaymentIntent here
    // isn't safe, so block it instead of drifting the charged amount.
    if (
      booking.payment_method === "stripe" &&
      Number(totalPrice) !== Number(booking.total_price)
    ) {
      throw httpError(
        400,
        "This date/time would change the price, which isn't supported for card-paid bookings. Cancel and create a new booking instead."
      );
    }

    return bookingsRepository.updateScheduleByIdAndOwnerId(ownerId, bookingId, {
      startDate,
      endDate,
      startTime,
      endTime,
      duration,
      durationUnit,
      totalPrice,
    });
  },

  async submitReview(ownerId, bookingId, rating, text) {
    const booking = await bookingsRepository.findByIdAndOwnerId(
      ownerId,
      bookingId
    );

    if (!booking) {
      throw httpError(404, "Booking not found");
    }

    if (booking.status !== "success") {
      throw httpError(400, "Can only review a completed booking");
    }

    if (booking.review) {
      throw httpError(409, "Booking already reviewed");
    }

    return reviewsRepository.create({
      bookingId,
      ownerId,
      sitterId: booking.sitter_id,
      rating,
      text,
    });
  },

  async submitReport(ownerId, bookingId, subject, description) {
    const booking = await bookingsRepository.findByIdAndOwnerId(
      ownerId,
      bookingId
    );

    if (!booking) {
      throw httpError(404, "Booking not found");
    }

    return reportsRepository.create({
      bookingId,
      reporterId: ownerId,
      subject,
      description,
    });
  },

  // owner booking — cash | stripe (ไม่เชื่อ totalPrice จาก client)
  async createBooking(owner, body) {
    const {
      sitterId,
      petIds: rawPetIds,
      message,
      paymentMethod,
    } = body ?? {};

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      throw httpError(400, "paymentMethod must be cash or stripe");
    }

    if (typeof sitterId !== "string" || !sitterId.trim()) {
      throw httpError(400, "sitterId is required");
    }

    const { startDate, endDate } = resolveBookingDateRange(body);
    const { startTime, endTime } = resolveBookingTimes({
      startDate,
      endDate,
      startTime: body?.startTime,
      endTime: body?.endTime,
    });

    if (owner.is_banned) {
      throw httpError(403, "This account has been banned");
    }

    if (String(owner.id) === String(sitterId)) {
      throw httpError(400, "You cannot book yourself");
    }

    const petIds = normalizePetIds(rawPetIds);
    const { duration, durationUnit, totalPrice } = resolveBookingPricing({
      startDate,
      endDate,
      startTime,
      endTime,
      petCount: petIds.length,
    });

    const sitter = await sitterProfilesRepository.findPublicById(sitterId);
    if (!sitter) {
      throw httpError(404, "Sitter profile not found");
    }

    const pets = await petsRepository.findManyByIds(petIds, owner.id);
    if (pets.length !== petIds.length) {
      throw httpError(400, "One or more pets do not belong to you");
    }
    if (pets.some((pet) => pet.is_suspended)) {
      throw httpError(400, "One or more pets are suspended and cannot be booked");
    }

    const acceptedTypes = new Set(
      parsePetTypes(sitter.pet_types).map((name) =>
        String(name).trim().toLowerCase()
      )
    );
    const unsupported = pets.find(
      (pet) => !acceptedTypes.has(String(pet.pet_type).trim().toLowerCase())
    );
    if (unsupported) {
      throw httpError(400, "One or more pets are not accepted by this sitter");
    }

    if (!isOwnerProfileComplete(owner)) {
      throw httpError(400, "Please complete your profile before booking");
    }

    const overlapping = await bookingsRepository.hasOverlappingBooking({
      sitterId,
      startDate,
      endDate,
      startTime,
      endTime,
    });
    if (overlapping) {
      throw httpError(
        409,
        "This date and time is already booked. Please choose another slot."
      );
    }

    const additionalMessage =
      typeof message === "string" && message.trim()
        ? message.trim()
        : null;

    const created = await bookingsRepository.createBookingWithPets({
      ownerId: owner.id,
      sitterId,
      startDate,
      endDate,
      startTime,
      endTime,
      duration,
      durationUnit,
      paymentMethod, // T01 — persist cash | stripe ลง bookings.payment_method
      contactName: (owner.name && String(owner.name).trim()) || owner.email,
      contactEmail: owner.email,
      contactPhone: owner.phone,
      additionalMessage,
      totalPrice,
      petIds,
    });

    await notificationsService.notifyOwnerHiredSitter({
      ownerId: owner.id,
      sitterId,
      bookingId: created.bookingId,
    });

    if (paymentMethod === "cash") {
      return created;
    }

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: toStripeAmount(created.totalPrice),
      currency: "thb",
      capture_method: "manual", // T03 — authorize ตอนจอง, capture ตอน sitter Confirm
      automatic_payment_methods: { enabled: true },
      metadata: { bookingId: String(created.bookingId) },
    });

    await bookingsRepository.updatePaymentTokenByBookingId(
      created.bookingId,
      paymentIntent.id
    );

    return {
      ...created,
      clientSecret: paymentIntent.client_secret,
    };
  },
};
