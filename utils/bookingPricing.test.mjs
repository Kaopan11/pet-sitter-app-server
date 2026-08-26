import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateBookingTotal,
  resolveDurationHours,
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
