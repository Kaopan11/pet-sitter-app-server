import { payoutBankService } from "../services/payoutBank.service.mjs";

export function createBanksController({ payoutBank = payoutBankService } = {}) {
  return {
    async list(_req, res, next) {
      try {
        return res.status(200).json({ data: payoutBank.getBanks() });
      } catch (error) {
        next(error);
      }
    },
  };
}

export const banksController = createBanksController();
