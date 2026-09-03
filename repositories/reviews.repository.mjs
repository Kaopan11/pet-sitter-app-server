import { pool } from "./db.mjs";

export const reviewsRepository = {
  async create({ bookingId, ownerId, sitterId, rating, text }) {
    const client = await pool.connect();
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

  async findBySitterId({ sitterId, rating, pageSize, offset }) {
    const result = await pool.query(
      `
      select
        reviews.id,
        users.name,
        users.avatar_url,
        reviews.rating,
        reviews.comment,
        reviews.created_at
      from public.reviews
      inner join public.users
        on users.id = reviews.owner_id
      where reviews.sitter_id = $1
        and (reviews.rating = $2 or $2 is null)
      order by reviews.created_at desc
      limit $3 offset $4
      `,
      [sitterId, rating, pageSize, offset]
    );

    const countResult = await pool.query(
      `
      select count(*)::int as total
      from public.reviews
      where sitter_id = $1
        and (rating = $2 or $2 is null)
      `,
      [sitterId, rating]
    );

    return {
      rows: result.rows,
      total: countResult.rows[0]?.total ?? 0,
    };
  },

  async getSummary(sitterId) {
    const { rows } = await pool.query(
      `
      select
        coalesce(round(avg(rating)::numeric, 1), 0) as rating_avg,
        count(*)::int as review_count
      from public.reviews
      where sitter_id = $1
      `,
      [sitterId]
    );

    return {
      rating_avg: Number(rows[0]?.rating_avg ?? 0),
      review_count: Number(rows[0]?.review_count ?? 0),
    };
  },

  async findByOwnerId(ownerId) {
    const { rows } = await pool.query(
      `
      SELECT
        reviews.id,
        COALESCE(sitter_profiles.display_name, sitter_users.name) AS sitter_name,
        sitter_users.avatar_url AS sitter_avatar_url,
        reviews.rating,
        reviews.comment,
        reviews.created_at
      FROM public.reviews
      LEFT JOIN public.users AS sitter_users
        ON sitter_users.id = reviews.sitter_id
      LEFT JOIN public.sitter_profiles
        ON sitter_profiles.user_id = reviews.sitter_id
      WHERE reviews.owner_id = $1
      ORDER BY reviews.created_at DESC
      `,
      [ownerId]
    );
    return rows;
  },
};
