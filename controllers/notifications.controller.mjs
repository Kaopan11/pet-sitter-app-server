import { notificationsService } from "../services/notifications.service.mjs";

export const notificationsController = {
  async listMine(req, res, next) {
    try {
      const data = await notificationsService.listMine(req.user.id);
      return res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },

  async markRead(req, res, next) {
    try {
      const data = await notificationsService.markRead(
        req.user.id,
        req.params.id
      );
      return res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },

  async markAllRead(req, res, next) {
    try {
      const data = await notificationsService.markAllRead(req.user.id);
      return res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },
};
