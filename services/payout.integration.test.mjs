import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPayoutEligible,
  shouldCaptureStripeOnConfirm,
  shouldMarkCashPaidOnStatusChange,
} from "./payoutEligibility.mjs";
import { createPayoutService } from "./payout.service.mjs";
import { parseBankAccountPutBody } from "./payoutBank.service.mjs";
import { listThaiBanks } from "../utils/thaiBanks.mjs";

const sampleRow = (overrides = {}) => ({
  id: "booking-1",
  pet_owner_name: "John Wick",
  transaction_no: "TX-20260901-0001",
  total_price: 900,
  payment_method: "cash",
  paid_at: "2026-08-25T10:00:00.000Z",
  ...overrides,
});

describe("payout eligibility scenarios", () => {
  const cases = [
    {
      name: "cash in_service + paid counts",
      input: {
        paymentMethod: "cash",
        bookingStatus: "in_service",
        paymentStatus: "paid",
      },
      eligible: true,
    },
    {
      name: "cash waiting_service + paid does not count yet",
      input: {
        paymentMethod: "cash",
        bookingStatus: "waiting_service",
        paymentStatus: "paid",
      },
      eligible: false,
    },
    {
      name: "stripe paid before in_service counts",
      input: {
        paymentMethod: "stripe",
        bookingStatus: "waiting_service",
        paymentStatus: "paid",
      },
      eligible: true,
    },
    {
      name: "stripe cancelled after paid does not count",
      input: {
        paymentMethod: "stripe",
        bookingStatus: "cancelled",
        paymentStatus: "paid",
      },
      eligible: false,
    },
    {
      name: "cash cancelled after paid does not count",
      input: {
        paymentMethod: "cash",
        bookingStatus: "cancelled",
        paymentStatus: "paid",
      },
      eligible: false,
    },
    {
      name: "missing payment_method does not count",
      input: {
        paymentMethod: null,
        bookingStatus: "in_service",
        paymentStatus: "paid",
      },
      eligible: false,
    },
  ];

  for (const scenario of cases) {
    it(scenario.name, () => {
      assert.equal(isPayoutEligible(scenario.input), scenario.eligible);
    });
  }
});

describe("payout booking status hooks", () => {
  it("cash marks paid only on in_service", () => {
    assert.equal(
      shouldMarkCashPaidOnStatusChange({
        paymentMethod: "cash",
        nextStatus: "in_service",
      }),
      true
    );
    assert.equal(
      shouldMarkCashPaidOnStatusChange({
        paymentMethod: "cash",
        nextStatus: "waiting_service",
      }),
      false
    );
  });

  it("stripe captures only on sitter confirm (waiting_service)", () => {
    assert.equal(
      shouldCaptureStripeOnConfirm({
        paymentMethod: "stripe",
        nextStatus: "waiting_service",
      }),
      true
    );
    assert.equal(
      shouldCaptureStripeOnConfirm({
        paymentMethod: "stripe",
        nextStatus: "in_service",
      }),
      false
    );
  });
});

describe("createPayoutService", () => {
  it("keeps totalEarning global while transactions are paginated", async () => {
    const service = createPayoutService({
      sumEarningsBySitterId: async () => 5400,
      findEligibleTransactionsBySitterId: async () => ({
        rows: [sampleRow()],
        totalItems: 6,
      }),
      findBankAccountByUserId: async () => null,
    });

    const result = await service.getMyPayout("sitter-1", { page: 2, limit: 1 });

    assert.equal(result.totalEarning, 5400);
    assert.equal(result.transactions.length, 1);
    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.totalItems, 6);
    assert.equal(result.bankAccount, null);
  });

  it("includes masked bank account on dashboard", async () => {
    const service = createPayoutService({
      sumEarningsBySitterId: async () => 0,
      findEligibleTransactionsBySitterId: async () => ({
        rows: [],
        totalItems: 0,
      }),
      findBankAccountByUserId: async () => ({
        bank_code: "SCB",
        bank_name: "ไทยพาณิชย์",
        account_number: "003345347444",
        account_name: "Jane Watson",
        book_bank_image_url: "https://example.com/book.jpg",
      }),
    });

    const result = await service.getMyPayout("sitter-1", {});
    assert.equal(result.bankAccount.accountNumberMasked, "*444");
    assert.equal(result.bankAccount.bankCode, "SCB");
    assert.equal(result.bankAccount.bankName, "SCB");
  });
});

describe("parseBankAccountPutBody", () => {
  it("accepts valid bank account payload", () => {
    assert.deepEqual(
      parseBankAccountPutBody({
        bankCode: "scb",
        accountNumber: "003-345-347-444",
        accountName: "Jane Watson",
        bookBankImageUrl: "https://example.com/book.jpg",
      }),
      {
        bankCode: "SCB",
        bankName: "SCB",
        accountNumber: "003345347444",
        accountName: "Jane Watson",
        bookBankImageUrl: "https://example.com/book.jpg",
      }
    );
  });

  it("rejects invalid bankCode", () => {
    assert.throws(
      () =>
        parseBankAccountPutBody({
          bankCode: "FAKE",
          accountNumber: "003345347444",
          accountName: "Jane",
          bookBankImageUrl: "https://example.com/book.jpg",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it("rejects short account numbers", () => {
    assert.throws(
      () =>
        parseBankAccountPutBody({
          bankCode: "SCB",
          accountNumber: "123",
          accountName: "Jane",
          bookBankImageUrl: "https://example.com/book.jpg",
        }),
      (err) => {
        assert.match(err.message, /10 to 15 digits/);
        return true;
      }
    );
  });
});

describe("GET /api/banks contract", () => {
  it("returns code and English name pairs", () => {
    const banks = listThaiBanks();
    assert.ok(banks.length >= 8);
    assert.deepEqual(banks[0], { code: "SCB", name: "SCB" });
  });
});
