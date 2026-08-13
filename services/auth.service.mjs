import supabase from "../repositories/supabase.mjs";
import { usersRepository } from "../repositories/users.repository.mjs";
import { httpError } from "../utils/httpError.mjs";

const ROLE_MAP = {
  owner: "pet_owner",
  sitter: "pet_sitter",
  pet_owner: "pet_owner",
  pet_sitter: "pet_sitter",
};

function toAuthUser(profile) {
  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    name: profile.name ?? null,
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
  async register({ email, phone, password, role, name }) {
    const mappedRole = ROLE_MAP[role];
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = String(name).trim();

    const existing = await usersRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw httpError(409, "Email already exists");
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { role: mappedRole, phone, name: normalizedName },
    });

    if (authError) {
      if (isDuplicateEmailError(authError)) {
        throw httpError(409, "Email already exists");
      }
      throw httpError(400, authError.message);
    }

    try {
      const profile = await usersRepository.create({
        id: authData.user.id,
        email: normalizedEmail,
        phone,
        role: mappedRole,
        name: normalizedName,
      });

      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (sessionError) {
        throw httpError(400, sessionError.message);
      }

      return {
        token: sessionData.session.access_token,
        user: toAuthUser(profile),
      };
    } catch (error) {
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

    return {
      token: data.session.access_token,
      user: toAuthUser(profile),
    };
  },
};
