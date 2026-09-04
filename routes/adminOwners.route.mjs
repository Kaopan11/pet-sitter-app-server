import { Router } from "express";
import { adminOwnersController } from "../controllers/adminOwners.controller.mjs";

const adminOwnersRouter = Router();

adminOwnersRouter.get("/", adminOwnersController.list);
adminOwnersRouter.get("/:id", adminOwnersController.getById);
adminOwnersRouter.patch("/:id/ban", adminOwnersController.setBanStatus);
adminOwnersRouter.patch(
  "/:id/pets/:petId/suspend",
  adminOwnersController.setPetSuspended
);

export default adminOwnersRouter;
