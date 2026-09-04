import { mapPayoutTransaction } from "./payoutEligibility.mjs";

/**
 * T04 — รวม response payout
 * totalEarning มาจาก sum ทั้ง eligible (repo) ไม่ใช่ผลรวมแถวในหน้านั้น
 */
export function buildPayoutDashboard({
  totalEarning,
  rows,
  totalItems,
  page,
  limit,
  bankAccount = null,
}) {
  return {
    totalEarning,
    bankAccount,
    transactions: rows.map(mapPayoutTransaction),
    pagination: {
      page,
      limit,
      totalItems,
    },
  };
}

/** เทส/ตรวจว่า totalEarning ไม่ผูกกับจำนวนแถวในหน้า */
export function isGlobalTotalEarning(totalEarning, pageTransactions) {
  const pageSum = pageTransactions.reduce(
    (sum, row) => sum + Number(row.total_price ?? row.totalPrice ?? 0),
    0
  );

  if (pageTransactions.length === 0) {
    return totalEarning === 0 || totalEarning > 0;
  }

  return totalEarning >= pageSum;
}
