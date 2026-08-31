import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import supabase from "../repositories/supabase.mjs";
import { requireAuth, requireAdmin, requireSitter } from "../middlewares/auth.middleware.mjs";
import { uploadSitterImages } from "../middlewares/uploadSitterImages.mjs";

// =============================================================================
// ไฟล์อ่าน flow อนุมัติ sitter (ยังไม่ mount ใน app.mjs)
// โค้ดตรงกับของจริง ณ ตอนนี้ ทุกฟังก์ชันอยู่ในไฟล์นี้
//
// GET /api/admin/sitters และ GET /:id เห็นได้ทุกสถานะ
// กรองเฉพาะตอนส่ง ?status=... (ไม่ส่ง หรือ status=all = ทุกคน)
// PATCH /:id/status ทำได้แค่ Waiting for verify / Waiting for approve
//
// approval_status          กล่องที่ sitter แก้ได้    แอดมินกด Approve/Reject ได้
// Unverified               1                         ไม่
// Waiting for verify       1                         ได้ (รอบ 1)
// Verified                 1-3                       ไม่
// Waiting for approve      1-3                       ได้ (รอบ 2)
// Approved                 1-3                       ไม่
// Rejected                 1-3                       ไม่
//
// is_listed ถูกตั้งแค่ตอน PATCH ไม่ถูกปิดตอน PUT /me
//   Approved (รอบ 2) -> true
//   Reject / กลับ Unverified / Verified -> false
//   Approved แล้วกด Update -> status = Waiting for approve, is_listed ยัง true
//     admin เห็นของใหม่จาก pending (overlayPending)
//     owner เห็นคอลัมน์จริงที่อนุมัติแล้ว (public API ไม่ overlay)
//
// public list / booking ตอนนี้ยังไม่กรอง is_listed
//
// เส้นทางเรียกฟังก์ชัน
//
// GET  /api/sitters/me
//   sittersController.getMyProfile
//     -> sittersService.getProfileByUserId
//          -> sitterProfileMeRepository.findByUserId
//          -> overlayPending
//
// PUT  /api/sitters/me
//   uploadSitterImages -> sittersController.updateMyProfile
//     -> sittersService.updateMyProfile
//          -> findByUserId
//          -> isFullProfileUnlocked
//          -> validateSitterProfileBody หรือ validateSitterBasicBody
//          -> parseExistingGallery
//          -> isPhoneTaken / isEmailTaken
//          -> uploadImageFile  (ถ้ามีไฟล์)
//          -> nextStatusAfterUpdate
//          -> savePending
//
// GET  /api/admin/sitters
//   adminSittersController.list
//     -> adminSittersService.list
//          -> adminSittersRepository.findMany
//
// GET  /api/admin/sitters/:id
//   adminSittersController.getById
//     -> adminSittersService.getById
//          -> adminSittersRepository.findById
//          -> overlayPending
//
// PATCH /api/admin/sitters/:id/status
//   adminSittersController.updateStatus
//     -> adminSittersService.updateStatus
//          -> findById
//          -> applyPendingProfile          (ตอน Approved)
//               -> findByUserId
//               -> updateUser
//               -> supabase.auth.admin.updateUserById  (ถ้าอีเมลเปลี่ยน)
//               -> updateProfile
//               -> replacePetTypes
//               -> replacePhotos
//          -> updateStatus
// =============================================================================

