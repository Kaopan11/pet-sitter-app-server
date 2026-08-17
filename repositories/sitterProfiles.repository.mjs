import supabase from "./supabase.mjs";

// เป็น sitter หรือไม่ ดูจากตารางนี้ ไม่มี column asSitter ใน users
export const sitterProfilesRepository = {
  async findByUserId(userId) {
    const { data, error } = await supabase
      .from("sitter_profiles")
      .select("user_id, display_name, approval_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create({ userId, displayName }) {
    const { data, error } = await supabase
      .from("sitter_profiles")
      .insert({
        user_id: userId,
        display_name: displayName,
        experience_years: 0,
        rating_avg: 0,
        review_count: 0,
        approval_status: "pending", // รอแอดมินอนุมัติ
      })
      .select("user_id, display_name, approval_status")
      .single();

    if (error) throw error;
    return data;
  },
};
