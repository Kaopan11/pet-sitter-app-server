const MIN_OWNER_AGE = 18;

function toIsoDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return "";
}

export function isOwnerProfileComplete(owner) {
  const name = String(owner?.name ?? "").trim();
  const email = String(owner?.email ?? "").trim();
  const phone = String(owner?.phone ?? "").replace(/\D/g, "");
  const idNumber = String(owner?.id_number ?? "").replace(/\D/g, "");
  const dateOfBirth = toIsoDate(owner?.date_of_birth);

  if (!name || name.length < 6 || name.length > 20) return false;
  if (!/^[^\s@]+@[^\s@]+\.com$/i.test(email)) return false;
  if (!/^0\d{9}$/.test(phone)) return false;
  if (!/^\d{13}$/.test(idNumber)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false;
  if (getAge(dateOfBirth) < MIN_OWNER_AGE) return false;
  return true;
}

export function getAge(dateOfBirth) {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export const validateUpdateOwners = (req, res, next) => {
    const { name, email, phone, id_number, date_of_birth } = req.body ?? {};

    if (!name?.trim()) {
        return res.status(400).json({ message: "Name is required" });
    } 

    if (!email?.trim()) {
      return res.status(400).json({ message: "Email is required" });
    } else if (!/^[^\s@]+@[^\s@]+\.com$/i.test(email.trim())) {
        return res.status(400).json({ message: "Invalid email address" });
    }

    if (!phone?.trim()) {
      return res.status(400).json({ message: "Phone is required" });
    } else if (!/^0\d{9}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number" });
    }

    if (!id_number?.trim()) {
      return res.status(400).json({ message: "ID number is required" });
    } else if (!/^\d{13}$/.test(id_number.trim())) {
        return res.status(400).json({ message: "ID number must be 13 digits" });
    }
    
    if (!date_of_birth || !String(date_of_birth).trim()) {
        return res.status(400).json({ message: "Date of birth is required" });
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
        return res.status(400).json({ message: "Date of birth must be in YYYY-MM-DD format" });
    } else if (getAge(date_of_birth) < MIN_OWNER_AGE) {
        return res.status(400).json({ message: `You must be at least ${MIN_OWNER_AGE} years old` });
    }
    
    next();
  };