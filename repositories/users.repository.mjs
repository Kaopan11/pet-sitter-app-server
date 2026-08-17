import { pool } from "./db.mjs";

const USER_COLUMNS =
  "id, name, email, phone, id_number, date_of_birth, avatar_url, is_admin, is_verified, created_at, updated_at";

export const usersRepository = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT ${USER_COLUMNS}
      FROM public.users
      ORDER BY created_at DESC
    `);
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT ${USER_COLUMNS}
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT ${USER_COLUMNS}
       FROM public.users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );
    return rows[0] ?? null;
  },

  // id ต้องเป็นค่าเดียวกับ auth.users.id
  async create({ id, email, phone, name }) {
    const { rows } = await pool.query(
      `INSERT INTO public.users (id, email, phone, name)
       VALUES ($1, $2, $3, $4)
       RETURNING ${USER_COLUMNS}`,
      [id, email, phone, name ?? null]
    );
    return rows[0];
  },
};
