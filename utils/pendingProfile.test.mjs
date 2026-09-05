import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFullProfileUnlocked,
  nextStatusAfterUpdate,
  overlayPending,
} from "./pendingProfile.mjs";

describe("isFullProfileUnlocked", () => {
  it("unlocks Verified, Waiting for approve, and Approved", () => {
    assert.equal(isFullProfileUnlocked("Verified"), true);
    assert.equal(isFullProfileUnlocked("Waiting for approve"), true);
    assert.equal(isFullProfileUnlocked("Approved"), true);
  });

  it("keeps Unverified and Waiting for verify locked", () => {
    assert.equal(isFullProfileUnlocked("Unverified"), false);
    assert.equal(isFullProfileUnlocked("Waiting for verify"), false);
  });

  it("unlocks Rejected only when full profile data exists", () => {
    assert.equal(isFullProfileUnlocked("Rejected", null), false);
    assert.equal(
      isFullProfileUnlocked("Rejected", { address_detail: "123 Road" }),
      true
    );
    assert.equal(
      isFullProfileUnlocked("Rejected", {
        pending_profile: { display_name: "Happy Paws" },
      }),
      true
    );
  });
});

describe("nextStatusAfterUpdate", () => {
  it("moves locked statuses to Waiting for verify", () => {
    assert.equal(nextStatusAfterUpdate("Unverified"), "Waiting for verify");
    assert.equal(
      nextStatusAfterUpdate("Waiting for verify"),
      "Waiting for verify"
    );
  });

  it("moves unlocked statuses to Waiting for approve", () => {
    assert.equal(nextStatusAfterUpdate("Verified"), "Waiting for approve");
    assert.equal(nextStatusAfterUpdate("Approved"), "Waiting for approve");
    assert.equal(
      nextStatusAfterUpdate("Rejected", { province: "Bangkok" }),
      "Waiting for approve"
    );
  });
});

describe("overlayPending", () => {
  it("returns the same row when pending_profile is missing", () => {
    const row = { name: "Old Name", phone: "0812345678" };
    assert.equal(overlayPending(row), row);
  });

  it("overlays pending values onto the live row", () => {
    const row = {
      name: "Old Name",
      phone: "0811111111",
      display_name: "Old Shop",
      pending_profile: {
        full_name: "New Name",
        phone: "0899999999",
        display_name: "New Shop",
      },
    };

    const result = overlayPending(row);
    assert.equal(result.name, "New Name");
    assert.equal(result.phone, "0899999999");
    assert.equal(result.display_name, "New Shop");
    assert.equal(result.pet_sitter_name, "New Shop");
  });
});
