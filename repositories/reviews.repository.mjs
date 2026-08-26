import connectionPool from "../utils/db.mjs";

export const reviewsRepository = {
  async create({ bookingId, ownerId, sitterId, rating, text }) {
    const client = await connectionPool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `INSERT INTO reviews (booking_id, owner_id, sitter_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, booking_id, rating, comment AS text, created_at`,
        [bookingId, ownerId, sitterId, rating, text]
      );

      await client.query(
        `UPDATE sitter_profiles
         SET review_count = review_count + 1,
             rating_avg = ((COALESCE(rating_avg, 0) * review_count) + $2) / (review_count + 1)
         WHERE user_id = $1`,
        [sitterId, rating]
      );

      await client.query("COMMIT");
      return rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
