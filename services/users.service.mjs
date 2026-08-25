import { usersRepository } from "../repositories/users.repository.mjs";
import { petsRepository } from "../repositories/pets.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import supabase from "../repositories/supabase.mjs";

const PHOTOS_BUCKET = "photos";

async function uploadImageFile(file, folder, userId) {
  const safeName = String(file.originalname ?? "image").replace(/[^\w.\-]+/g, "_");
  const filePath = `${folder}/${userId}-${Date.now()}-${safeName}`;
  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
  if (error) {
    throw httpError(400, error.message || "Failed to upload profile image");
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(data.path);
  return publicUrl;
}

export const usersService = {
  async getAllUsers() {
    return usersRepository.findAll();
  },

  async getMe(userId) {
    const user = await usersRepository.findById(userId);
    if (!user) throw httpError(404, "User not found");
    return user;
  },

  // booking Day 0 — รายการสัตว์ของ owner
  async getPetsByOwner(userId) {
    return petsRepository.findByOwnerId(userId);
  },

  async updateMe(userId, body, avatarFile) {
    const current = await usersRepository.findById(userId);
    if (!current) throw httpError(404, "User not found");

    let avatarUrl = current.avatar_url ?? null;
    if (avatarFile) {
      avatarUrl = await uploadImageFile(avatarFile, "avatar", userId);
    } else if (body.avatar_url) {
      avatarUrl = body.avatar_url;
    }

    const updated = await usersRepository.updateById(userId, {
      name: body.name?.trim(),
      email: body.email?.trim(),
      phone: body.phone?.trim(),
      id_number: body.id_number?.trim() || null,
      date_of_birth: body.date_of_birth || null,
      avatar_url: avatarUrl,
    });
    if (!updated) throw httpError(404, "User not found");
    return updated;
  },
};
