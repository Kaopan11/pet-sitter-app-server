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

  it("masks account number in the response", () => {
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
        bankName: "ไทยพาณิชย์",
        accountNumberMasked: "*444",
        accountName: "Jane Watson",
        bookBankImageUrl: "https://example.com/book.jpg",
      }
    );
  });
});
