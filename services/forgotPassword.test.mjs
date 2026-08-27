import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORGOT_PASSWORD_MESSAGE,
  buildResetRedirectUrl,
  runForgotPassword,
} from "./forgotPassword.mjs";

describe("buildResetRedirectUrl", () => {
  it("appends /reset-password and strips a trailing slash", () => {
    assert.equal(
      buildResetRedirectUrl("http://localhost:3000/"),
      "http://localhost:3000/reset-password"
    );
  });

  it("rejects when FRONTEND_URL is missing", () => {
    assert.throws(() => buildResetRedirectUrl(""), (err) => {
      assert.equal(err.statusCode, 500);
      assert.match(err.message, /FRONTEND_URL/);
      return true;
    });
  });
});

describe("runForgotPassword", () => {
  it("rejects invalid email before looking up the user", async () => {
    let lookedUp = false;
    await assert.rejects(
      () =>
        runForgotPassword("not-an-email", {
          findByEmail: async () => {
            lookedUp = true;
            return null;
          },
          sendResetEmail: async () => ({ error: null }),
          getResetRedirectUrl: () => "http://localhost:3000/reset-password",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /invalid email/i);
        return true;
      }
    );
    assert.equal(lookedUp, false);
  });

  it("returns the same success message when no account exists and does not send email", async () => {
    let sendCalls = 0;
    const result = await runForgotPassword("missing@example.com", {
      findByEmail: async () => null,
      sendResetEmail: async () => {
        sendCalls += 1;
        return { error: null };
      },
      getResetRedirectUrl: () => "http://localhost:3000/reset-password",
    });

    assert.equal(result.message, FORGOT_PASSWORD_MESSAGE);
    assert.equal(sendCalls, 0);
  });

  it("sends a reset email when the account exists and returns the same success message", async () => {
    const calls = [];
    const result = await runForgotPassword("Owner@Example.com", {
      findByEmail: async (email) => {
        assert.equal(email, "owner@example.com");
        return { id: "user-1", email };
      },
      sendResetEmail: async (email, redirectTo) => {
        calls.push({ email, redirectTo });
        return { error: null };
      },
      getResetRedirectUrl: () => "http://localhost:3000/reset-password",
    });

    assert.equal(result.message, FORGOT_PASSWORD_MESSAGE);
    assert.deepEqual(calls, [
      {
        email: "owner@example.com",
        redirectTo: "http://localhost:3000/reset-password",
      },
    ]);
  });

  it("returns the same success message when sending fails so emails cannot be enumerated", async () => {
    const logs = [];
    const result = await runForgotPassword("owner@example.com", {
      findByEmail: async () => ({ id: "user-1" }),
      sendResetEmail: async () => ({
        error: { message: "SMTP unavailable" },
      }),
      getResetRedirectUrl: () => "http://localhost:3000/reset-password",
      logError: (err) => logs.push(err),
    });

    assert.equal(result.message, FORGOT_PASSWORD_MESSAGE);
    assert.equal(logs.length, 1);
  });
});
