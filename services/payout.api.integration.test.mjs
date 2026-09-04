import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import {
  buildPayoutDashboardResponse,
  createInMemoryPayoutBankService,
  createMockPayoutService,
  samplePayoutTransaction,
} from "../test/helpers/payoutMocks.mjs";
import {
  bannedAuth,
  createPayoutTestApp,
  ownerAuth,
  sitterAuth,
} from "../test/helpers/payoutTestApp.mjs";

const maskedBankAccount = {
  bankCode: "SCB",
  bankName: "SCB",
  accountNumberMasked: "*444",
  accountName: "Jane Watson",
  bookBankImageUrl: "https://example.com/book.jpg",
};

function payoutApp(payoutHandler, bankRows = { "sitter-1": {} }) {
  return createPayoutTestApp({
    payoutService: createMockPayoutService(payoutHandler),
    payoutBankService: createInMemoryPayoutBankService(bankRows),
  });
}

describe("Payout API integration", () => {
  describe("GET /api/sitters/me/payout", () => {
    it("TC1 — returns payout dashboard shape", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.totalEarning, 5400);
      assert.ok(Array.isArray(res.body.data.transactions));
      assert.deepEqual(res.body.data.pagination, {
        page: 1,
        limit: 20,
        totalItems: 6,
      });
      assert.equal(res.body.data.bankAccount, null);
    });

    it("TC2 — keeps totalEarning global across paginated transactions", async () => {
      const app = payoutApp(async (_sitterId, query) =>
        buildPayoutDashboardResponse({
          totalEarning: 5400,
          transactions: [samplePayoutTransaction],
          pagination: {
            page: Number(query.page) || 2,
            limit: Number(query.limit) || 1,
            totalItems: 6,
          },
        })
      );

      const res = await request(app)
        .get("/api/sitters/me/payout?page=2&limit=1")
        .set("Authorization", sitterAuth);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.totalEarning, 5400);
      assert.equal(res.body.data.transactions.length, 1);
      assert.equal(res.body.data.pagination.page, 2);
      assert.equal(res.body.data.pagination.limit, 1);
      assert.equal(res.body.data.pagination.totalItems, 6);
    });

    it("TC3 — returns complete transaction fields", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);

      assert.deepEqual(res.body.data.transactions[0], samplePayoutTransaction);
    });

    it("TC4 — includes eligible cash in_service booking", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          transactions: [
            { ...samplePayoutTransaction, paymentMethod: "cash", amount: 900 },
          ],
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);

      assert.equal(res.body.data.transactions[0].paymentMethod, "cash");
      assert.equal(res.body.data.transactions[0].amount, 900);
    });

    it("TC5 — includes eligible cash success booking", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          transactions: [
            {
              ...samplePayoutTransaction,
              paymentMethod: "cash",
              amount: 1200,
            },
          ],
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);

      assert.equal(res.body.data.transactions[0].paymentMethod, "cash");
    });

    it("TC6 — includes eligible stripe paid booking", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          transactions: [
            {
              ...samplePayoutTransaction,
              paymentMethod: "stripe",
              amount: 1500,
            },
          ],
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);

      assert.equal(res.body.data.transactions[0].paymentMethod, "stripe");
    });

    it("TC7 — paginates transactions while keeping global totalEarning", async () => {
      const app = payoutApp(async (_sitterId, query) =>
        buildPayoutDashboardResponse({
          totalEarning: 5400,
          transactions: [samplePayoutTransaction],
          pagination: {
            page: Number(query.page),
            limit: Number(query.limit),
            totalItems: 6,
          },
        })
      );

      const res = await request(app)
        .get("/api/sitters/me/payout?page=2&limit=1")
        .set("Authorization", sitterAuth);

      assert.equal(res.body.data.pagination.page, 2);
      assert.equal(res.body.data.pagination.limit, 1);
      assert.equal(res.body.data.pagination.totalItems, 6);
      assert.equal(res.body.data.totalEarning, 5400);
    });

    it("TC8 — returns empty state for sitter without eligible earnings", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          totalEarning: 0,
          transactions: [],
          pagination: { page: 1, limit: 20, totalItems: 0 },
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);

      assert.equal(res.body.data.totalEarning, 0);
      assert.deepEqual(res.body.data.transactions, []);
      assert.equal(res.body.data.pagination.totalItems, 0);
    });

    it("TC11 — includes masked bank account on dashboard", async () => {
      const app = payoutApp(
        async () =>
          buildPayoutDashboardResponse({ bankAccount: maskedBankAccount }),
        {
          "sitter-1": {
            bank_code: "SCB",
            bank_name: "SCB",
            account_number: "003345347444",
            account_name: "Jane Watson",
            book_bank_image_url: "https://example.com/book.jpg",
          },
        }
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);

      assert.deepEqual(res.body.data.bankAccount, maskedBankAccount);
    });

    it("TC19 — rejects payout without login", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app).get("/api/sitters/me/payout");
      assert.equal(res.status, 401);
      assert.equal(res.body.message, "Unauthorized");
    });

    it("TC20 — rejects payout with invalid token", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", "Bearer invalid-token");
      assert.equal(res.status, 401);
    });

    it("TC21 — rejects payout for non-sitter owner", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", ownerAuth);
      assert.equal(res.status, 403);
      assert.equal(res.body.message, "Forbidden: You are not a sitter");
    });

    it("TC22 — rejects payout for banned account", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", bannedAuth);
      assert.equal(res.status, 403);
      assert.equal(res.body.message, "This account has been banned");
    });

    it("TC23 — excludes cash waiting_service bookings from dashboard data", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          totalEarning: 0,
          transactions: [],
          pagination: { page: 1, limit: 20, totalItems: 0 },
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);
      assert.equal(res.body.data.totalEarning, 0);
      assert.equal(res.body.data.transactions.length, 0);
    });

    it("TC24 — excludes cash pending bookings from dashboard data", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          totalEarning: 0,
          transactions: [],
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);
      assert.equal(res.body.data.totalEarning, 0);
    });

    it("TC25 — excludes stripe bookings before capture from dashboard data", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          totalEarning: 0,
          transactions: [],
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);
      assert.equal(res.body.data.transactions.length, 0);
    });

    it("TC26 — excludes cancelled cash bookings from dashboard data", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          totalEarning: 0,
          transactions: [],
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);
      assert.equal(res.body.data.totalEarning, 0);
    });

    it("TC27 — excludes cancelled stripe bookings from dashboard data", async () => {
      const app = payoutApp(async () =>
        buildPayoutDashboardResponse({
          totalEarning: 0,
          transactions: [],
        })
      );
      const res = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);
      assert.equal(res.body.data.totalEarning, 0);
    });

    it("TC40 — normalizes invalid pagination through payout service", async () => {
      const { createPayoutService } = await import("./payout.service.mjs");
      const payoutService = createPayoutService({
        sumEarningsBySitterId: async () => 0,
        findEligibleTransactionsBySitterId: async () => ({
          rows: [],
          totalItems: 0,
        }),
        findBankAccountByUserId: async () => null,
      });
      const app = createPayoutTestApp({
        payoutService,
        payoutBankService: createInMemoryPayoutBankService({
          "sitter-1": {},
        }),
      });

      const res = await request(app)
        .get("/api/sitters/me/payout?page=-1&limit=999")
        .set("Authorization", sitterAuth);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.pagination.page, 1);
      assert.equal(res.body.data.pagination.limit, 100);
    });
  });

  describe("GET /api/banks", () => {
    it("TC9 — returns bank list without login", async () => {
      const app = createPayoutTestApp({
        payoutService: createMockPayoutService(async () => ({})),
        payoutBankService: createInMemoryPayoutBankService(),
      });
      const res = await request(app).get("/api/banks");
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 8);
      assert.deepEqual(res.body.data[0], { code: "SCB", name: "SCB" });
    });
  });

  describe("GET /api/sitters/me/payout/bank-account", () => {
    it("TC10 — returns masked bank account details", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse(), {
        "sitter-1": {
          bank_code: "SCB",
          bank_name: "SCB",
          account_number: "003345347444",
          account_name: "Jane Watson",
          book_bank_image_url: "https://example.com/book.jpg",
        },
      });
      const res = await request(app)
        .get("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, maskedBankAccount);
    });

    it("TC12 — returns null when bank account is not configured", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse(), {
        "sitter-1": { bank_code: "SCB" },
      });
      const res = await request(app)
        .get("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth);

      assert.equal(res.status, 200);
      assert.equal(res.body.data, null);
    });

    it("TC39 — rejects bank-account lookup without login", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app).get("/api/sitters/me/payout/bank-account");
      assert.equal(res.status, 401);
    });
  });

  describe("PUT /api/sitters/me/payout/bank-account", () => {
    const validBody = {
      bankCode: "SCB",
      accountNumber: "003-345-347-444",
      accountName: "Jane Watson",
      bookBankImageUrl: "https://example.com/book.jpg",
    };

    it("TC13 — creates bank account for the first time", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send(validBody);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.accountNumberMasked, "*444");
      assert.equal(res.body.data.bankCode, "SCB");
    });

    it("TC14 — updates an existing bank account", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse(), {
        "sitter-1": {
          bank_code: "SCB",
          account_number: "003345347444",
          account_name: "Jane Watson",
          book_bank_image_url: "https://example.com/old.jpg",
        },
      });
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({
          bankCode: "KBANK",
          accountNumber: "1234567890",
          accountName: "Jane Updated",
          bookBankImageUrl: "https://example.com/new.jpg",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.bankCode, "KBANK");
      assert.equal(res.body.data.accountNumberMasked, "*890");
      assert.equal(res.body.data.accountName, "Jane Updated");
    });

    it("TC15 — normalizes lowercase bankCode", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({ ...validBody, bankCode: "scb" });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.bankCode, "SCB");
      assert.equal(res.body.data.bankName, "SCB");
    });

    it("TC28 — rejects missing bankCode", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({
          accountNumber: "003345347444",
          accountName: "Jane",
          bookBankImageUrl: "https://example.com/book.jpg",
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /bankCode/i);
    });

    it("TC29 — rejects invalid bankCode", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({ ...validBody, bankCode: "FAKE" });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Invalid bankCode/i);
    });

    it("TC30 — rejects account numbers shorter than 10 digits", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({ ...validBody, accountNumber: "123" });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /10 to 15 digits/);
    });

    it("TC31 — rejects account numbers longer than 15 digits", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({ ...validBody, accountNumber: "1234567890123456" });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /10 to 15 digits/);
    });

    it("TC32 — rejects missing accountNumber", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({
          bankCode: "SCB",
          accountName: "Jane",
          bookBankImageUrl: "https://example.com/book.jpg",
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /accountNumber is required/);
    });

    it("TC33 — rejects missing accountName", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({
          bankCode: "SCB",
          accountNumber: "003345347444",
          bookBankImageUrl: "https://example.com/book.jpg",
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /accountName is required/);
    });

    it("TC34 — rejects missing bookBankImageUrl", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({
          bankCode: "SCB",
          accountNumber: "003345347444",
          accountName: "Jane Watson",
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /bookBankImageUrl is required/);
    });

    it("TC38 — rejects bank-account update from owner", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", ownerAuth)
        .send(validBody);

      assert.equal(res.status, 403);
    });
  });

  describe("POST /api/sitters/me/payout/book-bank-image", () => {
    it("TC16 — uploads a book bank image", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .post("/api/sitters/me/payout/book-bank-image")
        .set("Authorization", sitterAuth)
        .attach("bookBankImage", Buffer.from("fake-image"), {
          filename: "book.jpg",
          contentType: "image/jpeg",
        });

      assert.equal(res.status, 200);
      assert.match(res.body.data.url, /^https:\/\/example\.com\/book-bank\//);
    });

    it("TC35 — rejects upload without file", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .post("/api/sitters/me/payout/book-bank-image")
        .set("Authorization", sitterAuth);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /bookBankImage is required/);
    });

    it("TC36 — rejects non-image uploads", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .post("/api/sitters/me/payout/book-bank-image")
        .set("Authorization", sitterAuth)
        .attach("bookBankImage", Buffer.from("%PDF-1.4"), {
          filename: "book.pdf",
          contentType: "application/pdf",
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /\.jpg, \.jpeg, or \.png/);
    });

    it("TC37 — rejects uploads larger than 2MB", async () => {
      const app = payoutApp(async () => buildPayoutDashboardResponse());
      const res = await request(app)
        .post("/api/sitters/me/payout/book-bank-image")
        .set("Authorization", sitterAuth)
        .attach("bookBankImage", Buffer.alloc(2 * 1024 * 1024 + 1, 1), {
          filename: "large.jpg",
          contentType: "image/jpeg",
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /2MB or smaller/);
    });
  });

  describe("Payout flow", () => {
    it("TC17 — upload image, save bank account, then read payout dashboard", async () => {
      const bankService = createInMemoryPayoutBankService({ "sitter-1": {} });
      const payoutHandler = async () =>
        buildPayoutDashboardResponse({
          bankAccount: maskedBankAccount,
        });
      const app = createPayoutTestApp({
        payoutService: createMockPayoutService(payoutHandler),
        payoutBankService: bankService,
      });

      const uploadRes = await request(app)
        .post("/api/sitters/me/payout/book-bank-image")
        .set("Authorization", sitterAuth)
        .attach("bookBankImage", Buffer.from("fake-image"), {
          filename: "book.jpg",
          contentType: "image/jpeg",
        });
      assert.equal(uploadRes.status, 200);

      const saveRes = await request(app)
        .put("/api/sitters/me/payout/bank-account")
        .set("Authorization", sitterAuth)
        .send({
          bankCode: "SCB",
          accountNumber: "003-345-347-444",
          accountName: "Jane Watson",
          bookBankImageUrl: uploadRes.body.data.url,
        });
      assert.equal(saveRes.status, 200);
      assert.equal(saveRes.body.data.accountNumberMasked, "*444");

      const payoutRes = await request(app)
        .get("/api/sitters/me/payout")
        .set("Authorization", sitterAuth);
      assert.equal(payoutRes.status, 200);
      assert.equal(payoutRes.body.data.bankAccount.accountNumberMasked, "*444");
    });
  });
});
