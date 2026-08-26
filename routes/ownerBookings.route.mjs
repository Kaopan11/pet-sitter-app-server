import { Router } from "express";
import { bookingsController } from "../controllers/bookings.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const ownerBookingsRouter = Router();

<<<<<<< HEAD
ownerBookingsRouter.get("/owner", requireAuth, bookingsController.getOwnerBookings);
// Day 3–5 — owner สร้าง booking ด้วย cash | stripe
ownerBookingsRouter.post("/", requireAuth, bookingsController.create);
=======
ownerBookingsRouter.get(
  "/owner",
  requireAuth,
  bookingsController.getOwnerBookings
);
ownerBookingsRouter.get(
  "/owner/:id",
  requireAuth,
  bookingsController.getOwnerBookingById
);
ownerBookingsRouter.post(
  "/owner/:id/review",
  requireAuth,
  bookingsController.submitOwnerReview
);
ownerBookingsRouter.post(
  "/owner/:id/report",
  requireAuth,
  bookingsController.submitOwnerReport
);
>>>>>>> 8863466 (feat(bookings): add owner bookings endpoints and review/report functionality)

export default ownerBookingsRouter;
