import test from "node:test";
import assert from "node:assert/strict";
import { cacheIdentityOf, shouldClearDeviceCaches, viewerKey, viewerOf, viewerPersonOf } from "./access-viewer.ts";
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

test("SEC-04: the cache identity is the viewer key plus the nickname key of an approved request", () => {
  const approvedAbc = { state: "approved", nickname: "Abc", level: 3, origin: "sheet" } as const;
  const approved2 = { state: "approved", nickname: "Visitor_1", level: 2, origin: "outside" } as const;
  assert.equal(cacheIdentityOf({ mode: "closed", state: none, allowed: true, level: 5, editor: true }), "editor|");
  assert.equal(cacheIdentityOf({ mode: "closed", state: approvedAbc, allowed: true, level: 3, editor: false }), "level-3|abc");
  assert.equal(cacheIdentityOf({ mode: "open", state: approved2 }), "level-2|visitor_1");
  for (const state of [none, { state: "pending", nickname: "Visitor_1" }, { state: "rejected", nickname: "Visitor_1", retryAt: null }, { state: "revoked", nickname: "Visitor_1", retryAt: null }] as const) {
    assert.equal(cacheIdentityOf({ mode: "open", state }), "level-1|", state.state);
  }
  assert.equal(cacheIdentityOf({ mode: "closed", state: none, allowed: false, level: null, editor: false }), "|");
  // An editor session wins over any visitor request on the same device: the person is empty.
  assert.equal(cacheIdentityOf({ mode: "closed", state: approvedAbc, allowed: true, level: 5, editor: true }), "editor|");
  assert.equal(viewerPersonOf({ mode: "closed", state: approvedAbc, allowed: true, level: 3, editor: false }), "abc");
  assert.equal(viewerPersonOf({ mode: "closed", state: approvedAbc, allowed: false, level: null, editor: false }), "");
});
