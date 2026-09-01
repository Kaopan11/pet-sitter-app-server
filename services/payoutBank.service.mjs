import { payoutBankRepository } from "../repositories/payoutBank.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import {
  listThaiBanks,
  maskAccountNumber,
  resolveThaiBankByCode,
} from "../utils/thaiBanks.mjs";
import { uploadImageFile } from "../utils/supabaseImageUpload.mjs";

function normalizeAccountNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    throw httpError(400, "accountNumber is required");
  }
  if (digits.length < 10 || digits.length > 15) {
    throw httpError(400, "accountNumber must be 10 to 15 digits");
  }
  return digits;
}

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw httpError(400, `${fieldName} is required`);
  }
  return value.trim();
}

/** T06 — validate PUT body แยกออกมาเทสได้ (ไม่แตะ DB) */
export function parseBankAccountPutBody(body) {
  const bank = resolveThaiBankByCode(body?.bankCode);
  return {
    bankCode: bank.code,
    bankName: bank.name,
    accountNumber: normalizeAccountNumber(body?.accountNumber),
    accountName: normalizeRequiredString(body?.accountName, "accountName"),
    bookBankImageUrl: normalizeRequiredString(
      body?.bookBankImageUrl,
      "bookBankImageUrl"
    ),
  };
}

/** T05 — map DB row → response (masked) หรือ null ถ้ายังไม่ตั้งบัญชี */
export function mapBankAccountResponse(row) {
  if (!row?.account_number) {
    return null;
  }

  return {
    bankCode: row.bank_code ?? null,
    bankName: row.bank_name ?? null,
    accountNumberMasked: maskAccountNumber(row.account_number),
    accountName: row.account_name ?? null,
    bookBankImageUrl: row.book_bank_image_url ?? null,
  };
}

export const payoutBankService = {
  getBanks() {
    return listThaiBanks();
  },

  async getBankAccount(sitterId) {
    const row = await payoutBankRepository.findByUserId(sitterId);
    if (!row) {
      throw httpError(404, "Sitter profile not found");
    }
    return mapBankAccountResponse(row);
  },

  async updateBankAccount(sitterId, body) {
    const fields = parseBankAccountPutBody(body);

    const row = await payoutBankRepository.updateByUserId(sitterId, {
      bankCode: fields.bankCode,
      bankName: fields.bankName,
      accountNumber: fields.accountNumber,
      accountName: fields.accountName,
      bookBankImageUrl: fields.bookBankImageUrl,
    });

    if (!row) {
      throw httpError(404, "Sitter profile not found");
    }

    return mapBankAccountResponse(row);
  },

  async uploadBookBankImage(sitterId, file) {
    if (!file) {
      throw httpError(400, "bookBankImage is required");
    }

    const url = await uploadImageFile(file, "book_bank", sitterId);
    return { url };
  },
};
