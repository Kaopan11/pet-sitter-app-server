import { adminSittersRepository } from "../repositories/adminSitters.repository.mjs";

export const adminSittersService = {
  async list(search, status, limit, offset) {
    return adminSittersRepository.findMany(search, status, limit, offset);
  },
};
