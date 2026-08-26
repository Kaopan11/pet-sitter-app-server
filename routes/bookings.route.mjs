import { Router } from "express";
import { bookingsController } from "../controllers/bookings.controller.mjs";
import { requireAuth, requireSitter } from "../middlewares/auth.middleware.mjs";

const bookingsRouter = Router();

bookingsRouter.get("/", requireAuth, requireSitter, bookingsController.getMyBookings);
bookingsRouter.get("/:id", requireAuth, requireSitter, bookingsController.getMyBookingById);
bookingsRouter.patch(
  "/:id/status",
  requireAuth,
  requireSitter,
  bookingsController.updateMyBookingStatus
);

export default bookingsRouter;
