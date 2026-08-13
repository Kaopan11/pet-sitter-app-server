import { authService } from "../services/auth.service.mjs";

export const authController = {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
};
