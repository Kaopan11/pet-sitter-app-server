import { isValidPhone, normalizePhone } from "../utils/phone.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ตรวจ body ตอนสมัคร ถ้าไม่ผ่านจะหยุดที่นี่ ไม่เข้า controller
export const validateRegister = (req, res, next) => {
  const { name, email, phone, password, asSitter } = req.body ?? {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Name is required" });
  }

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  if (!phone) {
    return res.status(400).json({ message: "Phone is required" });
  }

  // normalize ก่อน validate — "081 234 5678" กับ "0812345678" ถือเป็นเบอร์เดียวกัน
  const normalizedPhone = normalizePhone(phone);
  if (!isValidPhone(normalizedPhone)) {
    return res.status(400).json({ message: "Phone must be 10 digits" });
  }
  req.body.phone = normalizedPhone;

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  // asSitter ต้องเป็น true/false จริงๆ ไม่ใช่ string
  if (typeof asSitter !== "boolean") {
    return res.status(400).json({ message: "asSitter must be true or false" });
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const { email, password } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  next();
};
