import { Router } from "express";
import { reportsController } from "../controllers/reports.controller.mjs";

const reportsRouter = Router();

// Temporary: no auth until admin login exists. Add requireAuth + requireAdmin later.
reportsRouter.get("/", reportsController.list);
reportsRouter.get("/:id", reportsController.getById);
reportsRouter.patch("/:id/status", reportsController.updateStatus);

export default reportsRouter;
