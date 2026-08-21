import { Router } from "express";
import { authController } from "../controllers/auth.controller.mjs";
import { validateLogin, validateRegister } from "../middlewares/validateAuth.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const authRouter = Router();

// POST /api/auth/register → ตรวจ body ก่อน แล้วค่อยสมัคร
authRouter.post("/register", validateRegister, authController.register);

// POST /api/auth/login → ตรวจ body ก่อน แล้วค่อยเข้าสู่ระบบ
authRouter.post("/login", validateLogin, authController.login);

// POST /api/auth/become-sitter → owner ที่ login แล้ว สร้าง sitter_profiles แบบเดียวกับ register asSitter
authRouter.post("/become-sitter", requireAuth, authController.becomeSitter);

export default authRouter;
