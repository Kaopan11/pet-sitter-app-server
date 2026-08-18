import { httpError } from "./httpError.mjs";

const EXPERIENCE_VALUES = new Set(["0-2", "3-5", "5+"]);

export function validateSitterProfileBody(body) {
  const name = String(body.name ?? "").trim();
  if (!name) {
    throw httpError(400, "Full name is required");
  }
  if (name.length < 6 || name.length > 20) {
    throw httpError(400, "Full name must be 6-20 characters");
  }

  const experience = String(body.experience_years ?? "").trim();
  if (!experience) {
    throw httpError(400, "Experience is required");
  }
  if (!EXPERIENCE_VALUES.has(experience)) {
    throw httpError(400, "Experience must be 0-2, 3-5, or 5+ Years");
  }

  const phone = String(body.phone ?? "").trim();
  if (!phone) {
    throw httpError(400, "Phone number is required");
  }
  if (!/^0\d{9}$/.test(phone)) {
    throw httpError(400, "Phone number must be 10 digits and start with 0");
  }

  if (body.email) {
    const email = String(body.email).trim();
    if (!email.includes("@") || !email.toLowerCase().includes(".com")) {
      throw httpError(400, "Email must contain @ and .com");
    }
  }

  const displayName = String(body.display_name ?? "").trim();
  if (!displayName) {
    throw httpError(400, "Pet sitter name is required");
  }

  const requiredAddress = [
    ["address_detail", "Address detail"],
    ["district", "District"],
    ["sub_district", "Sub-district"],
    ["province", "Province"],
    ["post_code", "Post code"],
  ];

  for (const [key, label] of requiredAddress) {
    if (!String(body[key] ?? "").trim()) {
      throw httpError(400, `${label} is required`);
    }
  }
}
