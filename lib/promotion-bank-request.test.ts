import assert from "node:assert/strict";
import test from "node:test";
import { BANK_BODY_LIMIT, bankBodyTooLarge, parseManualIds, previewSecretOrNull, syncFailureStatus } from "./promotion-bank-request.ts";

test("bank body limit is 64 KiB of UTF-8 bytes, checked on the raw text", () => {
  assert.equal(BANK_BODY_LIMIT, 64 * 1024);
  assert.equal(bankBodyTooLarge(""), false);
  assert.equal(bankBodyTooLarge("x".repeat(65536)), false);
  assert.equal(bankBodyTooLarge("x".repeat(65537)), true);
  // Cyrillic is 2 bytes per character: 32768 characters fit exactly, one more does not.
  assert.equal(bankBodyTooLarge("ж".repeat(32768)), false);
  assert.equal(bankBodyTooLarge("ж".repeat(32769)), true);
});

test("manualIds: absent stays absent, up to 100 strings of up to 64 characters pass, everything else is invalid", () => {
  assert.equal(parseManualIds(undefined), undefined);
  const hundred = Array.from({ length: 100 }, (_, index) => `id-${index}`);
  assert.deepEqual(parseManualIds(hundred), hundred);
  assert.deepEqual(parseManualIds([]), []);
  assert.deepEqual(parseManualIds(["a".repeat(64)]), ["a".repeat(64)]);
  assert.equal(parseManualIds([...hundred, "extra"]), "invalid");
  assert.equal(parseManualIds(["a".repeat(65)]), "invalid");
  assert.equal(parseManualIds(["ok", 5]), "invalid");
  assert.equal(parseManualIds(["ok", null]), "invalid");
  assert.equal(parseManualIds("a"), "invalid");
  assert.equal(parseManualIds({ length: 1 }), "invalid");
  assert.equal(parseManualIds(null), "invalid");
});

test("L2: a rights refusal of the counts sync is 403, every other sync error stays 409", () => {
  assert.equal(syncFailureStatus({ message: "forbidden" }), 403);
  assert.equal(syncFailureStatus({ code: "42501" }), 403);
  assert.equal(syncFailureStatus({ code: "42501", message: "permission denied" }), 403);
  assert.equal(syncFailureStatus({ message: "stale-or-mismatched-bank" }), 409);
  assert.equal(syncFailureStatus({ code: "P0001", message: "invalid-quota" }), 409);
  assert.equal(syncFailureStatus({}), 409);
  assert.equal(syncFailureStatus(null), 409);
  assert.equal(syncFailureStatus(undefined), 409);
});

test("L3: a missing or short preview secret is null, a good one passes through", () => {
  assert.equal(previewSecretOrNull(() => { throw new Error("PORTIA_PROMOTION_DEVICE_SECRET must contain at least 32 characters."); }), null);
  assert.equal(previewSecretOrNull(() => ""), null);
  const secret = "s".repeat(32);
  assert.equal(previewSecretOrNull(() => secret), secret);
});
