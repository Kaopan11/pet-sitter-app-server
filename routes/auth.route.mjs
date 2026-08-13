import { Router } from "express";
import { authController } from "../controllers/auth.controller.mjs";
import { validateLogin, validateRegister } from "../middlewares/validateAuth.mjs";

const authRouter = Router();

authRouter.post("/register", validateRegister, authController.register);
authRouter.post("/login", validateLogin, authController.login);

export default authRouter;
