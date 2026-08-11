import supabase from "./supabase.mjs";

export const usersRepository = {
  async findAll() {
    const { data, error } = await supabase.from("users").select("*");
    if (error) throw error;
    return data;
  },
};
