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

  async getById(req, res, next) {
    try {
      const sitter = await adminSittersService.getById(req.params.id);

      return res.status(200).json({ data: sitter });
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      await adminSittersService.updateStatus(
        req.params.id,
        req.body.approval_status
      );

      return res.status(200).json({
        message: "Sitter approval status updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};
