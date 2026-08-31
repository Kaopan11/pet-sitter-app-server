import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const bookingsRouter = Router();


bookingsRouter.get("/", requireAuth, async (req, res) => {
  const sitterId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 6;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;
  const status = req.query.status && req.query.status !== "all" ? req.query.status : null;

  try {
    const sitter = await connectionPool.query(
      `SELECT user_id FROM sitter_profiles WHERE user_id = $1 LIMIT 1`,
      [sitterId]
    );

    if (!sitter.rows[0]) {
      return res.status(404).json({ message: "Sitter profile not found" });
    }

    const selectBookings = `
      SELECT
        bookings.id,
        users.name AS pet_owner_name,
        COUNT(booking_pets.pet_id)::int AS pet_count,
        bookings.duration_hours,
        bookings.booking_date,
        bookings.start_time,
        bookings.end_time,
        bookings.status
      FROM bookings
      INNER JOIN users ON users.id = bookings.owner_id
      LEFT JOIN booking_pets ON booking_pets.booking_id = bookings.id
    `;

    const fromWithJoins = `
      FROM bookings
      INNER JOIN users ON users.id = bookings.owner_id
    `;

    let result;
    let totalBookings;

    if (search && status) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE bookings.sitter_id = $1
           AND users.name ILIKE $2
           AND bookings.status = $3`,
        [sitterId, search, status]
      );
      totalBookings = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectBookings}
         WHERE bookings.sitter_id = $1
           AND users.name ILIKE $2
           AND bookings.status = $3
         GROUP BY bookings.id, users.name
         ORDER BY bookings.created_at DESC
         LIMIT $4 OFFSET $5`,
        [sitterId, search, status, limit, offset]
      );
    } else if (search) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE bookings.sitter_id = $1
           AND users.name ILIKE $2`,
        [sitterId, search]
      );
      totalBookings = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectBookings}
         WHERE bookings.sitter_id = $1
           AND users.name ILIKE $2
         GROUP BY bookings.id, users.name
         ORDER BY bookings.created_at DESC
         LIMIT $3 OFFSET $4`,
        [sitterId, search, limit, offset]
      );
    } else if (status) {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE bookings.sitter_id = $1
           AND bookings.status = $2`,
        [sitterId, status]
      );
      totalBookings = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectBookings}
         WHERE bookings.sitter_id = $1
           AND bookings.status = $2
         GROUP BY bookings.id, users.name
         ORDER BY bookings.created_at DESC
         LIMIT $3 OFFSET $4`,
        [sitterId, status, limit, offset]
      );
    } else {
      const count = await connectionPool.query(
        `SELECT COUNT(*) ${fromWithJoins}
         WHERE bookings.sitter_id = $1`,
        [sitterId]
      );
      totalBookings = Number(count.rows[0].count);

      result = await connectionPool.query(
        `${selectBookings}
         WHERE bookings.sitter_id = $1
         GROUP BY bookings.id, users.name
         ORDER BY bookings.created_at DESC
         LIMIT $2 OFFSET $3`,
        [sitterId, limit, offset]
      );
    }

    const totalPages = Math.ceil(totalBookings / limit) || 1;

    return res.status(200).json({
      totalBookings,
      totalPages,
      currentPage: page,
      limit,
      data: result.rows,
      nextPage: page < totalPages ? page + 1 : null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read bookings because database connection",
    });
  }
});

bookingsRouter.get("/:id", requireAuth, async (req, res) => {
  const sitterId = req.user.id;
  const bookingId = req.params.id;

  try {
    const sitter = await connectionPool.query(
      `SELECT user_id FROM sitter_profiles WHERE user_id = $1 LIMIT 1`,
      [sitterId]
    );

    if (!sitter.rows[0]) {
      return res.status(404).json({ message: "Sitter profile not found" });
    }

    const result = await connectionPool.query(
      `
      SELECT
        bookings.id,
        bookings.owner_id,
        users.name AS pet_owner_name,
        json_build_object(
          'id', users.id,
          'name', users.name,
          'email', users.email,
          'phone', users.phone,
          'id_number', users.id_number,
          'date_of_birth', to_char(users.date_of_birth, 'YYYY-MM-DD'),
          'avatar_url', users.avatar_url
        ) AS pet_owner,
        (
          SELECT COUNT(*)::int
          FROM booking_pets
          WHERE booking_pets.booking_id = bookings.id
        ) AS pet_count,
        bookings.duration_hours,
        bookings.booking_date,
        bookings.start_time,
        bookings.end_time,
        bookings.total_price,
        bookings.transaction_no,
        payments.paid_at AS transaction_date,
        bookings.additional_message,
        bookings.status,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pets.id,
                'name', pets.name,
                'pet_type', pet_types.name,
                'breed', pets.breed,
                'sex', pets.sex,
                'age_months', pets.age_months,
                'color', pets.color,
                'weight_kg', pets.weight_kg,
                'about', pets.about,
                'avatar_url', pets.avatar_url
              )
              ORDER BY pets.id
            )
            FROM booking_pets
            INNER JOIN pets ON pets.id = booking_pets.pet_id
            INNER JOIN pet_types ON pet_types.id = pets.pet_type_id
            WHERE booking_pets.booking_id = bookings.id
          ),
          '[]'::json
        ) AS pets
      FROM bookings
      INNER JOIN users ON users.id = bookings.owner_id
      LEFT JOIN payments ON payments.booking_id = bookings.id
      WHERE bookings.id = $1
        AND bookings.sitter_id = $2
      `,
      [bookingId, sitterId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Booking not found" });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read booking because database connection",
    });
  }
});

export default bookingsRouter;
