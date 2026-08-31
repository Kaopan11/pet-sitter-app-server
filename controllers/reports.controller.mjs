import { reportsRepository } from "../repositories/reports.repository.mjs";
import { httpError } from "../utils/httpError.mjs";

const ALLOWED_STATUSES = new Set(["pending", "resolved", "cancelled"]);

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

  async updateStatus(req, res, next) {
    try {
      const raw = String(req.body?.status ?? "").trim().toLowerCase();
      const status = raw === "canceled" ? "cancelled" : raw;

      if (!ALLOWED_STATUSES.has(status)) {
        throw httpError(400, "status must be pending, resolved, or cancelled");
      }

      const report = await reportsRepository.updateStatus(req.params.id, status);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      return res.status(200).json({ data: report });
    } catch (error) {
      next(error);
    }
  },
};
