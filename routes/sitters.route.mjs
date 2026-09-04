import { Router } from "express";
import { sittersController } from "../controllers/sitters.controller.mjs";
import { requireAuth, requireSitter } from "../middlewares/auth.middleware.mjs";
import { uploadSitterImages } from "../middlewares/uploadSitterImages.mjs";
import { uploadBookBankImage } from "../middlewares/uploadBookBankImage.mjs";
import bookingsRouter from "./bookings.route.mjs";

const sittersRouter = Router();

// GET /api/sitters — endpoint หลักของหน้า Landing page: ดึงรายชื่อ sitter
// พร้อมรองรับค้นหา (q), กรอง petTypes/rating/experience และแบ่งหน้า (page, limit)
sittersRouter.get("/", sittersController.list);
sittersRouter.get(
  "/me",
  requireAuth,
  requireSitter,
  sittersController.getMyProfile
);
sittersRouter.get(
  "/me/payout",
  requireAuth,
  requireSitter,
  sittersController.getMyPayout
);
sittersRouter.get(
  "/me/payout/bank-account",
  requireAuth,
  requireSitter,
  sittersController.getMyPayoutBankAccount
);
sittersRouter.put(
  "/me/payout/bank-account",
  requireAuth,
  requireSitter,
  sittersController.updateMyPayoutBankAccount
);
sittersRouter.post(
  "/me/payout/book-bank-image",
  [uploadBookBankImage, requireAuth, requireSitter],
  sittersController.uploadMyPayoutBookBankImage
);
sittersRouter.put(
  "/me",
  [uploadSitterImages, requireAuth, requireSitter],
  sittersController.updateMyProfile
);

sittersRouter.use("/bookings", bookingsRouter);
// ต้องวาง /me และ /bookings ก่อน /:id เพราะ Express อ่านบนลงล่าง
sittersRouter.get("/:id", sittersController.getById);
sittersRouter.get("/:id/reviews", sittersController.getReviews);
sittersRouter.get("/:id/availability", sittersController.getAvailability);

export default sittersRouter;
