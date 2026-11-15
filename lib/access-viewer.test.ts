import test from "node:test";
import assert from "node:assert/strict";
import { shouldClearDeviceCaches, viewerKey, viewerOf } from "./access-viewer.ts";
import type { GateDecision } from "./access-gate.ts";

const none = { state: "none" } as const;
const approved3 = { state: "approved", nickname: "a", level: 3, origin: "sheet" } as const;

test("viewerKey names the editor, a level, or nothing", () => {
  assert.equal(viewerKey(viewerOf({ mode: "closed", state: none, allowed: true, level: 5, editor: true })), "editor");
  assert.equal(viewerKey(viewerOf({ mode: "closed", state: approved3, allowed: true, level: 3, editor: false })), "level-3");
  assert.equal(viewerKey(viewerOf({ mode: "open", state: none })), "level-1");
  assert.equal(viewerKey(null), "");
  assert.equal(viewerKey(viewerOf({ mode: "closed", state: none, allowed: false, level: null, editor: false })), "");
});

test("D-21: the device copies are cleared only when the site is closed and this device is not allowed", () => {
  const closedDenied: GateDecision = { mode: "closed", state: none, allowed: false, level: null, editor: false };
  const closedAllowed: GateDecision = { mode: "closed", state: approved3, allowed: true, level: 3, editor: false };
  const open: GateDecision = { mode: "open", state: none };
  assert.equal(shouldClearDeviceCaches(closedDenied), true);
  assert.equal(shouldClearDeviceCaches(closedAllowed), false);
  assert.equal(shouldClearDeviceCaches(open), false);
  assert.equal(shouldClearDeviceCaches({ mode: "closed", state: { state: "revoked", nickname: "a", retryAt: null }, allowed: false, level: null, editor: false }), true);
});
