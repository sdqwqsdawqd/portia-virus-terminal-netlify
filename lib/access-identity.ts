import { createHmac } from "node:crypto";
import { accessTokenDigest, createAccessToken, readAccessToken } from "./access-session.ts";
import type { AccessState } from "./access-store.ts";

/** The access cookie is an opaque bearer proof; nicknames never authorize Promotion. */
export function currentAccessHash(headers: Headers, secret: string): string | null {
  const token = readAccessToken(headers);
  return token ? accessTokenDigest(token, secret) : null;
}

/** A guest token cannot become an editor-owned request just because the nickname matches. */
export function editorRequestToken(existingToken: string | null, ownStatus: AccessState, create: () => string = createAccessToken): string {
  return existingToken && ownStatus.state !== "none" ? existingToken : create();
}

export type PromotionSubmitProof = {
  accessHash: string; kind: "ordinary" | "qualification"; titleId: string; targetId: string;
  tokenHash: string; riskBucket: string; bucketKey: string; ipBucket: string; issuedAt: number;
};

export function signPromotionSubmit(fields: PromotionSubmitProof, secret: string) {
  if (secret.length < 32) throw new Error("Promotion signing secret is too short.");
  const message = ["promo-submit-v1", fields.accessHash, fields.kind, fields.titleId, fields.targetId,
    fields.tokenHash, fields.riskBucket, fields.bucketKey, fields.ipBucket, String(fields.issuedAt)].join("|");
  return createHmac("sha256", secret).update(message).digest("hex");
}

export type PromotionTestAction = "start" | "current" | "heartbeat" | "answer" | "fail";

export function signPromotionTest(fields: {
  accessHash: string; attemptId: string; tokenHash: string; action: PromotionTestAction; issuedAt: number;
}, secret: string) {
  if (secret.length < 32) throw new Error("Promotion signing secret is too short.");
  const message = ["promo-test-v1", fields.accessHash, fields.attemptId, fields.tokenHash, fields.action, String(fields.issuedAt)].join("|");
  return createHmac("sha256", secret).update(message).digest("hex");
}
