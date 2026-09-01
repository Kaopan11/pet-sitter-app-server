export const DEFAULT_PAYOUT_LIMIT = 20;
export const MAX_PAYOUT_LIMIT = 100;

/** T04 — page/limit สำหรับ GET /api/sitters/me/payout */
export function parsePayoutPagination(query) {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(
    MAX_PAYOUT_LIMIT,
    Math.max(1, Number(query?.limit) || DEFAULT_PAYOUT_LIMIT)
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}
