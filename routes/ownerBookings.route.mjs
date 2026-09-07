import { Router } from "express";
import { bookingsController } from "../controllers/bookings.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const ownerBookingsRouter = Router();

/**
 * @openapi
 * /api/bookings/owner:
 *   get:
 *     summary: Get my bookings as owner
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: waiting_confirm
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Owner booking list
 *       401:
 *         description: Unauthorized
 */
ownerBookingsRouter.get(
  "/owner",
  requireAuth,
  bookingsController.getOwnerBookings
);
// GET /api/bookings/owner/:id — รายละเอียด booking รายการเดียว (สำหรับหน้า detail/drawer)
ownerBookingsRouter.get(
  "/owner/:id",
  requireAuth,
  bookingsController.getOwnerBookingById
);
// POST /api/bookings/owner/:id/cancel — ยกเลิก booking (ได้เฉพาะตอนยัง waiting_confirm)
ownerBookingsRouter.post(
  "/owner/:id/cancel",
  requireAuth,
  bookingsController.cancelOwnerBooking
);
// POST /api/bookings/owner/:id/reschedule — เลื่อนวัน/เวลา booking (ได้เฉพาะตอนยัง waiting_confirm)
ownerBookingsRouter.post(
  "/owner/:id/reschedule",
  requireAuth,
  bookingsController.rescheduleOwnerBooking
);
// POST /api/bookings/owner/:id/review — ให้คะแนน/เขียนรีวิว booking ที่เสร็จแล้ว (success)
ownerBookingsRouter.post(
  "/owner/:id/review",
  requireAuth,
  bookingsController.submitOwnerReview
);
// POST /api/bookings/owner/:id/report — แจ้งปัญหาเกี่ยวกับ booking นี้
ownerBookingsRouter.post(
  "/owner/:id/report",
  requireAuth,
  bookingsController.submitOwnerReport
);

/**
 * @openapi
 * /api/bookings:
 *   post:
 *     summary: Create a booking (cash or stripe)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sitterId, petIds, paymentMethod]
 *             properties:
 *               sitterId:
 *                 type: string
 *                 format: uuid
 *               petIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               message:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, stripe]
 *               startDate:
 *                 type: string
 *                 example: "2026-09-10"
 *               endDate:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 example: "10:00"
 *               endTime:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Time slot already booked
 */
ownerBookingsRouter.post("/", requireAuth, bookingsController.create);

export default ownerBookingsRouter;
