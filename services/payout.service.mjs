import { payoutRepository } from "../repositories/payout.repository.mjs";
import { buildPayoutDashboard } from "./payoutDashboard.mjs";
import { parsePayoutPagination } from "../utils/payoutPagination.mjs";

export const payoutService = {
  /** T04 — totalEarning = sum ทุก eligible · transactions = แค่หน้านั้น */
  async getMyPayout(sitterId, query) {
    const { page, limit, offset } = parsePayoutPagination(query);

    const [totalEarning, { rows, totalItems }] = await Promise.all([
      payoutRepository.sumEarningsBySitterId(sitterId),
      payoutRepository.findEligibleTransactionsBySitterId(sitterId, limit, offset),
    ]);

    return buildPayoutDashboard({
      totalEarning,
      rows,
      totalItems,
      page,
      limit,
      bankAccount: null,
    });
  },
};
