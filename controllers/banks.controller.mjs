import { payoutBankService } from "../services/payoutBank.service.mjs";

export const banksController = {
  async list(_req, res, next) {
    try {
      return res.status(200).json({ data: payoutBankService.getBanks() });
    } catch (error) {
      next(error);
    }
  },
};
