import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { componentFamily, lf } from "./component-source.ts";

// Phase 26 (UI-04, D-12, D-13): one layout for the editor tabs. The seam components/portia-editor-tab-shell.tsx holds the sticky
// action bar (nav · status · actions), the list/detail body and the empty detail; the editor file only calls it (D-21).
const family = componentFamily("portia-editor");
const shellPart = family.find((part) => part.file === "portia-editor-tab-shell.tsx");
const shell = shellPart?.text ?? "";
const editor = family[0].text;
const styles = lf(readFileSync(new URL("../app/portia.css", import.meta.url), "utf8"));
const PHONE = "max-width: 900px";

const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

type Rule = { selectors: string[]; body: string; context: string | null };

function parseRules(text: string, context: string | null = null): Rule[] {
  const rules: Rule[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf("{", cursor);
    if (open < 0) break;
    let depth = 0;
    let close = open;
    for (; close < text.length; close += 1) {
      if (text[close] === "{") depth += 1;
      else if (text[close] === "}" && --depth === 0) break;
    }
    const prelude = text.slice(cursor, open).trim();
    const body = text.slice(open + 1, close);
    if (prelude.startsWith("@media")) rules.push(...parseRules(body, prelude.slice(6).trim()));
    else if (!prelude.startsWith("@")) rules.push({ selectors: prelude.split(",").map((selector) => selector.replace(/\s+/g, " ").trim()), body, context });
    cursor = close + 1;
  }
  return rules;
}

const rules = parseRules(styles.replace(/\/\*[\s\S]*?\*\//g, ""));

/** The value the last rule naming `selector` gives `property`; with a context the media rules of that query count too. */
function declared(selector: string, property: string, context?: string): string | undefined {
  let value: string | undefined;
  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) continue;
    if (rule.context !== null && !(context && rule.context.includes(context))) continue;
    for (const part of rule.body.split(";")) {
      const colon = part.indexOf(":");
      if (colon > 0 && part.slice(0, colon).trim() === property) value = part.slice(colon + 1).trim();
    }
  }
  return value;
}

/** The JSX of the editor between two anchors (comments stripped). */
function editorSlice(from: string, to: string) {
  const code = stripComments(editor);
  const start = code.indexOf(from);
  const end = code.indexOf(to, start + 1);
  assert.ok(start >= 0 && end > start, `${from} … ${to} is found`);
  return code.slice(start, end);
}

test("UI-04: the tab shell is an editor seam that exports the action bar, the tab body and the empty detail", () => {
  assert.ok(shellPart, "components/portia-editor-tab-shell.tsx exists and belongs to the portia-editor family");
  assert.match(shell, /^"use client";/);
  for (const name of ["EditorActionBar", "EditorTabBody", "EditorEmptyDetail"]) assert.match(shell, new RegExp(`export function ${name}\\(`), name);
  assert.doesNotMatch(shell, /from "@\/components\/portia-editor"/, "the seam never imports the editor");
});

