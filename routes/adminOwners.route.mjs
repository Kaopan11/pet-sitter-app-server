import { Router } from "express";
import { adminOwnersController } from "../controllers/adminOwners.controller.mjs";

const adminOwnersRouter = Router();

adminOwnersRouter.get("/", adminOwnersController.list);
adminOwnersRouter.get("/:id", adminOwnersController.getById);

export default adminOwnersRouter;
