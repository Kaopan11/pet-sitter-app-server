import { usersRepository } from "../repositories/users.repository.mjs";

export const usersService = {
  async getAllUsers() {
    return usersRepository.findAll();
  },
};
