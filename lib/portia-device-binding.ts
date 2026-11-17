import { createHmac, randomBytes } from "node:crypto";

export const deviceBindingCookie = "portia_promo_device";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function requireSecret(secret: string) {
  if (secret.length < 32) throw new Error("PORTIA_PROMOTION_DEVICE_SECRET must contain at least 32 characters.");
  return secret;
}

function keyedDigest(value: string, secret: string, length = 64) {
  return createHmac("sha256", requireSecret(secret)).update(value).digest("hex").slice(0, length);
}

export function promotionDeviceSecret() {
  return requireSecret(process.env.PORTIA_PROMOTION_DEVICE_SECRET ?? "");
}

export function createDeviceToken(randomSource: (size: number) => Uint8Array = randomBytes) {
  return Buffer.from(randomSource(32)).toString("base64url");
}

export function deviceTokenDigest(token: string, secret: string) {
  if (!tokenPattern.test(token)) throw new Error("Invalid promotion device token.");
  return keyedDigest(`device:${token}`, secret);
}

export function buildDeviceCookie(token: string) {
  return `${deviceBindingCookie}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}

export function readDeviceToken(headers: Headers) {
  const match = headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${deviceBindingCookie}=([^;]+)`));
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    return tokenPattern.test(token) ? token : null;
  } catch {
    return null;
  }
}

function coarseIp(headers: Headers) {
  const raw = headers.get("x-nf-client-connection-ip")
    ?? headers.get("x-forwarded-for")?.split(",", 1)[0]
    ?? headers.get("x-real-ip")
    ?? "unknown";
  const value = raw.trim().toLocaleLowerCase("en-US").slice(0, 128);
  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (ipv4 && ipv4.slice(1).every((part) => Number(part) <= 255)) return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.0/24`;
  if (value.includes(":")) return `${value.split(":").slice(0, 4).join(":")}::/64`;
  return "unknown";
}

export function coarseIpBucket(headers: Headers, secret: string) {
  return keyedDigest(`ip:${coarseIp(headers)}`, secret, 32);
}

export function auxiliarySignalDigest(headers: Headers, secret: string) {
  const signal = [
    headers.get("user-agent")?.slice(0, 256) ?? "",
    headers.get("accept-language")?.slice(0, 128) ?? "",
    headers.get("sec-ch-ua-platform")?.slice(0, 64) ?? "",
  ].join("\n");
  return keyedDigest(`signal:${signal}`, secret, 32);
}

export function promotionAttemptBucket(nicknameKey: string, headers: Headers, secret: string) {
  const ipBucket = coarseIpBucket(headers, secret);
  const signal = auxiliarySignalDigest(headers, secret);
  return {
    bucketKey: keyedDigest(`attempt:${nicknameKey}:${ipBucket}:${signal}`, secret),
    ipBucket,
    riskBucket: keyedDigest(`risk:${ipBucket}:${signal}`, secret, 32),
  };
}

export type DeviceBindingDecision = "bind" | "allow" | "deny";

export function deviceBindingDecision(
  deviceNicknameKey: string | null,
  requestedNicknameKey: string,
  nicknameAlreadyBound: boolean,
): DeviceBindingDecision {
  if (deviceNicknameKey !== null) return deviceNicknameKey === requestedNicknameKey ? "allow" : "deny";
  return nicknameAlreadyBound ? "deny" : "bind";
}

export function penaltyMinutes(failures: number) {
  if (failures <= 0) return 0;
  if (failures === 1) return 5;
  if (failures === 2) return 15;
  return 60;
}
