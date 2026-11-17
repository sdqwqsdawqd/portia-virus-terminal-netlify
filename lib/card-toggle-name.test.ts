import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cardToggleName } from "./card-toggle-name.ts";

// UI-10 (26-13, WCAG 2.5.3 «Label in Name»): the accessible name of .nested-editor-toggle holds its visible text in the same order.
// The visible text of the button is «{label} {title}» (the chevron is aria-hidden); axe compares names case-insensitively, whitespace collapsed.
const norm = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
const visibleText = (label: string, title?: string) => (title ? `${label} ${title}` : label);
const holdsVisibleText = (name: string, label: string, title?: string) => norm(name).includes(norm(visibleText(label, title)));

// The rule of the editor before 26-13 (`title || label`), kept here as the reproduction of the axe finding label-content-name-mismatch.
const legacyName = (open: boolean, label: string, title?: string) => `${open ? "Свернуть" : "Развернуть"} раздел «${title || label}»`;

test("26-13 UI-10: the old rule loses the visible label «РАЗДЕЛ 01», the new name holds «РАЗДЕЛ 01 Вирусы»", () => {
  assert.equal(holdsVisibleText(legacyName(false, "РАЗДЕЛ 01", "Вирусы"), "РАЗДЕЛ 01", "Вирусы"), false, "the reproduction: the old name misses the visible label");
  assert.equal(holdsVisibleText(cardToggleName(false, "РАЗДЕЛ 01", "Вирусы"), "РАЗДЕЛ 01", "Вирусы"), true, "the name holds the visible text in the same order");
  assert.equal(holdsVisibleText(cardToggleName(true, "ПОДРАЗДЕЛ 03", "  Штамм  "), "ПОДРАЗДЕЛ 03", "  Штамм  "), true, "outer spaces of the title do not break the match");
});

test("26-13 UI-10: the exact names for an open and a closed card", () => {
  assert.equal(cardToggleName(false, "РАЗДЕЛ 01", "Вирусы"), "Развернуть раздел «РАЗДЕЛ 01 Вирусы»");
  assert.equal(cardToggleName(true, "РАЗДЕЛ 01", "Вирусы"), "Свернуть раздел «РАЗДЕЛ 01 Вирусы»");
});

test("26-13 UI-10: a card without a title (or with a blank one) is named «{label} Без названия», never empty", () => {
  assert.equal(cardToggleName(false, "РАЗДЕЛ 01"), "Развернуть раздел «РАЗДЕЛ 01 Без названия»");
  assert.equal(cardToggleName(false, "РАЗДЕЛ 01", ""), "Развернуть раздел «РАЗДЕЛ 01 Без названия»");
  assert.equal(cardToggleName(true, "РАЗДЕЛ 01", "   "), "Свернуть раздел «РАЗДЕЛ 01 Без названия»");
  for (const open of [true, false]) {
    for (const title of [undefined, "", " ", "Вирусы"]) {
      const name = cardToggleName(open, "РАЗДЕЛ 01", title);
      assert.ok(name.trim().length > 0, "the name is never empty");
      assert.match(name, open ? /^Свернуть раздел/ : /^Развернуть раздел/, "the start stays for editor-journeys.spec.ts (/^Развернуть раздел/)");
      assert.equal(holdsVisibleText(name, "РАЗДЕЛ 01", title), true, `the name holds the visible text (${JSON.stringify(title)})`);
    }
  }
});

test("26-13 UI-10: the name is a plain string; markup in a title stays text (React escapes the attribute)", () => {
  const name = cardToggleName(false, "РАЗДЕЛ 02", '<img src=x onerror="1">');
  assert.equal(typeof name, "string");
  assert.equal(name, 'Развернуть раздел «РАЗДЕЛ 02 <img src=x onerror="1">»');
});

// Source contract of CollapsibleCard in components/portia-editor.tsx (D-21: the edit is the approved hunk PORTIA-26-13 in lib/format-launch.test.ts).
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const editor = stripComments(readFileSync(new URL("../components/portia-editor.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n"));
const cardStart = editor.indexOf("function CollapsibleCard(");
const card = editor.slice(cardStart, editor.indexOf("\n}\n", cardStart));

test("26-13 UI-10: CollapsibleCard names its toggle with cardToggleName and keeps a space between the label and the title", () => {
  assert.ok(cardStart > 0, "CollapsibleCard is found");
  assert.match(editor, /import \{ cardToggleName \} from "@\/lib\/card-toggle-name";/, "the editor imports the name function");
  assert.ok(card.includes("aria-label={cardToggleName(open, label, title)}"), "the toggle's aria-label comes from cardToggleName");
  assert.ok(!card.includes("const name = title || label;"), "the old name rule is gone");
  assert.match(card, /<\/strong>\{" "\}\s*\{title \? <span className="nested-editor-title"/, "a whitespace node stands between <strong> and the title span");
  assert.match(card, /className="nested-editor-chevron" aria-hidden="true"/, "the chevron stays out of the name");
  assert.match(card, /aria-expanded=\{open\} aria-controls=\{bodyId\}/, "aria-expanded and aria-controls stay");
});
