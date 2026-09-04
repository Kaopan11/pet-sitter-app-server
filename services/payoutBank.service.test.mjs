import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapBankAccountResponse,
  parseBankAccountPutBody,
} from "./payoutBank.service.mjs";

describe("mapBankAccountResponse", () => {
  it("returns null when account number is missing", () => {
    assert.equal(mapBankAccountResponse({ bank_code: "SCB" }), null);
  });

  it("masks account number and uses English bank name from bank code", () => {
    assert.deepEqual(
      mapBankAccountResponse({
        bank_code: "SCB",
        bank_name: "ไทยพาณิชย์",
        account_number: "003345347444",
        account_name: "Jane Watson",
        book_bank_image_url: "https://example.com/book.jpg",
      }),
      {
        bankCode: "SCB",
        bankName: "SCB",
        accountNumberMasked: "*444",
        accountName: "Jane Watson",
        bookBankImageUrl: "https://example.com/book.jpg",
      }
    );
  });
});

describe("parseBankAccountPutBody", () => {
  it("persists English bank name from bank code", () => {
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

  it("TC28 — rejects missing bankCode", () => {
    assert.throws(
      () =>
        parseBankAccountPutBody({
          accountNumber: "003345347444",
          accountName: "Jane",
          bookBankImageUrl: "https://example.com/book.jpg",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /bankCode/i);
        return true;
      }
    );
  });

  it("TC32 — rejects missing accountNumber", () => {
    assert.throws(
      () =>
        parseBankAccountPutBody({
          bankCode: "SCB",
          accountName: "Jane",
          bookBankImageUrl: "https://example.com/book.jpg",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /accountNumber is required/);
        return true;
      }
    );
  });

  it("TC33 — rejects missing accountName", () => {
    assert.throws(
      () =>
        parseBankAccountPutBody({
          bankCode: "SCB",
          accountNumber: "003345347444",
          bookBankImageUrl: "https://example.com/book.jpg",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /accountName is required/);
        return true;
      }
    );
  });

  it("TC34 — rejects missing bookBankImageUrl", () => {
    assert.throws(
      () =>
        parseBankAccountPutBody({
          bankCode: "SCB",
          accountNumber: "003345347444",
          accountName: "Jane Watson",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /bookBankImageUrl is required/);
        return true;
      }
    );
  });
});
