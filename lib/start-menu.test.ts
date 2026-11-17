import test from "node:test";
import assert from "node:assert/strict";
import { componentFamily } from "./component-source.ts";
import { startMenuCloseReason } from "./start-menu.ts";

const source = componentFamily("portia-desktop").map((part) => part.text).join("\n");

test("UAT 2026-11-16 gap 1: a pointer press outside the menu and the PORTIA button closes the menu", () => {
  assert.equal(startMenuCloseReason({ kind: "pointerdown", inside: false }), "outside");
  assert.equal(startMenuCloseReason({ kind: "pointerdown", inside: true }), null);
});

test("UAT 2026-11-16 gap 1: focus moving outside the menu closes it, focus staying inside does not", () => {
  assert.equal(startMenuCloseReason({ kind: "focusin", inside: false }), "outside");
  assert.equal(startMenuCloseReason({ kind: "focusin", inside: true }), null);
});

test("UAT 2026-11-16 gap 1: the browser window losing focus closes the menu", () => {
  assert.equal(startMenuCloseReason({ kind: "blur" }), "outside");
});

test("UAT 2026-11-16 gap 1: Escape closes the menu, any other key does not", () => {
  assert.equal(startMenuCloseReason({ kind: "keydown", key: "Escape" }), "escape");
  for (const key of ["Enter", "Tab", " ", "ArrowDown", "a"]) assert.equal(startMenuCloseReason({ kind: "keydown", key }), null, key);
});

test("UAT 2026-11-16 gap 1: the desktop wires the rule to one effect that adds and removes every listener", () => {
  assert.ok(source.includes('import { startMenuCloseReason } from "@/lib/start-menu"') || /import \{[^}]*startMenuCloseReason[^}]*\} from "@\/lib\/start-menu"/.test(source));
  assert.ok(/<button[^>]*className="start-button"[^>]*ref={startButtonRef}|<button[^>]*ref={startButtonRef}[^>]*className="start-button"/.test(source), "ref on .start-button");
  assert.ok(/<div[^>]*ref={startPanelRef}[^>]*className="start-panel"|<div[^>]*className="start-panel"[^>]*ref={startPanelRef}/.test(source), "ref on .start-panel");
  const effectStart = source.indexOf("startMenuCloseReason(");
  assert.ok(effectStart > 0, "the rule is called");
  const end = source.indexOf("}, [startOpen]);", effectStart);
  assert.ok(end > effectStart, "one effect that depends on [startOpen]");
  const effect = source.slice(source.lastIndexOf("useEffect(", effectStart), end);
  for (const add of ['document.addEventListener("pointerdown"', 'document.addEventListener("focusin"', 'document.addEventListener("keydown"', 'window.addEventListener("blur"']) {
    assert.ok(effect.includes(add), add);
    assert.ok(effect.includes(add.replace("addEventListener", "removeEventListener")), `cleanup of ${add}`);
  }
  assert.ok(effect.includes("setStartOpen(false)"));
  assert.ok(effect.includes("preventDefault()"), "Escape is marked handled so the quest toast keeps its own Escape");
  assert.ok(effect.includes("startButtonRef.current?.focus()"), "Escape returns focus to the PORTIA button");
});

test("UAT 2026-11-16 gap 1: a menu opened from the keyboard moves focus to its first button", () => {
  assert.ok(source.includes("event.detail === 0"));
  assert.ok(source.includes('startPanelRef.current?.querySelector("button")'));
});
