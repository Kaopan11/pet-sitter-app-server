import { Router } from "express";
import { stripeWebhookController } from "../controllers/stripeWebhook.controller.mjs";

const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/", stripeWebhookController.handle);

export default stripeWebhookRouter;
