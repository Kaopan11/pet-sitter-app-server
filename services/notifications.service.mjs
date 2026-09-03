import { notificationsRepository } from "../repositories/notifications.repository.mjs";
import { usersRepository } from "../repositories/users.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";

function displayName(user, fallback) {
  const name = String(user?.name ?? "").trim();
  return name || fallback;
}

async function sitterLabel(sitterId) {
  const [profile, user] = await Promise.all([
    sitterProfilesRepository.findByUserId(sitterId),
    usersRepository.findById(sitterId),
  ]);
  const fromProfile = String(profile?.display_name ?? "").trim();
  return fromProfile || displayName(user, "Pet sitter");
}

async function ownerLabel(ownerId) {
  const user = await usersRepository.findById(ownerId);
  return displayName(user, "Pet owner");
}

export function sitterStatusCopy(approvalStatus) {
  if (approvalStatus === "Verified") {
    return {
      title: "Identity verified",
      body: "Admin verified your identity.",
    };
  }
  if (approvalStatus === "Approved") {
    return {
      title: "Profile approved",
      body: "Admin approved your sitter profile. You are now listed.",
    };
  }
  if (approvalStatus === "Rejected") {
    return {
      title: "Profile rejected",
      body: "Admin rejected your sitter profile.",
    };
  }
  if (approvalStatus === "Unverified") {
    return {
      title: "Verification not approved",
      body: "Admin did not approve your verification. Please update your profile and submit again.",
    };
  }
  return null;
}

async function createSafe(payload) {
  try {
    await notificationsRepository.create(payload);
  } catch (error) {
    console.error("Notification create failed:", error.message);
  }
}

export const notificationsService = {
  async listMine(userId) {
    const [items, unreadCount] = await Promise.all([
      notificationsRepository.listByUserId(userId),
      notificationsRepository.countUnread(userId),
    ]);
    return { items, unreadCount };
  },

  async markRead(userId, notificationId) {
    await notificationsRepository.markRead(userId, notificationId);
    return notificationsService.listMine(userId);
  },

  async markAllRead(userId) {
    await notificationsRepository.markAllRead(userId);
    return notificationsService.listMine(userId);
  },

  async notifyOwnerHiredSitter({ ownerId, sitterId, bookingId }) {
    const ownerName = await ownerLabel(ownerId);
    await createSafe({
      userId: sitterId,
      type: "booking_created",
      title: "New booking",
      body: `${ownerName} booked you.`,
      href: `/sitter/booking-list/${bookingId}`,
      bookingId,
    });
  },

  async notifyOwnerBookingConfirmed({ ownerId, sitterId, bookingId }) {
    const name = await sitterLabel(sitterId);
    await createSafe({
      userId: ownerId,
      type: "booking_confirmed",
      title: "Booking confirmed",
      body: `${name} confirmed your booking.`,
      href: "/owner/bookings",
      bookingId,
    });
  },

  async notifyBookingCancelled({ recipientId, actorName, bookingId, href }) {
    await createSafe({
      userId: recipientId,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: `${actorName} cancelled a booking.`,
      href,
      bookingId,
    });
  },

  async notifySitterOwnerCancelled({ ownerId, sitterId, bookingId }) {
    const ownerName = await ownerLabel(ownerId);
    await notificationsService.notifyBookingCancelled({
      recipientId: sitterId,
      actorName: ownerName,
      bookingId,
      href: "/sitter/booking-list",
    });
  },

  async notifyOwnerSitterCancelled({ ownerId, sitterId, bookingId }) {
    const name = await sitterLabel(sitterId);
    await notificationsService.notifyBookingCancelled({
      recipientId: ownerId,
      actorName: name,
      bookingId,
      href: "/owner/bookings",
    });
  },

  async notifySitterApprovalStatus(sitterId, approvalStatus) {
    const copy = sitterStatusCopy(approvalStatus);
    if (!copy) return;
    await createSafe({
      userId: sitterId,
      type: "sitter_status",
      title: copy.title,
      body: copy.body,
      href: "/sitter/profile",
    });
  },
};
