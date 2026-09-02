import connectionPool from "../utils/db.mjs";

export const adminOwnersRepository = {
  async findMany(search, limit, offset) {
    const values = [];
    const conditions = ["users.is_admin IS NOT TRUE"];

    if (search) {
      values.push(search);
      conditions.push(`(
        users.name ILIKE $${values.length}
        OR users.email ILIKE $${values.length}
        OR users.phone ILIKE $${values.length}
      )`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const count = await connectionPool.query(
      `SELECT COUNT(*)
       FROM public.users
       ${where}`,
      values
    );

    const limitParam = values.length + 1;
    const offsetParam = values.length + 2;
    const result = await connectionPool.query(
      `SELECT
         users.id,
         users.name,
         users.phone,
         users.email,
         users.avatar_url,
         (
           SELECT COUNT(*)::int
           FROM public.pets
           WHERE pets.owner_id = users.id
         ) AS pet_count
       FROM public.users
       ${where}
       ORDER BY users.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...values, limit, offset]
    );

    return {
      rows: result.rows.map((row) => ({
        ...row,
        pet_count: Number(row.pet_count ?? 0),
        status: "Normal",
      })),
      totalOwners: Number(count.rows[0].count),
    };
  },

  async findById(ownerId) {
    const { rows } = await connectionPool.query(
      `SELECT
         users.id,
         users.name,
         users.phone,
         users.email,
         users.id_number,
         to_char(users.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
         users.avatar_url
       FROM public.users
       WHERE users.id = $1
         AND users.is_admin IS NOT TRUE`,
      [ownerId]
    );

    const owner = rows[0];
    if (!owner) return null;

    return {
      ...owner,
      status: "Normal",
    };
  },
};
