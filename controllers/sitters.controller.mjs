import { sittersService } from "../services/sitters.service.mjs";

export const sittersController = {
  async list(req, res, next) {
    try {
      const result = await sittersService.listSitters(req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
