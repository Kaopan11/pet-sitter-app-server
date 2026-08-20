import { pool } from "./db.mjs";

function formatPetTypeName(name) {
  const key = String(name ?? "").toLowerCase();
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : "";
}

function toListItem(row) {
  const petTypes = Array.isArray(row.pet_types)
    ? row.pet_types
    : typeof row.pet_types === "string"
      ? JSON.parse(row.pet_types)
      : [];

  return {
    id: row.id,
    title: row.title,
    sitterName: row.sitter_name,
    avatarUrl: row.avatar_url,
    location: row.location,
    rating: row.rating,
    petTypes: petTypes.map((type) => formatPetTypeName(type)).filter(Boolean),
    imageUrl: row.image_url,
    experience: row.experience,
  };
}

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
    // approval_status ต้องตรง CHECK ใน DB:
    // 'Waiting for approve' | 'Approved' | 'Rejected'
    // (เดิมใช้ 'pending' — หลัง migrate แล้วใส่ค่าเก่าจะ error)
    const { rows } = await pool.query(
      `INSERT INTO public.sitter_profiles (
         user_id, display_name, experience_years, rating_avg, review_count, approval_status
       )
       VALUES ($1, $2, 0, 0, 0, 'Waiting for approve')
       RETURNING user_id, display_name, approval_status`,
      [userId, displayName]
    );
    return rows[0];
  },

  async findMany({ q, petTypes, rating, experience, pageSize, offset }) {
    const result = await pool.query(
      `
      select
        sitter_profiles.user_id as id,
        coalesce(sitter_profiles.display_name, users.name, 'Pet Sitter') as title,
        users.name as sitter_name,
        users.avatar_url,
        concat_ws(', ', sitter_profiles.district, sitter_profiles.province) as location,
        round(coalesce(sitter_profiles.rating_avg, 0))::int as rating,
        sitter_profiles.experience_years as experience,
        (
          select sitter_photos.photo_url
          from sitter_photos
          where sitter_photos.sitter_id = sitter_profiles.user_id
          order by sitter_photos.sort_order asc
          limit 1
        ) as image_url,
        coalesce(
          (
            select json_agg(pet_types.name order by pet_types.name)
            from sitter_pet_types
            inner join pet_types
            on pet_types.id = sitter_pet_types.pet_type_id
            where sitter_pet_types.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) as pet_types
      from sitter_profiles
      inner join users
      on users.id = sitter_profiles.user_id
      where (
          sitter_profiles.display_name ilike $1 or
          sitter_profiles.my_place ilike $1 or
          sitter_profiles.district ilike $1 or
          sitter_profiles.sub_district ilike $1 or
          sitter_profiles.province ilike $1 or
          users.name ilike $1 or
          $1 is null
        ) and
        (
          $2::text[] is null or exists (
            select 1
            from sitter_pet_types
            inner join pet_types
            on pet_types.id = sitter_pet_types.pet_type_id
            where sitter_pet_types.sitter_id = sitter_profiles.user_id
              and lower(pet_types.name) = any($2)
          )
        ) and
        (sitter_profiles.rating_avg >= $3 or $3 is null) and
        (sitter_profiles.experience_years = $4 or $4 is null)
      order by sitter_profiles.rating_avg desc nulls last, sitter_profiles.display_name asc
      limit $5 offset $6
      `,
      [q, petTypes, rating, experience, pageSize, offset]
    );

    const countResult = await pool.query(
      `
      select count(*)::int as total
      from sitter_profiles
      inner join users
      on users.id = sitter_profiles.user_id
      where (
          sitter_profiles.display_name ilike $1 or
          sitter_profiles.my_place ilike $1 or
          sitter_profiles.district ilike $1 or
          sitter_profiles.sub_district ilike $1 or
          sitter_profiles.province ilike $1 or
          users.name ilike $1 or
          $1 is null
        ) and
        (
          $2::text[] is null or exists (
            select 1
            from sitter_pet_types
            inner join pet_types
            on pet_types.id = sitter_pet_types.pet_type_id
            where sitter_pet_types.sitter_id = sitter_profiles.user_id
              and lower(pet_types.name) = any($2)
          )
        ) and
        (sitter_profiles.rating_avg >= $3 or $3 is null) and
        (sitter_profiles.experience_years = $4 or $4 is null)
      `,
      [q, petTypes, rating, experience]
    );

    return {
      rows: result.rows.map(toListItem),
      total: countResult.rows[0]?.total ?? 0,
    };
  },
};
