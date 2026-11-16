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
  // 48px: the offset the old sticky add bar used on a phone before 26-07 moved it into the bar's nav slot.
  assert.equal(declared(".etab-bar", "top", PHONE), "48px");
  assert.equal(declared(".editor-section-addbar", "top", PHONE), undefined, "the add bar has no sticky offset of its own any more");
  assert.equal(declared(".etab-bar", "flex-wrap", PHONE), "wrap");
  assert.equal(declared(".etab-nav", "order", PHONE), "1");
  assert.equal(declared(".etab-nav", "flex-basis", PHONE), "100%");
});

// ---- 26-06 Task 2 (D-12): list on the left, detail on the right; a tab without a list shows only the detail ----

const dossier = family.find((part) => part.file === "portia-editor-dossier.tsx")?.text ?? "";

test("D-12: «База вирусов» is a list/detail body; the old classes stay beside the new ones", () => {
  const viruses = editorSlice('{tab === "viruses" && (', '{tab === "info" && (');
  assert.ok(viruses.includes('<div className="virus-editor-layout etab-body" ref={layoutRef} data-mobile-view={recordOpen && selectedVirus ? "record" : "list"}>'), "the body keeps its phone view switch");
  assert.ok(viruses.includes('<aside className="editor-record-list etab-list">'), "the list pane");
  assert.ok(viruses.includes('<div className="editor-form virus-editor-form etab-detail">'), "the detail pane");
  assert.ok(viruses.includes('aria-current={virus.id === selectedVirusId ? "true" : undefined}'), "the picked row is the current one");
  assert.ok(viruses.includes(') : draft.viruses.length ? <EditorEmptyDetail /> : <div className="editor-empty">Добавьте первую запись вируса.</div>}'), "nothing picked: the empty detail; no record at all: the old line");
  assert.ok(viruses.includes("editor-back-to-list"), "the phone back button stays");
});

test("D-12: «Корзина» is a list/detail body with a read-only viewer on the right", () => {
  const recycle = editorSlice('{tab === "recycle" && (', '{tab === "search" && (');
  assert.ok(recycle.includes('<div className="virus-editor-layout recycle-editor-layout etab-body" ref={layoutRef}'));
  assert.ok(recycle.includes('<aside className="editor-record-list etab-list">'));
  assert.ok(recycle.includes('aria-current={(virus ? virus.id === shownRecycledVirusId : file!.id === shownRecycleFileId) ? "true" : undefined}'));
  assert.ok(recycle.includes('<div className="editor-form etab-detail">'), "the file form is the detail pane");
  assert.match(dossier, /export function ArchivedVirusEditor[\s\S]*?return <div className="editor-form virus-editor-form etab-detail">/, "the archived virus is the detail pane too");
  assert.ok(recycle.includes("Корзина пуста. Добавьте файл или создайте полную запись вируса."), "h-46 stays word for word");
});

test("D-12: «Рекомендации», «Помощник» and «Доступ» are only a detail pane, with no empty left column", () => {
  const search = editorSlice('{tab === "search" && (', '{tab === "assistant" && (');
  const assistant = editorSlice('{tab === "assistant" && (', '{tab === "employees" &&');
  assert.ok(search.includes('<div className="editor-form flat-editor-form etab-detail">'));
  assert.ok(assistant.includes('<div className="editor-form flat-editor-form assistant-editor etab-detail">'));
  assert.ok(stripComments(editor).includes('return <div className="editor-form flat-editor-form access-editor etab-detail">'));
  for (const [name, body] of [["search", search], ["assistant", assistant]]) {
    assert.ok(!body.includes("etab-list") && !body.includes("etab-body"), `${name}: no list column`);
  }
});

test("D-12: the empty detail says what to do in short lines that live in the seam", () => {
  assert.match(shell, /title: "Выберите запись"/);
  assert.match(shell, /lines: \["Она откроется справа\.", "Выберите строку в списке слева\."\]/);
  for (const text of ["Выберите запись", "Она откроется справа.", "Выберите строку в списке слева."]) {
    assert.ok(text.split(/\s+/).length < 7, `${text}: shorter than 7 words`);
    assert.ok(!editor.includes(text), `${text}: not in the editor file (D-58)`);
  }
  assert.match(shell, /<div className="etab-detail etab-empty">/);
  assert.match(shell, /<div className="etab-body" data-detail-only=\{list \? undefined : true\}>/, "a body without a list says so");
});

