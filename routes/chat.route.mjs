import { Router } from "express";
import multer from "multer";
import { chatController } from "../controllers/chat.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const chatRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    if (
      !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
        file.mimetype
      )
    ) {
      callback(new Error("Image must be JPG, PNG, or WebP"));
      return;
    }
    callback(null, true);
  },
});

function uploadChatImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
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

chatRouter.use(requireAuth);

chatRouter.post("/", chatController.createConversation);
chatRouter.get("/", chatController.listConversations);
chatRouter.get("/events", chatController.streamEvents);
chatRouter.get("/:id/messages", chatController.listMessages);
chatRouter.post("/:id/messages", uploadChatImage, chatController.sendMessage);

export default chatRouter;
