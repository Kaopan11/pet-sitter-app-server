import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createBookingsService } from "./bookings.service.mjs";

function completeOwner(overrides = {}) {
  return {
    id: "owner-1",
    name: "Jane Owner",
    email: "jane@example.com",
    phone: "0812345678",
    id_number: "1234567890123",
    date_of_birth: "1990-01-15",
    is_banned: false,
    ...overrides,
  };
}

function bookingRow(overrides = {}) {
  return {
    id: "booking-1",
    owner_id: "owner-1",
    sitter_id: "sitter-1",
    status: "waiting_confirm",
    payment_method: "cash",
    payment_token: null,
    pet_count: 1,
    total_price: 600,
    ...overrides,
  };
}

function createMemory() {
  return {
    bookings: [],
    sitters: {
      "sitter-1": { user_id: "sitter-1", pet_types: ["Dog"] },
    },
    pets: [
      { id: 11, owner_id: "owner-1", pet_type: "Dog", is_suspended: false },
    ],
    overlapping: false,
    createdBookings: [],
    scheduleUpdates: [],
    notifications: [],
  };
}

function createServiceFromMemory(memory) {
  return createBookingsService({
    bookingsRepository: {
      async findByIdAndSitterId(sitterId, bookingId) {
        return (
          memory.bookings.find(
            (row) => row.id === bookingId && row.sitter_id === sitterId
          ) ?? null
        );
      },
      async findByIdAndOwnerId(ownerId, bookingId) {
        return (
          memory.bookings.find(
            (row) => row.id === bookingId && row.owner_id === ownerId
          ) ?? null
        );
      },
      async updateStatusByIdAndSitterId(sitterId, bookingId, nextStatus) {
        const row = memory.bookings.find(
          (item) => item.id === bookingId && item.sitter_id === sitterId
        );
        if (!row) return null;
        row.status = nextStatus;
        return { ...row };
      },
      async updateStatusByIdAndOwnerId(ownerId, bookingId, nextStatus) {
        const row = memory.bookings.find(
          (item) => item.id === bookingId && item.owner_id === ownerId
        );
        if (!row) return null;
        row.status = nextStatus;
        return { ...row };
      },
      async hasOverlappingBooking() {
        return memory.overlapping;
      },
      async updateScheduleByIdAndOwnerId(ownerId, bookingId, schedule) {
        memory.scheduleUpdates.push({ ownerId, bookingId, ...schedule });
        const row = memory.bookings.find(
          (item) => item.id === bookingId && item.owner_id === ownerId
        );
        if (!row) return null;
        Object.assign(row, {
          start_date: schedule.startDate,
          end_date: schedule.endDate,
          start_time: schedule.startTime,
          end_time: schedule.endTime,
          duration: schedule.duration,
          duration_unit: schedule.durationUnit,
          total_price: schedule.totalPrice,
        });
        return { ...row };
      },
      async createBookingWithPets(payload) {
        memory.createdBookings.push(payload);
        return {
          bookingId: "booking-1",
          totalPrice: payload.totalPrice,
        };
      },
      async markPaymentPaidByBookingId() {},
      async updatePaymentTokenByBookingId() {},
    },
    petsRepository: {
      async findManyByIds(petIds, ownerId) {
        return memory.pets.filter(
          (pet) => petIds.includes(pet.id) && pet.owner_id === ownerId
        );
      },
    },
    sitterProfilesRepository: {
      async findPublicById(sitterId) {
        return memory.sitters[sitterId] ?? null;
      },
    },
    notificationsService: {
      async notifyOwnerBookingConfirmed(payload) {
        memory.notifications.push(["ownerConfirmed", payload]);
      },
      async notifyOwnerSitterCancelled(payload) {
        memory.notifications.push(["ownerSitterCancelled", payload]);
      },
      async notifySitterOwnerCancelled(payload) {
        memory.notifications.push(["sitterOwnerCancelled", payload]);
      },
      async notifyOwnerHiredSitter(payload) {
        memory.notifications.push(["ownerHiredSitter", payload]);
      },
    },
  });
}

async function expectHttpError(promise, statusCode, messagePattern) {
  await expect(promise).rejects.toMatchObject({ statusCode });
  if (messagePattern) {
    await expect(promise).rejects.toThrow(messagePattern);
  }
}

describe("bookingsService.getMyBookingById", () => {
  let memory;
  let service;

  beforeEach(() => {
    memory = createMemory();
    memory.bookings.push(bookingRow());
    service = createServiceFromMemory(memory);
  });

  afterEach(() => {
    memory = null;
    service = null;
  });

  test("returns the booking when it belongs to the sitter", async () => {
    await expect(
      service.getMyBookingById("sitter-1", "booking-1")
    ).resolves.toEqual(bookingRow());
  });

  test("throws 404 when the booking is missing", async () => {
    await expectHttpError(
      service.getMyBookingById("sitter-1", "missing"),
      404,
      /Booking not found/
    );
  });
});

