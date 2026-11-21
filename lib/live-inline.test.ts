import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 26.1-27 (owner items 26 and 33, with the owner's clarification 2026-11-21): in the live mode the status plaque grows with the typed text,
// a place typed in sits exactly where the visitor's text is (its font, size, line height, padding and position), and «Запросы» of «Повышения» has no live toggle.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const styles = read("app/portia.css").replace(/\/\*[\s\S]*?\*\//g, "");
const seam = read("components/portia-editor-live.tsx");
const card = read("components/portia-virus-card.tsx");
const promotionMain = read("components/portia-promotion-editor-main.tsx");

type Rule = { selectors: string[]; body: string; declarations: Map<string, string> };
/** The innermost rules of the file: an @media block's body holds braces, so only the rules themselves match. */
function cssRules(): Rule[] {
  const rules: Rule[] = [];
  for (const match of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].trim().split(",").map((part) => part.trim().replace(/\s+/g, " ")).filter(Boolean);
    const declarations = new Map<string, string>();
    for (const line of match[2].split(";")) {
      const at = line.indexOf(":");
      if (at > 0) declarations.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
    }
    rules.push({ selectors, body: match[2], declarations });
  }
  return rules;
}
const rules = cssRules();
const rulesOf = (selector: string) => rules.filter((rule) => rule.selectors.includes(selector));
const declarationsOf = (selector: string) => {
  const found = rulesOf(selector);
  assert.ok(found.length > 0, `${selector}: the rule is in app/portia.css`);
  return new Map(found.flatMap((rule) => [...rule.declarations]));
};
const sliceOf = (source: string, from: string, to: string) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `${from} is in the source`);
  const end = source.indexOf(to, start + from.length);
  assert.ok(end > start, `${to} follows ${from}`);
  return source.slice(start, end);
};
/** The subject of a selector: its last compound, the element the declarations land on. */
const subjectOf = (selector: string) => selector.split(/\s*[\s>+~]\s*/).filter(Boolean).at(-1) ?? "";

test("26.1-27 (owner 33): the live status plaque follows its text: as wide as the text, wraps a long one and grows in height", () => {
  const plaque = declarationsOf(".live-surface .record-status");
  assert.equal(plaque.get("width"), "fit-content", "the width is the text's (the phone's 140px cap and max-content do not hold the live plaque)");
  assert.equal(plaque.get("max-width"), "100%", "a long text stops at the column and wraps");
  assert.equal(plaque.get("height"), "auto", "the height grows with the lines");
  assert.equal(plaque.get("align-items"), "flex-start", "the dot stays at the first line of a wrapped status");
  const dot = declarationsOf(".live-surface .record-status > span:first-child");
  assert.equal(dot.get("flex"), "none", "the dot never shrinks");
  const place = declarationsOf(".live-surface .record-status .live-editable");
  assert.equal(place.get("white-space"), "normal");
  assert.equal(place.get("overflow-wrap"), "anywhere", "a long word wraps inside the plaque instead of leaving it");
  assert.equal(place.has("min-width"), false, "no own minimum width: the plaque is the text's");
  // the visitor's `.record-status span` is the 7px red dot; it also matches the live place, which must be put back to a plain run of text
  assert.equal(place.get("width"), "auto");
  assert.equal(place.get("height"), "auto");
  assert.equal(place.get("background"), "transparent");
  assert.equal(place.get("border-radius"), "0");
  assert.equal(styles.includes(".live-surface .record-status .live-editable { min-width: 6ch; }"), false, "the old fixed minimum is gone");
});

test("26.1-27 (owner 33): the live status is typed inside the visitor's plaque, after its dot, with the plaque's font", () => {
  assert.ok(card.includes('<div className="record-status"><span />{live ? live.text({ kind: "virus-status", virusId: virus.id }, virus.status) : plain(virus.status)}</div>'), "the place is the plaque's own text, after the dot");
  const base = declarationsOf(".live-editable");
  for (const [property, value] of [["font", "inherit"], ["line-height", "inherit"], ["letter-spacing", "inherit"], ["color", "inherit"], ["padding", "0"], ["margin", "0"], ["border", "0"], ["background", "transparent"]] as const) {
    assert.equal(base.get(property), value, `.live-editable ${property}: ${value} — the place is the visitor's text`);
  }
  assert.equal(base.has("display"), false, "the place keeps the display of its tag (an inline run inside the original element)");
});

