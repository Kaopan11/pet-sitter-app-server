import { adminSittersService } from "../services/adminSitters.service.mjs";

export const adminSittersController = {
  async list(req, res, next) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;
      const offset = (page - 1) * limit;
      const search = req.query.search ? `%${req.query.search}%` : null;
      const status =
        req.query.status && req.query.status !== "all"
          ? req.query.status
          : null;

      const { rows, totalSitters } = await adminSittersService.list(
        search,
        status,
        limit,
        offset
      );
      const totalPages = Math.ceil(totalSitters / limit) || 1;

      return res.status(200).json({
        totalSitters,
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
};
