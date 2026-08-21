import { authService } from "../services/auth.service.mjs";

export const authController = {
  // รับ request → เรียก service → ส่ง JSON กลับ Frontend
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        message: "Register success",
        data: result,
      });
    } catch (error) {
      next(error); // ส่งต่อไป error handler ใน app.mjs
    }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        message: "Login success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async becomeSitter(req, res, next) {
    try {
      const result = await authService.becomeSitter(req.user.id);
      res.status(201).json({
        message: "Become sitter success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};
