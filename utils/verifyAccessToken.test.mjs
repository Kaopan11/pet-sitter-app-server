import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";
import {
  AccessTokenError,
  createAccessTokenVerifier,
} from "./verifyAccessToken.mjs";

const ISSUER = "https://example.supabase.co/auth/v1";

function makeKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const jwk = publicKey.export({ format: "jwk" });
  jwk.kid = "test-key";
  jwk.alg = "ES256";
  jwk.use = "sig";
  return { privateKey, jwk };
}

function signToken(privateKey, claims = {}, signOptions = {}) {
  const { expiresIn = "1h", ...rest } = signOptions;
  const options = {
    algorithm: "ES256",
    keyid: "test-key",
    issuer: ISSUER,
    ...rest,
  };
  if (claims.exp == null) {
    options.expiresIn = expiresIn;
  }

  return jwt.sign(
    {
      sub: "user-1",
      email: "owner@example.com",
      aud: "authenticated",
      ...claims,
    },
    privateKey,
    options,
  );
}

function verifierWithKeys(keys, fetchImpl) {
  return createAccessTokenVerifier({
    jwksUrl: "https://example.supabase.co/auth/v1/.well-known/jwks.json",
    supabaseUrl: "https://example.supabase.co",
    fetchImpl:
      fetchImpl ??
      (async () => ({
        ok: true,
        json: async () => ({ keys }),
      })),
  });
}

describe("verifyAccessToken", () => {
  it("accepts a valid ES256 access token", async () => {
    const { privateKey, jwk } = makeKeys();
    const verifier = verifierWithKeys([jwk]);
    const token = signToken(privateKey);

    const payload = await verifier.verify(token);
    assert.equal(payload.sub, "user-1");
    assert.equal(payload.email, "owner@example.com");
  });

  it("rejects an expired token without calling a fallback", async () => {
    const { privateKey, jwk } = makeKeys();
    const verifier = verifierWithKeys([jwk]);
    const token = signToken(privateKey, {
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await assert.rejects(
      () => verifier.verify(token),
      (error) => error instanceof AccessTokenError && error.code === "TOKEN_EXPIRED",
    );
  });

  it("rejects a token signed with another key", async () => {
    const { jwk } = makeKeys();
    const other = makeKeys();
    const verifier = verifierWithKeys([jwk]);
    const token = signToken(other.privateKey);

    await assert.rejects(
      () => verifier.verify(token),
      (error) => error instanceof AccessTokenError && error.code === "TOKEN_INVALID",
    );
  });

  it("marks JWKS fetch failures as unavailable", async () => {
    const { privateKey } = makeKeys();
    const verifier = createAccessTokenVerifier({
      jwksUrl: "https://example.supabase.co/auth/v1/.well-known/jwks.json",
      supabaseUrl: "https://example.supabase.co",
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    const token = signToken(privateKey);

    await assert.rejects(
      () => verifier.verify(token),
      (error) =>
        error instanceof AccessTokenError && error.code === "JWKS_UNAVAILABLE",
    );
  });
});
