import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateLogin } from "./validateAuth.mjs";

function runValidateLogin(body) {
  return new Promise((resolve) => {
    const req = { body };
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({ statusCode: this.statusCode, body: this.body });
      },
    };
    const next = () => resolve({ next: true, req });
    validateLogin(req, res, next);
  });
}

describe("validateLogin", () => {
  it("TC9 — rejects missing email", async () => {
    const result = await runValidateLogin({ password: "password123" });
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.message, "Email is required");
  });

  it("TC10 — rejects missing password", async () => {
    const result = await runValidateLogin({ email: "owner@example.com" });
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.message, "Password is required");
  });

  it("TC11 — rejects missing email before checking password", async () => {
    const result = await runValidateLogin({});
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.message, "Email is required");
  });

  it("TC18 — treats whitespace-only email as present and forwards to service", async () => {
    const result = await runValidateLogin({
      email: "   ",
      password: "password123",
    });
    assert.equal(result.next, true);
    assert.equal(result.req.body.email, "   ");
  });

  it("TC19 — treats whitespace-only password as present and forwards to service", async () => {
    const result = await runValidateLogin({
      email: "owner@example.com",
      password: "   ",
    });
    assert.equal(result.next, true);
    assert.equal(result.req.body.password, "   ");
  });

  it("passes valid email and password to the controller", async () => {
    const result = await runValidateLogin({
      email: "owner@example.com",
      password: "password123",
    });
    assert.equal(result.next, true);
  });
});
