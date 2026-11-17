import assert from "node:assert/strict";
import test from "node:test";
import { statusPollOutcome } from "./portia-promotion-poll.ts";

test("503 with visible status stays stale even on explicit refresh", () => {
  assert.equal(statusPollOutcome({ httpStatus: 503, hasStatus: true, explicit: true, restore: false }), "keep-stale");
});

test("transient background HTTP refusals keep the visible status", () => {
  for (const httpStatus of [400, 409, 429, 500, 502, 504]) {
    assert.equal(statusPollOutcome({ httpStatus, hasStatus: true, explicit: false, restore: false }), "keep-stale", String(httpStatus));
  }
});

test("explicit nickname checks reset after non-503 refusal", () => {
  for (const httpStatus of [400, 409, 429, 500, 502, 504]) {
    assert.equal(statusPollOutcome({ httpStatus, hasStatus: true, explicit: true, restore: false }), "reset", String(httpStatus));
  }
});

test("definitive missing or denied device responses reset visible status", () => {
  for (const httpStatus of [404, 423]) {
    assert.equal(statusPollOutcome({ httpStatus, hasStatus: true, explicit: false, restore: false }), "reset", String(httpStatus));
  }
});

test("restore without a displayed status ignores refusal", () => {
  for (const httpStatus of [400, 404, 423, 429, 500, 503]) {
    assert.equal(statusPollOutcome({ httpStatus, hasStatus: false, explicit: false, restore: true }), "ignore", String(httpStatus));
  }
});

test("background refusal without a displayed status resets the gate", () => {
  assert.equal(statusPollOutcome({ httpStatus: 500, hasStatus: false, explicit: false, restore: false }), "reset");
});
