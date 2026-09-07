import { Router } from "express";
import { reportsController } from "../controllers/reports.controller.mjs";

const reportsRouter = Router();

/**
 * @openapi
 * /api/reports:
 *   get:
 *     summary: List all reports
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Report list
 */
reportsRouter.get("/", reportsController.list);
reportsRouter.get("/:id", reportsController.getById);
reportsRouter.patch("/:id/status", reportsController.updateStatus);

export default reportsRouter;
