import { usersRepository } from "../repositories/users.repository.mjs";

export const usersService = {
  async getAllUsers() {
    return usersRepository.findAll();
  },

  async getMe(userId) {
    const user = await usersRepository.findById(userId);
    if (!user) throw httpError(404, "User not found");
    return user;
  },
  
  async updateMe(userId, body) {
    // validate ตรงนี้หรือ middleware
    const updated = await usersRepository.updateById(userId, {
      name: body.name?.trim(),
      email: body.email?.trim(),
      phone: body.phone?.trim(),
      id_number: body.id_number?.trim() || null,
      date_of_birth: body.date_of_birth || null,
      avatar_url: body.avatar_url || null,
    });
    if (!updated) throw httpError(404, "User not found");
    return updated;
  },
  
};
