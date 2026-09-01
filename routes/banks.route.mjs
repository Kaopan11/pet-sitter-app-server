import { Router } from "express";
import { banksController } from "../controllers/banks.controller.mjs";

const banksRouter = Router();

banksRouter.get("/", banksController.list);

export default banksRouter;
