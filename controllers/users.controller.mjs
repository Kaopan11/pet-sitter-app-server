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
};
