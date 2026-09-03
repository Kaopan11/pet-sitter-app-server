import { pool } from "./db.mjs";

const USER_COLUMNS =
  "id, name, email, phone, id_number, date_of_birth, avatar_url, is_admin, is_verified, is_banned, created_at, updated_at";

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

  async findByPhone(phone) {
    const { rows } = await pool.query(
      `SELECT ${USER_COLUMNS}
       FROM public.users
       WHERE phone = $1
       LIMIT 1`,
      [phone]
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
  
  async updateById(id, { name, email, phone, id_number, date_of_birth, avatar_url }) {
    const { rows } = await pool.query(
      `UPDATE public.users
       SET name = $2,
           email = $3,
           phone = $4,
           id_number = $5,
           date_of_birth = $6,
           avatar_url = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${USER_COLUMNS}`,
      [id, name, email, phone, id_number, date_of_birth, avatar_url]
    );
    return rows[0] ?? null;
  },

  async setBanned(id, isBanned) {
    const { rows } = await pool.query(
      `UPDATE public.users
       SET is_banned = $2,
           updated_at = NOW()
       WHERE id = $1
         AND is_admin IS NOT TRUE
       RETURNING ${USER_COLUMNS}`,
      [id, isBanned]
    );
    return rows[0] ?? null;
  },
};