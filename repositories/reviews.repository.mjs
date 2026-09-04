import { pool } from "./db.mjs";

export const reviewsRepository = {
  async create({ bookingId, ownerId, sitterId, rating, text }) {
    const { rows } = await pool.query(
      `INSERT INTO reviews (booking_id, owner_id, sitter_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, booking_id, rating, comment AS text, created_at`,
      [bookingId, ownerId, sitterId, rating, text]
    );

    return rows[0];
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
        and reviews.is_approved = true
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
        and is_approved = true
        and (rating = $2 or $2 is null)
      `,
      [sitterId, rating]
    );

    return {
      rows: result.rows,
      total: countResult.rows[0]?.total ?? 0,
    };
  },

  // ค้นหา review ที่ยังไม่ได้อนุมัติ (สำหรับ admin)
  async findPendingBySitterId(sitterId, limit, offset) {
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
        and reviews.is_approved = false
      order by reviews.created_at desc
      limit $2 offset $3
      `,
      [sitterId, limit, offset]
    );

    const countResult = await pool.query(
      `
      select count(*)::int as total
      from public.reviews
      where sitter_id = $1
        and is_approved = false
      `,
      [sitterId]
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
        and is_approved = true
      `,
      [sitterId]
    );

    return {
      rating_avg: Number(rows[0]?.rating_avg ?? 0),
      review_count: Number(rows[0]?.review_count ?? 0),
    };
  },

  // อนุมัติ review (สำหรับ admin)
  async approveByIdAndSitterId(sitterId, reviewId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `UPDATE reviews
         SET is_approved = true
         WHERE id = $1
           AND sitter_id = $2
           AND is_approved = false
         RETURNING rating`,
        [reviewId, sitterId]
      );

      if (!rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(
        `UPDATE sitter_profiles
         SET review_count = COALESCE(review_count, 0) + 1,
             rating_avg = ((COALESCE(rating_avg, 0) * COALESCE(review_count, 0)) + $2)
               / (COALESCE(review_count, 0) + 1)
         WHERE user_id = $1`,
        [sitterId, rows[0].rating]
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

  // ลบ review ที่ยังไม่ได้อนุมัติ (สำหรับ admin)
  async deletePendingByIdAndSitterId(sitterId, reviewId) {
    const { rows } = await pool.query(
      `DELETE FROM reviews
       WHERE id = $1
         AND sitter_id = $2
         AND is_approved = false
       RETURNING id`,
      [reviewId, sitterId]
    );

    return rows[0] ?? null;
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
