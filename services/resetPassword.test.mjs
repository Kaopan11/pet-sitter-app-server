import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESET_PASSWORD_MESSAGE,
  runResetPassword,
} from "./resetPassword.mjs";

describe("runResetPassword", () => {
  it("rejects a short new password before touching auth", async () => {
    let getUserCalls = 0;
    await assert.rejects(
      () =>
        runResetPassword(
          { accessToken: "tok", newPassword: "12345" },
          {
            getUserByAccessToken: async () => {
              getUserCalls += 1;
              return { user: { id: "u1" }, error: null };
            },
            updatePassword: async () => ({ error: null }),
          }
        ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /at least 6/i);
        return true;
      }
    );
    assert.equal(getUserCalls, 0);
  });

  it("rejects a missing access token", async () => {
    await assert.rejects(
      () =>
        runResetPassword(
          { accessToken: "", newPassword: "secret1" },
          {
            getUserByAccessToken: async () => ({ user: null, error: null }),
            updatePassword: async () => ({ error: null }),
          }
        ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /accessToken/i);
        return true;
      }
    );
  });

  it("rejects an invalid or expired recovery token", async () => {
    await assert.rejects(
      () =>
        runResetPassword(
          { accessToken: "bad-token", newPassword: "secret1" },
          {
            getUserByAccessToken: async () => ({
              user: null,
              error: { message: "invalid JWT" },
            }),
            updatePassword: async () => ({ error: null }),
          }
        ),
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /invalid or expired/i);
        return true;
      }
    );
  });

  it("updates the password when the recovery token is valid", async () => {
    const updates = [];
    const result = await runResetPassword(
      { accessToken: "good-token", newPassword: "secret1" },
      {
        getUserByAccessToken: async (token) => {
          assert.equal(token, "good-token");
          return { user: { id: "user-42" }, error: null };
        },
        updatePassword: async (userId, password) => {
          updates.push({ userId, password });
          return { error: null };
        },
      }
    );

    assert.equal(result.message, RESET_PASSWORD_MESSAGE);
    assert.deepEqual(updates, [{ userId: "user-42", password: "secret1" }]);
  });

  it("surfaces provider errors when the password update fails", async () => {
    await assert.rejects(
      () =>
        runResetPassword(
          { accessToken: "good-token", newPassword: "secret1" },
          {
            getUserByAccessToken: async () => ({
              user: { id: "user-42" },
              error: null,
            }),
            updatePassword: async () => ({
              error: { message: "Weak password" },
            }),
          }
        ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Weak password/);
        return true;
      }
    );
  });
});
