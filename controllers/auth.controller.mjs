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

  // Ticket #2 — ข้อความสำเร็จอยู่ที่ result.message (มี/ไม่มีบัญชี ข้อความเดียวกัน)
  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword(req.body);
      res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  },

  // Ticket #3 — ตั้งรหัสใหม่จาก recovery token
  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword(req.body);
      res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Ticket #4 — GET /api/auth/me
   * Authorization: Bearer <supabase access_token>
   * 200 + data เหมือน login · 404 = ยังไม่มี public.users (ไป complete-profile)
   */
  async me(req, res, next) {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const accessToken = header.slice(7);
      const result = await authService.resolveOAuthSession(accessToken);

      res.status(200).json({
        message: "Login success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Ticket #5 — POST /api/auth/oauth/complete
   * Bearer + { name, phone } → สร้าง Owner profile
   */
  async completeOAuthProfile(req, res, next) {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const accessToken = header.slice(7);
      const result = await authService.completeOAuthProfile(
        accessToken,
        req.body
      );

      res.status(200).json({
        message: "Login success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};
