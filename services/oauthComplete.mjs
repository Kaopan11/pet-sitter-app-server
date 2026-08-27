import { parseName, parsePhone } from "../utils/authValidation.mjs";
import { httpError } from "../utils/httpError.mjs";

/**
 * Ticket #5 — OAuth complete profile
 *
 * หลัง Social ครั้งแรก (#4 ได้ 404 Profile incomplete)
 * FE ส่ง name + phone + Bearer → สร้าง public.users
 * - เริ่มเป็น Owner เสมอ (ไม่สร้าง sitter_profiles)
 * - มีโปรไฟล์อยู่แล้ว → คืนของเดิม ไม่สร้างซ้ำ (idempotent)
 */

/**
 * @param {{ accessToken: string, name: string, phone: string }} body
 * @param {{
 *   getUserByAccessToken: (token: string) => Promise<{ user: { id: string, email?: string }|null, error: unknown }>,
 *   findProfileById: (id: string) => Promise<object|null>,
 *   findProfileByPhone: (phone: string) => Promise<object|null>,
 *   createProfile: (row: { id: string, email: string, phone: string, name: string }) => Promise<object>,
 *   hasSitterProfile: (userId: string) => Promise<boolean>,
 *   toAuthUser: (profile: object, isSitter: boolean) => object,
 * }} deps
 */
export async function runCompleteOAuthProfile(body, deps) {
  const token =
    typeof body?.accessToken === "string" ? body.accessToken.trim() : "";

  if (!token) {
    throw httpError(401, "Unauthorized");
  }

  const { user, error } = await deps.getUserByAccessToken(token);
  if (error || !user?.id) {
    throw httpError(401, "Unauthorized");
  }

  // มีโปรไฟล์แล้ว → ไม่บังคับกรอกซ้ำ / ไม่ overwrite name-phone
  const existing = await deps.findProfileById(user.id);
  if (existing) {
    const isSitter = await deps.hasSitterProfile(existing.id);
    return {
      token,
      user: deps.toAuthUser(existing, isSitter),
    };
  }

  const parsedName = parseName(body?.name);
  if (!parsedName.ok) {
    throw httpError(400, parsedName.message);
  }

  const parsedPhone = parsePhone(body?.phone);
  if (!parsedPhone.ok) {
    throw httpError(400, parsedPhone.message);
  }

  const email = String(user.email ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    throw httpError(400, "Email is required from the OAuth provider");
  }

  // เบอร์ซ้ำกับบัญชีอื่น
  const phoneOwner = await deps.findProfileByPhone(parsedPhone.value);
  if (phoneOwner && phoneOwner.id !== user.id) {
    throw httpError(409, "Phone number is already in use");
  }

  const profile = await deps.createProfile({
    id: user.id,
    email,
    phone: parsedPhone.value,
    name: parsedName.value,
  });

  // ตาม grill: Social complete = Owner เสมอ · sitter ทีหลังผ่าน become-sitter
  return {
    token,
    user: deps.toAuthUser(profile, false),
  };
}
