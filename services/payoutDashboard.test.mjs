import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPayoutDashboard,
  isGlobalTotalEarning,
} from "./payoutDashboard.mjs";

describe("buildPayoutDashboard", () => {
  it("keeps totalEarning separate from paginated rows", () => {
    const dashboard = buildPayoutDashboard({
      totalEarning: 5400,
      rows: [
        {
          id: "a",
          pet_owner_name: "John",
          transaction_no: "TX-1",
          total_price: 900,
          payment_method: "cash",
          paid_at: "2026-08-25T00:00:00.000Z",
        },
      ],
      totalItems: 6,
      page: 1,
      limit: 20,
    });

    assert.equal(dashboard.totalEarning, 5400);
    assert.equal(dashboard.transactions.length, 1);
    assert.equal(dashboard.pagination.totalItems, 6);
    assert.equal(dashboard.transactions[0].amount, 900);
  });
});

describe("isGlobalTotalEarning", () => {
  it("allows totalEarning greater than current page sum", () => {
    assert.equal(
      isGlobalTotalEarning(5400, [{ total_price: 900 }, { total_price: 900 }]),
      true
    );
  });

  it("allows equal when all rows fit on one page", () => {
    assert.equal(
      isGlobalTotalEarning(1800, [{ total_price: 900 }, { total_price: 900 }]),
      true
    );
  });
});
