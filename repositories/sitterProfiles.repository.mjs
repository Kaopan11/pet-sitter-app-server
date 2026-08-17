import { pool } from "./db.mjs";

// เป็น sitter หรือไม่ ดูจากตารางนี้ ไม่มี column asSitter ใน users
export const sitterProfilesRepository = {
  async findByUserId(userId) {
    const { rows } = await pool.query(
      `SELECT user_id, display_name, approval_status
       FROM public.sitter_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    return rows[0] ?? null;
  },

  async create({ userId, displayName }) {
    const { rows } = await pool.query(
      `INSERT INTO public.sitter_profiles (
         user_id, display_name, experience_years, rating_avg, review_count, approval_status
       )
       VALUES ($1, $2, 0, 0, 0, 'pending')
       RETURNING user_id, display_name, approval_status`,
      [userId, displayName]
    );
    return rows[0];
  },
};
