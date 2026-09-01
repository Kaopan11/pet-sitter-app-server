import { httpError } from "./httpError.mjs";

/** แหล่งเดียวสำหรับ GET /api/banks + validate ตอน PUT */
export const THAI_BANKS = [
  { code: "SCB", name: "SCB" },
  { code: "KBANK", name: "KBANK" },
  { code: "BBL", name: "BBL" },
  { code: "KTB", name: "KTB" },
  { code: "BAY", name: "BAY" },
  { code: "TTB", name: "TTB" },
  { code: "GSB", name: "GSB" },
  { code: "BAAC", name: "BAAC" },
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
