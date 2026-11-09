import { createHmac } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
import { ACCESS_ORIGINS, type AccessOrigin } from "./access-levels.ts";
import { isValidNickname } from "./nickname.ts";
import { createDeviceToken, promotionDeviceSecret } from "./portia-device-binding.ts";

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

// RLS21-08: the access path groups IP addresses on its own. The Promotion helper (coarseIp in portia-device-binding.ts)
// cuts the TEXT form of an IPv6 address after four groups, so `::` compression gave `2001:db8::5` and `2001:db8::6`
// different buckets and a free /48 bought 65536 of them. Here the address is canonicalised first (every group expanded,
// lower case, brackets and zone id removed, IPv4-mapped read as IPv4) and IPv6 is grouped by /48, IPv4 by /24.
// Promotion buckets must stay byte-identical, so the shared helper is not changed.
function accessClientAddress(headers: Headers) {
  const raw = headers.get("x-nf-client-connection-ip")
    ?? headers.get("x-forwarded-for")?.split(",", 1)[0]
    ?? headers.get("x-real-ip")
    ?? "";
  return raw.trim().toLocaleLowerCase("en-US").slice(0, 128);
}

// Eight 16-bit groups of a valid IPv6 address, or null. net.isIPv6 validates; the expansion below is the only parsing.
function ipv6Groups(address: string) {
  const text = address.split("%", 1)[0];
  if (!isIPv6(text)) return null;
  let head = text;
  const dotted = text.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) {
    const octets = dotted[2].split(".").map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    head = `${dotted[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const halves = head.split("::");
  const side = (part: string | undefined) => (part ? part.split(":") : []);
  const left = side(halves[0]);
  const right = side(halves[1]);
  const groups = halves.length === 2 ? [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right] : left;
  if (groups.length !== 8) return null;
  const numbers = groups.map((group) => Number.parseInt(group, 16));
  return numbers.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffff) ? numbers : null;
}

export function accessIpGroup(headers: Headers) {
  let value = accessClientAddress(headers);
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  if (isIPv4(value)) return ipv4Group(value.split(".").map(Number));
  const groups = ipv6Groups(value);
  if (!groups) return "unknown";
  const mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (mapped) return ipv4Group([groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255]);
  return `${groups.slice(0, 3).map((group) => group.toString(16).padStart(4, "0")).join(":")}::/48`;
}

function ipv4Group(octets: number[]) {
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

export function accessIpBucket(headers: Headers, secret: string) {
  if (secret.length < 32) throw new Error("Access session secret must contain at least 32 characters.");
  return createHmac("sha256", secret).update(`access-ip:${accessIpGroup(headers)}`).digest("hex").slice(0, 32);
}
