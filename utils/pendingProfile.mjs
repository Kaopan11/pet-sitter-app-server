export function isFullProfileUnlocked(status) {
  return [
    "Verified",
    "Waiting for approve",
    "Approved",
    "Rejected",
  ].includes(status);
}

export function nextStatusAfterUpdate(status) {
  return isFullProfileUnlocked(status)
    ? "Waiting for approve"
    : "Waiting for verify";
}

export function overlayPending(row) {
  const pending = row?.pending_profile;
  if (!pending) return row;

  const asObjects = Array.isArray(row.sitter_photos);

  return {
    ...row,
    name: pending.full_name ?? row.name,
    full_name: pending.full_name ?? row.full_name ?? row.name,
    email: pending.email ?? row.email,
    phone: pending.phone ?? row.phone,
    id_number: pending.id_number ?? row.id_number,
    date_of_birth: pending.date_of_birth ?? row.date_of_birth,
    avatar_url: pending.avatar_url ?? row.avatar_url,
    experience_years: pending.experience_years ?? row.experience_years,
    introduction: pending.introduction ?? row.introduction,
    display_name: pending.display_name ?? row.display_name,
    pet_sitter_name: pending.display_name ?? row.pet_sitter_name,
    services: pending.services ?? row.services,
    my_place: pending.my_place ?? row.my_place,
    address_detail: pending.address_detail ?? row.address_detail,
    district: pending.district ?? row.district,
    sub_district: pending.sub_district ?? row.sub_district,
    province: pending.province ?? row.province,
    post_code: pending.post_code ?? row.post_code,
    latitude: pending.latitude ?? row.latitude,
    longitude: pending.longitude ?? row.longitude,
    photos: pending.photos?.map((photo) => photo.photo_url) ?? row.photos,
    sitter_photos:
      pending.photos?.map((photo, index) => ({
        id: photo.id ?? `pending-${index}`,
        photo_url: photo.photo_url,
      })) ?? row.sitter_photos,
    pet_types: pending.pet_types
      ? asObjects
        ? pending.pet_types.map((name, index) => ({ id: index, name }))
        : pending.pet_types
      : row.pet_types,
  };
}
