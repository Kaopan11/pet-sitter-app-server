import { httpError } from "../../utils/httpError.mjs";
import { listThaiBanks } from "../../utils/thaiBanks.mjs";
import {
  mapBankAccountResponse,
  parseBankAccountPutBody,
} from "../../services/payoutBank.service.mjs";

export function createInMemoryPayoutBankService(initialRows = {}) {
  const rows = new Map(Object.entries(initialRows));

  return {
    getBanks() {
      return listThaiBanks();
    },

    async getBankAccount(sitterId) {
      if (!rows.has(sitterId)) {
        throw httpError(404, "Sitter profile not found");
      }
      return mapBankAccountResponse(rows.get(sitterId));
    },

    async updateBankAccount(sitterId, body) {
      const fields = parseBankAccountPutBody(body);
      const row = {
        bank_code: fields.bankCode,
        bank_name: fields.bankName,
        account_number: fields.accountNumber,
        account_name: fields.accountName,
        book_bank_image_url: fields.bookBankImageUrl,
      };
      rows.set(sitterId, row);
      return mapBankAccountResponse(row);
    },

    async uploadBookBankImage(sitterId, file) {
      if (!file) {
        throw httpError(400, "bookBankImage is required");
      }
      return { url: `https://example.com/book-bank/${sitterId}.jpg` };
    },
  };
}

export function createMockPayoutService(handler) {
  return {
    async getMyPayout(sitterId, query) {
      return handler(sitterId, query);
    },
  };
}

export const samplePayoutTransaction = {
  date: "2026-08-25",
  from: "John Wick",
  transactionNo: "TX-20260901-0001",
  amount: 900,
  bookingId: "booking-1",
  paymentMethod: "cash",
};

export function buildPayoutDashboardResponse(overrides = {}) {
  return {
    totalEarning: 5400,
    bankAccount: null,
    transactions: [samplePayoutTransaction],
    pagination: {
      page: 1,
      limit: 20,
      totalItems: 6,
    },
    ...overrides,
  };
}
