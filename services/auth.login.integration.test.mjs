import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { httpError } from "../utils/httpError.mjs";
import { createLoginTestApp } from "../test/helpers/loginTestApp.mjs";

const ownerUser = {
  id: "owner-1",
  email: "owner@example.com",
  phone: "0812345678",
  name: "Owner User",
  avatarUrl: null,
  isSitter: false,
  isAdmin: false,
};

const sitterUser = {
  id: "sitter-1",
  email: "sitter@example.com",
  phone: "0812345679",
  name: "Sitter User",
  avatarUrl: null,
  isSitter: true,
  isAdmin: false,
};

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  phone: "0812345680",
  name: "Admin User",
  avatarUrl: null,
  isSitter: false,
  isAdmin: true,
};

function createMockAuthService(handler) {
  return {
    async login(body) {
      return handler(body);
    },
  };
}

function successLogin(user, token = "jwt-token-abc") {
  return createMockAuthService(async () => ({
    token,
    user,
  }));
}

describe("POST /api/auth/login integration", () => {
  it("TC1 — owner login returns 200 with token and user", async () => {
    const app = createLoginTestApp(successLogin(ownerUser));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@example.com", password: "password123" });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Login success");
    assert.equal(res.body.data.token, "jwt-token-abc");
    assert.deepEqual(res.body.data.user, ownerUser);
  });

  it("TC2 — sitter login returns isSitter true", async () => {
    const app = createLoginTestApp(successLogin(sitterUser));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "sitter@example.com", password: "password123" });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.isSitter, true);
  });

  it("TC3 — admin login returns isAdmin true", async () => {
    const app = createLoginTestApp(successLogin(adminUser));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "password123" });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.isAdmin, true);
  });

  it("TC4 — accepts mixed-case email at the HTTP layer", async () => {
    const calls = [];
    const app = createLoginTestApp(
      createMockAuthService(async (body) => {
        calls.push(body.email);
        return { token: "jwt-token-abc", user: ownerUser };
      })
    );

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "Owner@Example.COM", password: "password123" });

    assert.equal(res.status, 200);
    assert.equal(calls[0], "Owner@Example.COM");
  });

  it("TC5 — forwards trimmed-looking email input to the service", async () => {
    const calls = [];
    const app = createLoginTestApp(
      createMockAuthService(async (body) => {
        calls.push(body.email);
        return { token: "jwt-token-abc", user: ownerUser };
      })
    );

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "  owner@example.com  ", password: "password123" });

    assert.equal(res.status, 200);
    assert.equal(calls[0], "  owner@example.com  ");
  });

  it("TC7 — response includes message, token, and full user object", async () => {
    const app = createLoginTestApp(successLogin(ownerUser, "token-xyz"));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@example.com", password: "password123" });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Login success");
    assert.equal(res.body.data.token, "token-xyz");
    assert.deepEqual(Object.keys(res.body.data.user).sort(), [
      "avatarUrl",
      "email",
      "id",
      "isAdmin",
      "isSitter",
      "name",
      "phone",
    ]);
  });

  it("TC9 — missing email returns 400", async () => {
    const app = createLoginTestApp(successLogin(ownerUser));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "password123" });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Email is required");
  });

  it("TC10 — missing password returns 400", async () => {
    const app = createLoginTestApp(successLogin(ownerUser));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@example.com" });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Password is required");
  });

  it("TC12 — unknown email returns 401 Email is incorrect", async () => {
    const app = createLoginTestApp(
      createMockAuthService(async () => {
        throw httpError(401, "Email is incorrect");
      })
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "notregistered@example.com", password: "password123" });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Email is incorrect");
  });

  it("TC13 — wrong password returns 401 Password is incorrect", async () => {
    const app = createLoginTestApp(
      createMockAuthService(async () => {
        throw httpError(401, "Password is incorrect");
      })
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@example.com", password: "wrongpassword" });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Password is incorrect");
  });

  it("TC14 — wrong email returns Email is incorrect before password check", async () => {
    const app = createLoginTestApp(
      createMockAuthService(async () => {
        throw httpError(401, "Email is incorrect");
      })
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrong@example.com", password: "wrongpassword" });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Email is incorrect");
  });

  it("TC15 — banned account returns 403", async () => {
    const app = createLoginTestApp(
      createMockAuthService(async () => {
        throw httpError(403, "This account has been banned");
      })
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "banned@example.com", password: "password123" });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, "This account has been banned");
  });

  it("TC21 — empty body returns 400 Email is required", async () => {
    const app = createLoginTestApp(successLogin(ownerUser));
    const res = await request(app).post("/api/auth/login").send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Email is required");
  });

  it("TC22 — email-only body returns 400 Password is required", async () => {
    const app = createLoginTestApp(successLogin(ownerUser));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@example.com" });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Password is required");
  });
});
