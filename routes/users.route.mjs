import { Router } from "express";
import { usersController } from "../controllers/users.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";
import { validateUpdateOwners } from "../middlewares/validateUsers.mjs";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, callback) => {
    if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
      callback(new Error("Image must be .jpg, .jpeg, or .png"));
      return;
    }
    callback(null, true);
  },
});

function uploadOwnerAvatar(req, res, next) {
  upload.single("avatar")(req, res, (error) => {
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

const usersRouter = Router();

usersRouter.get("/", usersController.getAllUsers);
usersRouter.get("/me", requireAuth, usersController.getMe);
// booking Day 0 — สัตว์ของ owner ที่ login
usersRouter.get("/me/pets", requireAuth, usersController.getMyPets);
usersRouter.put(
  "/me",
  uploadOwnerAvatar,
  requireAuth,
  validateUpdateOwners,
  usersController.updateMe,
);

export default usersRouter;
