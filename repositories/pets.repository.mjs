import { pool } from "./db.mjs";

export const petsRepository = {
  // ดึงสัตว์ทั้งหมดของ owner คนนั้น พร้อมชื่อประเภทสัตว์
  async findByOwnerId(ownerId) {
    const { rows } = await pool.query(
      `SELECT
         pets.id,
         pets.name,
         pets.breed,
         pets.sex,
         pets.age_months,
         pets.color,
         pets.weight_kg,
         pets.about,
         pets.avatar_url,
         pets.created_at,
         pet_types.name AS pet_type
       FROM public.pets
       INNER JOIN public.pet_types ON pet_types.id = pets.pet_type_id
       WHERE pets.owner_id = $1
       ORDER BY pets.created_at ASC`,
      [ownerId]
    );
    return rows;
  },

  // ดึงสัตว์หลาย id พร้อมตรวจว่าเป็นของ owner คนนี้จริง
  async findManyByIds(petIds, ownerId) {
    const { rows } = await pool.query(
      `SELECT
         pets.id,
         pets.name,
         pet_types.name AS pet_type
       FROM public.pets
       INNER JOIN public.pet_types ON pet_types.id = pets.pet_type_id
       WHERE pets.id = ANY($1::bigint[])
         AND pets.owner_id = $2`,
      [petIds, ownerId]
    );
    return rows;
  },
};
