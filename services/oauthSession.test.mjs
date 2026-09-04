import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runResolveOAuthSession } from "./oauthSession.mjs";

const toAuthUser = (profile, isSitter) => ({
  id: profile.id,
  email: profile.email,
  phone: profile.phone,
  name: profile.name ?? null,
  avatarUrl: profile.avatar_url ?? null,
  isSitter: Boolean(isSitter),
});

describe("runResolveOAuthSession", () => {
  it("rejects a missing access token", async () => {
    await assert.rejects(
      () =>
        runResolveOAuthSession("", {
          getUserByAccessToken: async () => ({ user: null, error: null }),
          findProfileById: async () => null,
          hasSitterProfile: async () => false,
          toAuthUser,
        }),
      (err) => {
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  it("rejects an invalid Supabase token", async () => {
    await assert.rejects(
      () =>
        runResolveOAuthSession("bad-token", {
          getUserByAccessToken: async () => ({
            user: null,
            error: { message: "invalid" },
          }),
          findProfileById: async () => null,
          hasSitterProfile: async () => false,
          toAuthUser,
        }),
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /unauthorized/i);
        return true;
      }
    );
  });

  it("returns 404 when Auth user exists but public.users profile is missing", async () => {
    await assert.rejects(
      () =>
        runResolveOAuthSession("oauth-token", {
          getUserByAccessToken: async (token) => {
            assert.equal(token, "oauth-token");
            return { user: { id: "auth-1" }, error: null };
          },
          findProfileById: async (id) => {
            assert.equal(id, "auth-1");
            return null;
          },
          hasSitterProfile: async () => false,
          toAuthUser,
        }),
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.match(err.message, /profile incomplete/i);
        return true;
      }
    );
  });

  it("returns token and user when the app profile already exists", async () => {
    const profile = {
      id: "auth-1",
      email: "owner@example.com",
      phone: "0812345678",
      name: "Kaopan1",
      avatar_url: null,
    };

    const result = await runResolveOAuthSession("oauth-token", {
      getUserByAccessToken: async () => ({
        user: { id: "auth-1" },
        error: null,
      }),
      findProfileById: async () => profile,
      hasSitterProfile: async (userId) => {
        assert.equal(userId, "auth-1");
        return true;
      },
      toAuthUser,
    });

    assert.deepEqual(result, {
      token: "oauth-token",
      user: {
        id: "auth-1",
        email: "owner@example.com",
        phone: "0812345678",
        name: "Kaopan1",
        avatarUrl: null,
        isSitter: true,
      },
    });
  });

  it("rejects a banned user", async () => {
    await assert.rejects(
      () =>
        runResolveOAuthSession("oauth-token", {
          getUserByAccessToken: async () => ({
            user: { id: "auth-1" },
            error: null,
          }),
          findProfileById: async () => ({
            id: "auth-1",
            email: "owner@example.com",
            is_banned: true,
          }),
          hasSitterProfile: async () => false,
          toAuthUser,
        }),
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /banned/i);
        return true;
      }
    );
  });
});
