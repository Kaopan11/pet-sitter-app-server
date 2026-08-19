import { usersService } from "../services/users.service.mjs";

export const usersController = {
  async getAllUsers(req, res, next) {
    try {
      const users = await usersService.getAllUsers();
      res.status(200).json({ data: users });
    } catch (error) {
      next(error);
    }
  },
  async getMe(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await usersService.getMe(userId);
      res.status(200).json({ data: user });
    } catch (error) {
      next(error);
    }
  },
  async updateMe(req, res, next) {
    try {
      const user = await usersService.updateMe(req.user.id, req.body, req.file);
      res.status(200).json({ data: user });
    } catch (error) {
      next(error);
    }
  },

};