const PHOTOS_BUCKET = "photos";
const EXPERIENCE_VALUES = new Set(["0-2", "3-5", "5+"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.com$/i;

const sittersRouter = Router();
const adminSittersRouter = Router();

// จาก: utils/httpError.mjs
// ใช้ที่: validate, service ตอน throw 400/404
function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// จาก: utils/pendingProfile.mjs
// ใช้ที่: sittersService.updateMyProfile, nextStatusAfterUpdate
function isFullProfileUnlocked(status) {
  return ["Verified", "Waiting for approve", "Approved", "Rejected"].includes(status);
}

// จาก: utils/pendingProfile.mjs
// ใช้ที่: sittersService.updateMyProfile -> savePending
function nextStatusAfterUpdate(status) {
  return isFullProfileUnlocked(status) ? "Waiting for approve" : "Waiting for verify";
}

// จาก: utils/pendingProfile.mjs
// ใช้ที่: sittersService.getProfileByUserId, adminSittersService.getById
function overlayPending(row) {
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

// จาก: utils/validateSitterProfile.mjs
// ใช้ที่: sittersService.updateMyProfile (กล่อง 1), validateSitterProfileBody
function validateSitterBasicBody(body) {
  const name = String(body.name ?? "").trim();
  if (!name) throw httpError(400, "Full name is required");
  if (name.length < 6 || name.length > 20) {
    throw httpError(400, "Full name must be 6-20 characters");
  }

  const experience = String(body.experience_years ?? "").trim();
  if (!experience) throw httpError(400, "Experience is required");
  if (!EXPERIENCE_VALUES.has(experience)) {
    throw httpError(400, "Experience must be 0-2, 3-5, or 5+ Years");
  }

  const phone = String(body.phone ?? "").trim();
  if (!phone) throw httpError(400, "Phone number is required");
  if (!/^0\d{9}$/.test(phone)) {
    throw httpError(400, "Phone number must be 10 digits and start with 0");
  }

  const email = String(body.email ?? "").trim();
  if (!email) throw httpError(400, "Email is required");
  if (!EMAIL_PATTERN.test(email)) {
    throw httpError(400, "Email must include @ and end with .com");
  }

  const idNumber = String(body.id_number ?? "").trim();
  if (!idNumber) throw httpError(400, "ID number is required");
  if (!/^\d{13}$/.test(idNumber)) {
    throw httpError(400, "ID number must be 13 digits");
  }

  const dateOfBirth = String(body.date_of_birth ?? "").trim();
  if (!dateOfBirth) throw httpError(400, "Date of birth is required");

  const today = new Date();
  const minBirthDate = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate()
  );
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > minBirthDate) {
    throw httpError(400, "Pet sitter must be at least 18 years old");
  }
}

// จาก: utils/validateSitterProfile.mjs
// ใช้ที่: sittersService.updateMyProfile (กล่อง 1-3)
function validateSitterProfileBody(body) {
  validateSitterBasicBody(body);

  const displayName = String(body.display_name ?? "").trim();
  if (!displayName) throw httpError(400, "Pet sitter name is required");

  const requiredAddress = [
    ["address_detail", "Address detail"],
    ["district", "District"],
    ["sub_district", "Sub-district"],
    ["province", "Province"],
    ["post_code", "Post code"],
  ];

  for (const [key, label] of requiredAddress) {
    if (!String(body[key] ?? "").trim()) {
      throw httpError(400, `${label} is required`);
    }
  }
}

// จาก: services/sitters.service.mjs (helper ในไฟล์ ไม่ export)
// ใช้ที่: sittersService.updateMyProfile (avatar + gallery)
async function uploadImageFile(file, folder, userId) {
  const filePath = `${folder}/${userId}-${Date.now()}-${file.originalname ?? "image"}`;
  const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(data.path);
  return publicUrl;
}

// จาก: services/sitters.service.mjs (helper ในไฟล์ ไม่ export)
// ใช้ที่: sittersService.updateMyProfile
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

// จาก: repositories/sitterProfileMe.repository.mjs (helper ในไฟล์ ไม่ export)
// ใช้ที่: updateUser
function buildUpdateQuery(tableName, idColumn, userId, fields) {
  const columns = [];
  const values = [];
  let param = 1;

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    columns.push(`${column} = $${param++}`);
    values.push(value);
  }

  if (columns.length === 0) return null;

  columns.push("updated_at = now()");
  values.push(userId);

  return {
    text: `UPDATE ${tableName} SET ${columns.join(", ")} WHERE ${idColumn} = $${param}`,
    values,
  };
}

