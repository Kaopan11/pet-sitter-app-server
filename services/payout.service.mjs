import { payoutRepository } from "../repositories/payout.repository.mjs";
import { mapPayoutTransaction } from "./payoutEligibility.mjs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query) {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(query?.limit) || DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export const payoutService = {
  /** T02 — dashboard cash earnings (bankAccount มาใน T05) */
  async getMyPayout(sitterId, query) {
    const { page, limit, offset } = parsePagination(query);

    const [totalEarning, { rows, totalItems }] = await Promise.all([
      payoutRepository.sumCashEarningsBySitterId(sitterId),
      payoutRepository.findCashTransactionsBySitterId(sitterId, limit, offset),
    ]);

    return {
      totalEarning,
      bankAccount: null,
      transactions: rows.map(mapPayoutTransaction),
      pagination: {
        page,
        limit,
        totalItems,
      },
    };
  },
};
