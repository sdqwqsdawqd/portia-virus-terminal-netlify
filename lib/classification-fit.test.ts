import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lf } from "./component-source.ts";
import { classificationOptions } from "./portia-content.ts";

// Phase 26, UAT 2026-11-16 gap 11 (UI-07): a classification name in the archive card ("Базы вирусов") is always read in full.
// IBM Plex Mono is monospaced: one glyph is 0.6em wide in Latin and Cyrillic, bold does not change it. So "does the longest word fit
// its cell" is a sum, not a screenshot: the cell's width at each layout of the grid against the word at the font size the CSS gives it.
const ADVANCE = 0.6;
const MIN_FONT = 12;
const PADDING_PC = 24;
const PADDING_PHONE = 20;
const BORDER = 1;
const BADGE_AND_GAP = 24;

const css = lf(readFileSync(new URL("../app/portia.css", import.meta.url), "utf8"));
const cardSource = lf(readFileSync(new URL("../components/portia-virus-card.tsx", import.meta.url), "utf8"));

type Rule = { selectors: string[]; body: string; context: string | null; index: number };

function blank(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function closingBrace(text: string, open: number) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}" && --depth === 0) return index;
  }
  throw new Error("unbalanced braces");
}

let ruleCounter = 0;
function parseRules(text: string, context: string | null = null): Rule[] {
  const rules: Rule[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf("{", cursor);
    if (open < 0) break;
    const close = closingBrace(text, open);
    const prelude = text.slice(cursor, open).trim();
    const body = text.slice(open + 1, close);
    if (prelude.startsWith("@media") || prelude.startsWith("@container")) rules.push(...parseRules(body, prelude.replace(/\s+/g, " ")));
    else if (!prelude.startsWith("@")) {
      rules.push({ selectors: prelude.split(",").map((selector) => selector.replace(/\s+/g, " ").trim()), body, context, index: ruleCounter++ });
    }
    cursor = close + 1;
  }
  return rules;
}

const rules = parseRules(blank(css));

function declarations(body: string) {
  return body.split(";").map((part) => part.trim()).filter((part) => part !== "").map((part) => {
    const colon = part.indexOf(":");
    return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as const;
  });
}

/** The last declaration of `property` among the rules in `context` whose selector list names `selector`: the cascade at equal specificity. */
function last(selector: string, property: string, context: string | null = null) {
  let value: string | undefined;
  for (const rule of rules) {
    if (rule.context !== context || !rule.selectors.includes(selector)) continue;
    for (const [name, text] of declarations(rule.body)) if (name === property) value = text;
  }
  return value;
}

// The longest part of a name that cannot be broken: split on spaces and after a hyphen (a hyphen is a break the CSS allows).
const names = Object.values(classificationOptions).flatMap((options) => options.map((option) => option.value));
const longest = Math.max(...names.flatMap((name) => name.split(/\s+|(?<=-)/u)).map((part) => part.length));
const requiredCell = Math.ceil(longest * ADVANCE * MIN_FONT) + PADDING_PC + BORDER;

const PHONE = "@media (max-width: 900px)";
const clampOf = (value: string | undefined) => /^clamp\(12px, calc\(\(100cqw - (\d+)px\) \/ ([\d.]+)\), (\d+)px\)$/u.exec(value ?? "");

function containerWidth(context: string) {
  const match = /^@container \(max-width: (\d+)px\)$/u.exec(context);
  return match === null ? null : Number(match[1]);
}

/** Columns of the grid for a panel of the given width, by the two @container rules (the last matching rule wins). */
function columnsAt(panel: number) {
  let columns = 3;
  for (const rule of rules) {
    if (rule.context === null || !rule.selectors.includes(".classification-grid")) continue;
    const limit = containerWidth(rule.context);
    if (limit === null || panel > limit) continue;
    const value = declarations(rule.body).find(([name]) => name === "grid-template-columns")?.[1] ?? "";
    columns = value.startsWith("repeat(2,") ? 2 : 1;
  }
  return columns;
}

test("the longest unbreakable class name is 14 glyphs and a cell needs 126px to hold it at 12px", () => {
  assert.ok(names.includes("Предупреждение"));
  assert.equal(longest, 14);
  assert.equal(requiredCell, 126);
});

test("the cell's name breaks only between words: no break inside a word, no hyphenation, the word goes under the badge", () => {
  assert.equal(last(".class-cell strong", "flex-wrap"), "wrap");
  assert.equal(last(".class-cell strong", "overflow-wrap"), "normal");
  assert.equal(last(".class-cell strong", "word-break"), "normal");
  assert.equal(last(".class-cell strong", "hyphens"), "manual");
});

test("the name's font follows the cell: clamp from 12px, 15px on a PC, 13px on a phone, divisor not below the longest word", () => {
  const pc = clampOf(last(".class-cell strong", "font-size"));
  assert.ok(pc, "the base font-size is a clamp over the container width");
  assert.equal(pc[1], String(PADDING_PC));
  assert.equal(pc[3], "15");
  assert.ok(Number(pc[2]) >= longest * ADVANCE, `the divisor ${pc[2]} is at least ${longest * ADVANCE}`);
  const phone = clampOf(last(".class-cell strong", "font-size", PHONE));
  assert.ok(phone, "the phone font-size is a clamp over the container width");
  assert.equal(phone[1], String(PADDING_PHONE));
  assert.equal(phone[3], "13");
  assert.ok(Number(phone[2]) >= longest * ADVANCE);
});

