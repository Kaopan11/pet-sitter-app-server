import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCompleteOAuthProfile } from "./oauthComplete.mjs";

const toAuthUser = (profile, isSitter) => ({
  id: profile.id,
  email: profile.email,
  phone: profile.phone,
  name: profile.name ?? null,
  avatarUrl: profile.avatar_url ?? null,
  isSitter: Boolean(isSitter),
});

function baseDeps(overrides = {}) {
  return {
    getUserByAccessToken: async () => ({
      user: { id: "auth-1", email: "owner@example.com" },
      error: null,
    }),
    findProfileById: async () => null,
    findProfileByPhone: async () => null,
    createProfile: async (row) => ({
      id: row.id,
      email: row.email,
      phone: row.phone,
      name: row.name,
      avatar_url: null,
    }),
    hasSitterProfile: async () => false,
    toAuthUser,
    ...overrides,
  };
}

describe("runCompleteOAuthProfile", () => {
  it("rejects an invalid token", async () => {
    await assert.rejects(
      () =>
        runCompleteOAuthProfile(
          {
            accessToken: "bad",
            name: "Kaopan1",
            phone: "0812345678",
          },
          baseDeps({
            getUserByAccessToken: async () => ({
              user: null,
              error: { message: "nope" },
            }),
          })
        ),
      (err) => {
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  it("rejects invalid name before creating a profile", async () => {
    let created = false;
    await assert.rejects(
      () =>
        runCompleteOAuthProfile(
          { accessToken: "tok", name: "Ab", phone: "0812345678" },
          baseDeps({
            createProfile: async () => {
              created = true;
              return null;
            },
          })
        ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /6 and 20/i);
        return true;
      }
    );
    assert.equal(created, false);
  });

  it("rejects a phone that is already used by another account", async () => {
    await assert.rejects(
      () =>
        runCompleteOAuthProfile(
          {
            accessToken: "tok",
            name: "Kaopan1",
            phone: "0812345678",
          },
          baseDeps({
            findProfileByPhone: async () => ({ id: "other-user" }),
          })
        ),
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /phone/i);
        return true;
      }
    );
  });

  it("creates an Owner profile and returns login-shaped data", async () => {
    const creates = [];
    const result = await runCompleteOAuthProfile(
      {
        accessToken: "oauth-token",
        name: "  Kaopan1  ",
        phone: "081 234 5678",
      },
      baseDeps({
        createProfile: async (row) => {
          creates.push(row);
          return {
            id: row.id,
            email: row.email,
            phone: row.phone,
            name: row.name,
            avatar_url: null,
          };
        },
      })
    );

    assert.deepEqual(creates, [
      {
        id: "auth-1",
        email: "owner@example.com",
        phone: "0812345678",
        name: "Kaopan1",
      },
    ]);
    assert.deepEqual(result, {
      token: "oauth-token",
      user: {
        id: "auth-1",
        email: "owner@example.com",
        phone: "0812345678",
        name: "Kaopan1",
        avatarUrl: null,
        isSitter: false,
      },
    });
  });

  it("returns the existing profile without creating again (idempotent)", async () => {
    let createCalls = 0;
    const existing = {
      id: "auth-1",
      email: "owner@example.com",
      phone: "0812345678",
      name: "Kaopan1",
      avatar_url: null,
    };

    const result = await runCompleteOAuthProfile(
      {
        accessToken: "oauth-token",
        name: "NewName1",
        phone: "0899999999",
      },
      baseDeps({
        findProfileById: async () => existing,
        hasSitterProfile: async () => true,
        createProfile: async () => {
          createCalls += 1;
          return null;
        },
      })
    );

    assert.equal(createCalls, 0);
    assert.equal(result.user.isSitter, true);
    assert.equal(result.user.name, "Kaopan1");
  });
});
