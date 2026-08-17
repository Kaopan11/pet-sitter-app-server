import connectionPool from "../utils/db.mjs";

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
    petTypes: petTypes.map((name) => formatPetTypeName(name)).filter(Boolean),
    imageUrl: row.image_url,
    experience: row.experience,
  };
}

export const sitterProfilesRepository = {
  async findMany({ q, petTypes, rating, experience, pageSize, offset }) {
    const result = await connectionPool.query(
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

    const countResult = await connectionPool.query(
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
