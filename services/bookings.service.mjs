import { bookingsRepository } from "../repositories/bookings.repository.mjs";
import { httpError } from "../utils/httpError.mjs";

const ALLOWED_TRANSITIONS = {
  waiting_confirm: ["waiting_service", "cancelled"],
  waiting_service: ["in_service"],
  in_service: ["success"],
};

const OWNER_STATUS = {
  waiting_confirm: "pending",
  waiting_service: "confirmed",
  in_service: "ongoing",
  success: "completed",
  cancelled: "cancelled",
  pending: "pending",
  confirmed: "confirmed",
  ongoing: "ongoing",
  completed: "completed",
};

function toOwnerBooking(row) {
  const status = OWNER_STATUS[row.status] ?? row.status;

  return {
    id: String(row.id),
    sitter_id: row.sitter_id,
    sitter: {
      id: row.sitter_id,
      name: row.sitter_name,
      avatar_url: row.sitter_avatar_url ?? null,
    },
    owner_name: row.owner_name,
    pet: { name: row.pet_names || "—" },
    booking_date: row.booking_date,
    transaction_date: row.transaction_date,
    date_label: row.transaction_date ? "Transaction date" : "Booking date",
    transaction_no: row.transaction_no,
    total: row.total_price,
    start_time: row.start_time,
    end_time: row.end_time,
    duration: row.duration_hours,
    status,
    has_review: false,
    completed_date: status === "completed" ? row.updated_at : null,
  };
}

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

  async getOwnerBookings(ownerId) {
    const rows = await bookingsRepository.findManyByOwnerId(ownerId);
    return rows.map(toOwnerBooking);
  },
};
