import supabase from "./supabase.mjs";

// field ที่ส่งออก API ได้ — ไม่ดึงรหัสผ่าน
const USER_PUBLIC_FIELDS =
  "id, name, email, phone, id_number, date_of_birth, avatar_url, is_admin, is_verified, created_at, updated_at";

export const usersRepository = {
  async findAll() {
    const { data, error } = await supabase
      .from("users")
      .select(USER_PUBLIC_FIELDS);

    if (error) throw error;
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from("users")
      .select(USER_PUBLIC_FIELDS)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByEmail(email) {
    const { data, error } = await supabase
      .from("users")
      .select(USER_PUBLIC_FIELDS)
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // id ต้องเป็นค่าเดียวกับ auth.users.id
  async create({ id, email, phone, name }) {
    const { data, error } = await supabase
      .from("users")
      .insert({
        id,
        email,
        phone,
        name: name ?? null,
      })
      .select(USER_PUBLIC_FIELDS)
      .single();

    if (error) throw error;
    return data;
  },
};