describe("bookingsService.updateMyBookingStatus", () => {
  let memory;
  let service;

  beforeEach(() => {
    memory = createMemory();
    memory.bookings.push(bookingRow());
    service = createServiceFromMemory(memory);
  });

  afterEach(() => {
    memory = null;
    service = null;
  });

  test("throws 404 when the booking is missing", async () => {
    await expectHttpError(
      service.updateMyBookingStatus("sitter-1", "missing", "waiting_service"),
      404,
      /Booking not found/
    );
  });

  test("rejects an invalid status transition", async () => {
    await expectHttpError(
      service.updateMyBookingStatus("sitter-1", "booking-1", "success"),
      400,
      /Invalid status transition/
    );
    expect(memory.bookings[0].status).toBe("waiting_confirm");
  });

  test("confirms a booking and notifies the owner", async () => {
    const updated = await service.updateMyBookingStatus(
      "sitter-1",
      "booking-1",
      "waiting_service"
    );

    expect(updated.status).toBe("waiting_service");
    expect(memory.bookings[0].status).toBe("waiting_service");
    expect(memory.notifications).toContainEqual([
      "ownerConfirmed",
      {
        ownerId: "owner-1",
        sitterId: "sitter-1",
        bookingId: "booking-1",
      },
    ]);
  });

  test("lets the sitter cancel a waiting booking and notifies the owner", async () => {
    const updated = await service.updateMyBookingStatus(
      "sitter-1",
      "booking-1",
      "cancelled"
    );

    expect(updated.status).toBe("cancelled");
    expect(memory.notifications).toContainEqual([
      "ownerSitterCancelled",
      {
        ownerId: "owner-1",
        sitterId: "sitter-1",
        bookingId: "booking-1",
      },
    ]);
  });

  test("moves a confirmed booking into service", async () => {
    memory.bookings[0].status = "waiting_service";

    const updated = await service.updateMyBookingStatus(
      "sitter-1",
      "booking-1",
      "in_service"
    );

    expect(updated.status).toBe("in_service");
  });

  test("completes an in-service booking", async () => {
    memory.bookings[0].status = "in_service";

    const updated = await service.updateMyBookingStatus(
      "sitter-1",
      "booking-1",
      "success"
    );

    expect(updated.status).toBe("success");
  });
});

describe("bookingsService.getOwnerBookingById", () => {
  let memory;
  let service;

  beforeEach(() => {
    memory = createMemory();
    memory.bookings.push(bookingRow());
    service = createServiceFromMemory(memory);
  });

  afterEach(() => {
    memory = null;
    service = null;
  });

  test("returns the booking when it belongs to the owner", async () => {
    await expect(
      service.getOwnerBookingById("owner-1", "booking-1")
    ).resolves.toEqual(bookingRow());
  });

  test("throws 404 when the booking is missing", async () => {
    await expectHttpError(
      service.getOwnerBookingById("owner-1", "missing"),
      404,
      /Booking not found/
    );
  });
});

describe("bookingsService.cancelOwnerBooking", () => {
  let memory;
  let service;

  beforeEach(() => {
    memory = createMemory();
    memory.bookings.push(bookingRow());
    service = createServiceFromMemory(memory);
  });

  afterEach(() => {
    memory = null;
    service = null;
  });

  test("throws 404 when the booking is missing", async () => {
    await expectHttpError(
      service.cancelOwnerBooking("owner-1", "missing"),
      404,
      /Booking not found/
    );
  });

  test("rejects cancel after the sitter has already confirmed", async () => {
    memory.bookings[0].status = "waiting_service";

    await expectHttpError(
      service.cancelOwnerBooking("owner-1", "booking-1"),
      400,
      /waiting for confirmation/
    );
    expect(memory.bookings[0].status).toBe("waiting_service");
  });

  test("cancels a waiting booking and notifies the sitter", async () => {
    const updated = await service.cancelOwnerBooking("owner-1", "booking-1");

    expect(updated.status).toBe("cancelled");
    expect(memory.bookings[0].status).toBe("cancelled");
    expect(memory.notifications).toContainEqual([
      "sitterOwnerCancelled",
      {
        ownerId: "owner-1",
        sitterId: "sitter-1",
        bookingId: "booking-1",
      },
    ]);
  });
});

