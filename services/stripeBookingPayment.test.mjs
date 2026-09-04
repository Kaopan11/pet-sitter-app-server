import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cancelStripePaymentIntent,
  captureStripePaymentIntent,
} from "./stripeBookingPayment.mjs";

describe("captureStripePaymentIntent", () => {
  it("marks payment paid when capture succeeds", async () => {
    const calls = [];

    await captureStripePaymentIntent("pi_test", {
      capture: async (token) => {
        calls.push(["capture", token]);
        return { status: "succeeded" };
      },
      cancel: async () => {},
      updatePaymentStatus: async (token, status, paidAt) => {
        calls.push(["update", token, status, paidAt]);
      },
    });

    assert.deepEqual(calls[0], ["capture", "pi_test"]);
    assert.equal(calls[1][1], "pi_test");
    assert.equal(calls[1][2], "paid");
    assert.match(calls[1][3], /^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects when payment token is missing", async () => {
    await assert.rejects(
      () => captureStripePaymentIntent("", { capture: async () => ({}) }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it("rejects when capture does not succeed", async () => {
    await assert.rejects(
      () =>
        captureStripePaymentIntent("pi_test", {
          capture: async () => ({ status: "requires_capture" }),
          cancel: async () => {},
          updatePaymentStatus: async () => {},
        }),
      (err) => {
        assert.equal(err.statusCode, 402);
        return true;
      }
    );
  });
});

describe("cancelStripePaymentIntent", () => {
  it("ignores already-cancelled payment intents", async () => {
    let cancelled = false;
    await cancelStripePaymentIntent("pi_test", {
      capture: async () => ({}),
      cancel: async () => {
        cancelled = true;
        const error = new Error("already cancelled");
        error.code = "payment_intent_unexpected_state";
        throw error;
      },
      updatePaymentStatus: async () => {},
    });

    assert.equal(cancelled, true);
  });
});
