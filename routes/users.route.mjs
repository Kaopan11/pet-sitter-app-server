import { Router } from "express";
import { usersController } from "../controllers/users.controller.mjs";

const usersRouter = Router();

usersRouter.get("/", usersController.getAllUsers);

export default usersRouter;