describe("bookingsService.rescheduleOwnerBooking", () => {
  let memory;
  let service;
  const newSlot = {
    date: "2026-09-02",
    startTime: "10:00",
    endTime: "13:00",
  };

  beforeEach(() => {
    memory = createMemory();
    memory.bookings.push(bookingRow());
    service = createServiceFromMemory(memory);
  });

  afterEach(() => {
    memory = null;
    service = null;
  });

  test("throws 404 when the booking is missing", async () => {
    await expectHttpError(
      service.rescheduleOwnerBooking("owner-1", "missing", newSlot),
      404,
      /Booking not found/
    );
  });

  test("rejects reschedule after the sitter has confirmed", async () => {
    memory.bookings[0].status = "in_service";

    await expectHttpError(
      service.rescheduleOwnerBooking("owner-1", "booking-1", newSlot),
      400,
      /waiting for confirmation/
    );
    expect(memory.scheduleUpdates).toHaveLength(0);
  });

  test("rejects a slot that overlaps another booking", async () => {
    memory.overlapping = true;

    await expectHttpError(
      service.rescheduleOwnerBooking("owner-1", "booking-1", newSlot),
      409,
      /already booked/
    );
    expect(memory.scheduleUpdates).toHaveLength(0);
  });

  test("updates the date and time of a waiting booking", async () => {
    const updated = await service.rescheduleOwnerBooking(
      "owner-1",
      "booking-1",
      newSlot
    );

    expect(updated.start_date).toBe("2026-09-02");
    expect(memory.scheduleUpdates).toEqual([
      {
        ownerId: "owner-1",
        bookingId: "booking-1",
        startDate: "2026-09-02",
        endDate: "2026-09-02",
        startTime: "10:00",
        endTime: "13:00",
        duration: 3,
        durationUnit: "hours",
        totalPrice: 600,
      },
    ]);
  });
});

describe("bookingsService.createBooking", () => {
  const bookingBody = {
    sitterId: "sitter-1",
    petIds: [11],
    date: "2026-09-01",
    startTime: "10:00",
    endTime: "13:00",
    paymentMethod: "cash",
    message: "Please take care of my dog",
  };

  let memory;
  let service;

  beforeEach(() => {
    memory = createMemory();
    service = createServiceFromMemory(memory);
  });

  afterEach(() => {
    memory = null;
    service = null;
  });

  test("rejects a missing sitterId", async () => {
    await expectHttpError(
      service.createBooking(completeOwner(), {
        ...bookingBody,
        sitterId: "",
      }),
      400,
      /sitterId is required/
    );
  });

  test("rejects a banned owner", async () => {
    await expectHttpError(
      service.createBooking(completeOwner({ is_banned: true }), bookingBody),
      403,
      /banned/
    );
  });

  test("rejects booking yourself", async () => {
    await expectHttpError(
      service.createBooking(completeOwner({ id: "sitter-1" }), bookingBody),
      400,
      /cannot book yourself/
    );
  });

  test("rejects empty petIds", async () => {
    await expectHttpError(
      service.createBooking(completeOwner(), {
        ...bookingBody,
        petIds: [],
      }),
      400,
      /At least one pet/
    );
  });

  test("rejects invalid petIds", async () => {
    await expectHttpError(
      service.createBooking(completeOwner(), {
        ...bookingBody,
        petIds: ["abc"],
      }),
      400,
      /Invalid petIds/
    );
  });

  test("throws 404 when the sitter profile is missing", async () => {
    delete memory.sitters["sitter-1"];

    await expectHttpError(
      service.createBooking(completeOwner(), bookingBody),
      404,
      /Sitter profile not found/
    );
  });

  test("rejects pets that do not belong to the owner", async () => {
    memory.pets = [];

    await expectHttpError(
      service.createBooking(completeOwner(), bookingBody),
      400,
      /do not belong to you/
    );
  });

  test("rejects suspended pets", async () => {
    memory.pets[0].is_suspended = true;

    await expectHttpError(
      service.createBooking(completeOwner(), bookingBody),
      400,
      /suspended/
    );
  });

  test("rejects pets the sitter does not accept", async () => {
    memory.pets[0].pet_type = "Cat";

    await expectHttpError(
      service.createBooking(completeOwner(), bookingBody),
      400,
      /not accepted/
    );
  });

  test("parses sitter pet_types from a JSON string", async () => {
    memory.sitters["sitter-1"].pet_types = '["Dog"]';

    await service.createBooking(completeOwner(), bookingBody);

    expect(memory.createdBookings).toHaveLength(1);
  });

  test("rejects an incomplete owner profile", async () => {
    await expectHttpError(
      service.createBooking(completeOwner({ name: "Jo" }), bookingBody),
      400,
      /complete your profile/
    );
  });

  test("rejects an overlapping slot", async () => {
    memory.overlapping = true;

    await expectHttpError(
      service.createBooking(completeOwner(), bookingBody),
      409,
      /already booked/
    );
    expect(memory.createdBookings).toHaveLength(0);
  });

  test("creates a booking and notifies the sitter", async () => {
    const created = await service.createBooking(completeOwner(), bookingBody);

    expect(created).toEqual({ bookingId: "booking-1", totalPrice: 600 });
    expect(memory.createdBookings[0]).toMatchObject({
      ownerId: "owner-1",
      sitterId: "sitter-1",
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      startTime: "10:00",
      endTime: "13:00",
      duration: 3,
      durationUnit: "hours",
      petIds: [11],
      additionalMessage: "Please take care of my dog",
    });
    expect(memory.notifications).toContainEqual([
      "ownerHiredSitter",
      {
        ownerId: "owner-1",
        sitterId: "sitter-1",
        bookingId: "booking-1",
      },
    ]);
  });

  test("deduplicates petIds before insert", async () => {
    await service.createBooking(completeOwner(), {
      ...bookingBody,
      petIds: [11, 11],
    });

    expect(memory.createdBookings[0].petIds).toEqual([11]);
  });
});
