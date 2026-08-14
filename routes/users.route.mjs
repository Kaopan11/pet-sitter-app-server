import { Router } from "express";
import { usersController } from "../controllers/users.controller.mjs";

const usersRouter = Router();

// GET /api/users
usersRouter.get("/", usersController.getAllUsers);

export default usersRouter;
