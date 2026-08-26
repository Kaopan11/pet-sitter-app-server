import { bookingsRepository } from "../repositories/bookings.repository.mjs";
<<<<<<< HEAD
import { petsRepository } from "../repositories/pets.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";
import { getStripe } from "../repositories/stripe.mjs";
import {
  calculateBookingTotal,
  resolveDurationHours,
} from "../utils/bookingPricing.mjs";
import { toStripeAmount } from "../utils/stripeAmount.mjs";
=======
import { reviewsRepository } from "../repositories/reviews.repository.mjs";
import { reportsRepository } from "../repositories/reports.repository.mjs";
>>>>>>> 8863466 (feat(bookings): add owner bookings endpoints and review/report functionality)
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_METHODS = new Set(["cash", "stripe"]);

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

    const updated = await bookingsRepository.updateStatusByIdAndSitterId(
      sitterId,
      bookingId,
      nextStatus
    );

    return updated;
  },

<<<<<<< HEAD
  async getOwnerBookings(ownerId) {
    const rows = await bookingsRepository.findManyByOwnerId(ownerId);
    return rows.map(toOwnerBooking);
  },

  // owner booking — cash | stripe (ไม่เชื่อ totalPrice จาก client)
  async createBooking(owner, body) {
    const {
      sitterId,
      date,
      startTime,
      endTime,
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

    if (typeof date !== "string" || !DATE_RE.test(date.trim())) {
      throw httpError(400, "Invalid date format");
    }

    if (owner.id === sitterId) {
      throw httpError(400, "You cannot book yourself");
    }

    const petIds = normalizePetIds(rawPetIds);
    const durationHours = resolveDurationHours(startTime, endTime);
    const totalPrice = calculateBookingTotal(durationHours, petIds.length);

    const sitter = await sitterProfilesRepository.findPublicById(sitterId);
    if (!sitter) {
      throw httpError(404, "Sitter profile not found");
    }

    const pets = await petsRepository.findManyByIds(petIds, owner.id);
    if (pets.length !== petIds.length) {
      throw httpError(400, "One or more pets do not belong to you");
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

    if (!owner.email) {
      throw httpError(400, "Owner email is required to book");
    }
    if (!owner.phone) {
      throw httpError(400, "Owner phone is required to book");
    }

    const additionalMessage =
      typeof message === "string" && message.trim()
        ? message.trim()
        : null;

    const created = await bookingsRepository.createBookingWithPets({
      ownerId: owner.id,
      sitterId,
      bookingDate: date.trim(),
      startTime,
      endTime,
      durationHours,
      contactName: (owner.name && String(owner.name).trim()) || owner.email,
      contactEmail: owner.email,
      contactPhone: owner.phone,
      additionalMessage,
      totalPrice,
      petIds,
    });

    if (paymentMethod === "cash") {
      return created;
    }

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: toStripeAmount(created.totalPrice),
      currency: "thb",
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
=======
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
>>>>>>> 8863466 (feat(bookings): add owner bookings endpoints and review/report functionality)
  },
};