const sitterProfileMeRepository = {
  // จาก: repositories/sitterProfileMe.repository.mjs
  // ใช้ที่: sittersService.getProfileByUserId, sittersService.updateMyProfile, applyPendingProfile
  async findByUserId(userId) {
    const { rows } = await connectionPool.query(
      `
      SELECT
        sitter_profiles.user_id,
        sitter_profiles.display_name,
        sitter_profiles.introduction,
        sitter_profiles.my_place,
        sitter_profiles.services,
        sitter_profiles.experience_years,
        sitter_profiles.address_detail,
        sitter_profiles.district,
        sitter_profiles.sub_district,
        sitter_profiles.province,
        sitter_profiles.post_code,
        sitter_profiles.latitude,
        sitter_profiles.longitude,
        sitter_profiles.bank_name,
        sitter_profiles.account_number,
        sitter_profiles.approval_status,
        sitter_profiles.is_listed,
        sitter_profiles.pending_profile,
        users.name,
        users.email,
        users.phone,
        users.id_number,
        users.avatar_url,
        to_char(users.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', sitter_photos.id,
                'photo_url', sitter_photos.photo_url,
                'sort_order', sitter_photos.sort_order
              )
              ORDER BY sitter_photos.sort_order
            )
            FROM sitter_photos
            WHERE sitter_photos.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) AS sitter_photos,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', pet_types.id, 'name', pet_types.name)
              ORDER BY pet_types.id
            )
            FROM sitter_pet_types
            JOIN pet_types ON pet_types.id = sitter_pet_types.pet_type_id
            WHERE sitter_pet_types.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) AS pet_types
      FROM sitter_profiles
      JOIN users ON users.id = sitter_profiles.user_id
      WHERE sitter_profiles.user_id = $1
      `,
      [userId]
    );
    return rows[0] ?? null;
  },

  // จาก: repositories/sitterProfileMe.repository.mjs
  // ใช้ที่: applyPendingProfile
  async updateUser(userId, { name, email, phone, avatarUrl, dateOfBirth, idNumber }) {
    const query = buildUpdateQuery("users", "id", userId, {
      name,
      email,
      phone,
      avatar_url: avatarUrl,
      date_of_birth: dateOfBirth,
      id_number: idNumber,
    });
    if (!query) return;
    await connectionPool.query(query.text, query.values);
  },

  // จาก: repositories/sitterProfileMe.repository.mjs
  // ใช้ที่: sittersService.updateMyProfile
  async isPhoneTaken(phone, excludeUserId) {
    const { rows } = await connectionPool.query(
      `SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1`,
      [phone, excludeUserId]
    );
    return rows.length > 0;
  },

  // จาก: repositories/sitterProfileMe.repository.mjs
  // ใช้ที่: sittersService.updateMyProfile
  async isEmailTaken(email, excludeUserId) {
    const { rows } = await connectionPool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
      [email, excludeUserId]
    );
    return rows.length > 0;
  },

  // จาก: repositories/sitterProfileMe.repository.mjs
  // ใช้ที่: applyPendingProfile
  async replacePetTypes(userId, petTypeNames) {
    const { rows } = await connectionPool.query(
      `SELECT id FROM pet_types WHERE LOWER(name) = ANY($1::text[])`,
      [petTypeNames.map((name) => String(name).toLowerCase())]
    );
    if (rows.length === 0) return 0;

    await connectionPool.query(`DELETE FROM sitter_pet_types WHERE sitter_id = $1`, [userId]);
    for (const row of rows) {
      await connectionPool.query(
        `INSERT INTO sitter_pet_types (sitter_id, pet_type_id) VALUES ($1, $2)`,
        [userId, row.id]
      );
    }
    return rows.length;
  },

  // จาก: repositories/sitterProfileMe.repository.mjs
  // ใช้ที่: sittersService.updateMyProfile
  // เปลี่ยนแค่ pending_profile + approval_status ไม่แตะ is_listed
  async savePending(userId, pending, approvalStatus) {
    await connectionPool.query(
      `
      UPDATE sitter_profiles
      SET pending_profile = $1::jsonb,
          approval_status = $2,
          updated_at = NOW()
      WHERE user_id = $3
      `,
      [pending, approvalStatus, userId]
    );
  },

  // จาก: repositories/sitterProfileMe.repository.mjs
  // ใช้ที่: applyPendingProfile
  async replacePhotos(userId, photos) {
    await connectionPool.query(`DELETE FROM sitter_photos WHERE sitter_id = $1`, [userId]);
    for (const [index, photo] of photos.entries()) {
      if (!photo?.photo_url) continue;
      await connectionPool.query(
        `INSERT INTO sitter_photos (sitter_id, photo_url, sort_order) VALUES ($1, $2, $3)`,
        [userId, photo.photo_url, index]
      );
    }
  },
};

