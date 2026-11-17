import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { accessTokenDigest } from "./access-session.ts";
import { currentAccessHash, editorRequestToken, signPromotionSubmit, signPromotionTest } from "./access-identity.ts";
import { resolveEditorRequest, type AccessRpcClient } from "./access-store.ts";

const secret = "s".repeat(40);
const token = "a".repeat(43);
const migration = readFileSync(new URL("../supabase/migrations/20261113000000_portia_access_promotion.sql", import.meta.url), "utf8");

test("Promotion access proof uses only this device's opaque cookie", () => {
  assert.equal(currentAccessHash(new Headers({ cookie: `portia_access=${token}` }), secret), accessTokenDigest(token, secret));
  assert.equal(currentAccessHash(new Headers(), secret), null);
  assert.equal(currentAccessHash(new Headers({ cookie: "portia_access=forged" }), secret), null);
});

test("an editor cannot adopt a guest request token by typing the same nickname", () => {
  assert.equal(editorRequestToken(token, { state: "none" }, () => "new-token"), "new-token");
  assert.equal(editorRequestToken(token, { state: "pending", nickname: "SameNick" }, () => "new-token"), token);
});

test("editor request RPC reply validates origin on approval", async () => {
  const client: AccessRpcClient = { rpc(fn, args) {
    assert.equal(fn, "portia_access_editor_request_status");
    assert.equal(args?.p_token_hash, "0".repeat(64));
    return Promise.resolve({ data: { state: "approved", nickname: "Editor_1", level: 2, origin: "sheet" }, error: null });
  } };
  assert.deepEqual(await resolveEditorRequest(client, "0".repeat(64)), { state: "approved", nickname: "Editor_1", level: 2, origin: "sheet" });
});

test("SQL participant proof requires an approved sheet request and active person", () => {
  const start = migration.indexOf("create or replace function public.portia_promo_participant_key");
  const end = migration.indexOf("end; $$;", start);
  const body = migration.slice(start, end);
  assert.match(body, /r\.status = 'approved' and r\.origin = 'sheet' and p\.status = 'active'/);
  assert.match(body, /r\.requested_by = auth\.uid\(\)/);
  assert.match(body, /public\.portia_can_edit\(\)/);
  assert.match(body, /for share of r, p/);
  assert.doesNotMatch(body, /account_id/);
});

test("Promotion signatures bind every submit field and the test operation", () => {
  const fields = { accessHash: "a".repeat(64), kind: "ordinary" as const, titleId: "academic", targetId: "senior",
    tokenHash: "b".repeat(64), riskBucket: "c".repeat(32), bucketKey: "d".repeat(64), ipBucket: "e".repeat(32), issuedAt: 12345 };
  const message = ["promo-submit-v1", fields.accessHash, fields.kind, fields.titleId, fields.targetId, fields.tokenHash,
    fields.riskBucket, fields.bucketKey, fields.ipBucket, String(fields.issuedAt)].join("|");
  assert.equal(signPromotionSubmit(fields, secret), createHmac("sha256", secret).update(message).digest("hex"));
  assert.notEqual(signPromotionSubmit({ ...fields, targetId: "other" }, secret), signPromotionSubmit(fields, secret));
  const testFields = { accessHash: fields.accessHash, attemptId: "00000000-0000-4000-8000-000000000000", tokenHash: fields.tokenHash, action: "current" as const, issuedAt: 12345 };
  assert.notEqual(signPromotionTest(testFields, secret), signPromotionTest({ ...testFields, action: "answer" }, secret));
});
