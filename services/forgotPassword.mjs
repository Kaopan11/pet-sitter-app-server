import { parseEmail } from "../utils/authValidation.mjs";
import { httpError } from "../utils/httpError.mjs";

/**
 * Ticket #2 — Forgot password
 *
 * ข้อความเดียวเสมอ (มี/ไม่มีบัญชี) เพื่อกัน email enumeration
 * ส่งอีเมลจริงเฉพาะเมื่อมีแถวใน public.users
 * ส่งไม่สำเร็จ → ยังตอบข้อความเดิม (log ภายใน) เพื่อไม่เปิดช่องสแกนอีเมล
 */
export const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for this email, a reset link has been sent.";

/**
 * @param {string} email
 * @param {{
 *   findByEmail: (email: string) => Promise<object|null>,
 *   sendResetEmail: (email: string, redirectTo: string) => Promise<{ error: { message?: string }|null }>,
 *   getResetRedirectUrl: () => string,
 *   logError?: (err: unknown) => void,
 * }} deps
 */
export async function runForgotPassword(email, deps) {
  const parsed = parseEmail(email);
  if (!parsed.ok) {
    throw httpError(400, parsed.message);
  }

  const normalizedEmail = parsed.value.trim().toLowerCase();

  // เช็ค config ก่อนค้น user — ถ้า FRONTEND_URL หาย จะ 500 เหมือนกันทุกอีเมล (ไม่ leak)
  const redirectTo = deps.getResetRedirectUrl();

  const profile = await deps.findByEmail(normalizedEmail);
  const logError = deps.logError ?? ((err) => console.error("[forgotPassword]", err));

  if (profile) {
    try {
      const { error } = await deps.sendResetEmail(normalizedEmail, redirectTo);
      if (error) {
        logError(error);
      }
    } catch (err) {
      logError(err);
    }
  }

  return { message: FORGOT_PASSWORD_MESSAGE };
}

/** สร้าง URL ที่ Supabase จะพา user ไปหลังคลิกลิงก์ในอีเมล */
export function buildResetRedirectUrl(frontendUrl = process.env.FRONTEND_URL) {
  if (!frontendUrl || !String(frontendUrl).trim()) {
    throw httpError(
      500,
      "FRONTEND_URL is not configured (needed for password reset links)"
    );
  }

  const base = String(frontendUrl).trim().replace(/\/$/, "");
  return `${base}/reset-password`;
}
