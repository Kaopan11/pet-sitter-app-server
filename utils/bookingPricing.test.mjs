import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateBookingTotal,
  calculateNightlyTotal,
  resolveDurationHours,
  resolveNights,
} from "./bookingPricing.mjs";

describe("calculateBookingTotal", () => {
  it("3 hours × 1 pet = 600", () => {
    assert.equal(calculateBookingTotal(3, 1), 600);
  });

  it("3 hours × 2 pets = 900", () => {
    assert.equal(calculateBookingTotal(3, 2), 900);
  });

  it("3 hours × 3 pets = 1200", () => {
    assert.equal(calculateBookingTotal(3, 3), 1200);
  });

  it("rejects zero pets", () => {
    assert.throws(() => calculateBookingTotal(3, 0), (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  });
});

describe("resolveDurationHours", () => {
  it("returns whole hours between start and end", () => {
    assert.equal(resolveDurationHours("10:00", "13:00"), 3);
  });

  it("rejects fractional hours", () => {
    assert.throws(() => resolveDurationHours("10:00", "11:30"), (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /whole hours/i);
      return true;
    });
  });

  it("rejects end before or equal start", () => {
    assert.throws(() => resolveDurationHours("13:00", "10:00"), (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  });
});

describe("resolveNights", () => {
  // many-days: nights = endDate − startDate (ไม่ inclusive) — 27→29 Aug = 2
  it("counts nights between start and end dates", () => {
    assert.equal(resolveNights("2026-08-27", "2026-08-29"), 2);
  });

  it("rejects when endDate is before startDate", () => {
    assert.throws(() => resolveNights("2026-09-04", "2026-09-01"), (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /after startDate/i);
      return true;
    });
  });

  it("rejects when start and end are the same day (use hourly instead)", () => {
    assert.throws(() => resolveNights("2026-09-01", "2026-09-01"), (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  });

  it("rejects invalid date format", () => {
    assert.throws(() => resolveNights("01-09-2026", "2026-09-04"), (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /date/i);
      return true;
    });
  });
});

describe("calculateNightlyTotal", () => {
  it("2 nights × 1 pet = 2000", () => {
    assert.equal(calculateNightlyTotal(2, 1), 2000);
  });

  it("2 nights × 2 pets = 3000", () => {
    assert.equal(calculateNightlyTotal(2, 2), 3000);
  });

  it("rejects zero nights", () => {
    assert.throws(() => calculateNightlyTotal(0, 1), (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  });

  it("rejects zero pets", () => {
    assert.throws(() => calculateNightlyTotal(2, 0), (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  });
});
