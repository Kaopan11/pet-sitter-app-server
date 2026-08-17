import { Router } from "express";
import { sittersController } from "../controllers/sitters.controller.mjs";

const sittersRouter = Router();

sittersRouter.get("/", sittersController.list);

export default sittersRouter;
