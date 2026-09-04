import { Router } from "express";
import { authController } from "../controllers/auth.controller.mjs";
import {
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from "../middlewares/validateAuth.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

const authRouter = Router();

// POST /api/auth/register → ตรวจ body ก่อน แล้วค่อยสมัคร
authRouter.post("/register", validateRegister, authController.register);

// POST /api/auth/login → ตรวจ body ก่อน แล้วค่อยเข้าสู่ระบบ
authRouter.post("/login", validateLogin, authController.login);

// GET /api/auth/me → OAuth / session ที่มีอยู่: มีโปรไฟล์แล้วคืน user · ไม่มี → 404
authRouter.get("/me", authController.me);

// POST /api/auth/oauth/complete → Social ครั้งแรก: กรอก name+phone สร้าง Owner
// ไม่ใช้ validateOAuthComplete ที่บังคับ body ก่อน — มีโปรไฟล์แล้วให้ short-circuit ได้แม้ body ว่าง
authRouter.post("/oauth/complete", authController.completeOAuthProfile);

// POST /api/auth/forgot-password → ขอลิงก์รีเซ็ต (ตอบสำเร็จเหมือนกันเสมอถ้าอีเมลรูปแบบถูก)
authRouter.post(
  "/forgot-password",
  validateForgotPassword,
  authController.forgotPassword
);

// POST /api/auth/reset-password → ตั้งรหัสใหม่ด้วย accessToken จากลิงก์ในอีเมล
authRouter.post(
  "/reset-password",
  validateResetPassword,
  authController.resetPassword
);

// POST /api/auth/become-sitter → owner ที่ login แล้ว สร้าง sitter_profiles แบบเดียวกับ register asSitter
authRouter.post("/become-sitter", requireAuth, authController.becomeSitter);

export default authRouter;
