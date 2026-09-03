import { adminSittersRepository } from "../repositories/adminSitters.repository.mjs";
import { sitterProfileMeRepository } from "../repositories/sitterProfileMe.repository.mjs";
import { reviewsRepository } from "../repositories/reviews.repository.mjs";
import { bookingsService } from "./bookings.service.mjs";
import { overlayPending } from "../utils/pendingProfile.mjs";
import { httpError } from "../utils/httpError.mjs";
import supabase from "../repositories/supabase.mjs";
import { notificationsService } from "./notifications.service.mjs";

async function applyPendingProfile(userId, pending) {
  if (!pending) return;

  const current = await sitterProfileMeRepository.findByUserId(userId);
  if (!current) {
    throw httpError(404, "Sitter profile not found");
  }

  const email = String(pending.email ?? current.email ?? "")
    .trim()
    .toLowerCase();

  await sitterProfileMeRepository.updateUser(userId, {
    name: pending.full_name ?? current.name,
    email,
    phone: pending.phone ?? current.phone,
    dateOfBirth: pending.date_of_birth ?? current.date_of_birth,
    idNumber: pending.id_number ?? current.id_number,
    avatarUrl: pending.avatar_url ?? current.avatar_url,
  });

  if (email && email !== String(current.email ?? "").toLowerCase()) {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      email,
    });
    if (error) {
      throw httpError(400, "Email is already in use");
    }
  }

  await adminSittersRepository.updateProfile(userId, {
    display_name: pending.display_name ?? current.display_name,
    introduction:
      pending.introduction !== undefined
        ? pending.introduction
        : current.introduction,
    my_place:
      pending.my_place !== undefined ? pending.my_place : current.my_place,
    services:
      pending.services !== undefined ? pending.services : current.services,
    experience_years: pending.experience_years ?? current.experience_years,
    address_detail: pending.address_detail ?? current.address_detail,
    district: pending.district ?? current.district,
    sub_district: pending.sub_district ?? current.sub_district,
    province: pending.province ?? current.province,
    post_code: pending.post_code ?? current.post_code,
  });

  if (Array.isArray(pending.pet_types) && pending.pet_types.length > 0) {
    await sitterProfileMeRepository.replacePetTypes(userId, pending.pet_types);
  }

  if (Array.isArray(pending.photos)) {
    await sitterProfileMeRepository.replacePhotos(userId, pending.photos);
  }
}

export const adminSittersService = {
  async list(search, status, limit, offset) {
    return adminSittersRepository.findMany(search, status, limit, offset);
  },

  async getById(sitterId) {
    const sitter = await adminSittersRepository.findById(sitterId);

    if (!sitter) {
      throw httpError(404, "Sitter not found");
    }

    return overlayPending(sitter);
  },

  // มี bookingsService + repository อยู่แล้วของ sitter เลยหยิบมาใช้ได้เลย
  async listBookings(sitterId, search, status, limit, offset) {
    const sitter = await adminSittersRepository.findById(sitterId);

    if (!sitter) {
      throw httpError(404, "Sitter not found");
    }

    return bookingsService.getMyBookings(sitterId, search, status, limit, offset);
  },

  // มี bookingsService + repository อยู่แล้วของ sitter เลยหยิบมาใช้ได้เลย
  async getBookingById(sitterId, bookingId) {
    const sitter = await adminSittersRepository.findById(sitterId);

    if (!sitter) {
      throw httpError(404, "Sitter not found");
    }

    return bookingsService.getMyBookingById(sitterId, bookingId);
  },

  async listReviews(sitterId, limit, offset) {
    const sitter = await adminSittersRepository.findById(sitterId);

    if (!sitter) {
      throw httpError(404, "Sitter not found");
    }

    return reviewsRepository.findPendingBySitterId(sitterId, limit, offset);
  },

  async approveReview(sitterId, reviewId) {
    const sitter = await adminSittersRepository.findById(sitterId);

    if (!sitter) {
      throw httpError(404, "Sitter not found");
    }

    const approved = await reviewsRepository.approveByIdAndSitterId(
      sitterId,
      reviewId
    );

    if (!approved) {
      throw httpError(404, "Review not found");
    }
  },

  async deleteReview(sitterId, reviewId) {
    const sitter = await adminSittersRepository.findById(sitterId);

    if (!sitter) {
      throw httpError(404, "Sitter not found");
    }

    const deleted = await reviewsRepository.deletePendingByIdAndSitterId(
      sitterId,
      reviewId
    );

    if (!deleted) {
      throw httpError(404, "Review not found");
    }
  },

  async updateStatus(sitterId, requestedStatus, rejectionReason) {
    if (!["Approved", "Rejected"].includes(requestedStatus)) {
      throw httpError(400, "Invalid approval status");
    }

    const sitter = await adminSittersRepository.findById(sitterId);
    if (!sitter) {
      throw httpError(404, "Sitter not found");
    }

    const current = sitter.approval_status;

    // requestedStatus คือ approve หรือ reject ที่ admin กดบนหน้า admin
    if (requestedStatus === "Approved") {
      if (current === "Waiting for verify") {
        await applyPendingProfile(sitterId, sitter.pending_profile);
        const updated = await adminSittersRepository.updateStatus(sitterId, {
          approvalStatus: "Verified",
          isListed: false,
          clearPending: true,
          rejectionReason: null,
        });
        await notificationsService.notifySitterApprovalStatus(
          sitterId,
          "Verified"
        );
        return updated;
      }

      if (current === "Waiting for approve") {
        await applyPendingProfile(sitterId, sitter.pending_profile);
        const updated = await adminSittersRepository.updateStatus(sitterId, {
          approvalStatus: "Approved",
          isListed: true,
          clearPending: true,
          rejectionReason: null,
        });
        await notificationsService.notifySitterApprovalStatus(
          sitterId,
          "Approved"
        );
        return updated;
      }

      throw httpError(400, "This profile is not waiting for review");
    }

    const note = String(rejectionReason ?? "").trim();
    if (!note) {
      throw httpError(400, "Rejection reason is required");
    }

    if (current === "Waiting for verify") {
      const updated = await adminSittersRepository.updateStatus(sitterId, {
        approvalStatus: "Unverified",
        isListed: false,
        clearPending: false,
        rejectionReason: note,
      });
      await notificationsService.notifySitterApprovalStatus(
        sitterId,
        "Unverified"
      );
      return updated;
    }

    if (current === "Waiting for approve") {
      const updated = await adminSittersRepository.updateStatus(sitterId, {
        approvalStatus: "Rejected",
        isListed: false,
        clearPending: false,
        rejectionReason: note,
      });
      await notificationsService.notifySitterApprovalStatus(
        sitterId,
        "Rejected"
      );
      return updated;
    }

    throw httpError(400, "This profile is not waiting for review");
  },
};
