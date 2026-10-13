import test from "node:test";
import assert from "node:assert/strict";
import { shortcutOf, type KeyInfo } from "./editor-shortcuts.ts";

const none: KeyInfo = { code: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
const key = (patch: Partial<KeyInfo>): KeyInfo => ({ ...none, ...patch });

test("Ctrl+S and Cmd+S save", () => {
  assert.equal(shortcutOf(key({ code: "KeyS", ctrlKey: true })), "save");
  assert.equal(shortcutOf(key({ code: "KeyS", metaKey: true })), "save");
});

test("the physical S key saves on a Russian layout, where key is «ы»", () => {
  assert.equal(shortcutOf({ ...key({ code: "KeyS", ctrlKey: true }), key: "ы" } as KeyInfo), "save");
});

test("Ctrl+Z undoes and Ctrl+Shift+Z or Cmd+Shift+Z redoes", () => {
  assert.equal(shortcutOf(key({ code: "KeyZ", ctrlKey: true })), "undo");
  assert.equal(shortcutOf(key({ code: "KeyZ", ctrlKey: true, shiftKey: true })), "redo");
  assert.equal(shortcutOf(key({ code: "KeyZ", metaKey: true, shiftKey: true })), "redo");
});

test("Ctrl+Y redoes", () => {
  assert.equal(shortcutOf(key({ code: "KeyY", ctrlKey: true })), "redo");
});

test("Ctrl+Shift+S is not a save", () => {
  assert.equal(shortcutOf(key({ code: "KeyS", ctrlKey: true, shiftKey: true })), null);
});

test("AltGr (reported as Ctrl+Alt on Windows) never triggers a shortcut", () => {
  assert.equal(shortcutOf(key({ code: "KeyZ", ctrlKey: true, altKey: true })), null);
  assert.equal(shortcutOf(key({ code: "KeyS", ctrlKey: true, altKey: true })), null);
});

test("a letter without Ctrl or Meta is plain typing", () => {
  assert.equal(shortcutOf(key({ code: "KeyS" })), null);
  assert.equal(shortcutOf(key({ code: "KeyZ", shiftKey: true })), null);
});

test("other Ctrl combinations are left to the browser", () => {
  assert.equal(shortcutOf(key({ code: "KeyA", ctrlKey: true })), null);
  assert.equal(shortcutOf(key({ code: "KeyY", ctrlKey: true, shiftKey: true })), null);
});
