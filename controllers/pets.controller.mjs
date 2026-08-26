import { petsService } from "../services/pets.service.mjs";

export const petsController = {
  async getMyPets(req, res, next) {
    try {
      const pets = await petsService.getMyPets(req.user.id);
      res.status(200).json({ data: pets });
    } catch (error) {
      next(error);
    }
  },
  async getPetById(req, res, next) {
    try {
      const pets = await petsService.getPetById(req.user.id, req.params.id);
      res.status(200).json({ data: pets });
    } catch (error) {
      next(error);
    }
  },
  async createPet(req, res, next) {
    try {
      const pets = await petsService.createPet(req.user.id, req.body, req.file);
      res.status(201).json({ data: pets });
    } catch (error) {
      next(error);
    }
  },
  async updatePet(req, res, next) {
    try {
      const pets = await petsService.updatePet(
        req.user.id,
        req.params.id,
        req.body,
        req.file
      );
      res.status(200).json({ data: pets });
    } catch (error) {
      next(error);
    }
  },
  async deletePet(req, res, next) {
    try {
      const pets = await petsService.deletePet(req.user.id, req.params.id);
      res.status(200).json({ data: pets });
    } catch (error) {
      next(error);
    }
  },
};
