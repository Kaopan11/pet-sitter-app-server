import { Router } from "express";
import { bookingsController } from "../controllers/bookings.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const ownerBookingsRouter = Router();

// Day 3 — owner สร้าง booking ด้วย cash
ownerBookingsRouter.post("/", requireAuth, bookingsController.create);

export default ownerBookingsRouter;