// ---------- repositories/adminSitters.repository.mjs ----------
const adminSittersRepository = {
  // จาก: repositories/adminSitters.repository.mjs
  // ใช้ที่: adminSittersService.list
  // ไม่มี status = ดึงทุกคน ไม่ซ่อน Unverified / Verified / Approved / Rejected
  async findMany(search, status, limit, offset) {
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`sitter_profiles.approval_status = $${values.length}`);
    }
    if (search) {
      values.push(search);
      conditions.push(`(
        users.name ILIKE $${values.length}
        OR sitter_profiles.display_name ILIKE $${values.length}
        OR users.email ILIKE $${values.length}
        OR sitter_profiles.pending_profile->>'full_name' ILIKE $${values.length}
        OR sitter_profiles.pending_profile->>'display_name' ILIKE $${values.length}
        OR sitter_profiles.pending_profile->>'email' ILIKE $${values.length}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const count = await connectionPool.query(
      `
      SELECT COUNT(*)
      FROM sitter_profiles
      INNER JOIN users ON users.id = sitter_profiles.user_id
      ${where}
      `,
      values
    );

    const result = await connectionPool.query(
      `
      SELECT
        sitter_profiles.user_id AS id,
        COALESCE(sitter_profiles.pending_profile->>'full_name', users.name) AS full_name,
        COALESCE(sitter_profiles.pending_profile->>'display_name', sitter_profiles.display_name) AS pet_sitter_name,
        COALESCE(sitter_profiles.pending_profile->>'email', users.email) AS email,
        COALESCE(sitter_profiles.pending_profile->>'avatar_url', users.avatar_url) AS avatar_url,
        sitter_profiles.approval_status
      FROM sitter_profiles
      INNER JOIN users ON users.id = sitter_profiles.user_id
      ${where}
      ORDER BY users.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `,
      [...values, limit, offset]
    );

    return {
      rows: result.rows,
      totalSitters: Number(count.rows[0].count),
    };
  },

  // จาก: repositories/adminSitters.repository.mjs
  // ใช้ที่: adminSittersService.getById, adminSittersService.updateStatus
  async findById(sitterId) {
    const { rows } = await connectionPool.query(
      `
      SELECT
        sitter_profiles.user_id AS id,
        users.name AS full_name,
        users.phone,
        users.id_number,
        to_char(users.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        users.avatar_url,
        sitter_profiles.display_name AS pet_sitter_name,
        sitter_profiles.experience_years,
        sitter_profiles.introduction,
        sitter_profiles.services,
        sitter_profiles.my_place,
        sitter_profiles.address_detail,
        sitter_profiles.sub_district,
        sitter_profiles.district,
        sitter_profiles.province,
        sitter_profiles.post_code,
        sitter_profiles.latitude,
        sitter_profiles.longitude,
        sitter_profiles.approval_status,
        sitter_profiles.is_listed,
        sitter_profiles.pending_profile,
        COALESCE(
          (
            SELECT json_agg(pet_types.name ORDER BY pet_types.name)
            FROM sitter_pet_types
            INNER JOIN pet_types ON pet_types.id = sitter_pet_types.pet_type_id
            WHERE sitter_pet_types.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) AS pet_types,
        COALESCE(
          (
            SELECT json_agg(sitter_photos.photo_url ORDER BY sitter_photos.sort_order)
            FROM sitter_photos
            WHERE sitter_photos.sitter_id = sitter_profiles.user_id
          ),
          '[]'::json
        ) AS photos
      FROM sitter_profiles
      INNER JOIN users ON users.id = sitter_profiles.user_id
      WHERE sitter_profiles.user_id = $1
      `,
      [sitterId]
    );
    return rows[0] ?? null;
  },

  // จาก: repositories/adminSitters.repository.mjs
  // ใช้ที่: applyPendingProfile
  async updateProfile(userId, profile) {
    await connectionPool.query(
      `UPDATE sitter_profiles
       SET display_name = $1,
           introduction = $2,
           my_place = $3,
           services = $4,
           experience_years = $5,
           address_detail = $6,
           district = $7,
           sub_district = $8,
           province = $9,
           post_code = $10,
           updated_at = NOW()
       WHERE user_id = $11`,
      [
        profile.display_name,
        profile.introduction,
        profile.my_place,
        profile.services,
        profile.experience_years,
        profile.address_detail,
        profile.district,
        profile.sub_district,
        profile.province,
        profile.post_code,
        userId,
      ]
    );
  },

  // จาก: repositories/adminSitters.repository.mjs
  // ใช้ที่: adminSittersService.updateStatus
  async updateStatus(sitterId, { approvalStatus, isListed, clearPending }) {
    const { rows } = await connectionPool.query(
      `
      UPDATE sitter_profiles
      SET approval_status = $1,
          is_listed = COALESCE($2, is_listed),
          pending_profile = CASE WHEN $3 THEN NULL ELSE pending_profile END,
          updated_at = NOW()
      WHERE user_id = $4
      RETURNING user_id AS id, approval_status, is_listed
      `,
      [approvalStatus, isListed, clearPending, sitterId]
    );
    return rows[0] ?? null;
  },
};

// จาก: services/adminSitters.service.mjs (helper ในไฟล์ ไม่ export)
// ใช้ที่: adminSittersService.updateStatus ตอน Approved
async function applyPendingProfile(userId, pending) {
  if (!pending) return;

  const current = await sitterProfileMeRepository.findByUserId(userId);
  if (!current) throw httpError(404, "Sitter profile not found");

  const email = String(pending.email ?? current.email ?? "").trim().toLowerCase();

  await sitterProfileMeRepository.updateUser(userId, {
    name: pending.full_name ?? current.name,
    email,
    phone: pending.phone ?? current.phone,
    dateOfBirth: pending.date_of_birth ?? current.date_of_birth,
    idNumber: pending.id_number ?? current.id_number,
    avatarUrl: pending.avatar_url ?? current.avatar_url,
  });

  if (email && email !== String(current.email ?? "").toLowerCase()) {
    const { error } = await supabase.auth.admin.updateUserById(userId, { email });
    if (error) throw httpError(400, "Email is already in use");
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

// ---------- services/sitters.service.mjs ----------
const sittersService = {
  // จาก: services/sitters.service.mjs
  // ใช้ที่: sittersController.getMyProfile (GET /api/sitters/me)
  async getProfileByUserId(userId) {
    const profile = await sitterProfileMeRepository.findByUserId(userId);
    if (!profile) throw httpError(404, "Sitter profile not found");
    return overlayPending(profile);
  },

  // จาก: services/sitters.service.mjs
  // ใช้ที่: sittersController.updateMyProfile (PUT /api/sitters/me)
  async updateMyProfile(userId, { body, avatarFile, galleryFiles }) {
    const profile = await sitterProfileMeRepository.findByUserId(userId);
    if (!profile) throw httpError(404, "Sitter profile not found");

    const fullProfileUnlocked = isFullProfileUnlocked(profile.approval_status);
    if (fullProfileUnlocked) validateSitterProfileBody(body);
    else validateSitterBasicBody(body);

    const existingGallery = fullProfileUnlocked
      ? parseExistingGallery(body.existing_gallery, profile.pending_profile?.photos ?? profile.sitter_photos)
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
      if (petTypes.length === 0) throw httpError(400, "Pet type is required");

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

// ---------- services/adminSitters.service.mjs ----------
const adminSittersService = {
  // จาก: services/adminSitters.service.mjs
  // ใช้ที่: adminSittersController.list (GET /api/admin/sitters)
  async list(search, status, limit, offset) {
    return adminSittersRepository.findMany(search, status, limit, offset);
  },

  // จาก: services/adminSitters.service.mjs
  // ใช้ที่: adminSittersController.getById (GET /api/admin/sitters/:id)
  // เปิดได้ทุกสถานะ แล้วทับด้วย pending ให้แอดมินเห็นของที่รอรีวิว
  async getById(sitterId) {
    const sitter = await adminSittersRepository.findById(sitterId);
    if (!sitter) throw httpError(404, "Sitter not found");
    return overlayPending(sitter);
  },

  // จาก: services/adminSitters.service.mjs
  // ใช้ที่: adminSittersController.updateStatus (PATCH /api/admin/sitters/:id/status)
  // Waiting for verify  + Approved -> Verified,  is_listed false, เคลียร์ pending
  // Waiting for approve + Approved -> Approved,  is_listed true,  เคลียร์ pending
  // Waiting for verify  + Rejected -> Unverified, is_listed false, เก็บ pending
  // Waiting for approve + Rejected -> Rejected,  is_listed false, เก็บ pending
  async updateStatus(sitterId, requestedStatus) {
    if (!["Approved", "Rejected"].includes(requestedStatus)) {
      throw httpError(400, "Invalid approval status");
    }

    const sitter = await adminSittersRepository.findById(sitterId);
    if (!sitter) throw httpError(404, "Sitter not found");

    const current = sitter.approval_status;

    if (requestedStatus === "Approved") {
      if (current === "Waiting for verify") {
        await applyPendingProfile(sitterId, sitter.pending_profile);
        return adminSittersRepository.updateStatus(sitterId, {
          approvalStatus: "Verified",
          isListed: false,
          clearPending: true,
        });
      }
      if (current === "Waiting for approve") {
        await applyPendingProfile(sitterId, sitter.pending_profile);
        return adminSittersRepository.updateStatus(sitterId, {
          approvalStatus: "Approved",
          isListed: true,
          clearPending: true,
        });
      }
      throw httpError(400, "This profile is not waiting for review");
    }

    if (current === "Waiting for verify") {
      return adminSittersRepository.updateStatus(sitterId, {
        approvalStatus: "Unverified",
        isListed: false,
        clearPending: false,
      });
    }
    if (current === "Waiting for approve") {
      return adminSittersRepository.updateStatus(sitterId, {
        approvalStatus: "Rejected",
        isListed: false,
        clearPending: false,
      });
    }
    throw httpError(400, "This profile is not waiting for review");
  },
};

// จาก: controllers/sitters.controller.mjs getMyProfile
// ใช้ที่: routes/sitters.route.mjs GET /api/sitters/me
sittersRouter.get("/me", requireAuth, requireSitter, async (req, res, next) => {
  try {
    const profile = await sittersService.getProfileByUserId(req.user.id);
    return res.status(200).json({ data: profile });
  } catch (error) {
    next(error);
  }
});

// จาก: controllers/sitters.controller.mjs updateMyProfile
// ใช้ที่: routes/sitters.route.mjs PUT /api/sitters/me
sittersRouter.put(
  "/me",
  [uploadSitterImages, requireAuth, requireSitter],
  async (req, res, next) => {
    try {
      await sittersService.updateMyProfile(req.user.id, {
        body: req.body,
        avatarFile: req.files?.imageFile?.[0],
        galleryFiles: req.files?.galleryFiles ?? [],
      });
      return res.status(200).json({ message: "Profile updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

// จาก: controllers/adminSitters.controller.mjs list
// ใช้ที่: routes/adminSitters.route.mjs GET /api/admin/sitters
adminSittersRouter.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 8;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;
    const status =
      req.query.status && req.query.status !== "all" ? req.query.status : null;

    const { rows, totalSitters } = await adminSittersService.list(
      search,
      status,
      limit,
      offset
    );
    const totalPages = Math.ceil(totalSitters / limit) || 1;
    return res.status(200).json({
      totalSitters,
      totalPages,
      currentPage: page,
      limit,
      data: rows,
      nextPage: page < totalPages ? page + 1 : null,
    });
  } catch (error) {
    next(error);
  }
});

// จาก: controllers/adminSitters.controller.mjs getById
// ใช้ที่: routes/adminSitters.route.mjs GET /api/admin/sitters/:id
adminSittersRouter.get("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const sitter = await adminSittersService.getById(req.params.id);
    return res.status(200).json({ data: sitter });
  } catch (error) {
    next(error);
  }
});

// จาก: controllers/adminSitters.controller.mjs updateStatus
// ใช้ที่: routes/adminSitters.route.mjs PATCH /api/admin/sitters/:id/status
adminSittersRouter.patch("/:id/status", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await adminSittersService.updateStatus(req.params.id, req.body.approval_status);
    return res.status(200).json({
      message: "Sitter approval status updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

export { sittersRouter, adminSittersRouter };
export default { sittersRouter, adminSittersRouter };
