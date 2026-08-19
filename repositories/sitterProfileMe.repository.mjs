import connectionPool from "../utils/db.mjs";

function buildUpdateQuery(tableName, idColumn, userId, fields) {
  const columns = [];
  const values = [];
  let param = 1;

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined || value === "") {
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
        users.name,
        users.email,
        users.phone,
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

  async updateUser(userId, { name, email, phone, avatarUrl, dateOfBirth }) {
    const query = buildUpdateQuery("users", "id", userId, {
      name,
      email,
      phone,
      avatar_url: avatarUrl,
      date_of_birth: dateOfBirth,
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

  async updateProfile(userId, profile) {
    const fields = {
      display_name: profile.display_name,
      introduction: profile.introduction,
      my_place: profile.my_place,
      services: profile.services,
      experience_years: profile.experience_years,
      address_detail: profile.address_detail,
      district: profile.district,
      sub_district: profile.sub_district,
      province: profile.province,
      post_code: profile.post_code,
      bank_name: profile.bank_name,
      account_number: profile.account_number,
    };

    if (profile.latitude !== undefined && profile.latitude !== "") {
      fields.latitude = Number(profile.latitude);
    }
    if (profile.longitude !== undefined && profile.longitude !== "") {
      fields.longitude = Number(profile.longitude);
    }

    const query = buildUpdateQuery("sitter_profiles", "user_id", userId, fields);

    if (!query) {
      return;
    }

    await connectionPool.query(query.text, query.values);
  },

  async getNextPhotoSortOrder(userId) {
    const query = `
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
      FROM sitter_photos
      WHERE sitter_id = $1
    `;
    const { rows } = await connectionPool.query(query, [userId]);
    return rows[0].next_sort_order;
  },

  async insertPhoto(userId, photoUrl, sortOrder) {
    const query = `
      INSERT INTO sitter_photos (sitter_id, photo_url, sort_order)
      VALUES ($1, $2, $3)
    `;
    await connectionPool.query(query, [userId, photoUrl, sortOrder]);
  },

  async findPhotoById(userId, photoId) {
    const { rows } = await connectionPool.query(
      "SELECT id, photo_url FROM sitter_photos WHERE id = $1 AND sitter_id = $2",
      [photoId, userId]
    );
    return rows[0] ?? null;
  },

  async deletePhoto(userId, photoId) {
    await connectionPool.query(
      "DELETE FROM sitter_photos WHERE id = $1 AND sitter_id = $2",
      [photoId, userId]
    );
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
};