test("26.1-27 (owner 33): a typed letter is in the view at once — LiveText writes the draft on every input and draws the draft's value", () => {
  const text = sliceOf(seam, "export function LiveText(", "export function LiveCommitText(");
  assert.match(text, /onInput=\{\(event\) => commit\(event\.currentTarget\.textContent \?\? ""\)\}/, "every input is written");
  assert.match(text, /const commit = \(raw: string\) => bridge\.changeDraft\(/, "into the draft, so the visitor's view is drawn from it at once");
  assert.equal(text.includes("useState"), false, "no local copy of the value: the element shows the draft's value (the prop)");
  assert.match(text, /if \(!element \|\| element\.textContent === value\) return;\n\s*element\.textContent = value;/, "the draft's value is written back only when it differs");
  // «Повышение»: the banks are not in the draft; the typed text stays in its place until it is left (LiveCommitText) and the command answers
  const commit = sliceOf(seam, "export function LiveCommitText(", "export function LiveTextarea(");
  assert.match(commit, /const shown = typed \?\? value;/, "a multi-line place shows the typed text while it is typed");
  assert.match(commit, /onChange=\{\(event\) => setTyped\(event\.target\.value\)\}/);
});

test("26.1-27 (owner 33): no live text place has its own font, padding, margin, border, line height or minimum size", () => {
  const checked: string[] = [];
  const neutral = new Set(["inherit", "0", "none", "auto", "transparent", "0 0"]);
  const own = /^(font|padding|margin|border|line-height|min-width|min-height)/;
  for (const rule of rules) {
    const targets = rule.selectors.filter((selector) => /\.live-(editable|textarea)\b/.test(subjectOf(selector)) && !selector.includes("::"));
    if (targets.length === 0) continue;
    checked.push(...targets);
    for (const [property, value] of rule.declarations) {
      if (own.test(property)) assert.ok(neutral.has(value), `${targets.join(", ")} { ${property}: ${value} } — a live place takes the visitor's ${property}`);
      if (property === "display") assert.notEqual(value, "inline-block", `${targets.join(", ")}: no inline-block box around the visitor's text`);
      if (property === "outline-offset") assert.ok(/^[0-2]px$/.test(value), `${targets.join(", ")}: the outline sits next to the text (${value})`);
    }
  }
  for (const selector of [".live-editable", ".live-surface .record-status .live-editable", ".live-surface .broadcast-conditions .live-textarea", ".promo-live textarea.live-textarea"]) {
    assert.ok(checked.includes(selector), `${selector} is among the checked rules`);
  }
  for (const gone of [".live-surface .record-header .live-editable", ".live-surface .archive-document-view .live-editable", ".live-surface .trash-viewer-head .live-editable"]) {
    assert.equal(rulesOf(gone).length, 0, `${gone}: the inline-block box with its own minimum width is gone`);
  }
  assert.equal(/\.live-(editable|textarea)[^{,]*\{[^}]*\bborder(-[a-z]+)?:\s*1px/.test(styles), false, "the frame of a place is an outline, never a border");
  assert.equal(declarationsOf(".live-editable").get("outline-offset"), "2px");
});

test("26.1-27 (owner 33): a multi-line place is the visitor's text block: no frame, no inner padding, its height follows the text", () => {
  for (const selector of [".live-surface .broadcast-conditions .live-textarea", ".promo-live textarea.live-textarea"]) {
    const place = declarationsOf(selector);
    assert.equal(place.get("display"), "block", `${selector}: a block like the visitor's paragraph`);
    assert.equal(place.get("width"), "100%");
    assert.equal(place.get("resize"), "none", `${selector}: the corner handle would change the size`);
    assert.equal(place.get("field-sizing"), "content", `${selector}: the height is the text's`);
    assert.equal(place.has("background"), false, `${selector}: no own background (the base rule clears it)`);
  }
  // without field-sizing the rows are the text's own lines: no floor of two or three rows that the visitor's paragraph does not have
  assert.match(sliceOf(seam, "export function LiveCommitText(", "export function LiveTextarea("), /rows=\{shown\.split\("\\n"\)\.length\}/);
  assert.match(sliceOf(seam, "export function LiveTextarea(", "export function LiveDate("), /rows=\{value\.split\("\\n"\)\.length\}/);
  // the formatted text: pressed, it is the editor's field; in the live mode the field drops its frame, padding, label row and tall minimum
  const field = declarationsOf(".live-surface .live-rich-edit .formatted-rich-input");
  for (const [property, value] of [["min-height", "1.6em"], ["max-height", "none"], ["padding", "0"], ["border", "0"], ["border-radius", "0"], ["background", "transparent"], ["box-shadow", "none"], ["overflow", "visible"]] as const) {
    assert.equal(field.get(property), value, `the live rich field ${property}: ${value}`);
  }
  assert.match(field.get("outline") ?? "", /^1px dashed var\(--teal\)$/, "the field is marked like the other places, with an outline");
  assert.equal(field.get("outline-offset"), "2px");
  assert.ok(rulesOf(".live-surface .live-rich-edit .formatted-rich-input:focus").length > 0 && rulesOf(".live-surface .live-rich-edit .formatted-rich-input.is-editor-active").length > 0, "the focused and active field keep the same box");
  const wrap = declarationsOf(".live-surface .live-rich-edit .formatted-text-field");
  assert.equal(wrap.get("margin"), "0", "no 11px step above the field");
  assert.equal(wrap.get("gap"), "0");
  const label = declarationsOf(".live-surface .live-rich-edit .formatted-text-field-head");
  assert.equal(label.get("position"), "absolute", "the label row leaves the flow (it still names the field for a screen reader)");
  assert.equal(label.get("clip-path"), "inset(50%)");
  assert.equal(declarationsOf(".live-rich").get("min-height"), "1.6em", "the field at rest and pressed has the same minimum height");
  // a phrase of Vivian at rest is its plate (.assistant-formatted-text) at 12px; pressed, the field is the same plate at the same size, not the editor's 10px field
  const first = (selector: string) => rulesOf(selector)[0]?.declarations ?? new Map<string, string>();
  const phrase = first(".live-surface .assistant-live-bubble .live-rich-edit .formatted-rich-input");
  const plate = first(".assistant-formatted-text");
  for (const property of ["padding", "border", "border-radius", "background"]) assert.equal(phrase.get(property), plate.get(property), `the pressed phrase keeps the plate's ${property}`);
  // the phone plate (max-width 520px) is 8px 9px; so is the pressed phrase there
  assert.equal(rulesOf(".assistant-formatted-text").find((rule) => rule.declarations.get("padding") === "8px 9px") !== undefined, true);
  assert.equal(rulesOf(".live-surface .assistant-live-bubble .live-rich-edit .formatted-rich-input").some((rule) => rule.declarations.get("padding") === "8px 9px"), true);
  assert.equal(phrase.get("font-size"), "12px");
  assert.equal(phrase.get("line-height"), "1.4");
  assert.ok(rulesOf(".live-surface .assistant-live-bubble .live-rich-edit .formatted-rich-input.is-editor-active").length > 0);
});

test("26.1-27: the new live rules stand before the users-tab block, ui-unify stays last, no font under 11px", () => {
  const raw = read("app/portia.css");
  const usersTab = raw.indexOf("/* users-tab:start");
  for (const selector of [".live-surface .record-status {", ".live-surface .live-rich-edit .formatted-rich-input", ".live-surface .record-status > span:first-child"]) {
    const at = raw.indexOf(selector);
    assert.ok(at > 0 && at < usersTab, `${selector} stands before users-tab`);
  }
  assert.ok(raw.trimEnd().endsWith("/* ui-unify:end */"), "ui-unify is the last block");
  const live = raw.slice(raw.indexOf("/* LIVE-01..05 (26.1-10)"), usersTab);
  for (const size of live.matchAll(/(?:font-size:\s*|font:[^;]*?\b)(\d+(?:\.\d+)?)px/g)) assert.ok(Number(size[1]) >= 11, `a live font of ${size[1]}px (the tail keeps 11px and up)`);
});
