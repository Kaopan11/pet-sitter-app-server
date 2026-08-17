import { Router } from "express";
import { authController } from "../controllers/auth.controller.mjs";
import { validateLogin, validateRegister } from "../middlewares/validateAuth.mjs";

const authRouter = Router();

// POST /api/auth/register → ตรวจ body ก่อน แล้วค่อยสมัคร
authRouter.post("/register", validateRegister, authController.register);

// POST /api/auth/login → ตรวจ body ก่อน แล้วค่อยเข้าสู่ระบบ
authRouter.post("/login", validateLogin, authController.login);

export default authRouter;
