import { Router } from "express";
import {
  authController,
  createAuthController,
} from "../controllers/auth.controller.mjs";
import {
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from "../middlewares/validateAuth.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";

export function createAuthRouter(controller = authController) {
  const authRouter = Router();

  authRouter.post("/register", validateRegister, controller.register);
  authRouter.post("/login", validateLogin, controller.login);
  authRouter.get("/me", controller.me);
  authRouter.post("/oauth/complete", controller.completeOAuthProfile);
  authRouter.post(
    "/forgot-password",
    validateForgotPassword,
    controller.forgotPassword
  );
  authRouter.post(
    "/reset-password",
    validateResetPassword,
    controller.resetPassword
  );
  authRouter.post("/become-sitter", requireAuth, controller.becomeSitter);

  return authRouter;
}

export default createAuthRouter();
