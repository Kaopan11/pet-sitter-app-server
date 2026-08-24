import { bookingsRepository } from "../repositories/bookings.repository.mjs";
import { httpError } from "../utils/httpError.mjs";

const ALLOWED_TRANSITIONS = {
  waiting_confirm: ["waiting_service", "cancelled"],
  waiting_service: ["in_service"],
  in_service: ["success"],
};

export const bookingsService = {
  // get bookings ไม่ต้องเช็คอะไรเพิ่มเติมจึงไม่ต้องทำอะไร
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

    const updated = await bookingsRepository.updateStatusByIdAndSitterId(
      sitterId,
      bookingId,
      nextStatus
    );

    return updated;
  },
};