test("D-12: list column 240–320px, detail 24px (PC) / 16px (phone), one column and the old list-or-record switch on a phone", () => {
  assert.equal(declared(".etab-body", "grid-template-columns"), "clamp(240px, 24%, 320px) minmax(0, 1fr)");
  assert.equal(declared(".etab-body[data-detail-only]", "grid-template-columns"), "minmax(0, 1fr)");
  assert.equal(declared(".etab-detail", "padding"), "24px");
  assert.equal(declared(".etab-detail", "min-width"), "0");
  assert.equal(declared(".etab-detail", "padding", PHONE), "16px");
  assert.equal(declared(".etab-body", "grid-template-columns", PHONE), "minmax(0, 1fr)");
  assert.equal(declared('.etab-body[data-mobile-view="list"] > .etab-detail', "display", PHONE), "none", "a phone shows the list or the record");
  assert.equal(declared(".etab-empty", "padding"), "48px 24px");
  assert.match(styles, /\.etab-empty > strong\s*\{[^}]*font:\s*700 16px/);
  assert.match(styles, /\.etab-empty > p\s*\{[^}]*font:\s*400 13px/);
  // 26-05: the maximized rules of the old classes still reach the new bodies.
  assert.match(styles, /\.app-window\.is-maximized \.virus-editor-form \{/);
});

// ---- 26-07 (D-13a, A2): section navigation in the bar's nav slot, the TOC on the left, the active section on the right ----

/** The JSX expression the bar receives as `nav` (from `nav={` up to the `actions={` prop). */
function barNav() {
  return editorSlice("          nav={", "          actions={<>");
}

test("D-13a: section tabs mark the current section with aria-current, not aria-pressed, and keep it in view", () => {
  const tabs = editorSlice("function SectionTabs(", "function GuidePhotoLayoutEditor(");
  assert.ok(tabs.includes('aria-current={section.id === activeId ? "true" : undefined}'), "the current section is aria-current");
  assert.ok(!tabs.includes("aria-pressed"), "no aria-pressed on section buttons");
  assert.ok(tabs.includes('{section.title || "Без названия"}'), "an empty title still reads «Без названия» (T-26-14)");
  assert.ok(tabs.includes("<nav aria-label={label} ref={navRef}>"), "the nav holds a ref");
  assert.match(tabs, /useEffect\(\(\) => \{\n\s*navRef\.current\?\.querySelector<HTMLElement>\('\[aria-current="true"\]'\)\?\.scrollIntoView\(\{ block: "nearest", inline: "nearest", behavior: document\.documentElement\.dataset\.motion === "full" \? "smooth" : "auto" \}\);\n\s*\}, \[activeId\]\);/, "the current item is scrolled into view on change, instantly unless motion is full");
  assert.ok(tabs.includes('aria-label="Порядок разделов"'), "the order buttons stay beside the tabs");
  assert.doesNotMatch(tabs, /dangerouslySetInnerHTML/);
});

test("D-13a: «Справочник» switches sections in the nav slot of the bar: the add button first, then the section tabs", () => {
  const nav = barNav();
  const guide = nav.indexOf('nav={tab === "guide" ? <>');
  const add = nav.indexOf("<SectionAddBar onCreate={(title) => {", guide);
  const tabs = nav.indexOf('<SectionTabs label="Разделы справочника"', guide);
  assert.ok(guide >= 0 && add > guide && tabs > add, "SectionAddBar, then SectionTabs «Разделы справочника» in the nav");
  assert.ok(nav.includes('const id = makeId("guide");'), "the same onCreate");
  assert.ok(nav.includes("onSelect={setSelectedGuideSection} onMove={(from, to) => changeDraft((next) => moveArrayItem(next.guideSections, from, to))} />"), "the same props");
  const body = editorSlice('{tab === "guide" && (', '{tab === "broadcasts" && (');
  assert.ok(!body.includes("<SectionAddBar") && !body.includes("<SectionTabs"), "the guide body holds neither the add bar nor the section tabs");
});

test("A2: the «Справочник» body is the TOC on the left (only when it shows) and the active section on the right", () => {
  const body = editorSlice('{tab === "guide" && (', '{tab === "broadcasts" && (');
  assert.ok(body.includes("<EditorTabBody list={guideTocItems.length >= 5 && <EditorToc items={guideTocItems} onJump={jumpGuide} onAll={(open) => setAllOpen(guideCardIds, open)} />} detail={"), "list = the TOC with the same threshold");
  assert.match(stripComments(editor), /if \(items\.length < 5\) return null;/, "the TOC threshold is still 5");
  const detail = body.slice(body.indexOf("detail={"));
  const form = detail.indexOf('<div className="editor-form flat-editor-form editor-card-columns">');
  const hint = detail.indexOf('<p className="editor-guidance">Справочник на рабочем столе');
  const empty = detail.indexOf("Разделов пока нет. Добавьте первый раздел кнопкой «+ ДОБАВИТЬ РАЗДЕЛ».");
  const columns = detail.indexOf("<SectionColumns items={draft.guideSections} render={(section, index) => section.id === activeGuideSection && (");
  assert.ok(form > 0 && hint > form && empty > hint && columns > empty, "detail = the form, its hint (h-41), the empty state (h-43), the active section");
  assert.match(body, /<\/div>\n\s*\} \/>\n\s*\)\}/, "the detail closes after the form");
  assert.match(shell, /export function EditorTabBody/);
});

