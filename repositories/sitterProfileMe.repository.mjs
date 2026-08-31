import connectionPool from "../utils/db.mjs";

function buildUpdateQuery(tableName, idColumn, userId, fields) {
  const columns = [];
  const values = [];
  let param = 1;

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    columns.push(`${column} = $${param++}`);
    values.push(value);
  }

  if (columns.length === 0) {
    return null;
  }

  columns.push("updated_at = now()");
  values.push(userId);

  return {
    text: `UPDATE ${tableName} SET ${columns.join(", ")} WHERE ${idColumn} = $${param}`,
    values,
  };
}

export const sitterProfileMeRepository = {
  async findByUserId(userId) {
    const query = `
      SELECT
        sitter_profiles.user_id,
        sitter_profiles.display_name,
        sitter_profiles.introduction,
        sitter_profiles.my_place,
        sitter_profiles.services,
        sitter_profiles.experience_years,
        sitter_profiles.address_detail,
        sitter_profiles.district,
        sitter_profiles.sub_district,
        sitter_profiles.province,
        sitter_profiles.post_code,
        sitter_profiles.latitude,
        sitter_profiles.longitude,
        sitter_profiles.bank_name,
        sitter_profiles.account_number,
        sitter_profiles.approval_status,
        sitter_profiles.is_listed,
        sitter_profiles.pending_profile,
        users.name,
        users.email,
        users.phone,
        users.id_number,
        users.avatar_url,
        to_char(users.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', sitter_photos.id,
                'photo_url', sitter_photos.photo_url,
                'sort_order', sitter_photos.sort_order
              )
              ORDER BY sitter_photos.sort_order
            )
            FROM sitter_photos
            WHERE sitter_photos.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) AS sitter_photos,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pet_types.id,
                'name', pet_types.name
              )
              ORDER BY pet_types.id
            )
            FROM sitter_pet_types
            JOIN pet_types ON pet_types.id = sitter_pet_types.pet_type_id
            WHERE sitter_pet_types.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) AS pet_types
      FROM sitter_profiles
      JOIN users ON users.id = sitter_profiles.user_id
      WHERE sitter_profiles.user_id = $1
    `;
    const { rows } = await connectionPool.query(query, [userId]);
    return rows[0] ?? null;
  },

  async updateUser(userId, { name, email, phone, avatarUrl, dateOfBirth, idNumber }) {
    const query = buildUpdateQuery("users", "id", userId, {
      name,
      email,
      phone,
      avatar_url: avatarUrl,
      date_of_birth: dateOfBirth,
      id_number: idNumber,
    });

    if (!query) {
      return;
    }

    await connectionPool.query(query.text, query.values);
  },

  async isPhoneTaken(phone, excludeUserId) {
    const query = `
      SELECT id
      FROM users
      WHERE phone = $1 AND id <> $2
      LIMIT 1
    `;
    const { rows } = await connectionPool.query(query, [phone, excludeUserId]);
    return rows.length > 0;
  },

  async isEmailTaken(email, excludeUserId) {
    const query = `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1) AND id <> $2
      LIMIT 1
    `;
    const { rows } = await connectionPool.query(query, [email, excludeUserId]);
    return rows.length > 0;
  },

  async replacePetTypes(userId, petTypeNames) {
    const { rows } = await connectionPool.query(
      "SELECT id FROM pet_types WHERE LOWER(name) = ANY($1::text[])",
      [petTypeNames.map((name) => String(name).toLowerCase())]
    );

    if (rows.length === 0) {
      return 0;
    }

    await connectionPool.query(
      "DELETE FROM sitter_pet_types WHERE sitter_id = $1",
      [userId]
    );

    for (const row of rows) {
      await connectionPool.query(
        `INSERT INTO sitter_pet_types (sitter_id, pet_type_id)
         VALUES ($1, $2)`,
        [userId, row.id]
      );
    }

    return rows.length;
  },

  async savePending(userId, pending, approvalStatus) {
    await connectionPool.query(
      `UPDATE sitter_profiles
       SET pending_profile = $1::jsonb,
           approval_status = $2,
           updated_at = NOW()
       WHERE user_id = $3`,
      [pending, approvalStatus, userId]
    );
  },

  async replacePhotos(userId, photos) {
    await connectionPool.query(
      "DELETE FROM sitter_photos WHERE sitter_id = $1",
      [userId]
    );

    for (const [index, photo] of photos.entries()) {
      if (!photo?.photo_url) continue;
      await connectionPool.query(
        `INSERT INTO sitter_photos (sitter_id, photo_url, sort_order)
         VALUES ($1, $2, $3)`,
        [userId, photo.photo_url, index]
      );
    }
  },
};
