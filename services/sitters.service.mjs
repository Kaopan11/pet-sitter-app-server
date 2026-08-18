import { sitterProfileMeRepository } from "../repositories/sitterProfileMe.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import {
  assertImageFile,
  validateSitterProfileBody,
} from "../utils/validateSitterProfile.mjs";
import supabase from "../repositories/supabase.mjs";

const BUCKET_NAME = "sitter-photos";

async function uploadImageFile(file, folder, userId) {
  const filePath = `${folder}/${userId}-${Date.now()}-${file.originalname ?? "image"}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error("Failed to upload image to storage");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

  return publicUrl;
}

export const sittersService = {
  async getProfileByUserId(userId) {
    const profile = await sitterProfileMeRepository.findByUserId(userId);

    if (!profile) {
      throw httpError(404, "Sitter profile not found");
    }

    return profile;
  },

  async updateMyProfile(userId, { body, avatarFile, galleryFiles }) {
    const profile = await sitterProfileMeRepository.findByUserId(userId);

    if (!profile) {
      throw httpError(404, "Sitter profile not found");
    }

    validateSitterProfileBody(body);
    assertImageFile(avatarFile, "Profile image");

    const existingCount = (profile.sitter_photos ?? []).length;
    if (existingCount + galleryFiles.length > 10) {
      throw httpError(400, "Image gallery allows a maximum of 10 images");
    }

    for (const file of galleryFiles) {
      assertImageFile(file, "Gallery image");
    }

    const phone = String(body.phone).trim();
    if (await sitterProfileMeRepository.isPhoneTaken(phone, userId)) {
      throw httpError(400, "Phone number is already in use");
    }

    let avatarUrl = null;

    if (avatarFile) {
      avatarUrl = await uploadImageFile(avatarFile, "avatars", userId);
    }

    await sitterProfileMeRepository.updateUser(userId, {
      name: body.name,
      phone: body.phone,
      avatarUrl,
      dateOfBirth: body.date_of_birth,
    });

    await sitterProfileMeRepository.updateProfile(userId, {
      display_name: body.display_name,
      introduction: body.introduction,
      my_place: body.my_place,
      services: body.services,
      experience_years: body.experience_years,
      address_detail: body.address_detail,
      district: body.district,
      sub_district: body.sub_district,
      province: body.province,
      post_code: body.post_code,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    if (galleryFiles.length > 0) {
      let sortOrder = await sitterProfileMeRepository.getNextPhotoSortOrder(userId);

      for (const file of galleryFiles) {
        const photoUrl = await uploadImageFile(file, "gallery", userId);
        await sitterProfileMeRepository.insertPhoto(userId, photoUrl, sortOrder);
        sortOrder += 1;
      }
    }
  },
};
