import supabase from "./supabase.mjs";

function formatPetTypeName(name) {
  const key = String(name ?? "").toLowerCase();
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : "";
}

function formatLocation(profile) {
  return [profile.district, profile.province].filter(Boolean).join(", ");
}

function toListItem(profile, user, photos, petTypes) {
  const sortedPhotos = [...photos].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return {
    id: profile.user_id,
    title: profile.display_name || user?.name || "Pet Sitter",
    sitterName: user?.name ?? null,
    avatarUrl: user?.avatar_url ?? null,
    location: formatLocation(profile),
    rating: Math.round(Number(profile.rating_avg) || 0),
    petTypes: petTypes.map((type) => formatPetTypeName(type.name)).filter(Boolean),
    imageUrl: sortedPhotos[0]?.photo_url ?? null,
    experience: profile.experience_years ?? null,
  };
}

async function findSitterIdsByPetTypes(petTypes) {
  const { data: types, error: typesError } = await supabase
    .from("pet_types")
    .select("id, name");

  if (typesError) throw typesError;

  const matchedTypeIds = (types ?? [])
    .filter((type) => petTypes.includes(String(type.name).toLowerCase()))
    .map((type) => type.id);

  if (matchedTypeIds.length === 0) {
    return [];
  }

  const { data: links, error: linksError } = await supabase
    .from("sitter_pet_types")
    .select("sitter_id")
    .in("pet_type_id", matchedTypeIds);

  if (linksError) throw linksError;

  return [...new Set((links ?? []).map((link) => link.sitter_id))];
}

async function findUserIdsByName(query) {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .ilike("name", `%${query}%`);

  if (error) throw error;
  return (data ?? []).map((user) => user.id);
}

function buildSearchFilter(query, nameMatchedIds) {
  const pattern = `%${query}%`;
  const filters = [
    `display_name.ilike.${pattern}`,
    `my_place.ilike.${pattern}`,
    `district.ilike.${pattern}`,
    `sub_district.ilike.${pattern}`,
    `province.ilike.${pattern}`,
  ];

  if (nameMatchedIds.length > 0) {
    filters.push(`user_id.in.(${nameMatchedIds.join(",")})`);
  }

  return filters.join(",");
}

export const sitterProfilesRepository = {
  async findMany({ q, petTypes, rating, experience, page, limit }) {
    let sitterIds = null;

    if (petTypes.length > 0) {
      sitterIds = await findSitterIdsByPetTypes(petTypes);
      if (sitterIds.length === 0) {
        return { items: [], total: 0 };
      }
    }

    let query = supabase
      .from("sitter_profiles")
      .select(
        "user_id, display_name, my_place, experience_years, district, sub_district, province, rating_avg, review_count",
        { count: "exact" }
      );

    if (sitterIds) {
      query = query.in("user_id", sitterIds);
    }

    if (q) {
      const nameMatchedIds = await findUserIdsByName(q);
      query = query.or(buildSearchFilter(q, nameMatchedIds));
    }

    if (experience) {
      query = query.eq("experience_years", experience);
    }

    if (rating) {
      query = query.gte("rating_avg", rating);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: profiles, error, count } = await query
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .order("display_name", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const items = await hydrateProfiles(profiles ?? []);
    return { items, total: count ?? 0 };
  },
};

async function hydrateProfiles(profiles) {
  if (profiles.length === 0) {
    return [];
  }

  const ids = profiles.map((profile) => profile.user_id);

  const [usersResult, photosResult, petTypeLinksResult] = await Promise.all([
    supabase.from("users").select("id, name, avatar_url").in("id", ids),
    supabase
      .from("sitter_photos")
      .select("sitter_id, photo_url, sort_order")
      .in("sitter_id", ids)
      .order("sort_order", { ascending: true }),
    supabase
      .from("sitter_pet_types")
      .select("sitter_id, pet_type_id")
      .in("sitter_id", ids),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (photosResult.error) throw photosResult.error;
  if (petTypeLinksResult.error) throw petTypeLinksResult.error;

  const petTypeIds = [
    ...new Set((petTypeLinksResult.data ?? []).map((link) => link.pet_type_id)),
  ];

  let petTypesById = new Map();
  if (petTypeIds.length > 0) {
    const { data: petTypes, error: petTypesError } = await supabase
      .from("pet_types")
      .select("id, name")
      .in("id", petTypeIds);

    if (petTypesError) throw petTypesError;
    petTypesById = new Map((petTypes ?? []).map((type) => [type.id, type]));
  }

  const usersById = new Map((usersResult.data ?? []).map((user) => [user.id, user]));
  const photosBySitterId = new Map();
  const petTypesBySitterId = new Map();

  for (const photo of photosResult.data ?? []) {
    const list = photosBySitterId.get(photo.sitter_id) ?? [];
    list.push(photo);
    photosBySitterId.set(photo.sitter_id, list);
  }

  for (const link of petTypeLinksResult.data ?? []) {
    const petType = petTypesById.get(link.pet_type_id);
    if (!petType) continue;
    const list = petTypesBySitterId.get(link.sitter_id) ?? [];
    list.push(petType);
    petTypesBySitterId.set(link.sitter_id, list);
  }

  return profiles.map((profile) =>
    toListItem(
      profile,
      usersById.get(profile.user_id),
      photosBySitterId.get(profile.user_id) ?? [],
      petTypesBySitterId.get(profile.user_id) ?? []
    )
  );
}
