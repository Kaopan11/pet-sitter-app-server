import { Router } from "express";
import { adminSittersController } from "../controllers/adminSitters.controller.mjs";

const adminSittersRouter = Router();

adminSittersRouter.get("/", adminSittersController.list);

export default adminSittersRouter;
