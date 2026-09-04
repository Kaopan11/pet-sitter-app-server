import { httpError } from "../utils/httpError.mjs";

/**
 * Ticket #4 — OAuth session (มีโปรไฟล์แล้วเข้าได้ทันที)
 *
 * หลัง Google/Facebook สำเร็จ FE ได้ access_token จาก Supabase
 * เรียก GET /api/auth/me พร้อม Bearer:
 * - มีแถวใน public.users → คืน { token, user } แบบ login
 * - ยังไม่มีโปรไฟล์ → 404 "Profile incomplete" ให้ FE ไปหน้ากรอก name+phone (#5)
 */

/**
 * @param {string} accessToken
 * @param {{
 *   getUserByAccessToken: (token: string) => Promise<{ user: { id: string }|null, error: unknown }>,
 *   findProfileById: (id: string) => Promise<object|null>,
 *   hasSitterProfile: (userId: string) => Promise<boolean>,
 *   toAuthUser: (profile: object, isSitter: boolean) => object,
 * }} deps
 */
export async function runResolveOAuthSession(accessToken, deps) {
  const token =
    typeof accessToken === "string" ? accessToken.trim() : "";

  if (!token) {
    throw httpError(401, "Unauthorized");
  }

  const { user, error } = await deps.getUserByAccessToken(token);
  if (error || !user?.id) {
    throw httpError(401, "Unauthorized");
  }

  // Auth มีแล้ว แต่ยังไม่เคย complete โปรไฟล์แอป
  const profile = await deps.findProfileById(user.id);
  if (!profile) {
    throw httpError(404, "Profile incomplete");
  }
  if (profile.is_banned) {
    throw httpError(403, "This account has been banned");
  }

  const isSitter = await deps.hasSitterProfile(profile.id);

  return {
    // ส่ง token เดิมกลับ — FE เก็บใช้ต่อได้เหมือนหลัง login ด้วยอีเมล
    token,
    user: deps.toAuthUser(profile, isSitter),
  };
}
