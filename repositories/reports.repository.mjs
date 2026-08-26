import connectionPool from "../utils/db.mjs";

export const reportsRepository = {
  async create({ bookingId, reporterId, subject, description }) {
    const { rows } = await connectionPool.query(
      `INSERT INTO reports (booking_id, reporter_id, issue, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, booking_id, issue AS subject, description, status, created_at`,
      [bookingId, reporterId, subject, description]
    );

    return rows[0];
  },
};
