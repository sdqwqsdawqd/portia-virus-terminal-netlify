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

test("26.1-27: the new live rules stand before the users-tab block, ui-unify stays last, no font under 11px", () => {
  const raw = read("app/portia.css");
  const usersTab = raw.indexOf("/* users-tab:start");
  for (const selector of [".live-surface .record-status {", ".live-surface .record-status > span:first-child"]) {
    const at = raw.indexOf(selector);
    assert.ok(at > 0 && at < usersTab, `${selector} stands before users-tab`);
  }
  assert.ok(raw.trimEnd().endsWith("/* ui-unify:end */"), "ui-unify is the last block");
  const live = raw.slice(raw.indexOf("/* LIVE-01..05 (26.1-10)"), usersTab);
  for (const size of live.matchAll(/(?:font-size:\s*|font:[^;]*?\b)(\d+(?:\.\d+)?)px/g)) assert.ok(Number(size[1]) >= 11, `a live font of ${size[1]}px (the tail keeps 11px and up)`);
});
