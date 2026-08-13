import supabase from "./supabase.mjs";

const USER_PUBLIC_FIELDS =
  "id, name, email, phone, id_number, date_of_birth, profile_image, role, created_at, updated_at";

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

  async create({ id, email, phone, role, name }) {
    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          id,
          email,
          phone,
          role,
          name,
        },
        { onConflict: "id" }
      )
      .select(USER_PUBLIC_FIELDS)
      .single();

    if (error) throw error;
    return data;
  },
};
