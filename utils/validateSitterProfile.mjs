import { httpError } from "./httpError.mjs";

const EXPERIENCE_VALUES = new Set(["0-2", "3-5", "5+"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.com$/i;

// validate แค่ข้อมูลพื้นฐานของ sitter (กล่อง 1)
export function validateSitterBasicBody(body) {
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

  const email = String(body.email ?? "").trim();
  if (!email) {
    throw httpError(400, "Email is required");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw httpError(400, "Email must include @ and end with .com");
  }

  const idNumber = String(body.id_number ?? "").trim();
  if (!idNumber) {
    throw httpError(400, "ID number is required");
  }
  if (!/^\d{13}$/.test(idNumber)) {
    throw httpError(400, "ID number must be 13 digits");
  }

  const dateOfBirth = String(body.date_of_birth ?? "").trim();
  if (!dateOfBirth) {
    throw httpError(400, "Date of birth is required");
  }

  const today = new Date();
  const minBirthDate = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  );
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > minBirthDate) {
    throw httpError(400, "Pet sitter must be at least 18 years old");
  }
}

// validate ข้อมูลทั้งหมดของ sitter (กล่อง 1-3)
export function validateSitterProfileBody(body) {
  validateSitterBasicBody(body);

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
