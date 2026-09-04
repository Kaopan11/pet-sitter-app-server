import { petsRepository } from "../repositories/pets.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import supabase from "../repositories/supabase.mjs";

const PHOTOS_BUCKET = "photos";
const PET_TYPES = new Set(["Dog", "Cat", "Bird", "Rabbit"]);
const PET_SEXES = new Set(["Male", "Female"]);

async function uploadImageFile(file, folder, userId) {
  const safeName = String(file.originalname ?? "image").replace(/[^\w.\-]+/g, "_");
  const filePath = `${folder}/${userId}-${Date.now()}-${safeName}`;
  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
  if (error) {
    throw httpError(400, error.message || "Failed to upload pet image");
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(data.path);
  return publicUrl;
}

function requiredText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw httpError(400, `${label} is required`);
  return text;
}

function optionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseNumber(value, label, { min = 0, allowZero = true, integer = false } = {}) {
  const text = String(value ?? "").trim();
  if (!text) throw httpError(400, `${label} is required`);
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || (!allowZero && number <= 0)) {
    throw httpError(400, `${label} must be a number`);
  }
  if (integer && !Number.isInteger(number)) {
    throw httpError(400, `${label} must be a whole number`);
  }
  return number;
}

function optionalNumber(value, label, options) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  return parseNumber(value, label, options);
}

function parsePetId(petId) {
  const id = Number(petId);
  if (!Number.isInteger(id) || id <= 0) {
    throw httpError(400, "Invalid pet id");
  }
  return id;
}

async function resolvePetTypeId(body) {
  if (body.pet_type_id != null && String(body.pet_type_id).trim() !== "") {
    const petTypeId = parseNumber(body.pet_type_id, "Pet type", {
      min: 1,
      allowZero: false,
      integer: true,
    });
    const petType = await petsRepository.findPetTypeById(petTypeId);
    if (!petType) throw httpError(400, "Pet type not found");
    return petType.id;
  }

  const petTypeName = requiredText(body.pet_type ?? body.petType ?? body.type, "Pet type");
  if (!PET_TYPES.has(petTypeName)) {
    throw httpError(400, "Pet type must be Dog, Cat, Bird, or Rabbit");
  }

  const petType = await petsRepository.findPetTypeByName(petTypeName);
  if (!petType) throw httpError(400, "Pet type not found");
  return petType.id;
}

async function normalizePetBody(body = {}) {
  const sex = optionalText(body.sex);
  if (sex && !PET_SEXES.has(sex)) {
    throw httpError(400, "Sex must be Male or Female");
  }

  return {
    name: requiredText(body.name, "Pet name"),
    pet_type_id: await resolvePetTypeId(body),
    breed: optionalText(body.breed),
    sex,
    age_months: optionalNumber(body.age_months ?? body.age, "Age", {
      min: 0,
      integer: true,
    }),
    color: optionalText(body.color),
    weight_kg: optionalNumber(body.weight_kg ?? body.weight, "Weight", {
      min: 0,
      allowZero: false,
    }),
    about: optionalText(body.about),
    avatar_url: optionalText(body.avatar_url ?? body.image_url ?? body.image),
  };
}

export const petsService = {
  async getMyPets(userId) {
    return petsRepository.findByOwnerId(userId);
  },

  async getPetById(userId, petId) {
    const pet = await petsRepository.findById(parsePetId(petId));
    if (!pet || String(pet.owner_id) !== String(userId)) {
      throw httpError(404, "Pet not found");
    }
    return pet;
  },

  async createPet(userId, body, imageFile) {
    const pet = await normalizePetBody(body); // สร้าง pet object จาก body

    if (imageFile) {
      pet.avatar_url = await uploadImageFile(imageFile, "pets", userId);
    }

    return petsRepository.create(userId, pet);
  },

  async updatePet(userId, petId, body, imageFile) {
    const current = await this.getPetById(userId, petId);
    const pet = await normalizePetBody(body);

    if (imageFile) {
      pet.avatar_url = await uploadImageFile(imageFile, "pets", userId);
    } else if (!pet.avatar_url) {
      pet.avatar_url = current.avatar_url ?? null;
    }

    const updated = await petsRepository.updateById(current.id, userId, pet);
    if (!updated) throw httpError(404, "Pet not found");
    return updated;
  },

  async deletePet(userId, petId) {
    const current = await this.getPetById(userId, petId);
   //fetch pet by id
    const used = await petsRepository.isUsedInBooking(current.id); //checked if pet is booked
    if (used) {
      throw httpError( //if pet is booked, cannot delete
        400,
        "This pet cannot be deleted because it is used in a booking"
      );
    }
    //delete pet
    const deleted = await petsRepository.deleteById(current.id, userId);
    if (!deleted) throw httpError(404, "Pet not found");
    return deleted;
  },
};
