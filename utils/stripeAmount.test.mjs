import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toStripeAmount } from "./stripeAmount.mjs";

describe("toStripeAmount", () => {
  it("converts 600 THB to 60000 satang", () => {
    assert.equal(toStripeAmount(600), 60000);
  });

  it("converts 900 THB to 90000 satang", () => {
    assert.equal(toStripeAmount(900), 90000);
  });

  it("rejects non-positive amounts", () => {
    assert.throws(() => toStripeAmount(0), (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  });
});
