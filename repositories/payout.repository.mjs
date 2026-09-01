import connectionPool from "../utils/db.mjs";

// T02 cash + T03 stripe — eligible earnings รวมใน query เดียว
const PAYOUT_ELIGIBLE_WHERE = `
  bookings.sitter_id = $1
  AND bookings.payment_method IS NOT NULL
  AND payments.status = 'paid'
  AND (
    (
      bookings.payment_method = 'cash'
      AND bookings.status IN ('in_service', 'success')
    )
    OR (
      bookings.payment_method = 'stripe'
      AND bookings.status <> 'cancelled'
    )
  )
`;

export const payoutRepository = {
  async findEligibleTransactionsBySitterId(sitterId, limit, offset) {
    const { rows: countRows } = await connectionPool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM bookings
      INNER JOIN payments ON payments.booking_id = bookings.id
      WHERE ${PAYOUT_ELIGIBLE_WHERE}
      `,
      [sitterId]
    );

    const { rows } = await connectionPool.query(
      `
      SELECT
        bookings.id,
        bookings.transaction_no,
        bookings.total_price,
        bookings.payment_method,
        users.name AS pet_owner_name,
        payments.paid_at
      FROM bookings
      INNER JOIN users ON users.id = bookings.owner_id
      INNER JOIN payments ON payments.booking_id = bookings.id
      WHERE ${PAYOUT_ELIGIBLE_WHERE}
      ORDER BY payments.paid_at DESC
      LIMIT $2 OFFSET $3
      `,
      [sitterId, limit, offset]
    );

    return {
      rows,
      totalItems: countRows[0]?.total ?? 0,
    };
  },

  async sumEarningsBySitterId(sitterId) {
    const { rows } = await connectionPool.query(
      `
      SELECT COALESCE(SUM(bookings.total_price), 0)::float AS total_earning
      FROM bookings
      INNER JOIN payments ON payments.booking_id = bookings.id
      WHERE ${PAYOUT_ELIGIBLE_WHERE}
      `,
      [sitterId]
    );

    return Number(rows[0]?.total_earning ?? 0);
  },
};
