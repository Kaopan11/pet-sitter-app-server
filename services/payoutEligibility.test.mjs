import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCashPayoutEligible,
  isStripePayoutEligible,
  isPayoutEligible,
  mapPayoutTransaction,
  shouldMarkCashPaidOnStatusChange,
  shouldCaptureStripeOnConfirm,
  shouldCancelStripePayment,
} from "./payoutEligibility.mjs";

describe("isCashPayoutEligible", () => {
  it("is true when cash booking is in_service and paid", () => {
    assert.equal(
      isCashPayoutEligible({
        paymentMethod: "cash",
        bookingStatus: "in_service",
        paymentStatus: "paid",
      }),
      true
    );
  });

  it("is true when cash booking is success and paid", () => {
    assert.equal(
      isCashPayoutEligible({
        paymentMethod: "cash",
        bookingStatus: "success",
        paymentStatus: "paid",
      }),
      true
    );
  });

  it("is false before in_service", () => {
    assert.equal(
      isCashPayoutEligible({
        paymentMethod: "cash",
        bookingStatus: "waiting_service",
        paymentStatus: "pending",
      }),
      false
    );
  });

  it("is false for stripe in cash-only helper", () => {
    assert.equal(
      isCashPayoutEligible({
        paymentMethod: "stripe",
        bookingStatus: "in_service",
        paymentStatus: "paid",
      }),
      false
    );
  });
});

describe("isStripePayoutEligible", () => {
  it("is true when stripe is paid and not cancelled", () => {
    assert.equal(
      isStripePayoutEligible({
        paymentMethod: "stripe",
        bookingStatus: "waiting_service",
        paymentStatus: "paid",
      }),
      true
    );
  });

  it("is false when booking is cancelled", () => {
    assert.equal(
      isStripePayoutEligible({
        paymentMethod: "stripe",
        bookingStatus: "cancelled",
        paymentStatus: "paid",
      }),
      false
    );
  });

  it("is false before capture/paid", () => {
    assert.equal(
      isStripePayoutEligible({
        paymentMethod: "stripe",
        bookingStatus: "waiting_confirm",
        paymentStatus: "pending",
      }),
      false
    );
  });
});

describe("isPayoutEligible", () => {
  it("accepts cash or stripe eligible rows", () => {
    assert.equal(
      isPayoutEligible({
        paymentMethod: "cash",
        bookingStatus: "in_service",
        paymentStatus: "paid",
      }),
      true
    );
    assert.equal(
      isPayoutEligible({
        paymentMethod: "stripe",
        bookingStatus: "waiting_confirm",
        paymentStatus: "paid",
      }),
      true
    );
  });

  it("excludes cancelled bookings for every payment method", () => {
    assert.equal(
      isPayoutEligible({
        paymentMethod: "cash",
        bookingStatus: "cancelled",
        paymentStatus: "paid",
      }),
      false
    );
    assert.equal(
      isPayoutEligible({
        paymentMethod: "stripe",
        bookingStatus: "cancelled",
        paymentStatus: "paid",
      }),
      false
    );
  });
});

describe("shouldCaptureStripeOnConfirm", () => {
  it("captures when sitter confirms stripe booking", () => {
    assert.equal(
      shouldCaptureStripeOnConfirm({
        paymentMethod: "stripe",
        nextStatus: "waiting_service",
      }),
      true
    );
  });

  it("does not capture on in_service", () => {
    assert.equal(
      shouldCaptureStripeOnConfirm({
        paymentMethod: "stripe",
        nextStatus: "in_service",
      }),
      false
    );
  });
});

describe("shouldCancelStripePayment", () => {
  it("cancels PI when stripe booking is cancelled", () => {
    assert.equal(
      shouldCancelStripePayment({
        paymentMethod: "stripe",
        nextStatus: "cancelled",
      }),
      true
    );
  });
});

describe("shouldMarkCashPaidOnStatusChange", () => {
  it("marks paid when cash moves to in_service", () => {
    assert.equal(
      shouldMarkCashPaidOnStatusChange({
        paymentMethod: "cash",
        nextStatus: "in_service",
      }),
      true
    );
  });

  it("does not mark paid for waiting_service confirm step", () => {
    assert.equal(
      shouldMarkCashPaidOnStatusChange({
        paymentMethod: "cash",
        nextStatus: "waiting_service",
      }),
      false
    );
  });

  it("does not mark paid for stripe", () => {
    assert.equal(
      shouldMarkCashPaidOnStatusChange({
        paymentMethod: "stripe",
        nextStatus: "in_service",
      }),
      false
    );
  });
});

describe("mapPayoutTransaction", () => {
  it("maps db row to payout transaction shape", () => {
    assert.deepEqual(
      mapPayoutTransaction({
        id: "booking-uuid",
        pet_owner_name: "John Wick",
        transaction_no: "TX-20260831-0001",
        total_price: "900.00",
        payment_method: "cash",
        paid_at: "2026-08-25T10:30:00.000Z",
      }),
      {
        date: "2026-08-25",
        from: "John Wick",
        transactionNo: "TX-20260831-0001",
        amount: 900,
        bookingId: "booking-uuid",
        paymentMethod: "cash",
      }
    );
  });
});
