import { Router } from "express";
import { usersController } from "../controllers/users.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";
import { validateUpdateOwners } from "../middlewares/validateUsers.mjs";

const usersRouter = Router();

usersRouter.get("/", usersController.getAllUsers);
usersRouter.get("/me", requireAuth, usersController.getMe);
usersRouter.put("/me", requireAuth, validateUpdateOwners, usersController.updateMe);

export default usersRouter;