test("the cell and the classification panel are inline-size containers", () => {
  assert.equal(last(".class-cell", "container-type"), "inline-size");
  assert.equal(last(".classification-panel", "container-type"), "inline-size");
});

test("the grid goes 3 -> 2 -> 1 columns by the panel's own width, at no more than the width three and two cells need", () => {
  const widths = rules
    .filter((rule) => rule.selectors.includes(".classification-grid") && rule.context !== null && containerWidth(rule.context) !== null)
    .map((rule) => ({ limit: containerWidth(rule.context as string) as number, value: declarations(rule.body).find(([name]) => name === "grid-template-columns")?.[1] }));
  const two = widths.find((entry) => entry.value === "repeat(2, minmax(0, 1fr))");
  const one = widths.find((entry) => entry.value === "minmax(0, 1fr)");
  assert.ok(two && one, "both container rules exist");
  assert.ok(two.limit >= 3 * requiredCell, `three columns end at ${two.limit}px, three cells need ${3 * requiredCell}px`);
  assert.ok(one.limit >= 2 * requiredCell, `two columns end at ${one.limit}px, two cells need ${2 * requiredCell}px`);
  assert.ok(one.limit < two.limit);
  const base = rules.find((rule) => rule.context === null && rule.selectors.includes(".classification-grid"));
  const containers = rules.filter((rule) => rule.context !== null && rule.selectors.includes(".classification-grid") && containerWidth(rule.context) !== null);
  assert.ok(base && containers.every((rule) => rule.index > base.index), "the container rules come after the base grid rule");
});

test("at every panel width the grid has the longest word fit its cell, on one line beside the badge or under it", () => {
  for (let panel = requiredCell + BORDER; panel <= 1400; panel += 1) {
    const cell = (panel - BORDER) / columnsAt(panel);
    const content = cell - PADDING_PC - BORDER;
    const pc = clampOf(last(".class-cell strong", "font-size"));
    assert.ok(pc);
    const font = Math.min(15, Math.max(MIN_FONT, (content - Number(pc[1])) / Number(pc[2])));
    const word = longest * ADVANCE * font;
    assert.ok(word <= content + 1e-9, `panel ${panel}px: the word needs ${word}px of a ${content}px cell`);
    if (word + BADGE_AND_GAP <= content) continue;
    assert.ok(font >= MIN_FONT, `panel ${panel}px: the name is wrapped under the badge, not squeezed below ${MIN_FONT}px`);
  }
});

test("the longest part of a field label (11px) also fits the cell", () => {
  const labels = [...cardSource.matchAll(/\["[a-zA-Z]+", "([^"]+)"/gu)].map((match) => match[1]);
  assert.ok(labels.length >= 7, "all seven labels of the card are read from its source");
  const longestLabel = Math.max(...labels.flatMap((label) => label.split(/\s+/u)).map((part) => part.length));
  assert.ok(Math.ceil(longestLabel * ADVANCE * 11) + PADDING_PC + BORDER <= requiredCell, `a ${longestLabel}-glyph label word fits ${requiredCell}px`);
});

test("nothing around the class cell cuts a name: no ellipsis, no nowrap, no hidden overflow, no break anywhere", () => {
  const related = rules.filter((rule) => rule.selectors.some((selector) => /\.class-cell|\.classification-grid|\.classification-panel/u.test(selector)));
  assert.ok(related.length > 5);
  for (const rule of related) {
    for (const [name, value] of declarations(rule.body)) {
      const where = `${rule.selectors.join(", ")} { ${name}: ${value} }`;
      assert.ok(!(name === "text-overflow" && /ellipsis/u.test(value)), where);
      assert.ok(!(name === "white-space" && /nowrap/u.test(value)), where);
      assert.ok(!(name === "overflow" && /hidden/u.test(value)), where);
      assert.ok(!(name === "overflow-wrap" && /anywhere|break-word/u.test(value)), where);
      assert.ok(!(name === "word-break" && /break-all|break-word/u.test(value)), where);
    }
  }
});

test("the template export is untouched: levels, transmission cell and the builder card's own rule (D-65)", () => {
  for (const selector of [".class-cell.level-1 strong, .class-cell.level-1 small", ".class-cell.level-2 strong, .class-cell.level-2 small", ".class-cell.level-3 strong, .class-cell.level-3 small"]) {
    assert.ok(rules.some((rule) => rule.context === null && rule.selectors.join(", ") === selector), `${selector} stays`);
  }
  assert.equal(last(".class-cell.transmission", "grid-column"), "1 / -1");
  assert.equal(last(".template-card-preview .class-cell strong", "overflow-wrap"), "normal");
  assert.match(last(".template-card-preview .class-cell strong", "font-size") ?? "", /^clamp\(12px,/u);
  assert.equal(last(".template-card-preview .class-cell", "container-type"), "inline-size");
});
