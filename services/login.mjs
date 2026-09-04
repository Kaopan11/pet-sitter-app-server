import { httpError } from "../utils/httpError.mjs";

export function toAuthUser(profile, isSitter) {
  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    name: profile.name ?? null,
    avatarUrl: profile.avatar_url ?? null,
    isSitter: Boolean(isSitter),
    isAdmin: Boolean(profile.is_admin),
  };
}

/**
 * @param {{ email: string, password: string }} credentials
 * @param {{
 *   findByEmail: (email: string) => Promise<object|null>,
 *   signInWithPassword: (email: string, password: string) => Promise<{ data: object|null, error: object|null }>,
 *   findSitterProfileByUserId: (userId: string) => Promise<object|null>,
 *   toAuthUser?: typeof toAuthUser,
 * }} deps
 */
export async function runLogin({ email, password }, deps) {
  const normalizedEmail = email.trim().toLowerCase();
  const mapUser = deps.toAuthUser ?? toAuthUser;

  const profile = await deps.findByEmail(normalizedEmail);
  if (!profile) {
    throw httpError(401, "Email is incorrect");
  }
  if (profile.is_banned) {
    throw httpError(403, "This account has been banned");
  }

  const { data, error } = await deps.signInWithPassword(
    normalizedEmail,
    password
  );

  if (error || !data?.user || !data?.session) {
    throw httpError(401, "Password is incorrect");
  }

  const sitterProfile = await deps.findSitterProfileByUserId(profile.id);

  return {
    token: data.session.access_token,
    user: mapUser(profile, Boolean(sitterProfile)),
  };
}
