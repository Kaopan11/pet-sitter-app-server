import { Router } from "express";
import multer from "multer";
import { sittersController } from "../controllers/sitters.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const sittersRouter = Router();
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
      callback(new Error("Image must be .jpg, .jpeg, or .png"));
      return;
    }
    callback(null, true);
  },
});
const imageFileUpload = multerUpload.fields([
  { name: "imageFile", maxCount: 1 },
  { name: "galleryFiles", maxCount: 10 },
]);

function uploadSitterImages(req, res, next) {
  imageFileUpload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image must be 2MB or smaller"
        : error.message;
    return res.status(400).json({ message });
  });
}

sittersRouter.get("/", sittersController.list);
sittersRouter.get("/me", requireAuth, sittersController.getMyProfile);
// ต้องวาง /me ก่อน /:id เพราะ Express อ่านบนลงล่าง — ถ้า /:id อยู่ก่อน /me จะถูกตีความว่า id = "me"
sittersRouter.get("/:id", sittersController.getById);
sittersRouter.put(
  "/me",
  [uploadSitterImages, requireAuth],
  sittersController.updateMyProfile
);
sittersRouter.delete(
  "/me/photos/:photoId",
  requireAuth,
  sittersController.deleteMyPhoto
);

export default sittersRouter;
