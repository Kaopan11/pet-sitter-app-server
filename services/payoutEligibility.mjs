export const PAYMENT_METHOD_CASH = "cash";

/** cash นับ earnings เมื่อ in_service/success + payments.paid */
const CASH_EARNING_STATUSES = new Set(["in_service", "success"]);

export function isCashPayoutEligible({
  paymentMethod,
  bookingStatus,
  paymentStatus,
}) {
  return (
    paymentMethod === PAYMENT_METHOD_CASH &&
    CASH_EARNING_STATUSES.has(bookingStatus) &&
    paymentStatus === "paid"
  );
}

/** T02 — cash เปลี่ยนเป็น in_service → mark payments.paid */
export function shouldMarkCashPaidOnStatusChange({
  paymentMethod,
  nextStatus,
}) {
  return paymentMethod === PAYMENT_METHOD_CASH && nextStatus === "in_service";
}

/** แปลง row จาก DB → shape ที่ FE payout dashboard ใช้ */
export function mapPayoutTransaction(row) {
  const paidAt = row.paid_at ?? row.paidAt;
  const date =
    paidAt instanceof Date
      ? paidAt.toISOString().slice(0, 10)
      : String(paidAt).slice(0, 10);

  return {
    date,
    from: row.pet_owner_name ?? row.petOwnerName,
    transactionNo: row.transaction_no ?? row.transactionNo,
    amount: Number(row.total_price ?? row.totalPrice),
    bookingId: row.id ?? row.bookingId,
    paymentMethod: row.payment_method ?? row.paymentMethod,
  };
}
