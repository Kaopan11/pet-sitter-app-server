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

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, password, asSitter]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               asSitter:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Register success
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email or phone already in use
 */
authRouter.post("/register", validateRegister, authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: apitest@mail.com
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login success
 *       400:
 *         description: Email or password is required
 *       401:
 *         description: Email or password is incorrect
 */
authRouter.post("/login", validateLogin, authController.login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current user from access token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
authRouter.get("/me", authController.me);

/**
 * @openapi
 * /api/auth/oauth/complete:
 *   post:
 *     summary: Complete OAuth profile (first social login)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login success
 *       400:
 *         description: Name or phone is invalid
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Phone number is already in use
 */

// POST /api/auth/oauth/complete → Social ครั้งแรก: กรอก name+phone สร้าง Owner
// ไม่ใช้ validateOAuthComplete ที่บังคับ body ก่อน — มีโปรไฟล์แล้วให้ short-circuit ได้แม้ body ว่าง
authRouter.post("/oauth/complete", authController.completeOAuthProfile);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset email sent if the account exists
 *       400:
 *         description: Invalid email
 */
authRouter.post(
  "/forgot-password",
  validateForgotPassword,
  authController.forgotPassword
);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Set a new password from email reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken, newPassword]
 *             properties:
 *               accessToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Validation error
 */
authRouter.post(
  "/reset-password",
  validateResetPassword,
  authController.resetPassword
);

// POST /api/auth/become-sitter → owner ที่ login แล้ว สร้าง sitter_profiles แบบเดียวกับ register asSitter
authRouter.post("/become-sitter", requireAuth, authController.becomeSitter);

export default authRouter;
