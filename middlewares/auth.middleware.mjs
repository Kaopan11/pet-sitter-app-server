import supabase from "../repositories/supabase.mjs";
import { usersRepository } from "../repositories/users.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";

// ใช้กับ endpoint ที่ต้อง login แล้ว อ่าน Authorization: Bearer <token>
export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.slice(7);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const profile = await usersRepository.findById(data.user.id);
    if (!profile) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.authUser = data.user; // ข้อมูลจาก Supabase Auth
    req.user = profile; // โปรไฟล์จาก public.users
    next();
  } catch (error) {
    next(error);
  }
};

// ใช้ต่อจาก requireAuth — ต้องมีแถวใน sitter_profiles
export const requireSitter = async (req, res, next) => {
  try {
    const sitter = await sitterProfilesRepository.findByUserId(req.user.id);
    if (!sitter) {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.sitter = sitter;
    next();
  } catch (error) {
    next(error);
  }
};
