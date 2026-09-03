import { Router } from "express";
import { adminSittersController } from "../controllers/adminSitters.controller.mjs";

const adminSittersRouter = Router();

adminSittersRouter.get("/", adminSittersController.list);
adminSittersRouter.get("/:id/bookings", adminSittersController.listBookings);
adminSittersRouter.get("/:id/bookings/:bookingId", adminSittersController.getBookingById);
adminSittersRouter.get("/:id/reviews", adminSittersController.listReviews);
adminSittersRouter.patch("/:id/reviews/:reviewId", adminSittersController.approveReview);
adminSittersRouter.delete("/:id/reviews/:reviewId", adminSittersController.deleteReview);
adminSittersRouter.get("/:id", adminSittersController.getById);
adminSittersRouter.patch("/:id/status", adminSittersController.updateStatus);

export default adminSittersRouter;
