import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runLogin } from "./login.mjs";

const ownerProfile = {
  id: "owner-1",
  email: "owner@example.com",
  phone: "0812345678",
  name: "Owner User",
  avatar_url: null,
  is_admin: false,
  is_banned: false,
};

const sitterProfile = {
  id: "sitter-1",
  email: "sitter@example.com",
  phone: "0812345679",
  name: "Sitter User",
  avatar_url: null,
  is_admin: false,
  is_banned: false,
};

const adminProfile = {
  id: "admin-1",
  email: "admin@example.com",
  phone: "0812345680",
  name: "Admin User",
  avatar_url: null,
  is_admin: true,
  is_banned: false,
};

function successSession(token = "access-token-123") {
  return {
    data: {
      user: { id: "auth-user" },
      session: { access_token: token },
    },
    error: null,
  };
}

function createDeps(overrides = {}) {
  return {
    findByEmail: async () => ownerProfile,
    signInWithPassword: async () => successSession(),
    findSitterProfileByUserId: async () => null,
    ...overrides,
  };
}

describe("runLogin", () => {
  it("TC4 — normalizes email to lowercase before lookup", async () => {
    const calls = [];
    const deps = createDeps({
      findByEmail: async (email) => {
        calls.push(email);
        return ownerProfile;
      },
    });

    await runLogin(
      { email: "Owner@Example.COM", password: "password123" },
      deps
    );

    assert.deepEqual(calls, ["owner@example.com"]);
  });

  it("TC5 — trims surrounding spaces from email before lookup", async () => {
    const calls = [];
    const deps = createDeps({
      findByEmail: async (email) => {
        calls.push(email);
        return ownerProfile;
      },
    });

    await runLogin(
      { email: "  owner@example.com  ", password: "password123" },
      deps
    );

    assert.deepEqual(calls, ["owner@example.com"]);
  });

  it("TC12 — rejects unknown email before checking password", async () => {
    let signInCalls = 0;
    const deps = createDeps({
      findByEmail: async () => null,
      signInWithPassword: async () => {
        signInCalls += 1;
        return successSession();
      },
    });

    await assert.rejects(
      () =>
        runLogin(
          { email: "notregistered@example.com", password: "password123" },
          deps
        ),
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.message, "Email is incorrect");
        return true;
      }
    );
    assert.equal(signInCalls, 0);
  });

  it("TC13 — rejects wrong password when email exists", async () => {
    const deps = createDeps({
      signInWithPassword: async () => ({
        data: null,
        error: { message: "Invalid login credentials" },
      }),
    });

    await assert.rejects(
      () =>
        runLogin(
          { email: "owner@example.com", password: "wrongpassword" },
          deps
        ),
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.message, "Password is incorrect");
        return true;
      }
    );
  });

  it("TC14 — checks email before password when both are wrong", async () => {
    let signInCalls = 0;
    const deps = createDeps({
      findByEmail: async () => null,
      signInWithPassword: async () => {
        signInCalls += 1;
        return successSession();
      },
    });

    await assert.rejects(
      () =>
        runLogin(
          { email: "wrong@example.com", password: "wrongpassword" },
          deps
        ),
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.message, "Email is incorrect");
        return true;
      }
    );
    assert.equal(signInCalls, 0);
  });

  it("TC15 — rejects banned accounts before checking password", async () => {
    let signInCalls = 0;
    const deps = createDeps({
      findByEmail: async () => ({ ...ownerProfile, is_banned: true }),
      signInWithPassword: async () => {
        signInCalls += 1;
        return successSession();
      },
    });

    await assert.rejects(
      () =>
        runLogin({ email: "owner@example.com", password: "password123" }, deps),
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.message, "This account has been banned");
        return true;
      }
    );
    assert.equal(signInCalls, 0);
  });

  it("TC1 — returns token and owner user shape on success", async () => {
    const result = await runLogin(
      { email: "owner@example.com", password: "password123" },
      createDeps()
    );

    assert.equal(result.token, "access-token-123");
    assert.deepEqual(result.user, {
      id: "owner-1",
      email: "owner@example.com",
      phone: "0812345678",
      name: "Owner User",
      avatarUrl: null,
      isSitter: false,
      isAdmin: false,
    });
  });

  it("TC2 — marks sitter accounts with isSitter true", async () => {
    const result = await runLogin(
      { email: "sitter@example.com", password: "password123" },
      createDeps({
        findByEmail: async () => sitterProfile,
        findSitterProfileByUserId: async () => ({ user_id: "sitter-1" }),
      })
    );

    assert.equal(result.user.isSitter, true);
    assert.equal(result.user.isAdmin, false);
  });

  it("TC3 — marks admin accounts with isAdmin true", async () => {
    const result = await runLogin(
      { email: "admin@example.com", password: "password123" },
      createDeps({
        findByEmail: async () => adminProfile,
      })
    );

    assert.equal(result.user.isAdmin, true);
    assert.equal(result.user.isSitter, false);
  });

  it("TC7 — returns complete user fields required by the API contract", async () => {
    const result = await runLogin(
      { email: "owner@example.com", password: "password123" },
      createDeps({
        findByEmail: async () => ({
          ...ownerProfile,
          avatar_url: "https://example.com/avatar.png",
        }),
      })
    );

    assert.equal(typeof result.token, "string");
    assert.ok(result.token.length > 0);
    assert.deepEqual(Object.keys(result.user).sort(), [
      "avatarUrl",
      "email",
      "id",
      "isAdmin",
      "isSitter",
      "name",
      "phone",
    ]);
    assert.equal(result.user.avatarUrl, "https://example.com/avatar.png");
  });
});