test("D-13b: the bar has a nav slot only when given, a polite status slot and an actions slot; reasons are alert lines under it", () => {
  const code = stripComments(shell);
  assert.match(code, /className="etab-bar"[^>]*aria-label=\{label\}/);
  assert.match(code, /\{nav && <div className="etab-nav">\{nav\}<\/div>\}/, "no nav slot without sections");
  assert.match(code, /className=\{`etab-status[^`]*`\} role="status" aria-live="polite"/);
  assert.match(code, /className="etab-actions"/);
  assert.match(code, /className="etab-message" role="alert"/);
  assert.ok(code.indexOf('className="etab-message"') > code.indexOf('className="etab-actions"'), "the reasons follow the bar");
  assert.match(code, /Не сохранено: \$\{unsavedCount\}/, "the unsaved count joins the status while dirty");
  assert.match(code, /notice \|\| statusText/, "the server's notice takes the status slot");
  assert.doesNotMatch(code, /dangerouslySetInnerHTML/, "T-26-11: titles and messages are escaped by React");
});

test("D-13b: the editor renders one action bar under the tab strip for the draft tabs, with the old buttons", () => {
  assert.match(editor, /import \{ EditorActionBar[^}]*\} from "@\/components\/portia-editor-tab-shell";/);
  const code = stripComments(editor);
  assert.equal(code.split("<EditorActionBar").length - 1, 1, "one call");
  const bar = editorSlice('<nav className="editor-tabs" aria-label="Разделы редактора"', "{refusedShown.map(");
  assert.match(bar, /<\/nav>\n\s*\{editorSections\.some\(\(section\) => section === tab\) && \(\n\s*<EditorActionBar/, "the bar follows the tab strip, only in a draft tab");
  for (const prop of ["label={sectionLabels[tab as EditorSection]}", "statusText={statusText}", "tone={status}", "unsavedCount={dirty ? shownChanged.length : 0}", "notice={saveNotice}"]) {
    assert.ok(bar.includes(prop), prop);
  }
  assert.ok(bar.includes('aria-label="Отменить последнее действие" disabled={!history.past.length} onClick={() => step("undo")}>↶</button>'), "the undo step");
  assert.ok(bar.includes('disabled={!dirty} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") setDialog("discard"); }}>ОТМЕНИТЬ</button>'), "ОТМЕНИТЬ opens the discard dialog");
  assert.ok(bar.includes('disabled={!dirty || saveBlocked} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") void save(); }}>СОХРАНИТЬ</button>'), "СОХРАНИТЬ saves");
  for (const reason of ['status === "error" && saveError', "oversize.length > 0 && oversizeMessage(oversize)", "bodyMessage", 'className="editor-save-fix" onClick={() => revealCard(badQuest.id, "endsAt", "quests")}>{dateMessage}</button>']) {
    assert.ok(bar.includes(reason), reason);
  }
});

test("D-13b: the floating save chip and its popover are gone; the sr-only live region and the discard dialog stay", () => {
  const code = stripComments(editor);
  for (const gone of ["chipVisible", "chipLabel", "chipText", "popoverOpen", "chipRef", "popoverId", "editor-save-chip", "editor-save-popover"]) {
    assert.ok(!code.includes(gone), `${gone} is gone`);
  }
  assert.ok(code.includes('<p className="sr-only" role="status" aria-live="polite">'), "the hidden list of unsaved sections stays");
  assert.ok(code.includes('title="Отменить несохранённые правки?"'), "the discard dialog stays");
});

test("D-13b: the bar is sticky, opaque and above the content; the chip rules are gone from the stylesheet", () => {
  assert.equal(declared(".etab-bar", "position"), "sticky");
  assert.equal(declared(".etab-bar", "top"), "0");
  // z-index 4, not 3: the TOC (.editor-toc, z-index 3, later in the DOM) would paint over a bar of the same level when scrolled under it.
  assert.equal(declared(".etab-bar", "z-index"), "4");
  assert.ok(Number(declared(".etab-bar", "z-index")) > Number(declared(".editor-toc", "z-index")), "the bar is above the TOC");
  assert.equal(declared(".etab-bar", "background"), "var(--panel)");
  assert.equal(declared(".etab-bar", "border-bottom"), "1px solid var(--line)");
  assert.equal(declared(".etab-bar", "min-height"), "48px");
  assert.equal(declared(".etab-bar", "padding"), "0 16px");
  assert.equal(declared(".etab-bar", "gap"), "8px");
  assert.equal(declared(".etab-nav", "overflow-x"), "auto");
  assert.equal(declared(".etab-actions", "flex"), "none");
  assert.doesNotMatch(styles, /\.editor-save-chip|\.editor-save-popover/, "no rule of the retired chip");
  assert.ok(Number(declared(".floating-text-format", "z-index")) > 3, "the format panel stays above the bar");
});

test("D-13b phone: one sticky bar in two rows under the 48px system bar, held by overflow: clip", () => {
  const clip = rules.find((rule) => rule.context?.includes(PHONE) && rule.selectors.includes(".app-window:has(.etab-bar)") && rule.selectors.includes(".content-editor:has(.etab-bar)"));
  assert.ok(clip && /overflow:\s*clip/.test(clip.body), "the window and the pane clip instead of scrolling");
  assert.equal(declared(".etab-bar", "top", PHONE), "48px");
  assert.equal(declared(".etab-bar", "top", PHONE), declared(".editor-section-addbar", "top", PHONE), "the same offset as the add bar today");
  assert.equal(declared(".etab-bar", "flex-wrap", PHONE), "wrap");
  assert.equal(declared(".etab-nav", "order", PHONE), "1");
  assert.equal(declared(".etab-nav", "flex-basis", PHONE), "100%");
});
