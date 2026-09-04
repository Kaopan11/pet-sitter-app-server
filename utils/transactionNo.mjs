/** รูปแบบเดียวกับ DB function next_transaction_no() */
export const TRANSACTION_NO_RE = /^TX-\d{8}-\d{4}$/;

/** สร้างเลขอ้างอิงจาก dateKey (YYYYMMDD) + running — ใช้เทส/อ้างอิง contract */
export function formatTransactionNo(dateKey, running) {
  const seq = String(running).padStart(4, "0");
  return `TX-${dateKey}-${seq}`;
}

export function isValidTransactionNo(value) {
  return typeof value === "string" && TRANSACTION_NO_RE.test(value);
}
