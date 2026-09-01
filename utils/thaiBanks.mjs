import { httpError } from "./httpError.mjs";

/** แหล่งเดียวสำหรับ GET /api/banks + validate ตอน PUT */
export const THAI_BANKS = [
  { code: "SCB", name: "ไทยพาณิชย์" },
  { code: "KBANK", name: "กสิกรไทย" },
  { code: "BBL", name: "กรุงเทพ" },
  { code: "KTB", name: "กรุงไทย" },
  { code: "BAY", name: "กรุงศรีอยุธยา" },
  { code: "TTB", name: "ทหารไทยธนชาต" },
  { code: "GSB", name: "ออมสิน" },
  { code: "BAAC", name: "ธ.ก.ส." },
];

const BANK_BY_CODE = new Map(THAI_BANKS.map((bank) => [bank.code, bank]));

export function listThaiBanks() {
  return THAI_BANKS.map((bank) => ({ ...bank }));
}

export function resolveThaiBankByCode(bankCode) {
  if (typeof bankCode !== "string" || !bankCode.trim()) {
    throw httpError(400, "bankCode is required");
  }

  const bank = BANK_BY_CODE.get(bankCode.trim().toUpperCase());
  if (!bank) {
    throw httpError(400, "Invalid bankCode");
  }

  return bank;
}

/** GET ส่งแค่ suffix — เช่น *444 */
export function maskAccountNumber(accountNumber) {
  const digits = String(accountNumber ?? "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.length <= 3) {
    return `*${digits}`;
  }
  return `*${digits.slice(-3)}`;
}
