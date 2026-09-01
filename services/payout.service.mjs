import { payoutRepository } from "../repositories/payout.repository.mjs";
import { payoutBankRepository } from "../repositories/payoutBank.repository.mjs";
import { buildPayoutDashboard } from "./payoutDashboard.mjs";
import { mapBankAccountResponse } from "./payoutBank.service.mjs";
import { parsePayoutPagination } from "../utils/payoutPagination.mjs";

export const payoutService = {
  /** T04/T05 — dashboard + bankAccount (masked) */
  async getMyPayout(sitterId, query) {
    const { page, limit, offset } = parsePayoutPagination(query);

    const [totalEarning, { rows, totalItems }, bankRow] = await Promise.all([
      payoutRepository.sumEarningsBySitterId(sitterId),
      payoutRepository.findEligibleTransactionsBySitterId(sitterId, limit, offset),
      payoutBankRepository.findByUserId(sitterId),
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
