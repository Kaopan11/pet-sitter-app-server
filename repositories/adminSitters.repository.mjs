import connectionPool from "../utils/db.mjs";

export const adminSittersRepository = {
  async findMany(search, status, limit, offset) {
    const selectSitters = `
      SELECT
        sitter_profiles.user_id AS id,
        users.name AS full_name,
        sitter_profiles.display_name AS pet_sitter_name,
        users.email,
        users.avatar_url,
        sitter_profiles.approval_status
      FROM sitter_profiles
      INNER JOIN users ON users.id = sitter_profiles.user_id
    `;

    const fromWithJoins = `
      FROM sitter_profiles
      INNER JOIN users ON users.id = sitter_profiles.user_id
    `;

    let result;
    let totalSitters;

    if (search && status) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE (
              users.name ILIKE $1
           OR sitter_profiles.display_name ILIKE $1
           OR users.email ILIKE $1
         )
           AND sitter_profiles.approval_status = $2`,
        [search, status]
      );
      totalSitters = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectSitters}
         WHERE (
              users.name ILIKE $1
           OR sitter_profiles.display_name ILIKE $1
           OR users.email ILIKE $1
         )
           AND sitter_profiles.approval_status = $2
         ORDER BY users.created_at DESC
         LIMIT $3 OFFSET $4`,
        [search, status, limit, offset]
      );
    } else if (search) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE users.name ILIKE $1
            OR sitter_profiles.display_name ILIKE $1
            OR users.email ILIKE $1`,
        [search]
      );
      totalSitters = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectSitters}
         WHERE users.name ILIKE $1
            OR sitter_profiles.display_name ILIKE $1
            OR users.email ILIKE $1
         ORDER BY users.created_at DESC
         LIMIT $2 OFFSET $3`,
        [search, limit, offset]
      );
    } else if (status) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE sitter_profiles.approval_status = $1`,
        [status]
      );
      totalSitters = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectSitters}
         WHERE sitter_profiles.approval_status = $1
         ORDER BY users.created_at DESC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      );
    } else {
      const count = await connectionPool.query(`SELECT COUNT(*) ${fromWithJoins}`);
      totalSitters = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectSitters}
         ORDER BY users.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }

    return {
      rows: result.rows,
      totalSitters,
    };
  },
};
