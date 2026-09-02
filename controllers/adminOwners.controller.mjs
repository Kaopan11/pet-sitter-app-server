import { adminOwnersService } from "../services/adminOwners.service.mjs";

export const adminOwnersController = {
  async list(req, res, next) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;
      const offset = (page - 1) * limit;
      const search = req.query.search ? `%${req.query.search}%` : null;

      const { rows, totalOwners } = await adminOwnersService.list(
        search,
        limit,
        offset
      );
      const totalPages = Math.ceil(totalOwners / limit) || 1;

      return res.status(200).json({
        totalOwners,
        totalPages,
        currentPage: page,
        limit,
        data: rows,
        nextPage: page < totalPages ? page + 1 : null,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const owner = await adminOwnersService.getById(req.params.id);
      return res.status(200).json({ data: owner });
    } catch (error) {
      next(error);
    }
  },
};
