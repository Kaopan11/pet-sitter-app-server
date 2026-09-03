import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sitterStatusCopy } from "./notifications.service.mjs";

describe("sitterStatusCopy", () => {
  it("covers admin verify / approve / reject", () => {
    assert.equal(sitterStatusCopy("Verified").title, "Identity verified");
    assert.equal(sitterStatusCopy("Approved").title, "Profile approved");
    assert.equal(sitterStatusCopy("Rejected").title, "Profile rejected");
    assert.equal(sitterStatusCopy("Unverified").title, "Verification not approved");
    assert.equal(sitterStatusCopy("Waiting for approve"), null);
  });
});
