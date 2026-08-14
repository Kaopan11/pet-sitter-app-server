import supabase from "../repositories/supabase.mjs";
import { usersRepository } from "../repositories/users.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";
import { httpError } from "../utils/httpError.mjs";

// รูป user ที่ส่งกลับ Frontend — ไม่มีรหัสผ่าน และไม่มี column role
function toAuthUser(profile, isSitter) {
  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    name: profile.name ?? null,
    isSitter,
  };
}

function isDuplicateEmailError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "").toLowerCase();

  return (
    code === "user_already_exists" ||
    code === "23505" ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("duplicate")
  );
}

export const authService = {
  async register({ name, email, phone, password, asSitter }) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = String(name).trim();

    const existing = await usersRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw httpError(409, "Email already exists");
    }

    // 1) สร้างบัญชีใน Supabase Auth (เก็บรหัสที่นี่)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: normalizedName, phone, asSitter },
    });

    if (authError) {
      if (isDuplicateEmailError(authError)) {
        throw httpError(409, "Email already exists");
      }
      throw httpError(400, authError.message);
    }

    try {
      // 2) สร้างโปรไฟล์ใน public.users — id ต้องตรงกับ auth.users.id
      const profile = await usersRepository.create({
        id: authData.user.id,
        email: normalizedEmail,
        phone,
        name: normalizedName,
      });

      // 3) ถ้าสมัครแบบ Sitter ใช้ name เป็น display_name
      if (asSitter) {
        await sitterProfilesRepository.create({
          userId: profile.id,
          displayName: normalizedName,
        });
      }

      // 4) ล็อกอินทันทีเพื่อได้ token ส่งกลับ Frontend
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (sessionError) {
        throw httpError(400, sessionError.message);
      }

      return {
        token: sessionData.session.access_token,
        user: toAuthUser(profile, Boolean(asSitter)),
      };
    } catch (error) {
      // insert users/sitter พัง → ลบ auth user ทิ้ง ไม่ให้ค้างกำพร้า
      await supabase.auth.admin.deleteUser(authData.user.id);
      if (error.statusCode) throw error;
      if (isDuplicateEmailError(error)) {
        throw httpError(409, "Email already exists");
      }
      throw error;
    }
  },

  async login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user || !data.session) {
      throw httpError(401, "Invalid email or password");
    }

    const profile = await usersRepository.findById(data.user.id);

    if (!profile) {
      throw httpError(401, "Invalid email or password");
    }

    // มีแถวใน sitter_profiles = เป็น sitter
    const sitterProfile = await sitterProfilesRepository.findByUserId(profile.id);

    return {
      token: data.session.access_token,
      user: toAuthUser(profile, Boolean(sitterProfile)),
    };
  },
};
