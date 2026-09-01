import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PAYOUT_LIMIT,
  MAX_PAYOUT_LIMIT,
  parsePayoutPagination,
} from "./payoutPagination.mjs";

describe("parsePayoutPagination", () => {
  it("defaults to page 1 and limit 20", () => {
    assert.deepEqual(parsePayoutPagination({}), {
      page: 1,
      limit: DEFAULT_PAYOUT_LIMIT,
      offset: 0,
    });
  });

  it("calculates offset from page and limit", () => {
    assert.deepEqual(parsePayoutPagination({ page: "3", limit: "10" }), {
      page: 3,
      limit: 10,
      offset: 20,
    });
  });

  it("clamps invalid page and limit", () => {
    assert.deepEqual(parsePayoutPagination({ page: 0, limit: 999 }), {
      page: 1,
      limit: MAX_PAYOUT_LIMIT,
      offset: 0,
    });
  });
});
