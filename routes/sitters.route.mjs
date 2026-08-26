import { Router } from "express";
import { sittersController } from "../controllers/sitters.controller.mjs";
import { requireAuth, requireSitter } from "../middlewares/auth.middleware.mjs";
import { uploadSitterImages } from "../middlewares/uploadSitterImages.mjs";
import bookingsRouter from "./bookings.route.mjs";

const sittersRouter = Router();

sittersRouter.get("/", sittersController.list);
sittersRouter.get(
  "/me",
  requireAuth,
  requireSitter,
  sittersController.getMyProfile
);
sittersRouter.put(
  "/me",
  [uploadSitterImages, requireAuth, requireSitter],
  sittersController.updateMyProfile
);
sittersRouter.delete(
  "/me/photos/:photoId",
  requireAuth,
  requireSitter,
  sittersController.deleteMyPhoto
);

sittersRouter.use("/bookings", bookingsRouter);
// ต้องวาง /me และ /bookings ก่อน /:id เพราะ Express อ่านบนลงล่าง
sittersRouter.get("/:id", sittersController.getById);
sittersRouter.get("/:id/reviews", sittersController.getReviews);

export default sittersRouter;
