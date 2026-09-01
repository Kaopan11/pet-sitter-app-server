import { payoutRepository } from "../repositories/payout.repository.mjs";
import { payoutBankRepository } from "../repositories/payoutBank.repository.mjs";
import { buildPayoutDashboard } from "./payoutDashboard.mjs";
import { mapBankAccountResponse } from "./payoutBank.service.mjs";
import { parsePayoutPagination } from "../utils/payoutPagination.mjs";

/** T06 — inject deps เพื่อเทส integration โดยไม่ต้องต่อ DB */
export function createPayoutService({
  sumEarningsBySitterId = payoutRepository.sumEarningsBySitterId.bind(
    payoutRepository
  ),
  findEligibleTransactionsBySitterId = payoutRepository.findEligibleTransactionsBySitterId.bind(
    payoutRepository
  ),
  findBankAccountByUserId = payoutBankRepository.findByUserId.bind(
    payoutBankRepository
  ),
} = {}) {
  return {
    async getMyPayout(sitterId, query) {
      const { page, limit, offset } = parsePayoutPagination(query);

      const [totalEarning, { rows, totalItems }, bankRow] = await Promise.all([
        sumEarningsBySitterId(sitterId),
        findEligibleTransactionsBySitterId(sitterId, limit, offset),
        findBankAccountByUserId(sitterId),
      ]);

      return buildPayoutDashboard({
        totalEarning,
        rows,
        totalItems,
        page,
        limit,
        bankAccount: mapBankAccountResponse(bankRow),
      });
    },
  };
}

export const payoutService = createPayoutService();
