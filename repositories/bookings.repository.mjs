import connectionPool from "../utils/db.mjs";

export const bookingsRepository = {
  async findManyBySitterId(sitterId, search, status, limit, offset) {
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

    return {
      rows: result.rows,
      totalBookings,
    };
  },

  async findByIdAndSitterId(sitterId, bookingId) {
    const { rows } = await connectionPool.query(
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

    return rows[0] ?? null;
  },

  async updateStatusByIdAndSitterId(sitterId, bookingId, status) {
    const { rows } = await connectionPool.query(
      `
      UPDATE bookings
      SET status = $3,
          updated_at = NOW()
      WHERE id = $1
        AND sitter_id = $2
      RETURNING id, status
      `,
      [bookingId, sitterId, status]
    );

    return rows[0] ?? null;
  },

  // owner booking — สร้าง booking + pets + payment ใน transaction เดียว
  async createBookingWithPets({
    ownerId,
    sitterId,
    bookingDate,
    startTime,
    endTime,
    durationHours,
    contactName,
    contactEmail,
    contactPhone,
    additionalMessage,
    totalPrice,
    petIds,
  }) {
    const client = await connectionPool.connect();

    try {
      await client.query("BEGIN");

      const { rows: bookingRows } = await client.query(
        `
        INSERT INTO bookings (
          owner_id,
          sitter_id,
          booking_date,
          start_time,
          end_time,
          duration_hours,
          contact_name,
          contact_email,
          contact_phone,
          additional_message,
          total_price,
          status
        )
        VALUES (
          $1, $2, $3::date, $4::time, $5::time, $6,
          $7, $8, $9, $10, $11, 'waiting_confirm'
        )
        RETURNING id, status, total_price
        `,
        [
          ownerId,
          sitterId,
          bookingDate,
          startTime,
          endTime,
          durationHours,
          contactName,
          contactEmail,
          contactPhone,
          additionalMessage,
          totalPrice,
        ]
      );

      const booking = bookingRows[0];

      for (const petId of petIds) {
        await client.query(
          `
          INSERT INTO booking_pets (booking_id, pet_id)
          VALUES ($1, $2)
          `,
          [booking.id, petId]
        );
      }

      const { rows: paymentRows } = await client.query(
        `
        INSERT INTO payments (booking_id, amount, status)
        VALUES ($1, $2, 'pending')
        RETURNING status
        `,
        [booking.id, totalPrice]
      );

      await client.query("COMMIT");

      return {
        bookingId: booking.id,
        status: booking.status,
        totalPrice: Number(booking.total_price),
        paymentStatus: paymentRows[0].status,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async updatePaymentTokenByBookingId(bookingId, paymentToken) {
    const { rows } = await connectionPool.query(
      `
      UPDATE payments
      SET payment_token = $2
      WHERE booking_id = $1
      RETURNING status, payment_token
      `,
      [bookingId, paymentToken]
    );
    return rows[0] ?? null;
  },

  async updatePaymentStatusByToken(paymentToken, status, paidAt = null) {
    const { rows } = await connectionPool.query(
      `
      UPDATE payments
      SET status = $2::varchar,
          paid_at = CASE
            WHEN $2::text = 'paid' THEN COALESCE($3::timestamptz, NOW())
            ELSE paid_at
          END
      WHERE payment_token = $1
      RETURNING booking_id, status, paid_at
      `,
      [paymentToken, status, paidAt]
    );
    return rows[0] ?? null;
  },
};
