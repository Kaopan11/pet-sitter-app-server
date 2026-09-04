import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseEmail,
  parseName,
  parsePassword,
  parsePhone,
} from "./authValidation.mjs";

describe("parseName", () => {
  it("trims and accepts names between 6 and 20 characters", () => {
    assert.deepEqual(parseName("  Kaopan  "), {
      ok: true,
      value: "Kaopan",
    });
  });

  it("rejects missing name", () => {
    assert.deepEqual(parseName(""), {
      ok: false,
      message: "Name is required",
    });
  });

  it("rejects names shorter than 6 characters", () => {
    assert.deepEqual(parseName("Short"), {
      ok: false,
      message: "Name must be between 6 and 20 characters",
    });
  });

  it("rejects names longer than 20 characters", () => {
    assert.deepEqual(parseName("A".repeat(21)), {
      ok: false,
      message: "Name must be between 6 and 20 characters",
    });
  });
});

describe("parseEmail", () => {
  it("accepts a normal email", () => {
    assert.deepEqual(parseEmail("owner@example.com"), {
      ok: true,
      value: "owner@example.com",
    });
  });

  it("rejects missing email", () => {
    assert.deepEqual(parseEmail(""), {
      ok: false,
      message: "Email is required",
    });
  });

  it("rejects invalid email shape", () => {
    assert.deepEqual(parseEmail("not-an-email"), {
      ok: false,
      message: "Invalid email",
    });
  });
});

describe("parsePhone", () => {
  it("normalizes spaced phone numbers to 10 digits", () => {
    assert.deepEqual(parsePhone("081 234 5678"), {
      ok: true,
      value: "0812345678",
    });
  });

  it("rejects missing phone", () => {
    assert.deepEqual(parsePhone(""), {
      ok: false,
      message: "Phone is required",
    });
  });

  it("rejects phone that is not 10 Thai digits", () => {
    assert.deepEqual(parsePhone("123"), {
      ok: false,
      message: "Phone must be 10 digits",
    });
  });

  it("rejects non-digit input as invalid length, not missing", () => {
    assert.deepEqual(parsePhone("---"), {
      ok: false,
      message: "Phone must be 10 digits",
    });
  });
});

describe("parsePassword", () => {
  // กฎ lock กับ FE: มากกว่า 8 ตัว (9 ตัวขึ้นไปผ่าน)
  it("accepts passwords with more than 8 characters", () => {
    assert.deepEqual(parsePassword("123456789"), {
      ok: true,
      value: "123456789",
    });
  });

  it("rejects missing password", () => {
    assert.deepEqual(parsePassword(""), {
      ok: false,
      message: "Password is required",
    });
  });

  it("rejects passwords with exactly 8 characters", () => {
    assert.deepEqual(parsePassword("12345678"), {
      ok: false,
      message: "Password must be more than 8 characters",
    });
  });

  it("rejects passwords with 8 or fewer characters", () => {
    assert.deepEqual(parsePassword("1234567"), {
      ok: false,
      message: "Password must be more than 8 characters",
    });
  });
});
