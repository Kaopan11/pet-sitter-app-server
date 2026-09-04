import connectionPool from "../utils/db.mjs";

export const bookingsRepository = {
  async findManyBySitterId(sitterId, search, status, limit, offset) {
    const selectBookings = `
      SELECT
        bookings.id,
        users.name AS pet_owner_name,
        COUNT(booking_pets.pet_id)::int AS pet_count,
        bookings.duration,
        bookings.duration_unit,
        bookings.start_date,
        bookings.end_date,
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
        bookings.duration,
        bookings.duration_unit,
        bookings.start_date,
        bookings.end_date,
        bookings.start_time,
        bookings.end_time,
        bookings.total_price,
        bookings.transaction_no,
        bookings.payment_method,
        payments.status AS payment_status,
        payments.payment_token,
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

  // Booking History (list) — booking ทั้งหมดของ owner คนนี้ พร้อมชื่อ/รูป sitter,
  // รายชื่อ pet ที่พารวมกัน, และรีวิวที่เคยให้ (ถ้ามี) เพื่อโชว์บนหน้ารายการ
  // ทำ 2 query: นับจำนวนทั้งหมดที่ตรงเงื่อนไข (สำหรับ pagination) แล้วค่อยดึงรายการจริง
  async findManyByOwnerId(ownerId, search, status, limit, offset) {
    const { rows: countRows } = await connectionPool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM bookings
      INNER JOIN users AS sitter_users ON sitter_users.id = bookings.sitter_id
      LEFT JOIN sitter_profiles ON sitter_profiles.user_id = bookings.sitter_id
      WHERE bookings.owner_id = $1
        AND ($2::text IS NULL OR sitter_users.name ILIKE $2 OR sitter_profiles.display_name ILIKE $2)
        AND ($3::text IS NULL OR bookings.status = $3)
      `,
      [ownerId, search, status]
    );

    const { rows } = await connectionPool.query(
      `
      SELECT
        bookings.id,
        bookings.sitter_id,
        COALESCE(sitter_profiles.display_name, sitter_users.name) AS sitter_name,
        sitter_users.avatar_url AS sitter_avatar_url,
        STRING_AGG(pets.name, ', ' ORDER BY pets.name) AS pet_names,
        bookings.duration,
        bookings.duration_unit,
        bookings.start_date,
        bookings.end_date,
        bookings.start_time,
        bookings.end_time,
        bookings.total_price,
        bookings.transaction_no,
        bookings.status,
        bookings.created_at,
        bookings.updated_at,
        (
          SELECT json_build_object(
            'rating', reviews.rating,
            'text', reviews.comment,
            'created_at', reviews.created_at
          )
          FROM reviews
          WHERE reviews.booking_id = bookings.id
        ) AS review
      FROM bookings
      INNER JOIN users AS sitter_users ON sitter_users.id = bookings.sitter_id
      LEFT JOIN sitter_profiles ON sitter_profiles.user_id = bookings.sitter_id
      LEFT JOIN booking_pets ON booking_pets.booking_id = bookings.id
      LEFT JOIN pets ON pets.id = booking_pets.pet_id
      WHERE bookings.owner_id = $1
        AND ($2::text IS NULL OR sitter_users.name ILIKE $2 OR sitter_profiles.display_name ILIKE $2)
        AND ($3::text IS NULL OR bookings.status = $3)
      GROUP BY bookings.id, sitter_profiles.display_name, sitter_users.name, sitter_users.avatar_url
      ORDER BY bookings.created_at DESC
      LIMIT $4 OFFSET $5
      `,
      [ownerId, search, status, limit, offset]
    );

    return {
      rows,
      totalBookings: countRows[0]?.total ?? 0,
    };
  },

  // Booking History (detail) — booking รายการเดียว พร้อมข้อมูล sitter, รายชื่อ pet
  // ที่พาไป, สถานะการชำระเงิน และรีวิวที่เคยให้ (ถ้ามี) สำหรับหน้ารายละเอียด
  // WHERE ผูกทั้ง id และ owner_id เพื่อกัน owner คนอื่นดู booking ที่ไม่ใช่ของตัวเอง
  async findByIdAndOwnerId(ownerId, bookingId) {
    const { rows } = await connectionPool.query(
      `
      SELECT
        bookings.id,
        bookings.sitter_id,
        json_build_object(
          'id', sitter_users.id,
          'name', COALESCE(sitter_profiles.display_name, sitter_users.name),
          'avatar_url', sitter_users.avatar_url
        ) AS sitter,
        (
          SELECT COUNT(*)::int
          FROM booking_pets
          WHERE booking_pets.booking_id = bookings.id
        ) AS pet_count,
        bookings.duration,
        bookings.duration_unit,
        bookings.start_date,
        bookings.end_date,
        bookings.start_time,
        bookings.end_time,
        bookings.total_price,
        bookings.transaction_no,
        bookings.payment_method,
        payments.status AS payment_status,
        payments.payment_token,
        payments.paid_at AS transaction_date,
        bookings.additional_message,
        bookings.status,
        bookings.created_at,
        bookings.updated_at,
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
        ) AS pets,
        (
          SELECT json_build_object(
            'rating', reviews.rating,
            'text', reviews.comment,
            'created_at', reviews.created_at
          )
          FROM reviews
          WHERE reviews.booking_id = bookings.id
        ) AS review
      FROM bookings
      INNER JOIN users AS sitter_users ON sitter_users.id = bookings.sitter_id
      LEFT JOIN sitter_profiles ON sitter_profiles.user_id = bookings.sitter_id
      LEFT JOIN payments ON payments.booking_id = bookings.id
      WHERE bookings.id = $1
        AND bookings.owner_id = $2
      `,
      [bookingId, ownerId]
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

  // T02 — cash เข้า in_service → payments.paid
  async markPaymentPaidByBookingId(bookingId) {
    const { rows } = await connectionPool.query(
      `
      UPDATE payments
      SET status = 'paid',
          paid_at = COALESCE(paid_at, NOW())
      WHERE booking_id = $1
        AND status <> 'paid'
      RETURNING status, paid_at
      `,
      [bookingId]
    );

    return rows[0] ?? null;
  },

  // ใช้โดย cancelOwnerBooking — เปลี่ยนสถานะ booking (เช่น -> 'cancelled')
  // WHERE ผูก owner_id ด้วย เพื่อกันแก้ booking ของ owner คนอื่น
  async updateStatusByIdAndOwnerId(ownerId, bookingId, status) {
    const { rows } = await connectionPool.query(
      `
      UPDATE bookings
      SET status = $3,
          updated_at = NOW()
      WHERE id = $1
        AND owner_id = $2
      RETURNING id, status
      `,
      [bookingId, ownerId, status]
    );

    return rows[0] ?? null;
  },

  // ใช้โดย rescheduleOwnerBooking — อัปเดตวัน/เวลา/ระยะเวลา/ราคาของ booking เดิม
  // (ราคาถูกคำนวณใหม่โดย service ก่อนเรียกมาที่นี่แล้ว)
  async updateScheduleByIdAndOwnerId(
    ownerId,
    bookingId,
    { startDate, endDate, startTime, endTime, duration, durationUnit, totalPrice }
  ) {
    const { rows } = await connectionPool.query(
      `
      UPDATE bookings
      SET start_date = $3::date,
          end_date = $4::date,
          start_time = $5::time,
          end_time = $6::time,
          duration = $7,
          duration_unit = $8,
          total_price = $9,
          updated_at = NOW()
      WHERE id = $1
        AND owner_id = $2
      RETURNING id, start_date, end_date, start_time, end_time, duration, duration_unit, total_price, status
      `,
      [
        bookingId,
        ownerId,
        startDate,
        endDate,
        startTime,
        endTime,
        duration,
        durationUnit,
        totalPrice,
      ]
    );

    return rows[0] ?? null;
  },

  // owner booking — สร้าง booking + pets + payment ใน transaction เดียว
  async createBookingWithPets({
    ownerId,
    sitterId,
    startDate,
    endDate,
    startTime,
    endTime,
    duration,
    durationUnit,
    paymentMethod,
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

      // T01 — payment_method จาก client + transaction_no จาก DB sequence
      const { rows: bookingRows } = await client.query(
        `
        INSERT INTO bookings (
          owner_id,
          sitter_id,
          start_date,
          end_date,
          start_time,
          end_time,
          duration,
          duration_unit,
          payment_method,
          transaction_no,
          contact_name,
          contact_email,
          contact_phone,
          additional_message,
          total_price,
          status
        )
        VALUES (
          $1, $2, $3::date, $4::date, $5::time, $6::time, $7, $8,
          $9, next_transaction_no(),
          $10, $11, $12, $13, $14, 'waiting_confirm'
        )
        RETURNING id, status, total_price, transaction_no
        `,
        [
          ownerId,
          sitterId,
          startDate,
          endDate,
          startTime,
          endTime,
          duration,
          durationUnit,
          paymentMethod,
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
        transactionNo: booking.transaction_no,
        paymentStatus: paymentRows[0].status,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // เก็บ Stripe PaymentIntent id ไว้ที่ payments.payment_token หลังสร้าง booking
  // แบบจ่ายบัตร เพื่อใช้ capture/cancel payment ในภายหลัง
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

  async findBusySlotsBySitterId(sitterId) {
    const { rows } = await connectionPool.query(
      `
      SELECT
        to_char(start_date, 'YYYY-MM-DD') AS start_date,
        to_char(COALESCE(end_date, start_date), 'YYYY-MM-DD') AS end_date,
        to_char(start_time, 'HH24:MI') AS start_time,
        to_char(end_time, 'HH24:MI') AS end_time
      FROM bookings
      WHERE sitter_id = $1
        AND status IN ('waiting_confirm', 'waiting_service', 'in_service')
        AND COALESCE(end_date, start_date) >= CURRENT_DATE
      ORDER BY start_date, start_time
      `,
      [sitterId]
    );

    return rows.map((row) => ({
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: row.start_time,
      endTime: row.end_time,
    }));
  },

  // Ticket B — many-days เทียบช่วงวัน · one-day เทียบ datetime บนวันเดียวกัน
  async hasOverlappingBooking({
    sitterId,
    startDate,
    endDate,
    startTime,
    endTime,
    excludeBookingId = null,
  }) {
    const { rows } = await connectionPool.query(
      `
      SELECT id
      FROM bookings
      WHERE sitter_id = $1
        AND status IN ('waiting_confirm', 'waiting_service', 'in_service')
        AND ($6::text IS NULL OR id::text <> $6::text)
        AND (
          (
            COALESCE(end_date, start_date) > start_date
            AND start_date < $3::date
            AND COALESCE(end_date, start_date) > $2::date
          )
          OR (
            $3::date > $2::date
            AND start_date = COALESCE(end_date, start_date)
            AND start_date >= $2::date
            AND start_date < $3::date
          )
          OR (
            start_date = COALESCE(end_date, start_date)
            AND $2::date = $3::date
            AND start_date = $2::date
            AND (start_date + start_time) < ($3::date + $5::time)
            AND (start_date + end_time) > ($2::date + $4::time)
          )
        )
      LIMIT 1
      `,
      [sitterId, startDate, endDate, startTime, endTime, excludeBookingId]
    );

    return Boolean(rows[0]);
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
