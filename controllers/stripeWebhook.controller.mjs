import { stripeWebhookService } from "../services/stripeWebhook.service.mjs";

export const stripeWebhookController = {
  async handle(req, res, next) {
    try {
      const signature = req.headers["stripe-signature"];
      const result = await stripeWebhookService.handleEvent(req.body, signature);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
