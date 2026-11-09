import { createHmac } from "node:crypto";
import { coarseIpBucket, createDeviceToken, promotionDeviceSecret } from "./portia-device-binding.ts";

// Opaque device token for site access (Phase 21). The browser holds the random token in an HttpOnly cookie; only the
// server-side HMAC digest ("access:" label, apart from the promotion "device:" space) ever reaches the database.
// Not imported by any route in Phase 21: Phase 23 wires /api/visitor.

export const ACCESS_COOKIE = "portia_access";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createAccessToken(randomSource?: (size: number) => Uint8Array) {
  return createDeviceToken(randomSource);
}

// No new env var: the promotion device secret is reused, domain separation is by the HMAC label.
export function accessSessionSecret() {
  return promotionDeviceSecret();
}

export function accessTokenDigest(token: string, secret: string) {
  if (!tokenPattern.test(token)) throw new Error("Invalid access token.");
  if (secret.length < 32) throw new Error("Access session secret must contain at least 32 characters.");
  return createHmac("sha256", secret).update(`access:${token}`).digest("hex").slice(0, 64);
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
