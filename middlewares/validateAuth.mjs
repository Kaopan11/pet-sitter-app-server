const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = ["owner", "sitter", "pet_owner", "pet_sitter"];

export const validateRegister = (req, res, next) => {
  const { email, phone, password, role, name } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Name is required" });
  }

  if (!phone) {
    return res.status(400).json({ message: "Phone is required" });
  }

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  if (!role) {
    return res.status(400).json({ message: "Role is required" });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
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
