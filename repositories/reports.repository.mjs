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

  async findMany() {
    const { rows } = await connectionPool.query(
      `SELECT
         reports.id,
         reports.booking_id,
         reports.reporter_id,
         users.name AS reporter_name,
         reports.issue AS subject,
         reports.description,
         reports.status,
         reports.created_at
       FROM reports
       INNER JOIN users ON users.id = reports.reporter_id
       ORDER BY reports.created_at DESC`
    );
    return rows;
  },
  
  async findById(id) {
    const { rows } = await connectionPool.query(
      `SELECT
         reports.id,
         reports.booking_id,
         reports.reporter_id,
         users.name AS reporter_name,
         reports.issue AS subject,
         reports.description,
         reports.status,
         reports.created_at
       FROM reports
       INNER JOIN users ON users.id = reports.reporter_id
       WHERE reports.id = $1
       LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async updateStatus(id, status) {
    const { rows } = await connectionPool.query(
      `UPDATE reports
       SET status = $1
       WHERE id = $2
       RETURNING id`,
      [status, id]
    );
    if (!rows[0]) return null;
    return this.findById(id);
  },
};
