// แปลงเบอร์ให้เป็นรูปแบบเดียวกัน — เอาเฉพาะตัวเลข (ตัดช่องว่าง/ขีด)
// ตัวอย่าง: "081 234 5678" → "0812345678"
export function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

// เบอร์ไทย 10 หลัก ขึ้นต้นด้วย 0
export function isValidPhone(phone) {
  return /^0\d{9}$/.test(normalizePhone(phone));
}
