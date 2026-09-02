import { adminOwnersRepository } from "../repositories/adminOwners.repository.mjs";
import { petsRepository } from "../repositories/pets.repository.mjs";
import { reviewsRepository } from "../repositories/reviews.repository.mjs";
import { httpError } from "../utils/httpError.mjs";

function serializePet(pet) {
  return {
    id: String(pet.id),
    name: pet.name,
    pet_type: pet.pet_type,
    breed: pet.breed,
    sex: pet.sex,
    age_months: pet.age_months == null ? null : Number(pet.age_months),
    color: pet.color,
    weight_kg: pet.weight_kg == null ? null : Number(pet.weight_kg),
    about: pet.about,
    avatar_url: pet.avatar_url,
  };
}

function serializeReview(review) {
  return {
    id: String(review.id),
    sitter_name: review.sitter_name,
    sitter_avatar_url: review.sitter_avatar_url,
    rating: Number(review.rating ?? 0),
    comment: review.comment ?? "",
    created_at: review.created_at,
  };
}

export const adminOwnersService = {
  async list(search, limit, offset) {
    return adminOwnersRepository.findMany(search, limit, offset);
  },

  async getById(ownerId) {
    const owner = await adminOwnersRepository.findById(ownerId);
    if (!owner) {
      throw httpError(404, "Pet owner not found");
    }

    const [pets, reviews] = await Promise.all([
      petsRepository.findByOwnerId(ownerId),
      reviewsRepository.findByOwnerId(ownerId),
    ]);

    return {
      ...owner,
      pet_count: pets.length,
      pets: pets.map(serializePet),
      reviews: reviews.map(serializeReview),
    };
  },
};
