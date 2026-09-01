import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listThaiBanks,
  maskAccountNumber,
  resolveThaiBankByCode,
} from "./thaiBanks.mjs";

describe("listThaiBanks", () => {
  it("returns code and English name pairs", () => {
    const banks = listThaiBanks();
    assert.ok(banks.some((bank) => bank.code === "SCB"));
    assert.deepEqual(banks[0], { code: "SCB", name: "SCB" });
  });
});

describe("resolveThaiBankByCode", () => {
  it("resolves known bank codes case-insensitively", () => {
    assert.deepEqual(resolveThaiBankByCode("scb"), {
      code: "SCB",
      name: "SCB",
    });
  });

  it("rejects unknown bank codes", () => {
    assert.throws(() => resolveThaiBankByCode("FAKE"), (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  });
});

describe("maskAccountNumber", () => {
  it("masks to last three digits", () => {
    assert.equal(maskAccountNumber("003345347444"), "*444");
  });

  it("returns empty string for missing input", () => {
    assert.equal(maskAccountNumber(""), "");
  });
});
