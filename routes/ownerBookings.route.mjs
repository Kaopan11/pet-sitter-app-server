import { Router } from "express";
import { bookingsController } from "../controllers/bookings.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const ownerBookingsRouter = Router();

// หน้า Booking History (ฝั่ง owner) — ทุก endpoint ต้อง login (requireAuth)
// และทำงานกับ booking ของ owner ที่ login อยู่เท่านั้น (ผูกด้วย req.user.id)

// GET /api/bookings/owner — รายการ booking ทั้งหมดของ owner (ค้นหา/กรองสถานะ/แบ่งหน้า)
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
// owner สร้าง booking ด้วย cash | stripe
ownerBookingsRouter.post("/", requireAuth, bookingsController.create);

export default ownerBookingsRouter;
