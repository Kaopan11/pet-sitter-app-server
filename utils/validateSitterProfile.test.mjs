import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateSitterBasicBody,
  validateSitterProfileBody,
} from "./validateSitterProfile.mjs";

function yearsAgo(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function validBasic(overrides = {}) {
  return {
    name: "Kai Cenat",
    experience_years: "5+",
    phone: "0814568779",
    email: "sitter8@test.com",
    date_of_birth: "2002-04-02",
    id_number: "1103700123451",
    introduction: "Yo, nice to meet you bro",
    ...overrides,
  };
}

function validFull(overrides = {}) {
  return validBasic({
    display_name: "Kai Cenat",
    address_detail: "123 Road",
    district: "Watthana",
    sub_district: "Khlong Toei Nuea",
    province: "Bangkok",
    post_code: "10110",
    ...overrides,
  });
}

function assertHttpError(fn, statusCode, message) {
  assert.throws(fn, (error) => {
    assert.equal(error.statusCode, statusCode);
    assert.equal(error.message, message);
    return true;
  });
}

describe("validateSitterBasicBody", () => {
  it("Happy Path: accepts valid basic information", () => {
    assert.doesNotThrow(() => validateSitterBasicBody(validBasic()));
  });

  it("Error Case: Full name empty string", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ name: "" })),
      400,
      "Full name is required"
    );
  });

  it("Error Case: Full name missing", () => {
    const body = validBasic();
    delete body.name;
    assertHttpError(
      () => validateSitterBasicBody(body),
      400,
      "Full name is required"
    );
  });

  it("Boundary Case: Full name length is 6", () => {
    assert.doesNotThrow(() =>
      validateSitterBasicBody(validBasic({ name: "Kaopan" }))
    );
  });

  it("Boundary Case: Full name length is 20", () => {
    assert.doesNotThrow(() =>
      validateSitterBasicBody(validBasic({ name: "ABCDEFGHIJKLMNOPQRST" }))
    );
  });

  it("Error Case: Full name shorter than 6", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ name: "Kai" })),
      400,
      "Full name must be 6-20 characters"
    );
  });

  it("Error Case: Full name longer than 20", () => {
    assertHttpError(
      () =>
        validateSitterBasicBody(validBasic({ name: "ABCDEFGHIJKLMNOPQRSTU" })),
      400,
      "Full name must be 6-20 characters"
    );
  });

  it("Error Case: Experience missing", () => {
    const body = validBasic();
    delete body.experience_years;
    assertHttpError(
      () => validateSitterBasicBody(body),
      400,
      "Experience is required"
    );
  });

  it("Error Case: Experience outside allowed values", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ experience_years: "10+" })),
      400,
      "Experience must be 0-2, 3-5, or 5+ Years"
    );
  });

  it("Error Case: Phone empty string", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ phone: "" })),
      400,
      "Phone number is required"
    );
  });

  it("Boundary Case: Phone is exactly 10 digits starting with 0", () => {
    assert.doesNotThrow(() =>
      validateSitterBasicBody(validBasic({ phone: "0812345678" }))
    );
  });

  it("Error Case: Phone does not start with 0", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ phone: "9123456789" })),
      400,
      "Phone number must be 10 digits and start with 0"
    );
  });

  it("Error Case: Phone shorter than 10 digits", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ phone: "08123" })),
      400,
      "Phone number must be 10 digits and start with 0"
    );
  });

  it("Error Case: Email empty string", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ email: "" })),
      400,
      "Email is required"
    );
  });

  it("Error Case: Email does not end with .com", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ email: "sitter@test.co" })),
      400,
      "Email must include @ and end with .com"
    );
  });

  it("Error Case: Email missing @", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ email: "sittertest.com" })),
      400,
      "Email must include @ and end with .com"
    );
  });

  it("Error Case: ID number empty string", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ id_number: "" })),
      400,
      "ID number is required"
    );
  });

  it("Boundary Case: ID number is exactly 13 digits", () => {
    assert.doesNotThrow(() =>
      validateSitterBasicBody(validBasic({ id_number: "1103700123451" }))
    );
  });

  it("Error Case: ID number is not 13 digits", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ id_number: "12345" })),
      400,
      "ID number must be 13 digits"
    );
  });

  it("Error Case: ID number contains letters", () => {
    assertHttpError(
      () =>
        validateSitterBasicBody(validBasic({ id_number: "abcdefghijklm" })),
      400,
      "ID number must be 13 digits"
    );
  });

  it("Error Case: Date of birth empty string", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ date_of_birth: "" })),
      400,
      "Date of birth is required"
    );
  });

  it("Boundary Case: age is exactly 18", () => {
    assert.doesNotThrow(() =>
      validateSitterBasicBody(validBasic({ date_of_birth: yearsAgo(18) }))
    );
  });

  it("Error Case: age is under 18", () => {
    assertHttpError(
      () => validateSitterBasicBody(validBasic({ date_of_birth: yearsAgo(17) })),
      400,
      "Pet sitter must be at least 18 years old"
    );
  });

  it("Error Case: Date of birth invalid format", () => {
    assertHttpError(
      () =>
        validateSitterBasicBody(validBasic({ date_of_birth: "not-a-date" })),
      400,
      "Pet sitter must be at least 18 years old"
    );
  });
});

describe("validateSitterProfileBody", () => {
  it("Happy Path: accepts valid full profile", () => {
    assert.doesNotThrow(() => validateSitterProfileBody(validFull()));
  });

  it("Error Case: display_name empty string", () => {
    assertHttpError(
      () => validateSitterProfileBody(validFull({ display_name: "" })),
      400,
      "Pet sitter name is required"
    );
  });

  it("Error Case: display_name missing", () => {
    const body = validFull();
    delete body.display_name;
    assertHttpError(
      () => validateSitterProfileBody(body),
      400,
      "Pet sitter name is required"
    );
  });

  it("Error Case: address_detail empty string", () => {
    assertHttpError(
      () => validateSitterProfileBody(validFull({ address_detail: "" })),
      400,
      "Address detail is required"
    );
  });

  it("Error Case: district empty string", () => {
    assertHttpError(
      () => validateSitterProfileBody(validFull({ district: "" })),
      400,
      "District is required"
    );
  });

  it("Error Case: district missing", () => {
    const body = validFull();
    delete body.district;
    assertHttpError(
      () => validateSitterProfileBody(body),
      400,
      "District is required"
    );
  });

  it("Error Case: sub_district empty string", () => {
    assertHttpError(
      () => validateSitterProfileBody(validFull({ sub_district: "" })),
      400,
      "Sub-district is required"
    );
  });

  it("Error Case: province empty string", () => {
    assertHttpError(
      () => validateSitterProfileBody(validFull({ province: "" })),
      400,
      "Province is required"
    );
  });

  it("Error Case: province missing", () => {
    const body = validFull();
    delete body.province;
    assertHttpError(
      () => validateSitterProfileBody(body),
      400,
      "Province is required"
    );
  });

  it("Error Case: post_code empty string", () => {
    assertHttpError(
      () => validateSitterProfileBody(validFull({ post_code: "" })),
      400,
      "Post code is required"
    );
  });

  it("Error Case: post_code missing", () => {
    const body = validFull();
    delete body.post_code;
    assertHttpError(
      () => validateSitterProfileBody(body),
      400,
      "Post code is required"
    );
  });

  it("Error Case: still rejects invalid basic fields in full profile", () => {
    assertHttpError(
      () => validateSitterProfileBody(validFull({ name: "Kai" })),
      400,
      "Full name must be 6-20 characters"
    );
  });
});
