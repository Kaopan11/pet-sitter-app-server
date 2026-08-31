import connectionPool from "../utils/db.mjs";

export const adminSittersRepository = {
  async findMany(search, status, limit, offset) {
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`sitter_profiles.approval_status = $${values.length}`);
    }

    if (search) {
      values.push(search);
      conditions.push(`(
        users.name ILIKE $${values.length}
        OR sitter_profiles.display_name ILIKE $${values.length}
        OR users.email ILIKE $${values.length}
        OR sitter_profiles.pending_profile->>'full_name' ILIKE $${values.length}
        OR sitter_profiles.pending_profile->>'display_name' ILIKE $${values.length}
        OR sitter_profiles.pending_profile->>'email' ILIKE $${values.length}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const count = await connectionPool.query(
      `SELECT COUNT(*)
       FROM sitter_profiles
       INNER JOIN users ON users.id = sitter_profiles.user_id
       ${where}`,
      values
    );

    const limitParam = values.length + 1;
    const offsetParam = values.length + 2;
    const result = await connectionPool.query(
      `SELECT
         sitter_profiles.user_id AS id,
         COALESCE(
           sitter_profiles.pending_profile->>'full_name',
           users.name
         ) AS full_name,
         COALESCE(
           sitter_profiles.pending_profile->>'display_name',
           sitter_profiles.display_name
         ) AS pet_sitter_name,
         COALESCE(
           sitter_profiles.pending_profile->>'email',
           users.email
         ) AS email,
         COALESCE(
           sitter_profiles.pending_profile->>'avatar_url',
           users.avatar_url
         ) AS avatar_url,
         sitter_profiles.approval_status
       FROM sitter_profiles
       INNER JOIN users ON users.id = sitter_profiles.user_id
       ${where}
       ORDER BY users.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...values, limit, offset]
    );

    return {
      rows: result.rows,
      totalSitters: Number(count.rows[0].count),
    };
  },

  async findById(sitterId) {
    const { rows } = await connectionPool.query(
      `
      SELECT
        sitter_profiles.user_id AS id,
        users.name AS full_name,
        users.phone,
        users.email,
        users.id_number,
        to_char(users.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        users.avatar_url,
        sitter_profiles.display_name AS pet_sitter_name,
        sitter_profiles.experience_years,
        sitter_profiles.introduction,
        sitter_profiles.services,
        sitter_profiles.my_place,
        sitter_profiles.address_detail,
        sitter_profiles.sub_district,
        sitter_profiles.district,
        sitter_profiles.province,
        sitter_profiles.post_code,
        sitter_profiles.latitude,
        sitter_profiles.longitude,
        sitter_profiles.approval_status,
        sitter_profiles.is_listed,
        sitter_profiles.pending_profile,
        COALESCE(
          (
            SELECT json_agg(pet_types.name ORDER BY pet_types.name)
            FROM sitter_pet_types
            INNER JOIN pet_types ON pet_types.id = sitter_pet_types.pet_type_id
            WHERE sitter_pet_types.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) AS pet_types,
        COALESCE(
          (
            SELECT json_agg(sitter_photos.photo_url ORDER BY sitter_photos.sort_order)
            FROM sitter_photos
            WHERE sitter_photos.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) AS photos
      FROM sitter_profiles
      INNER JOIN users ON users.id = sitter_profiles.user_id
      WHERE sitter_profiles.user_id = $1
      `,
      [sitterId]
    );

    return rows[0] ?? null;
  },

  async updateProfile(userId, profile) {
    await connectionPool.query(
      `UPDATE sitter_profiles
       SET display_name = $1,
           introduction = $2,
           my_place = $3,
           services = $4,
           experience_years = $5,
           address_detail = $6,
           district = $7,
           sub_district = $8,
           province = $9,
           post_code = $10,
           updated_at = NOW()
       WHERE user_id = $11`,
      [
        profile.display_name,
        profile.introduction,
        profile.my_place,
        profile.services,
        profile.experience_years,
        profile.address_detail,
        profile.district,
        profile.sub_district,
        profile.province,
        profile.post_code,
        userId,
      ]
    );
  },

  async updateStatus(sitterId, { approvalStatus, isListed, clearPending }) {
    const { rows } = await connectionPool.query(
      `
      UPDATE sitter_profiles
      SET approval_status = $1,
          is_listed = COALESCE($2, is_listed),
          pending_profile = CASE WHEN $3 THEN NULL ELSE pending_profile END,
          updated_at = NOW()
      WHERE user_id = $4
      RETURNING user_id AS id, approval_status, is_listed
      `,
      [approvalStatus, isListed, clearPending, sitterId]
    );

    return rows[0] ?? null;
  },
};
