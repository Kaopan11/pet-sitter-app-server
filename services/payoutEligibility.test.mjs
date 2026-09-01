import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCashPayoutEligible,
  mapPayoutTransaction,
  shouldMarkCashPaidOnStatusChange,
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

  it("is false for stripe in this ticket", () => {
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
