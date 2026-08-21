import supabase from "../repositories/supabase.mjs";
import { usersRepository } from "../repositories/users.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import { normalizePhone } from "../utils/phone.mjs";

// รูป user ที่ส่งกลับ Frontend — ไม่มีรหัสผ่าน และไม่มี column role
// isSitter ต้องส่งเสมอ — FE ใช้ redirect ไป /sitter/profile หรือ /
function toAuthUser(profile, isSitter) {
  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    name: profile.name ?? null,
    avatarUrl: profile.avatar_url ?? null,
    isSitter: Boolean(isSitter),
  };
}

function isDuplicateEmailError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "").toLowerCase();
  const constraint = String(error?.constraint ?? "").toLowerCase();

  // 23505 จาก unique email — ไม่ปนกับ phone
  if (code === "23505" && constraint.includes("phone")) {
    return false;
  }

  return (
    code === "user_already_exists" ||
    code === "23505" ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("duplicate")
  );
}

function isDuplicatePhoneError(error) {
  const code = String(error?.code ?? "").toLowerCase();
  const constraint = String(error?.constraint ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    (code === "23505" && constraint.includes("phone")) ||
    message.includes("users_phone_unique")
  );
}

async function createSitterProfile(userId, displayName) {
  const existing = await sitterProfilesRepository.findByUserId(userId);
  if (existing) return existing;

  return sitterProfilesRepository.create({
    userId,
    displayName,
  });
}

export const authService = {
  async register({ name, email, phone, password, asSitter }) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = String(name).trim();
    const normalizedPhone = normalizePhone(phone);

    const existingEmail = await usersRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw httpError(409, "Email is already in use");
    }

    // เช็คเบอร์ซ้ำก่อนสร้าง auth user — FE แสดงข้อความใต้ช่อง Phone
    const existingPhone = await usersRepository.findByPhone(normalizedPhone);
    if (existingPhone) {
      throw httpError(409, "Phone number is already in use");
    }

    // 1) สร้างบัญชีใน Supabase Auth (เก็บรหัสที่นี่)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: normalizedName, phone: normalizedPhone, asSitter },
    });

    if (authError) {
      if (isDuplicateEmailError(authError)) {
        throw httpError(409, "Email is already in use");
      }
      throw httpError(400, authError.message);
    }

    try {
      // 2) สร้างโปรไฟล์ใน public.users — id ต้องตรงกับ auth.users.id
      const profile = await usersRepository.create({
        id: authData.user.id,
        email: normalizedEmail,
        phone: normalizedPhone,
        name: normalizedName,
      });

      // 3) ถ้าสมัครแบบ Sitter ใช้ name เป็น display_name
      if (asSitter) {
        await createSitterProfile(profile.id, normalizedName);
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
      if (isDuplicatePhoneError(error)) {
        throw httpError(409, "Phone number is already in use");
      }
      if (isDuplicateEmailError(error)) {
        throw httpError(409, "Email is already in use");
      }
      throw error;
    }
  },

  async login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1) หา email ใน public.users ก่อน — แยกข้อความให้ FE toast ได้
    // ห้ามส่งข้อความที่มีทั้งคำว่า email และ password ในบรรทัดเดียว
    const profile = await usersRepository.findByEmail(normalizedEmail);
    if (!profile) {
      throw httpError(401, "Email is incorrect");
    }

    // 2) email มีแล้ว → ลองรหัสผ่านกับ Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user || !data.session) {
      throw httpError(401, "Password is incorrect");
    }

    // มีแถวใน sitter_profiles = เป็น sitter → FE ใช้ redirect ไป /sitter/profile
    const sitterProfile = await sitterProfilesRepository.findByUserId(profile.id);

    return {
      token: data.session.access_token,
      user: toAuthUser(profile, Boolean(sitterProfile)),
    };
  },

  async becomeSitter(userId) {
    const profile = await usersRepository.findById(userId);
    if (!profile) {
      throw httpError(401, "Unauthorized");
    }

    await createSitterProfile(profile.id, profile.name || "Pet Sitter");

    return {
      user: toAuthUser(profile, true),
    };
  },
};
