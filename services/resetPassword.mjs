import { parsePassword } from "../utils/authValidation.mjs";
import { httpError } from "../utils/httpError.mjs";

/**
 * Ticket #3 — Reset password
 *
 * FE ได้ access_token จากลิงก์ recovery (hash/query หลังเปิดอีเมล)
 * แล้ว POST มาที่นี่พร้อมรหัสใหม่
 *
 * Flow:
 * 1) ตรวจ newPassword (≥ 6 ตัว — กฎเดียวกับ register)
 * 2) ตรวจ accessToken กับ Supabase (getUser)
 * 3) admin.updateUserById ตั้งรหัสใหม่
 */
export const RESET_PASSWORD_MESSAGE = "Password updated successfully";

/**
 * @param {{ accessToken: string, newPassword: string }} body
 * @param {{
 *   getUserByAccessToken: (token: string) => Promise<{ user: { id: string }|null, error: { message?: string }|null }>,
 *   updatePassword: (userId: string, password: string) => Promise<{ error: { message?: string }|null }>,
 * }} deps
 */
export async function runResetPassword(body, deps) {
  const accessToken =
    typeof body?.accessToken === "string" ? body.accessToken.trim() : "";

  if (!accessToken) {
    throw httpError(400, "accessToken is required");
  }

  const parsedPassword = parsePassword(body?.newPassword);
  if (!parsedPassword.ok) {
    throw httpError(400, parsedPassword.message);
  }

  // Token จากลิงก์รีเซ็ต — หมดอายุ / ใช้แล้ว / ปลอม → 401
  const { user, error: userError } = await deps.getUserByAccessToken(
    accessToken
  );

  if (userError || !user?.id) {
    throw httpError(401, "Invalid or expired reset token");
  }

  const { error: updateError } = await deps.updatePassword(
    user.id,
    parsedPassword.value
  );

  if (updateError) {
    throw httpError(400, updateError.message || "Failed to update password");
  }

  return { message: RESET_PASSWORD_MESSAGE };
}
