import { isValidPhone, normalizePhone } from "./phone.mjs";

// รูปแบบอีเมลแบบง่าย — ใช้ร่วม register / forgot-password
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ผลลัพธ์จากตัว parse:
 * - ok: true  → value พร้อมใช้ (trim / normalize แล้ว)
 * - ok: false → message สำหรับตอบ 400 (ข้อความเดิมจาก register)
 *
 * Ticket #1: ดึงกฎออกจาก middleware เพื่อให้ reset / oauth complete ใช้ชุดเดียวกัน
 */

/** ชื่อ 6–20 ตัวอักษรหลัง trim (ตรง FE / Owner Profile) */
export function parseName(name) {
  if (!name || !String(name).trim()) {
    return { ok: false, message: "Name is required" };
  }

  const value = String(name).trim();
  if (value.length < 6 || value.length > 20) {
    return {
      ok: false,
      message: "Name must be between 6 and 20 characters",
    };
  }

  return { ok: true, value };
}

/** อีเมลมีค่า + รูปทรงพื้นฐาน — ยังไม่บังคับ lower-case ที่นี่ (service ค่อย normalize) */
export function parseEmail(email) {
  if (!email) {
    return { ok: false, message: "Email is required" };
  }

  if (!EMAIL_PATTERN.test(String(email))) {
    return { ok: false, message: "Invalid email" };
  }

  return { ok: true, value: String(email) };
}

/**
 * เบอร์ไทย 10 หลักขึ้นต้น 0
 * normalize ก่อนเช็ค — "081 234 5678" กับ "0812345678" = เบอร์เดียวกัน
 */
export function parsePhone(phone) {
  // ตรงพฤติกรรม register เดิม: ไม่มีค่า → required; มีค่าแต่ไม่ผ่านรูป → 10 digits
  if (!phone) {
    return { ok: false, message: "Phone is required" };
  }

  const digits = normalizePhone(phone);
  if (!isValidPhone(digits)) {
    return { ok: false, message: "Phone must be 10 digits" };
  }

  return { ok: true, value: digits };
}

/**
 * รหัสผ่านต้องมากกว่า 8 ตัว (9 ตัวขึ้นไปผ่าน) — lock กับ FE Register + Reset password
 * ใช้ร่วม register (validateRegister) และ reset-password (validateResetPassword + service)
 */
export function parsePassword(password) {
  if (!password) {
    return { ok: false, message: "Password is required" };
  }

  // length <= 8 ไม่ผ่าน — ตรงกับ FE validatePassword
  if (String(password).length <= 8) {
    return {
      ok: false,
      message: "Password must be more than 8 characters",
    };
  }

  return { ok: true, value: String(password) };
}
