import { createHmac, timingSafeEqual } from "node:crypto";
import type { PromotionRequestKind } from "./portia-promotion.ts";

// Server-only: kept out of portia-promotion-reviewer.ts, which client editors import (node:crypto would pull a
// crypto polyfill with eval into the browser bundle and break the production CSP).
type PreviewPayload = { kind: PromotionRequestKind; bankId: string; version: string; ids: string[]; expiresAt: number };
const encode = (value: string) => Buffer.from(value).toString("base64url");
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");

export function createPreviewToken(payload: PreviewPayload, secret: string) {
  if (secret.length < 32) throw new Error("preview-secret-too-short");
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyPreviewToken(
  token: string,
  expected: { kind: PromotionRequestKind; bankId: string; version: string; now: number },
  secret: string,
) {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(sign(encoded, secret));
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PreviewPayload;
    if (value.kind !== expected.kind || value.bankId !== expected.bankId || value.version !== expected.version
      || !Array.isArray(value.ids) || !value.ids.every((id) => typeof id === "string") || value.expiresAt < expected.now) return null;
    return value.ids;
  } catch {
    return null;
  }
}