test("D-13b: only the action bar is sticky; the old add bar and section tabs have no sticky layer or top offset of their own", () => {
  for (const selector of [".editor-section-tabs", ".editor-section-addbar", ".editor-section-addbar + .editor-section-tabs"]) {
    for (const context of [undefined, PHONE, "min-width: 901px"]) {
      assert.notEqual(declared(selector, "position", context), "sticky", `${selector} ${context ?? ""}`);
      assert.equal(declared(selector, "top", context), undefined, `${selector} top ${context ?? ""}`);
    }
  }
  assert.doesNotMatch(styles, /top:\s*-28px/, "no PC correction of the old add bar");
  assert.doesNotMatch(styles, /\.etab-bar ~ \* \.editor-section-addbar/, "the 26-06 transitional rule is gone");
  assert.doesNotMatch(styles, /:has\(\.editor-section-addbar\)/, "the old phone clip of the add bar is gone: the bar's own clip holds");
});

test("D-13a: in the nav slot the section tabs run in one scrolling row; the title form opens under the add button", () => {
  assert.equal(declared(".etab-nav > .editor-section-addbar", "flex"), "none");
  assert.equal(declared(".etab-nav > .editor-section-tabs", "flex"), "1 1 auto");
  assert.equal(declared(".etab-nav > .editor-section-tabs", "min-width"), "0");
  assert.equal(declared(".etab-nav .editor-section-tabs nav", "flex-wrap"), "nowrap");
  assert.equal(declared(".etab-nav .editor-section-tabs nav", "overflow-x"), "auto");
  assert.equal(declared(".etab-nav .editor-section-create", "white-space"), "normal");
  assert.match(styles, /\.editor-section-tabs nav button\[aria-current="true"\]\s*\{[^}]*background:\s*var\(--teal-soft\)/, "the current section keeps the soft fill");
  assert.match(styles, /\.editor-section-addbar \{ display: grid; gap: 8px; \}/, "the add bar is a plain grid: button row, then the form under it");
});

test("D-13b: a jump from the TOC leaves the card clear of the sticky bar", () => {
  for (const selector of [".content-editor:has(> .etab-bar) .nested-editor-card", ".content-editor:has(> .etab-bar) .editor-record-row"]) {
    assert.equal(declared(selector, "scroll-margin-top"), "64px", selector);
    assert.equal(declared(selector, "scroll-margin-top", PHONE), "148px", `${selector} phone`);
  }
});
