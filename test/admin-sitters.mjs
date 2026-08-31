import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware.mjs";

const adminSittersRouter = Router();


adminSittersRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 8;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;
  const status = req.query.status && req.query.status !== "all" ? req.query.status : null;

  try {
    const selectSitters = `
      SELECT
        sitter_profiles.user_id AS id,
        users.name AS full_name,
        sitter_profiles.display_name AS pet_sitter_name,
        users.email,
        users.avatar_url,
        sitter_profiles.approval_status
      FROM sitter_profiles
      INNER JOIN users ON users.id = sitter_profiles.user_id
    `;

    const fromWithJoins = `
      FROM sitter_profiles
      INNER JOIN users ON users.id = sitter_profiles.user_id
    `;

    let result;
    let totalSitters;

    if (search && status) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE (
              users.name ILIKE $1
           OR sitter_profiles.display_name ILIKE $1
           OR users.email ILIKE $1
         )
           AND sitter_profiles.approval_status = $2`,
        [search, status]
      );
      totalSitters = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectSitters}
         WHERE (
              users.name ILIKE $1
           OR sitter_profiles.display_name ILIKE $1
           OR users.email ILIKE $1
         )
           AND sitter_profiles.approval_status = $2
         ORDER BY users.created_at DESC
         LIMIT $3 OFFSET $4`,
        [search, status, limit, offset]
      );
    } else if (search) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE users.name ILIKE $1
            OR sitter_profiles.display_name ILIKE $1
            OR users.email ILIKE $1`,
        [search]
      );
      totalSitters = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectSitters}
         WHERE users.name ILIKE $1
            OR sitter_profiles.display_name ILIKE $1
            OR users.email ILIKE $1
         ORDER BY users.created_at DESC
         LIMIT $2 OFFSET $3`,
        [search, limit, offset]
      );
    } else if (status) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE sitter_profiles.approval_status = $1`,
        [status]
      );
      totalSitters = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectSitters}
         WHERE sitter_profiles.approval_status = $1
         ORDER BY users.created_at DESC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      );
    } else {
      const count = await connectionPool.query(`SELECT COUNT(*) ${fromWithJoins}`);
      totalSitters = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectSitters}
         ORDER BY users.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }

    const totalPages = Math.ceil(totalSitters / limit) || 1;

    return res.status(200).json({
      totalSitters,
      totalPages,
      currentPage: page,
      limit,
      data: result.rows,
      nextPage: page < totalPages ? page + 1 : null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read pet sitters because database connection",
    });
  }
});

adminSittersRouter.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await connectionPool.query(
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
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Sitter not found" });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

adminSittersRouter.patch("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const allowed = ["Waiting for approve", "Approved", "Rejected"];
  const { approval_status } = req.body;

  if (!allowed.includes(approval_status)) {
    return res.status(400).json({ message: "Invalid approval status" });
  }

  try {
    const result = await connectionPool.query(
      `UPDATE sitter_profiles
       SET approval_status = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [approval_status, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Sitter not found" });
    }

    return res.status(200).json({
      message: "Sitter approval status updated successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default adminSittersRouter;
