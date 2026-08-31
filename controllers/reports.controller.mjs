import { reportsRepository } from "../repositories/reports.repository.mjs";

export const reportsController = {
  async list(req, res, next) {
    try {
      const reports = await reportsRepository.findMany();
      return res.status(200).json({ data: reports });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const report = await reportsRepository.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      return res.status(200).json({ data: report });
    } catch (error) {
      next(error);
    }
  },
};
