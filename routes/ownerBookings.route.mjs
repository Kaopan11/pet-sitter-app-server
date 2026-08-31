import { Router } from "express";
import { bookingsController } from "../controllers/bookings.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const ownerBookingsRouter = Router();

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
  "/owner/:id/cancel",
  requireAuth,
  bookingsController.cancelOwnerBooking
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
// owner สร้าง booking ด้วย cash | stripe
ownerBookingsRouter.post("/", requireAuth, bookingsController.create);

export default ownerBookingsRouter;
