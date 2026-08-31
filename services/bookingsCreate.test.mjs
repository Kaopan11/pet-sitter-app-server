import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  doBookingsOverlap,
  resolveBookingDateRange,
  resolveBookingPricing,
  resolveBookingTimes,
} from "./bookingsCreate.mjs";

describe("resolveBookingDateRange", () => {
  it("maps legacy date to the same start and end", () => {
    assert.deepEqual(resolveBookingDateRange({ date: "2026-09-01" }), {
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });
  });

  it("accepts startDate and endDate for many days", () => {
    assert.deepEqual(
      resolveBookingDateRange({
        startDate: "2026-08-27",
        endDate: "2026-08-29",
      }),
      {
        startDate: "2026-08-27",
        endDate: "2026-08-29",
      }
    );
  });

  it("defaults endDate to startDate when only startDate is sent", () => {
    assert.deepEqual(resolveBookingDateRange({ startDate: "2026-09-01" }), {
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });
  });

  it("prefers startDate over legacy date", () => {
    assert.deepEqual(
      resolveBookingDateRange({
        date: "2026-01-01",
        startDate: "2026-09-01",
        endDate: "2026-09-01",
      }),
      {
        startDate: "2026-09-01",
        endDate: "2026-09-01",
      }
    );
  });

  it("rejects when endDate is before startDate", () => {
    assert.throws(
      () =>
        resolveBookingDateRange({
          startDate: "2026-09-04",
          endDate: "2026-09-01",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /after startDate/i);
        return true;
      }
    );
  });

  it("rejects when no date fields are provided", () => {
    assert.throws(() => resolveBookingDateRange({}), (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /date/i);
      return true;
    });
  });
});

describe("resolveBookingTimes", () => {
  it("requires startTime and endTime for one day", () => {
    assert.throws(
      () =>
        resolveBookingTimes({
          startDate: "2026-09-01",
          endDate: "2026-09-01",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /startTime/i);
        return true;
      }
    );
  });

  it("defaults many-day times to 00:00 and 23:59 when omitted", () => {
    assert.deepEqual(
      resolveBookingTimes({
        startDate: "2026-08-27",
        endDate: "2026-08-29",
      }),
      {
        startTime: "00:00",
        endTime: "23:59",
      }
    );
  });

  it("keeps explicit many-day times when provided", () => {
    assert.deepEqual(
      resolveBookingTimes({
        startDate: "2026-08-27",
        endDate: "2026-08-29",
        startTime: "09:00",
        endTime: "17:00",
      }),
      {
        startTime: "09:00",
        endTime: "17:00",
      }
    );
  });
});

describe("doBookingsOverlap", () => {
  it("detects many-day date overlap without using time", () => {
    assert.equal(
      doBookingsOverlap(
        {
          startDate: "2026-08-27",
          endDate: "2026-08-29",
          startTime: "00:00",
          endTime: "23:59",
        },
        {
          startDate: "2026-08-28",
          endDate: "2026-08-30",
          startTime: "00:00",
          endTime: "23:59",
        }
      ),
      true
    );
  });

  it("allows non-overlapping many-day ranges", () => {
    assert.equal(
      doBookingsOverlap(
        {
          startDate: "2026-08-27",
          endDate: "2026-08-29",
          startTime: "00:00",
          endTime: "23:59",
        },
        {
          startDate: "2026-08-29",
          endDate: "2026-08-31",
          startTime: "00:00",
          endTime: "23:59",
        }
      ),
      false
    );
  });

  it("blocks one-day booking on a night inside many-day range", () => {
    assert.equal(
      doBookingsOverlap(
        {
          startDate: "2026-08-27",
          endDate: "2026-08-29",
          startTime: "00:00",
          endTime: "23:59",
        },
        {
          startDate: "2026-08-28",
          endDate: "2026-08-28",
          startTime: "10:00",
          endTime: "13:00",
        }
      ),
      true
    );
  });

  it("allows one-day booking on checkout day of many-day range", () => {
    assert.equal(
      doBookingsOverlap(
        {
          startDate: "2026-08-27",
          endDate: "2026-08-29",
          startTime: "00:00",
          endTime: "23:59",
        },
        {
          startDate: "2026-08-29",
          endDate: "2026-08-29",
          startTime: "10:00",
          endTime: "13:00",
        }
      ),
      false
    );
  });

  it("uses time overlap for two one-day bookings on the same date", () => {
    assert.equal(
      doBookingsOverlap(
        {
          startDate: "2026-09-01",
          endDate: "2026-09-01",
          startTime: "10:00",
          endTime: "13:00",
        },
        {
          startDate: "2026-09-01",
          endDate: "2026-09-01",
          startTime: "14:00",
          endTime: "17:00",
        }
      ),
      false
    );

    assert.equal(
      doBookingsOverlap(
        {
          startDate: "2026-09-01",
          endDate: "2026-09-01",
          startTime: "10:00",
          endTime: "14:00",
        },
        {
          startDate: "2026-09-01",
          endDate: "2026-09-01",
          startTime: "13:00",
          endTime: "17:00",
        }
      ),
      true
    );
  });
});

describe("resolveBookingPricing", () => {
  it("prices one day hourly", () => {
    assert.deepEqual(
      resolveBookingPricing({
        startDate: "2026-09-01",
        endDate: "2026-09-01",
        startTime: "10:00",
        endTime: "13:00",
        petCount: 1,
      }),
      {
        duration: 3,
        durationUnit: "hours",
        totalPrice: 600,
      }
    );
  });

  it("prices many days per night with duration Day", () => {
    assert.deepEqual(
      resolveBookingPricing({
        startDate: "2026-08-27",
        endDate: "2026-08-29",
        petCount: 2,
      }),
      {
        duration: 2,
        durationUnit: "Day",
        totalPrice: 3000,
      }
    );
  });
});
