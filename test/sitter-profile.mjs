import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import supabase from "../repositories/supabase.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";
import { uploadSitterImages } from "../middlewares/uploadSitterImages.mjs";
import { validateSitterProfileBody } from "../utils/validateSitterProfile.mjs";

const sittersRouter = Router();
const PHOTOS_BUCKET = "photos";

async function uploadImageFile(file, folder, userId) {
  const filePath = `${folder}/${userId}-${Date.now()}-${file.originalname ?? "image"}`;
  const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).upload(filePath, file.buffer, {
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

async function findMyProfile(userId) {
  const result = await connectionPool.query(
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
            json_build_object(
              'id', pet_types.id,
              'name', pet_types.name
            )
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

  return result.rows[0] ?? null;
}

// GET /api/sitters/me
sittersRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const profile = await findMyProfile(req.user.id);

    if (!profile) {
      return res.status(404).json({ message: "Sitter profile not found" });
    }

    return res.status(200).json({ data: profile });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read sitter profile because database connection",
    });
  }
});

// PUT /api/sitters/me
sittersRouter.put("/me", uploadSitterImages, requireAuth, async (req, res) => {
  const userId = req.user.id;
  const body = req.body;
  const avatarFile = req.files?.imageFile?.[0];
  const galleryFiles = req.files?.galleryFiles ?? [];

  try {
    const profile = await findMyProfile(userId);

    if (!profile) {
      return res.status(404).json({ message: "Sitter profile not found" });
    }

    validateSitterProfileBody(body);

    if ((profile.sitter_photos ?? []).length + galleryFiles.length > 10) {
      return res.status(400).json({ message: "Image gallery allows a maximum of 10 images" });
    }

    const phone = String(body.phone).trim();
    const email = String(body.email).trim().toLowerCase();

    const takenPhone = await connectionPool.query(
      `SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1`,
      [phone, userId]
    );
    if (takenPhone.rows[0]) {
      return res.status(400).json({ message: "Phone number is already in use" });
    }

    const takenEmail = await connectionPool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
      [email, userId]
    );
    if (takenEmail.rows[0]) {
      return res.status(400).json({ message: "Email is already in use" });
    }

    let avatarUrl = profile.avatar_url;
    if (avatarFile) {
      avatarUrl = await uploadImageFile(avatarFile, "avatar", userId);
    }

    await connectionPool.query(
      `
      UPDATE users
      SET
        name = $2,
        email = $3,
        phone = $4,
        date_of_birth = $5,
        id_number = $6,
        avatar_url = $7,
        updated_at = now()
      WHERE id = $1
      `,
      [userId, body.name, email, phone, body.date_of_birth, body.id_number, avatarUrl]
    );

    if (email !== String(profile.email ?? "").toLowerCase()) {
      const { error } = await supabase.auth.admin.updateUserById(userId, { email });
      if (error) {
        return res.status(400).json({ message: "Email is already in use" });
      }
    }

    await connectionPool.query(
      `
      UPDATE sitter_profiles
      SET
        display_name = $2,
        introduction = $3,
        my_place = $4,
        services = $5,
        experience_years = $6,
        address_detail = $7,
        district = $8,
        sub_district = $9,
        province = $10,
        post_code = $11,
        latitude = $12,
        longitude = $13,
        bank_name = $14,
        account_number = $15,
        updated_at = now()
      WHERE user_id = $1
      `,
      [
        userId,
        body.display_name,
        body.introduction,
        body.my_place,
        body.services,
        body.experience_years,
        body.address_detail,
        body.district,
        body.sub_district,
        body.province,
        body.post_code,
        body.latitude || null,
        body.longitude || null,
        body.bank_name,
        body.account_number,
      ]
    );

    const petTypes = [].concat(body.pet_types || []).filter(Boolean);
    if (petTypes.length === 0) {
      return res.status(400).json({ message: "Pet type is required" });
    }

    const petTypeRows = await connectionPool.query(
      `SELECT id FROM pet_types WHERE LOWER(name) = ANY($1::text[])`,
      [petTypes.map((name) => String(name).toLowerCase())]
    );
    if (petTypeRows.rows.length === 0) {
      return res.status(400).json({ message: "Pet type is invalid" });
    }

    await connectionPool.query(`DELETE FROM sitter_pet_types WHERE sitter_id = $1`, [userId]);
    for (const row of petTypeRows.rows) {
      await connectionPool.query(
        `INSERT INTO sitter_pet_types (sitter_id, pet_type_id) VALUES ($1, $2)`,
        [userId, row.id]
      );
    }

    if (galleryFiles.length > 0) {
      const nextSort = await connectionPool.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
         FROM sitter_photos
         WHERE sitter_id = $1`,
        [userId]
      );
      let sortOrder = nextSort.rows[0].next_sort_order;

      for (const file of galleryFiles) {
        const photoUrl = await uploadImageFile(file, "sitter_photos", userId);
        await connectionPool.query(
          `INSERT INTO sitter_photos (sitter_id, photo_url, sort_order) VALUES ($1, $2, $3)`,
          [userId, photoUrl, sortOrder]
        );
        sortOrder += 1;
      }
    }

    return res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Server could not update sitter profile because database connection",
    });
  }
});

// DELETE /api/sitters/me/photos/:photoId
sittersRouter.delete("/me/photos/:photoId", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const photoId = req.params.photoId;

  try {
    const photo = await connectionPool.query(
      `SELECT id, photo_url FROM sitter_photos WHERE id = $1 AND sitter_id = $2`,
      [photoId, userId]
    );

    if (!photo.rows[0]) {
      return res.status(404).json({ message: "Photo not found" });
    }

    await connectionPool.query(
      `DELETE FROM sitter_photos WHERE id = $1 AND sitter_id = $2`,
      [photoId, userId]
    );

    const marker = `/object/public/${PHOTOS_BUCKET}/`;
    const index = String(photo.rows[0].photo_url).indexOf(marker);
    if (index !== -1) {
      const filePath = decodeURIComponent(photo.rows[0].photo_url.slice(index + marker.length));
      await supabase.storage.from(PHOTOS_BUCKET).remove([filePath]);
    }

    return res.status(200).json({ message: "Photo deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not delete photo because database connection",
    });
  }
});

export default sittersRouter;
