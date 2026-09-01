import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatTransactionNo,
  isValidTransactionNo,
} from "./transactionNo.mjs";

describe("formatTransactionNo", () => {
  it("builds TX-YYYYMMDD-0001 shape", () => {
    assert.equal(formatTransactionNo("20260831", 1), "TX-20260831-0001");
    assert.equal(formatTransactionNo("20260831", 42), "TX-20260831-0042");
    assert.equal(formatTransactionNo("20260831", 9999), "TX-20260831-9999");
  });
});

describe("isValidTransactionNo", () => {
  it("accepts values from formatTransactionNo", () => {
    assert.equal(isValidTransactionNo("TX-20260831-0001"), true);
  });

  it("rejects invalid shapes", () => {
    assert.equal(isValidTransactionNo(""), false);
    assert.equal(isValidTransactionNo("TX-20260831"), false);
    assert.equal(isValidTransactionNo("BOOK-001"), false);
  });
});
