import {
  parseEmail,
  parseName,
  parsePassword,
  parsePhone,
} from "../utils/authValidation.mjs";

/**
 * Express middleware ตรวจ body ก่อนเข้า auth controller
 * กฎจริงอยู่ที่ utils/authValidation — ที่นี่แค่ map ผลลัพธ์ → 400 หรือ next()
 */

function rejectIfInvalid(result, req, res, bodyKey) {
  if (!result.ok) {
    return res.status(400).json({ message: result.message });
  }
  // เขียนค่าที่ normalize แล้วกลับเข้า body ให้ service ใช้ต่อได้เลย
  req.body[bodyKey] = result.value;
  return null;
}

// ตรวจ body ตอนสมัคร ถ้าไม่ผ่านจะหยุดที่นี่ ไม่เข้า controller
export const validateRegister = (req, res, next) => {
  const { name, email, phone, password, asSitter } = req.body ?? {};

  if (rejectIfInvalid(parseName(name), req, res, "name")) return;
  if (rejectIfInvalid(parseEmail(email), req, res, "email")) return;
  if (rejectIfInvalid(parsePhone(phone), req, res, "phone")) return;
  if (rejectIfInvalid(parsePassword(password), req, res, "password")) return;

  // asSitter ต้องเป็น true/false จริงๆ ไม่ใช่ string — เฉพาะ register
  if (typeof asSitter !== "boolean") {
    return res.status(400).json({ message: "asSitter must be true or false" });
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const { email, password } = req.body ?? {};

  // Login เดิมไม่เช็ครูปแบบอีเมลเข้ม — แค่ต้องมีค่า (คงพฤติกรรมเดิม)
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  next();
};

/** POST /api/auth/forgot-password — ต้องมีอีเมลรูปทรงถูกต้อง */
export const validateForgotPassword = (req, res, next) => {
  const { email } = req.body ?? {};

  if (rejectIfInvalid(parseEmail(email), req, res, "email")) return;

  next();
};

/**
 * POST /api/auth/reset-password
 * body: { accessToken, newPassword } — รหัสใหม่ใช้กฎเดียวกับ register
 */
export const validateResetPassword = (req, res, next) => {
  const { accessToken, newPassword } = req.body ?? {};

  if (!accessToken || !String(accessToken).trim()) {
    return res.status(400).json({ message: "accessToken is required" });
  }
  req.body.accessToken = String(accessToken).trim();

  if (rejectIfInvalid(parsePassword(newPassword), req, res, "newPassword")) {
    return;
  }

  next();
};

/**
 * POST /api/auth/oauth/complete
 * กฎ name/phone ตรวจใน runCompleteOAuthProfile หลังเช็คว่ามีโปรไฟล์แล้วหรือยัง
 * (idempotent: มีโปรไฟล์แล้วไม่บังคับ body)
 * export ไว้ถ้า FE/เทสอยากเช็ครูปแบบล่วงหน้า — route หลักไม่บังคับก่อน service
 */
export const validateOAuthComplete = (req, res, next) => {
  const { name, phone } = req.body ?? {};

  if (rejectIfInvalid(parseName(name), req, res, "name")) return;
  if (rejectIfInvalid(parsePhone(phone), req, res, "phone")) return;

  next();
};
