import supabase from "../repositories/supabase.mjs";
import { usersRepository } from "../repositories/users.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";
import {
  AccessTokenError,
  verifyAccessToken,
} from "../utils/verifyAccessToken.mjs";

function isLegacyHs256(token) {
  try {
    const [headerPart] = String(token ?? "").split(".");
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    return header.alg === "HS256";
  } catch {
    return false;
  }
}

async function resolveAuthUser(token) {
  try {
    const payload = await verifyAccessToken(token);
    return {
      id: payload.sub,
      email: payload.email ?? null,
    };
  } catch (error) {
    const canFallback =
      error instanceof AccessTokenError &&
      (error.code === "JWKS_UNAVAILABLE" || isLegacyHs256(token));
    if (!canFallback) {
      return null;
    }
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

// ใช้กับ endpoint ที่ต้อง login แล้ว อ่าน Authorization: Bearer <token>
export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.slice(7);
    const authUser = await resolveAuthUser(token);
    if (!authUser?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const profile = await usersRepository.findById(authUser.id);
    if (!profile) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.authUser = authUser;
    req.user = profile;
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
