import { Router } from "express";
import { bookingsController } from "../controllers/bookings.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const ownerBookingsRouter = Router();

ownerBookingsRouter.get("/owner", requireAuth, bookingsController.getOwnerBookings);

export default ownerBookingsRouter;
