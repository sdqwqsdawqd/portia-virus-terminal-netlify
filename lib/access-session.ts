import { createHmac } from "node:crypto";
import { ACCESS_ORIGINS, type AccessOrigin } from "./access-levels.ts";
import { isValidNickname } from "./nickname.ts";
import { coarseIpBucket, createDeviceToken, promotionDeviceSecret } from "./portia-device-binding.ts";

// Opaque device token for site access (Phase 21). The browser holds the random token in an HttpOnly cookie; only the
// server-side HMAC digest ("access:" label, apart from the promotion "device:" space) ever reaches the database.
// Not imported by any route in Phase 21: Phase 23 wires /api/visitor.

export const ACCESS_COOKIE = "portia_access";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createAccessToken(randomSource?: (size: number) => Uint8Array) {
  return createDeviceToken(randomSource);
}

// Token and IP digests reuse the promotion device secret, domain separation is by the HMAC label. The submit signature
// has its own secret (ACCESS_SUBMIT_SECRET_ENV): it is also stored in the database, so it must not be the device secret.
export function accessSessionSecret() {
  return promotionDeviceSecret();
}

export function accessTokenDigest(token: string, secret: string) {
  if (!tokenPattern.test(token)) throw new Error("Invalid access token.");
  if (secret.length < 32) throw new Error("Access session secret must contain at least 32 characters.");
  return createHmac("sha256", secret).update(`access:${token}`).digest("hex").slice(0, 64);
}

// Server-signed submit (RLS21-01, owner decision 1a of 2026-11-09). portia_access_submit_request is executable with the
// public key, so the database must know that the site server produced token_hash and ip_bucket. The server signs
// (origin, nickname, token_hash, ip_bucket, issuedAt) with a shared secret; the function recomputes the HMAC from the same
// secret held in the closed table portia_access_secrets. The secret never leaves the server and never reaches the RPC.
// lib/access-requests.test.ts pins the message layout and the time window to the SQL.
export const ACCESS_SUBMIT_SECRET_ENV = "PORTIA_ACCESS_SUBMIT_SECRET";
export const ACCESS_SUBMIT_MAX_AGE_SECONDS = 300;
export const ACCESS_SUBMIT_MAX_AHEAD_SECONDS = 60;

const submitSecretMinLength = 32;

export function accessSubmitSecret(env: Record<string, string | undefined> = process.env) {
  const secret = env[ACCESS_SUBMIT_SECRET_ENV] ?? "";
  if (secret.length < submitSecretMinLength) {
    throw new Error(`${ACCESS_SUBMIT_SECRET_ENV} must contain at least ${submitSecretMinLength} characters.`);
  }
  return secret;
}

export type AccessSubmitFields = {
  nickname: string;
  origin: AccessOrigin;
  tokenHash: string;
  ipBucket: string;
  issuedAt: number;
};

function checkedSubmitFields(fields: AccessSubmitFields) {
  if (!isValidNickname(fields.nickname)) throw new Error("Invalid nickname.");
  if (!(ACCESS_ORIGINS as readonly string[]).includes(fields.origin)) throw new Error("Invalid origin.");
  if (typeof fields.tokenHash !== "string" || !/^[0-9a-f]{64}$/.test(fields.tokenHash)) throw new Error("Invalid token hash.");
  if (typeof fields.ipBucket !== "string" || !/^[0-9a-f]{32}$/.test(fields.ipBucket)) throw new Error("Invalid IP bucket.");
  if (!Number.isSafeInteger(fields.issuedAt) || fields.issuedAt < 0) throw new Error("Invalid issuedAt time.");
  return fields;
}

// Pipe-separated, labelled and versioned. The nickname alphabet has no pipe and the hashes are hex, so the fields cannot
// be shifted into one another.
export function accessSubmitMessage(fields: AccessSubmitFields) {
  const { origin, nickname, tokenHash, ipBucket, issuedAt } = checkedSubmitFields(fields);
  return ["access-submit-v1", origin, nickname, tokenHash, ipBucket, String(issuedAt)].join("|");
}

export function signAccessSubmit(fields: AccessSubmitFields, secret: string) {
  if (secret.length < submitSecretMinLength) throw new Error(`Access submit secret must contain at least ${submitSecretMinLength} characters.`);
  return createHmac("sha256", secret).update(accessSubmitMessage(fields)).digest("hex");
}

export function buildAccessCookie(token: string) {
  return `${ACCESS_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}

export function readAccessToken(headers: Headers) {
  const match = headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${ACCESS_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    return tokenPattern.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function accessIpBucket(headers: Headers, secret: string) {
  return coarseIpBucket(headers, secret);
}
