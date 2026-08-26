import { pool } from "./db.mjs";

const PET_COLUMNS = `
  pets.id,
  pets.owner_id,
  pets.name,
  pets.pet_type_id,
  pet_types.name AS pet_type,
  pets.breed,
  pets.sex,
  pets.age_months,
  pets.color,
  pets.weight_kg,
  pets.about,
  pets.avatar_url,
  pets.created_at
`;

const PET_FROM = `
  FROM public.pets
  LEFT JOIN public.pet_types ON pet_types.id = pets.pet_type_id
`;

export const petsRepository = {
  async findByOwnerId(ownerId) {
    const { rows } = await pool.query(
      `SELECT ${PET_COLUMNS}
       ${PET_FROM}
       WHERE pets.owner_id = $1
       ORDER BY pets.created_at DESC`,
      [ownerId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT ${PET_COLUMNS}
       ${PET_FROM}
       WHERE pets.id = $1
       LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async findPetTypeById(id) {
    const { rows } = await pool.query(
      `SELECT id, name
       FROM public.pet_types
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async findPetTypeByName(name) {
    const { rows } = await pool.query(
      `SELECT id, name
       FROM public.pet_types
       WHERE LOWER(name) = LOWER($1)
       LIMIT 1`,
      [name]
    );
    return rows[0] ?? null;
  },

  async create(ownerId, pet) {
    const { rows } = await pool.query(
      `INSERT INTO public.pets (
         owner_id, name, pet_type_id, breed, sex, age_months, color, weight_kg, about, avatar_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        ownerId,
        pet.name,
        pet.pet_type_id,
        pet.breed,
        pet.sex,
        pet.age_months,
        pet.color,
        pet.weight_kg,
        pet.about,
        pet.avatar_url,
      ]
    );
    return this.findById(rows[0].id);
  },

  async updateById(id, ownerId, pet) {
    const { rows } = await pool.query(
      `UPDATE public.pets
       SET
         name = $3,
         pet_type_id = $4,
         breed = $5,
         sex = $6,
         age_months = $7,
         color = $8,
         weight_kg = $9,
         about = $10,
         avatar_url = $11
       WHERE id = $1 AND owner_id = $2
       RETURNING id`,
      [
        id,
        ownerId,
        pet.name,
        pet.pet_type_id,
        pet.breed,
        pet.sex,
        pet.age_months,
        pet.color,
        pet.weight_kg,
        pet.about,
        pet.avatar_url,
      ]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id);
  },

  async deleteById(id, ownerId) {
    const { rows } = await pool.query(
      `DELETE FROM public.pets
       WHERE id = $1 AND owner_id = $2
       RETURNING id`,
      [id, ownerId]
    );
    return rows[0] ?? null;
  },
};
