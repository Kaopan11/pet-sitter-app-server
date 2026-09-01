import { sitterProfileMeRepository } from "../repositories/sitterProfileMe.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";
import { reviewsRepository } from "../repositories/reviews.repository.mjs";
import { bookingsRepository } from "../repositories/bookings.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import {
  validateSitterBasicBody,
  validateSitterProfileBody,
} from "../utils/validateSitterProfile.mjs";
import {
  isFullProfileUnlocked,
  nextStatusAfterUpdate,
  overlayPending,
} from "../utils/pendingProfile.mjs";
import { uploadImageFile } from "../utils/supabaseImageUpload.mjs";

function parseExistingGallery(raw, livePhotos) {
  if (raw == null || raw === "") {
    return (livePhotos ?? []).map((photo) => ({
      id: photo.id,
      photo_url: photo.photo_url,
    }));
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((photo) => photo?.photo_url)
      .map((photo) => ({
        id: photo.id,
        photo_url: photo.photo_url,
      }));
  } catch {
    return [];
  }
}

export const sittersService = {
  async getProfileByUserId(userId) {
    const profile = await sitterProfileMeRepository.findByUserId(userId);

    if (!profile) {
      throw httpError(404, "Sitter profile not found");
    }

    return overlayPending(profile);
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

  async getReviews(id, { rating = null, page = 1, limit = 5 } = {}) {
    const isUuid =
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      );

    if (!isUuid) {
      throw httpError(404, "Sitter profile not found");
    }

    const profile = await sitterProfilesRepository.findByUserId(id);

    if (!profile) {
      throw httpError(404, "Sitter profile not found");
    }

    const pageSize = Math.min(Math.max(Number(limit) || 5, 1), 50);
    const currentPage = Math.max(Number(page) || 1, 1);
    const offset = (currentPage - 1) * pageSize;
    const ratingFilter =
      Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;

    const [result, summary] = await Promise.all([
      reviewsRepository.findBySitterId({
        sitterId: id,
        rating: ratingFilter,
        pageSize,
        offset,
      }),
      reviewsRepository.getSummary(id),
    ]);

    return {
      rows: result.rows,
      total: result.total,
      page: currentPage,
      limit: pageSize,
      summary,
    };
  },

  async getAvailability(id) {
    await this.getPublicById(id);
    return bookingsRepository.findBusySlotsBySitterId(id);
  },

  async updateMyProfile(userId, { body, avatarFile, galleryFiles }) {
    const profile = await sitterProfileMeRepository.findByUserId(userId);

    if (!profile) {
      throw httpError(404, "Sitter profile not found");
    }

    const fullProfileUnlocked = isFullProfileUnlocked(profile.approval_status);

    if (fullProfileUnlocked) {
      validateSitterProfileBody(body);
    } else {
      validateSitterBasicBody(body);
    }

    const existingGallery = fullProfileUnlocked
      ? parseExistingGallery(
          body.existing_gallery,
          profile.pending_profile?.photos ?? profile.sitter_photos
        )
      : [];
    const newGalleryFiles = fullProfileUnlocked ? galleryFiles ?? [] : [];

    if (existingGallery.length + newGalleryFiles.length > 10) {
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

    let avatarUrl = profile.pending_profile?.avatar_url ?? profile.avatar_url;
    if (avatarFile) {
      avatarUrl = await uploadImageFile(avatarFile, "avatar", userId);
    }

    const pending = {
      ...(profile.pending_profile ?? {}),
      full_name: String(body.name).trim(),
      email,
      phone,
      id_number: String(body.id_number).trim(),
      date_of_birth: String(body.date_of_birth).trim(),
      avatar_url: avatarUrl,
      experience_years: String(body.experience_years).trim(),
      introduction: String(body.introduction ?? "").trim(),
    };

    if (fullProfileUnlocked) {
      const petTypes = []
        .concat(body.pet_types ?? [])
        .map((item) => String(item).trim())
        .filter(Boolean);
      if (petTypes.length === 0) {
        throw httpError(400, "Pet type is required");
      }

      const uploadedPhotos = [];
      for (const file of newGalleryFiles) {
        uploadedPhotos.push({
          id: `pending-${Date.now()}-${uploadedPhotos.length}`,
          photo_url: await uploadImageFile(file, "sitter_photos", userId),
        });
      }

      Object.assign(pending, {
        display_name: String(body.display_name).trim(),
        pet_types: petTypes,
        services: String(body.services ?? "").trim(),
        my_place: String(body.my_place ?? "").trim(),
        address_detail: String(body.address_detail).trim(),
        district: String(body.district).trim(),
        sub_district: String(body.sub_district).trim(),
        province: String(body.province).trim(),
        post_code: String(body.post_code).trim(),
        photos: [...existingGallery, ...uploadedPhotos],
      });
    }

    await sitterProfileMeRepository.savePending(
      userId,
      pending,
      nextStatusAfterUpdate(profile.approval_status)
    );
  },
};
