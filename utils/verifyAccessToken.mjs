import { createPublicKey } from "node:crypto";
import jwt from "jsonwebtoken";

const JWKS_TTL_MS = 60 * 60 * 1000;
const CLOCK_TOLERANCE_SEC = 5;

export class AccessTokenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AccessTokenError";
    this.code = code;
  }
}

function readJwtHeader(token) {
  const [headerPart] = String(token ?? "").split(".");
  if (!headerPart) {
    throw new AccessTokenError("TOKEN_INVALID", "Invalid access token");
  }

  try {
    return JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
  } catch {
    throw new AccessTokenError("TOKEN_INVALID", "Invalid access token");
  }
}

function toIssuer(supabaseUrl) {
  const base = String(supabaseUrl ?? "").trim().replace(/\/$/, "");
  return base ? `${base}/auth/v1` : "";
}

export function createAccessTokenVerifier({
  jwksUrl = process.env.SUPABASE_JWKS_URL,
  supabaseUrl = process.env.SUPABASE_URL,
  audience = "authenticated",
  fetchImpl = fetch,
} = {}) {
  let cachedKeys = [];
  let cachedAt = 0;
  let pendingLoad = null;

  async function loadKeys(force = false) {
    const url = String(jwksUrl ?? "").trim();
    if (!url) {
      throw new AccessTokenError("JWKS_UNAVAILABLE", "SUPABASE_JWKS_URL is not set");
    }

    const fresh = Date.now() - cachedAt < JWKS_TTL_MS;
    if (!force && cachedKeys.length > 0 && fresh) {
      return cachedKeys;
    }

    if (!force && pendingLoad) {
      return pendingLoad;
    }

    pendingLoad = (async () => {
      let response;
      try {
        response = await fetchImpl(url, { cache: "no-store" });
      } catch (error) {
        throw new AccessTokenError(
          "JWKS_UNAVAILABLE",
          error instanceof Error ? error.message : "Failed to fetch JWKS",
        );
      }

      if (!response.ok) {
        throw new AccessTokenError(
          "JWKS_UNAVAILABLE",
          `JWKS request failed (${response.status})`,
        );
      }

      const body = await response.json().catch(() => ({}));
      const keys = Array.isArray(body?.keys) ? body.keys : [];
      if (keys.length === 0) {
        throw new AccessTokenError("JWKS_UNAVAILABLE", "JWKS did not return any keys");
      }

      cachedKeys = keys;
      cachedAt = Date.now();
      return cachedKeys;
    })();

    try {
      return await pendingLoad;
    } finally {
      pendingLoad = null;
    }
  }

  function publicKeyFor(jwk) {
    try {
      return createPublicKey({ key: jwk, format: "jwk" });
    } catch {
      throw new AccessTokenError("TOKEN_INVALID", "Invalid access token");
    }
  }

  async function keyForKid(kid) {
    let keys = await loadKeys(false);
    let jwk = kid ? keys.find((item) => item.kid === kid) : keys[0];

    if (!jwk && kid) {
      keys = await loadKeys(true);
      jwk = keys.find((item) => item.kid === kid);
    }

    if (!jwk) {
      throw new AccessTokenError("TOKEN_INVALID", "Invalid access token");
    }

    return publicKeyFor(jwk);
  }

  async function verify(token) {
    const header = readJwtHeader(token);
    const alg = String(header.alg ?? "");
    if (alg !== "ES256" && alg !== "RS256") {
      throw new AccessTokenError("TOKEN_INVALID", "Invalid access token");
    }

    const key = await keyForKid(header.kid);
    const issuer = toIssuer(supabaseUrl);
    const options = {
      algorithms: [alg],
      clockTolerance: CLOCK_TOLERANCE_SEC,
    };
    if (issuer) options.issuer = issuer;
    if (audience) options.audience = audience;

    try {
      const payload = jwt.verify(token, key, options);
      const userId = payload?.sub;
      if (!userId) {
        throw new AccessTokenError("TOKEN_INVALID", "Invalid access token");
      }
      return payload;
    } catch (error) {
      if (error instanceof AccessTokenError) throw error;
      if (error?.name === "TokenExpiredError") {
        throw new AccessTokenError("TOKEN_EXPIRED", "Access token expired");
      }
      throw new AccessTokenError("TOKEN_INVALID", "Invalid access token");
    }
  }

  function resetCache() {
    cachedKeys = [];
    cachedAt = 0;
    pendingLoad = null;
  }

  return { verify, resetCache };
}

const defaultVerifier = createAccessTokenVerifier();

export function verifyAccessToken(token) {
  return defaultVerifier.verify(token);
}

export function resetAccessTokenVerifierCache() {
  defaultVerifier.resetCache();
}
