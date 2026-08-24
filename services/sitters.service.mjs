import { sitterProfileMeRepository } from "../repositories/sitterProfileMe.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import { validateSitterProfileBody } from "../utils/validateSitterProfile.mjs";
import supabase from "../repositories/supabase.mjs";

const PHOTOS_BUCKET = "photos";

async function uploadImageFile(file, folder, userId) {
  const filePath = `${folder}/${userId}-${Date.now()}-${file.originalname ?? "image"}`;

  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(data.path);

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

  async getPublicById(id) {
    const isUuid =
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      );

    if (!isUuid) {
      throw httpError(404, "Sitter profile not found");
    }

    const sitter = await sitterProfilesRepository.findPublicById(id);

    if (!sitter) {
      throw httpError(404, "Sitter profile not found");
    }

    return sitter;
  },

  async updateMyProfile(userId, { body, avatarFile, galleryFiles }) {
    const profile = await sitterProfileMeRepository.findByUserId(userId);

    if (!profile) {
      throw httpError(404, "Sitter profile not found");
    }

    validateSitterProfileBody(body);

    const existingCount = (profile.sitter_photos ?? []).length;
    if (existingCount + galleryFiles.length > 10) {
      throw httpError(400, "Image gallery allows a maximum of 10 images");
    }

    const phone = String(body.phone).trim();
    if (await sitterProfileMeRepository.isPhoneTaken(phone, userId)) {
      throw httpError(400, "Phone number is already in use");
    }

    const email = String(body.email).trim().toLowerCase();
    if (await sitterProfileMeRepository.isEmailTaken(email, userId)) {
      throw httpError(400, "Email is already in use");
    }

    const userUpdate = {
      name: body.name,
      email,
      phone: body.phone,
      dateOfBirth: body.date_of_birth,
      idNumber: body.id_number,
    };

    if (avatarFile) {
      userUpdate.avatarUrl = await uploadImageFile(avatarFile, "avatar", userId);
    }

    await sitterProfileMeRepository.updateUser(userId, userUpdate);

    if (email !== String(profile.email ?? "").toLowerCase()) {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        email,
      });
      if (error) {
        throw httpError(400, "Email is already in use");
      }
    }

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
      bank_name: body.bank_name,
      account_number: body.account_number,
    });

    const petTypes = [].concat(body.pet_types || []).filter(Boolean);
    if (petTypes.length === 0) {
      throw httpError(400, "Pet type is required");
    }

    const savedCount = await sitterProfileMeRepository.replacePetTypes(userId, petTypes);
    if (savedCount === 0) {
      throw httpError(400, "Pet type is invalid");
    }

    if (galleryFiles.length > 0) {
      let sortOrder = await sitterProfileMeRepository.getNextPhotoSortOrder(userId);

      for (const file of galleryFiles) {
        const photoUrl = await uploadImageFile(file, "sitter_photos", userId);
        await sitterProfileMeRepository.insertPhoto(userId, photoUrl, sortOrder);
        sortOrder += 1;
      }
    }
  },

  async deleteMyPhoto(userId, photoId) {
    const photo = await sitterProfileMeRepository.findPhotoById(userId, photoId);

    if (!photo) {
      throw httpError(404, "Photo not found");
    }

    await sitterProfileMeRepository.deletePhoto(userId, photoId);

    const marker = `/object/public/${PHOTOS_BUCKET}/`;
    const index = String(photo.photo_url).indexOf(marker);
    if (index === -1) {
      return;
    }

    const filePath = decodeURIComponent(photo.photo_url.slice(index + marker.length));
    await supabase.storage.from(PHOTOS_BUCKET).remove([filePath]);
  },
};
