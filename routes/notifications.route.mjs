import { Router } from "express";
import { notificationsController } from "../controllers/notifications.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get("/", notificationsController.listMine);
notificationsRouter.patch("/read-all", notificationsController.markAllRead);
notificationsRouter.patch("/:id/read", notificationsController.markRead);

export default notificationsRouter;
