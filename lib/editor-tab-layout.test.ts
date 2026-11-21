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
// 26.1-02 (OWN-07): «Сотрудники» moved out of the editor file into its own seam (D-21).
const employeesSeam = family.find((part) => part.file === "portia-editor-employees.tsx")?.text ?? "";
// 26.1-08 (OWN-09): the order button and the hold gesture live in the dossier seam.
const dossierSeam = family.find((part) => part.file === "portia-editor-dossier.tsx")?.text ?? "";
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
  return declaredIn(rules, selector, property, context);
}

function declaredIn(list: Rule[], selector: string, property: string, context?: string): string | undefined {
  let value: string | undefined;
  for (const rule of list) {
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
  // Two bars since 26-07: the draft tabs share one; «Сотрудники» renders its own with its own save (D-12). Since 26.1-02 the second one lives in the seam.
  assert.equal(code.split("<EditorActionBar").length - 1, 1, "one bar for the draft tabs in the editor file");
  assert.equal(stripComments(employeesSeam).split("<EditorActionBar").length - 1, 1, "one bar for «Сотрудники» in its seam");
  const bar = editorSlice('<nav className="editor-tabs" aria-label="Разделы редактора"', "{refusedShown.map(");
  assert.match(bar, /<\/nav>\n\s*\{editorSections\.some\(\(section\) => section === tab\) && \(\n\s*<EditorActionBar/, "the bar follows the tab strip, only in a draft tab");
  for (const prop of ["label={sectionLabels[tab as EditorSection]}", "statusText={statusText}", "tone={status}", "unsavedCount={dirty ? shownChanged.length : 0}", "notice={saveNotice}"]) {
    assert.ok(bar.includes(prop), prop);
  }
  // WR-01: the buttons and the reasons are two constants, shared by this bar and by the bars of the other tabs (EditorDraftBarContext).
  assert.ok(bar.includes("actions={draftActions}") && bar.includes("messages={draftMessages}"), "the draft tabs' bar takes the shared buttons and reasons");
  const shared = editorSlice("const draftActions = <>", "const draftBar: EditorDraftBarState");
  assert.ok(shared.includes('aria-label="Отменить последнее действие" disabled={!history.past.length} onClick={() => step("undo")}>↶</button>'), "the undo step");
  assert.ok(shared.includes('disabled={!dirty} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") setDialog("discard"); }}>ОТМЕНИТЬ</button>'), "ОТМЕНИТЬ opens the discard dialog");
  assert.ok(shared.includes('disabled={!dirty || saveBlocked} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") void save(); }}>СОХРАНИТЬ</button>'), "СОХРАНИТЬ saves");
  for (const reason of ['status === "error" && saveError', "oversize.length > 0 && oversizeMessage(oversize)", "bodyMessage", 'className="editor-save-fix" onClick={() => revealCard(badQuest.id, "endsAt", "quests")}>{dateMessage}</button>']) {
    assert.ok(shared.includes(reason), reason);
  }
});

// ---- Review WR-01: the shared draft stays visible and savable on the tabs outside the draft tabs ----

test("WR-01: a tab outside the draft tabs shows the unsaved draft through the context, in the one sticky bar of that tab", () => {
  const code = stripComments(editor);
  const draft = editorSlice("const draftBar: EditorDraftBarState", "const header = (");
  assert.ok(draft.includes('!editorSections.some((section) => section === tab) && (dirty || saveState !== "idle")'), "only outside the draft tabs, while unsaved or a save is under way");
  for (const prop of ["statusText", "tone: status", "unsavedCount: dirty ? shownChanged.length : 0", "notice: saveNotice", "actions: draftActions", "messages: draftMessages"]) assert.ok(draft.includes(prop), prop);
  const provider = editorSlice("<EditorDraftBarContext.Provider value={draftBar}>", "</EditorDraftBarContext.Provider>");
  for (const tab of ["employees", "users", "promo"]) assert.ok(provider.includes(`{tab === "${tab}"`), `${tab} sits under the provider`);
  assert.ok(provider.includes('{tab === "access" && canManageEditors && <EditorDraftBar />}'), "the access tab has no bar of its own, so it renders the draft bar");
  assert.equal(code.split("<EditorActionBar").length - 1, 1, "no second action bar in the editor file: the other tabs reuse their own («Сотрудники» has its own in its seam)");
  assert.match(shell, /export const EditorDraftBarContext = createContext<EditorDraftBarState \| null>\(null\)/);
  assert.match(stripComments(shell), /export function EditorDraftBar\(\{ banner \}/);
  const bar = stripComments(shell);
  assert.match(bar, /const draft = useContext\(EditorDraftBarContext\);[\s\S]*\{draft && <DraftRow draft=\{draft\} \/>\}/, "EditorActionBar carries the draft row inside its own section");
  assert.match(bar, /className="etab-draft" role="group"/);
  const users = lf(readFileSync(new URL("../components/portia-users-tab.tsx", import.meta.url), "utf8"));
  assert.match(users, /\/> : <EditorDraftBar banner=\{staleBanner\} \/>\}/, "the phone list of «Пользователи» has no bar, so it renders the draft bar");
});

test("WR-06: the «data is stale» banner of «Пользователи» rides inside the sticky bar, so the bar never covers it", () => {
  const code = stripComments(shell);
  assert.match(code, /\{banner && <div className="etab-banner">\{banner\}<\/div>\}\n\s*<\/section>/, "the banner is the last row of the bar's own section");
  assert.equal(code.split('className="etab-banner"').length - 1, 2, "the action bar and the draft bar carry it");
  assert.match(code, /if \(!draft\) return banner \? <>\{banner\}<\/> : null;/, "without a bar the banner stands alone as before");
  const users = lf(readFileSync(new URL("../components/portia-users-tab.tsx", import.meta.url), "utf8"));
  assert.equal(users.split("<AppStaleBanner").length - 1, 1, "one banner element");
  assert.ok(users.includes("banner={staleBanner}\n      /> : <EditorDraftBar banner={staleBanner} />}"), "PC: in the action bar; phone: in the draft bar or alone");
  assert.ok(!/<\/EditorActionBar>|\{failure && lastGoodAt \? <AppStaleBanner/.test(users), "no separate sticky banner beside the bar");
  assert.equal(declared(".etab-banner", "order"), "3", "the last row, after the draft row (order 2)");
  assert.equal(declared(".etab-banner", "flex"), "0 0 100%");
  assert.equal(declared(".etab-banner > .app-stale-banner", "position"), "static", "not a second sticky layer");
  assert.equal(declared(".etab-bar:has(> .etab-banner)", "flex-wrap"), "wrap");
  assert.equal(declared(".etab-banner > .app-stale-banner", "margin"), "0 -16px", "full width inside the 16px padding of a PC bar");
  assert.equal(declared(".etab-banner > .app-stale-banner", "margin", PHONE), "0", "the phone bar has no side padding");
});

test("WR-04: «Повышение» tells a success from a failure; the status of a bar stays one line with an ellipsis whatever its tone", () => {
  assert.match(promotionMain, /const \[note, setNote\] = useState\(\{ text: "", ok: false \}\); const message = note\.text; const setMessage = useCallback\(\(text: string, ok = false\) => setNote\(\{ text, ok \}\), \[\]\);/, "a message is an error unless the call says it is a success");
  const successes = ['"Запрос отклонён и удалён из активной очереди." : "Запрос удалён.", true)', "Привязка ${nicknameKey} сброшена.`, true)"];
  for (const success of successes) assert.ok(promotionMain.includes(success), `${success} is a success`);
  assert.equal(promotionMain.split(", true)").length - 1, 2, "only the two successes pass the flag; every other message keeps the error tone");
  // .editor-save-status.error (0,2,0) sets white-space: normal; the bar rule is (0,3,0), so it wins whatever the order.
  assert.equal(declared(".etab-bar .etab-status.editor-save-status", "white-space"), "nowrap");
  assert.equal(declared(".editor-save-status.error", "white-space"), "normal", "the old tone rule stays for other places");
  assert.equal(declared(".etab-status", "text-overflow"), "ellipsis");
  assert.equal(declared(".etab-status", "overflow"), "hidden");
});

test("WR-05: exactly one live region announces the save status: the bar's status on the draft tabs, the hidden line on the other tabs", () => {
  const code = stripComments(editor);
  const hidden = '{!editorSections.some((section) => section === tab) && <p className="sr-only" role="status" aria-live="polite">';
  assert.equal(code.split('<p className="sr-only" role="status" aria-live="polite">').length - 1, 1, "one hidden status line");
  assert.ok(code.includes(hidden), "the hidden line exists only outside the draft tabs");
  // The draft row of a bar is a plain paragraph: no role, no aria-live, so it never doubles the hidden line.
  const row = stripComments(shell).slice(stripComments(shell).indexOf("function DraftRow"), stripComments(shell).indexOf("function BarMessages"));
  assert.ok(row.includes("etab-draft-status") && !/role="status"|aria-live/.test(row), "the draft row is not a live region");
  assert.match(stripComments(shell), /className=\{`etab-status editor-save-status \$\{notice \? "saved" : tone\}`\} role="status" aria-live="polite"/, "the bar's own status is the live region on the draft tabs");
});

test("WR-01: the draft row is one more line of the same sticky bar, after the nav and the actions, on PC and on a phone", () => {
  assert.equal(declared(".etab-bar:has(> .etab-draft)", "flex-wrap"), "wrap", "the bar wraps instead of a second sticky bar");
  assert.equal(declared(".etab-draft", "flex"), "0 0 100%");
  assert.equal(declared(".etab-draft", "order"), "2", "after the nav (order 1 on a phone)");
  assert.equal(declared(".etab-draft", "min-height"), "44px", "a 44px touch row");
  assert.equal(declared(".etab-draft > .etab-status", "flex"), "1 1 0");
  const draftRules = rules.filter((rule) => rule.selectors.some((selector) => selector.includes("etab-draft") && !selector.includes("etab-draft-label")) && rule.body.includes("position"));
  assert.equal(draftRules.length, 0, "the draft row is not sticky on its own");
});

// UAT 2026-11-16 gap 7: in the column flex of the promotion editor the sticky bar (min-height 48px) was shrunk to 48px, so the
// second row of the draft was painted over the filters and the reset button below it.
test("UAT 2026-11-16 gap 7: the sticky bar never shrinks under its rows in a column flex", () => {
  assert.equal(declared(".etab-bar", "flex-shrink"), "0");
  assert.equal(declared(".etab-bar", "flex-shrink", PHONE), "0", "a phone rule does not give the shrink back");
  for (const child of ["etab-bar", "etab-message", "promotion-editor-conflict", "promotion-requests-toolbar", "promotion-cleanup-disclosure"]) {
    assert.equal(declared(`.promotion-editor > .${child}`, "flex"), "none", `${child} keeps its own height`);
  }
  assert.equal(declared(".promotion-editor", "overflow-y"), "auto", "a short window scrolls the editor instead of cutting it");
  assert.equal(declared(".promotion-editor-workbench", "flex"), "1 1 0", "the workbench still takes the rest");
  const main = stripComments(lf(readFileSync(new URL("../components/portia-promotion-editor-main.tsx", import.meta.url), "utf8")));
  assert.match(main, /<div className="promotion-editor">\s*<EditorActionBar/, "the bar is a direct child of div.promotion-editor");
  assert.match(main, /<>\s*<div className="promotion-requests-toolbar">/, "the toolbar is a direct child of div.promotion-editor (inside a fragment)");
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
  return editorSlice("          nav={", "          actions={draftActions}");
}

test("D-13a: section tabs mark the current section with aria-current, not aria-pressed, and keep it in view", () => {
  const tabs = editorSlice("function SectionTabs(", "function GuidePhotoLayoutEditor(");
  assert.ok(tabs.includes('aria-current={section.id === activeId ? "true" : undefined}'), "the current section is aria-current");
  assert.ok(!tabs.includes("aria-pressed"), "no aria-pressed on section buttons");
  assert.ok(tabs.includes('{section.title || "Без названия"}'), "an empty title still reads «Без названия» (T-26-14)");
  assert.ok(tabs.includes("<nav aria-label={label} ref={navRef}>"), "the nav holds a ref");
  assert.match(tabs, /useEffect\(\(\) => \{\n\s*navRef\.current\?\.querySelector<HTMLElement>\('\[aria-current="true"\]'\)\?\.scrollIntoView\(\{ block: "nearest", inline: "nearest", behavior: document\.documentElement\.dataset\.motion === "full" \? "smooth" : "auto" \}\);\n\s*\}, \[activeId\]\);/, "the current item is scrolled into view on change, instantly unless motion is full");
  assert.ok(!tabs.includes('aria-label="Порядок разделов"'), "UAT 2026-11-16 gap 5: the arrow buttons beside the tabs are gone, the drag handle of every tab does their work");
  assert.doesNotMatch(tabs, /dangerouslySetInnerHTML/);
});

test("UAT 2026-11-16 gap 5: every section tab carries the drag handle of the subsections", () => {
  const tabs = editorSlice("function SectionTabs(", "function GuidePhotoLayoutEditor(");
  assert.match(tabs, /sections\.map\(\(section, index\) => <span key=\{section\.id\} className="editor-section-tab" data-sort-index=\{index\}>/, "a tab is a span with its source index, a child of the nav (the shared parent the handle swaps within)");
  assert.ok(tabs.includes('<OrderDragHandle index={index} label={section.title || "раздел"} onMove={onMove} />'), "the same handle as the subsections: no itemId, no move across lists");
  assert.ok(tabs.indexOf("<OrderDragHandle") < tabs.indexOf("<button"), "the handle stands before the tab button");
  assert.ok(tabs.includes('onClick={() => onSelect(section.id)}') && tabs.includes('aria-current={section.id === activeId ? "true" : undefined}'), "the tab button keeps selecting and aria-current");
  assert.ok(tabs.includes('{section.title || "Без названия"}'), "an empty title still reads «Без названия»");
  assert.ok(!tabs.includes("Переместить раздел") && !tabs.includes("activeIndex"), "no arrow buttons and no active-index bookkeeping");
  assert.ok(tabs.includes("<nav aria-label={label} ref={navRef}>"), "the nav keeps its ref and the scroll effect");
  assert.equal(declared(".editor-section-tabs nav > .editor-section-tab", "display"), "inline-flex");
  assert.equal(declared(".editor-section-tabs nav > .editor-section-tab", "flex"), "none");
  // owner 2026-11-20 (OWN-09): the 24px / tap-target handle is gone; the button of a tab is invisible until the keyboard focuses it.
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "position"), "absolute", "out of the tab's layout");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "width"), "1px");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "height"), "1px");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "padding"), "0");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "min-height"), "0", "the tab button rules (36/40px, tap target) do not size it");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "clip-path"), "inset(50%)");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "width", PHONE), "1px", "no phone size (tap target) for a button nobody sees");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle:focus-visible", "clip-path"), "none", "keyboard focus shows it");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle:focus-visible", "width"), "24px");
  assert.doesNotMatch(styles, /editor-section-tab-order/, "the dead arrow group has no rule left");
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
  const columns = detail.indexOf('<div className="editor-section-single">{draft.guideSections.map((section, index) => section.id === activeGuideSection && (');
  assert.ok(form > 0 && hint > form && empty > hint && columns > empty, "detail = the form, its hint (h-41), the empty state (h-43), the active section");
  assert.match(body, /<\/div>\n\s*\} \/>\n\s*\)\}/, "the detail closes after the form");
  assert.match(shell, /export function EditorTabBody/);
});

test("UAT 2026-11-16 gap 4: the active section spans the whole form", () => {
  for (const [tabStart, tabEnd, list, active] of [['{tab === "info" && (', '{tab === "guide" && (', "infoSections", "activeInfoSection"], ['{tab === "guide" && (', '{tab === "broadcasts" && (', "guideSections", "activeGuideSection"]]) {
    const body = editorSlice(tabStart, tabEnd);
    assert.ok(body.includes(`<div className="editor-section-single">{draft.${list}.map((section, index) => section.id === ${active} && (`), `${list}: the active section stands in the single-section wrapper`);
    assert.ok(body.includes("          ))}</div>"), `${list}: the wrapper closes after the card`);
    assert.ok(!body.includes("<SectionColumns"), `${list}: no column grid for one section`);
  }
  const recommendations = stripComments(editor).split("<SectionColumns items=").length - 1;
  assert.equal(recommendations, 1, "SectionColumns stays only for the recommendations, which show all their cards");
  assert.equal(declared(".editor-section-single", "grid-column"), "1 / -1");
  assert.equal(declared(".editor-section-single", "min-width"), "0");
  assert.equal(declared(".editor-section-single", "display"), "grid");
  assert.equal(declared(".editor-section-single", "gap"), "10px");
  assert.equal(declared(":root", "--editor-card-width") ?? "340px", "340px", "the card width of the grids is not touched (D-19)");
  assert.match(styles, /--editor-card-width: 340px;/);
});

test("UAT 2026-11-16 gap 4: the open add-section form takes a whole row of the bar", () => {
  const OPEN = ":has(> .editor-section-create:not([hidden]))";
  assert.equal(declared(`.etab-nav:has(> .editor-section-addbar > .editor-section-create:not([hidden]))`, "flex-wrap"), "wrap", "the bar's nav wraps while the form is open");
  assert.equal(declared(`.etab-nav > .editor-section-addbar${OPEN}`, "flex"), "1 0 100%", "the add bar takes the whole row while the form is open");
  assert.equal(declared(".etab-nav > .editor-section-addbar", "flex"), "none", "the closed form keeps the old rule");
  const open = ".etab-nav .editor-section-create:not([hidden])";
  assert.equal(declared(open, "display"), "flex");
  assert.equal(declared(open, "flex-wrap"), "wrap");
  assert.equal(declared(open, "align-items"), "end");
  assert.equal(declared(open, "gap"), "8px");
  assert.equal(declared(".etab-nav .editor-section-create", "width"), "auto", "no 320px cap on the form");
  assert.equal(declared(".etab-nav .editor-section-create .editor-field", "flex"), "1 1 320px");
  assert.equal(declared(".etab-nav .editor-section-create .editor-field", "max-width"), "var(--field-max)");
  assert.equal(declared(".editor-section-create[hidden]", "display"), "none", "a closed form stays hidden");
});

test("UAT 2026-11-16 gap 10: the recycle button stands in the record head beside the dossier tabs", () => {
  const form = editorSlice('<div className="editor-form virus-editor-form etab-detail">', ') : draft.viruses.length ? <EditorEmptyDetail />');
  const head = form.indexOf('<div className="virus-editor-head">');
  const tabs = form.indexOf("<DossierTabs active={dossierTab} changed={liveDossierChanged} onSelect={selectDossierTab} />");
  const button = form.indexOf('<button className="danger-control" type="button" onClick={() => setDialog("recycle")}>ПЕРЕМЕСТИТЬ В КОРЗИНУ</button>');
  const headEnd = form.indexOf("</div>", button);
  const firstGroup = form.indexOf('{dossierTab === "main" &&');
  assert.ok(head >= 0 && tabs > head && button > tabs && headEnd > button && firstGroup > headEnd, "the head holds the tabs and then the button, before the first group");
  assert.ok(form.slice(0, head).trim().endsWith('<div className="editor-form virus-editor-form etab-detail">'), "the head is the first line of the form");
  assert.equal(form.split("ПЕРЕМЕСТИТЬ В КОРЗИНУ").length - 1, 1, "one recycle button in the markup of the tab; none stays below the groups");
  assert.ok(form.indexOf("setDialog(") === form.indexOf('setDialog("recycle")'), "the same handler opens the confirmation dialog (T-26-40)");
  assert.equal(declared(".virus-editor-head", "display"), "flex");
  assert.equal(declared(".virus-editor-head", "flex-wrap"), "wrap");
  assert.equal(declared(".virus-editor-head", "align-items"), "center");
  assert.equal(declared(".virus-editor-head", "justify-content"), "space-between");
  assert.equal(declared(".virus-editor-head", "gap"), "8px");
  assert.equal(declared(".virus-editor-head", "margin-bottom"), "16px");
  assert.equal(declared(".virus-editor-head > .dossier-tabs", "flex"), "1 1 auto");
  assert.equal(declared(".virus-editor-head > .dossier-tabs", "min-width"), "0");
  assert.equal(declared(".virus-editor-head > .dossier-tabs", "margin"), "0");
  assert.equal(declared(".virus-editor-head > .danger-control", "flex"), "none");
  assert.notEqual(declared(".virus-editor-head > .danger-control", "width"), "100%");
});

test("D-13b: only the action bar is sticky; the old add bar and section tabs have no sticky layer or top offset of their own", () => {
  for (const selector of [".editor-section-tabs", ".editor-section-addbar", ".editor-section-addbar + .editor-section-tabs"]) {
    for (const context of [undefined, PHONE, "width > 900px"]) {
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

// ---- 26-07 Task 2: «Информация» and «Сводка» take the same nav slot and the same A2 body ----

test("D-13a/D-62: «Информация» switches sections in the nav slot — the add button before the section tabs", () => {
  const nav = barNav();
  const info = nav.indexOf(': tab === "info" ? <>');
  const end = nav.indexOf(': tab === "broadcasts" ? (', info);
  assert.ok(info > 0 && end > info, "an info branch of the nav");
  const slot = nav.slice(info, end);
  const add = slot.indexOf("<SectionAddBar onCreate={(title) => {");
  const tabs = slot.indexOf('<SectionTabs label="Разделы информации"');
  assert.ok(add > 0 && tabs > add, "SectionAddBar stands before SectionTabs «Разделы информации»");
  assert.ok(slot.includes('const id = makeId("info");'), "the same onCreate");
  const body = editorSlice('{tab === "info" && (', '{tab === "guide" && (');
  assert.ok(!body.includes("<SectionAddBar") && !body.includes("<SectionTabs"), "the info body holds neither");
});

test("D-13a: «Сводка» switches «Новости» / «Квесты» in the nav slot: tab family, aria-current, a count plaque", () => {
  const nav = barNav();
  const slot = nav.slice(nav.indexOf(': tab === "broadcasts" ? ('));
  assert.ok(slot.includes('<nav className="editor-tabs dossier-tabs" aria-label="Разделы сводки">'), "the broadcast nav moved into the bar");
  assert.ok(slot.includes('aria-current={broadcastEditorTab === id ? "true" : undefined}'), "the current group is aria-current");
  assert.ok(!slot.includes("aria-pressed"), "no aria-pressed");
  assert.ok(slot.includes('{label} <span className="tab-count">{draft.broadcasts.filter((item) => broadcastTabOf(item.type) === id).length}</span>'), "the count is a plaque after the label");
  assert.match(slot, /\) : undefined\}\n$/, "no nav for the other tabs");
  const body = editorSlice('{tab === "broadcasts" && (', '{tab === "recycle" && (');
  assert.ok(!body.includes("Разделы сводки"), "the body no longer holds the group nav");
});

test("A2: «Информация» and «Сводка» bodies are the TOC on the left (only when it shows) and the old form on the right", () => {
  const info = editorSlice('{tab === "info" && (', '{tab === "guide" && (');
  assert.ok(info.includes("<EditorTabBody list={infoTocItems.length >= 5 && <EditorToc items={infoTocItems} onJump={jumpInfo} onAll={(open) => setAllOpen(infoCardIds, open)} />} detail={"));
  const infoDetail = info.slice(info.indexOf("detail={"));
  const order = ['<div className="editor-form flat-editor-form editor-card-columns">', "<EditorGroup title={levelCopy.appsGroup}>", '<p className="editor-guidance">Каждый блок становится', "Разделов пока нет. Добавьте первый раздел кнопкой «+ ДОБАВИТЬ РАЗДЕЛ».", '<div className="editor-section-single">{draft.infoSections.map((section, index) => section.id === activeInfoSection && ('];
  order.reduce((last, piece) => { const at = infoDetail.indexOf(piece, last); assert.ok(at > last, `info detail: ${piece}`); return at; }, 0);
  const broadcasts = editorSlice('{tab === "broadcasts" && (', '{tab === "recycle" && (');
  assert.ok(broadcasts.includes("<EditorTabBody list={broadcastTocItems.length >= 5 && <EditorToc items={broadcastTocItems} onJump={(id) => { openBroadcast(id); jumpToCard(id); }} onAll={(open) => setAllOpen(broadcastTocItems.map((item) => item.id), open)} />} detail={"));
  const detail = broadcasts.slice(broadcasts.indexOf("detail={"));
  const pieces = ['<div className="editor-form flat-editor-form editor-card-columns">', '<p className="editor-guidance">Публикуйте новости', '"+ НОВАЯ НОВОСТЬ" : "+ НОВЫЙ КВЕСТ"', '"Новостей пока нет." : "Квестов и задач пока нет."', '<div className="broadcast-entry-list">{shownBroadcasts.map(renderBroadcastCard)}</div>'];
  pieces.reduce((last, piece) => { const at = detail.indexOf(piece, last); assert.ok(at > last, `broadcast detail: ${piece}`); return at; }, 0);
  for (const body of [info, broadcasts]) assert.match(body, /<\/div>\n\s*\} \/>\n\s*\)\}/, "the detail closes after the form");
});

test("D-13a: the broadcast group nav sits flush in the bar", () => {
  assert.equal(declared(".etab-nav > .dossier-tabs", "margin"), "0");
});

// ---- 26-07 Task 3 (D-12): «Сотрудники» — its own action bar, the employee list on the left, the profile on the right ----

/** The component of «Сотрудники» in its seam, comments stripped, from its first line to the end of the file. */
function employeesComponent() {
  const code = stripComments(employeesSeam);
  const start = code.indexOf("export function EmployeeProfilesEditor(");
  assert.ok(start >= 0, "export function EmployeeProfilesEditor( is in components/portia-editor-employees.tsx");
  return code.slice(start);
}

test("D-12: «Сотрудники» renders its own action bar with the profile save and its own status; no editor draft buttons", () => {
  const employees = employeesComponent();
  const ret = employees.slice(employees.indexOf("  return <>\n    <EditorActionBar"));
  assert.ok(ret.length > 0, "the bar opens the component's markup, above the layout");
  const bar = ret.slice(0, ret.indexOf('<div className="virus-editor-layout employee-editor-layout etab-body"'));
  assert.ok(bar.includes('label={tabRegistry.find((entry) => entry.id === "employees")?.label ?? ""}'), "the tab's own label, no new text");
  assert.ok(bar.includes('statusText={selected && draft ? (saveStatus === "saving" ? saveStatusText("saving") : saveStatus === "saved" ? saveStatusText("saved") : state === "error" ? errorMessage : "ТОЛЬКО ДЛЯ РЕДАКТОРОВ") : ""}'), "the status of the profile save (saveStatusText vocabulary)");
  assert.ok(bar.includes("tone={saveStatus}"));
  assert.ok(bar.includes('<button className="primary-control" type="button" disabled={state === "saving"} onClick={() => void save()}>СОХРАНИТЬ ПРОФИЛЬ</button>'), "the same save button and handler");
  assert.ok(bar.includes('href="/owner-login">ВОЙТИ СНОВА</a>'), "the sign-in link after an expired session stays beside it");
  for (const gone of ["↶", "ОТМЕНИТЬ", 'setDialog("discard")', "editor-undo-step"]) assert.ok(!bar.includes(gone), `${gone}: no editor draft action on this bar`);
  assert.ok(!employees.includes("employee-editor-save"), "the old save line under the profile is gone");
  assert.ok(employees.includes("leaving: boolean;") && employees.includes("onLeave(true);") && employees.includes('title="Сохранить изменения?"'), "the close question is asked by the seam");
  assert.match(employees, /<\/div>\n {2}<\/>;\n\}/, "the fragment closes after the layout");
});

test("D-12: «Сотрудники» is a list/detail body; the picked employee is the current row", () => {
  const employees = employeesComponent();
  assert.ok(employees.includes('<div className="virus-editor-layout employee-editor-layout etab-body" ref={layoutRef} data-mobile-view={recordOpen ? "record" : "list"}>'));
  assert.ok(employees.includes('<aside className="editor-record-list etab-list">'));
  assert.ok(employees.includes('aria-current={employee.id === selected?.id ? "true" : undefined}'), "the picked employee is aria-current");
  assert.ok(employees.includes('<div className="editor-form employee-profile-editor etab-detail">'));
  assert.ok(employees.includes("editor-back-to-list"), "the phone back button stays");
  assert.doesNotMatch(styles, /\.employee-editor-save/, "no rule of the retired save line");
});

// ---- 26.1-02 (OWN-07): «Сотрудники» keep one draft per employee and ask once, when the window closes ----

test("OWN-07: the component lives in its seam only; the editor imports it and the draft store and hands the store to the tab", () => {
  assert.equal(editor.split("function EmployeeProfilesEditor(").length - 1, 0, "the function is gone from the editor file");
  assert.match(employeesSeam, /^"use client";/);
  assert.match(employeesSeam, /export function EmployeeProfilesEditor\(/);
  assert.match(employeesSeam, /export function useEmployeeDraftStore\(/);
  assert.doesNotMatch(employeesSeam, /from "@\/components\/portia-editor"/, "the seam never imports the editor");
  assert.doesNotMatch(employeesSeam, /from "@\/components\/portia-desktop/, "the seam imports nothing of the desktop family");
  assert.ok(editor.includes('import { EmployeeProfilesEditor, useEmployeeDraftStore } from "@/components/portia-editor-employees";'));
  assert.ok(editor.includes("const employeeDrafts = useEmployeeDraftStore();"), "the store is made by PortiaEditor, so it outlives the tab");
  assert.match(editor, /<EmployeeProfilesEditor [^\n]*drafts=\{employeeDrafts\} \/>/);
});

test("OWN-07: another employee opens without a question and the draft of the one left stays in the store", () => {
  const employees = employeesComponent();
  const choose = employees.slice(employees.indexOf("const chooseEmployee ="), employees.indexOf("const continueLeave ="));
  assert.ok(choose.length > 0, "chooseEmployee is found");
  assert.ok(!employees.includes("pendingEmployeeId") && !employees.includes("setPendingEmployeeId"), "no question when another employee is picked (D-02 is retired)");
  assert.ok(choose.includes("openEmployee(employee);"), "an employee opens at once");
  assert.ok(!choose.includes("setDraft") && !choose.includes("store.drop") && !choose.includes("store.reset"), "opening another employee never touches a draft");
  assert.ok(employees.includes("store.update(selected,"), "typing writes to the draft of the open employee, by id");
  assert.ok(employees.includes("store.settle(sent, merged,"), "a save answer settles the draft of the employee it was sent for");
  assert.ok(!employees.includes("onDirtyChange(false)"), "leaving the tab does not clear the dirty flag: the drafts live on");
  assert.ok(employees.includes("onDirtyChange(dirtyCount > 0)"), "the dirty flag is the count of employees with edits");
});

test("OWN-07: leaving the tab asks nothing; the one question is asked by the seam when the window closes", () => {
  const code = stripComments(editor);
  assert.equal(code.split("setLeaveTo(").length - 1, 0, "no pending tab switch: the editor never asks when a tab is left");
  assert.ok(!code.includes("leaveTo"), "the pending-tab state is gone");
  assert.ok(code.includes("const switchTab = (id: EditorTab) => showTab(id);"), "a tab opens at once");
  assert.ok(code.includes("const leaving = employeeDirty && closeAsked;"), "the question is for the window close only");
  assert.ok(code.includes('if (closeAsked && employeeDirty && tab !== "employees" && stripTabs.some(([id]) => id === "employees")) showTab("employees");'), "a close with unsaved employee drafts goes to the tab that asks");
  const employees = employeesComponent();
  assert.ok(employees.includes('title="Сохранить изменения?"'));
  for (const label of ["СОХРАНИТЬ ВСЕ", "НЕ СОХРАНЯТЬ", "ОТМЕНА"]) assert.ok(employees.includes(`label: "${label}"`), label);
  assert.ok(employees.includes("{leaving && dirtyCount > 0 && ("), "the question shows only for a close with something unsaved");
});

test("OWN-07: «СОХРАНИТЬ ВСЕ» saves one employee after another through the one PATCH path and stops at the first refusal", () => {
  const employees = employeesComponent();
  const all = employees.slice(employees.indexOf("const saveAll = async"), employees.indexOf("const addEmployee = async"));
  assert.ok(all.length > 0, "saveAll is found");
  assert.ok(all.includes("for (const id of saveQueue(store.dirtyIds(), selectedIdRef.current))"), "the open employee first, then the list order");
  assert.ok(all.includes("if (!(await save(id, true)))"), "each save is awaited before the next starts, through the same save() as the single button");
  assert.ok(!all.includes("Promise.all") && !all.includes("forEach") && !all.includes(".map("), "not in parallel");
  assert.ok(all.includes("return false;") && all.includes("setSelectedId(id);"), "the first refusal stops the run and shows that employee");
  assert.ok(employees.includes("setErrorMessage(named ? `${employee.nickname}: ${text}` : text);"), "the error carries the name of the employee");
  assert.equal(employees.split('fetch("/api/employees", {\n        method: "PATCH"').length - 1, 1, "one PATCH call serves the single and the all-save");
  const dialog = employees.slice(employees.indexOf('title="Сохранить изменения?"'));
  assert.ok(dialog.includes("void saveAll().then((saved) => {") && dialog.includes("if (saved) onLeave(true);") && dialog.includes("else cancelLeave();"), "all saved closes; a refusal keeps the window and the drafts");
  // 26.1 WR-07: «НЕ СОХРАНЯТЬ» answers the employee question only; the drafts are dropped when the editor goes away, so a cancelled outer «Закрыть редактор?» keeps them.
  const leave = employees.slice(employees.indexOf("const continueLeave ="), employees.indexOf("const cancelLeave ="));
  assert.ok(leave.includes("const continueLeave = () => {\n    onLeave(true);"), "«НЕ СОХРАНЯТЬ» lets the close go on");
  assert.ok(!leave.includes("store.reset()"), "and does not drop the drafts before the editor closes");
  const hook = employeesSeam.replace(/\r\n/g, "\n");
  const hookBody = hook.slice(hook.indexOf("export function useEmployeeDraftStore"), hook.indexOf("const emptyDetails"));
  assert.ok(hookBody.length > 0);
  assert.ok(hookBody.includes("store.reset();") && hookBody.indexOf("off();") < hookBody.indexOf("store.reset();"), "the drafts go with the editor (unmount of the hook's owner)");
});

test("OWN-07: an employee with unsaved edits has a dot in the list and a name for a screen reader", () => {
  const employees = employeesComponent();
  assert.ok(employees.includes('<i className="tab-dot" aria-hidden="true" />'), "the same mark as the tab strip");
  assert.ok(employees.includes("aria-label={unsaved ? employeeRowName(employee, true) : undefined}"), "the name of the row says there are unsaved edits");
  assert.ok(employees.includes("{dirtyCount > 1 && <button"), "«СОХРАНИТЬ ВСЕ · N» shows from two drafts");
  assert.ok(employees.includes("`СОХРАНИТЬ ВСЕ · ${dirtyCount}`"));
});

// ---- 26-08 (D-12, D-13): «Повышение» — the branches in the bar's nav slot, the queue and the banks as list/detail ----
// components/portia-promotion-editor-main.tsx is not a part of the portia-editor family (no D-21 hunk guard); it calls the seam directly.

const promotionMain = stripComments(lf(readFileSync(new URL("../components/portia-promotion-editor-main.tsx", import.meta.url), "utf8")));
const promotionCss = lf(readFileSync(new URL("../app/portia-promotion-editor.css", import.meta.url), "utf8"));
const promotionRules = parseRules(promotionCss.replace(/\/\*[\s\S]*?\*\//g, ""));
const DESKTOP = "width > 900px";

/** The JSX of the reviewer workspace from `from` up to `to`. */
function promotionSlice(from: string, to: string) {
  const start = promotionMain.indexOf(from);
  const end = promotionMain.indexOf(to, start + 1);
  assert.ok(start >= 0 && end > start, `${from} … ${to} is found`);
  return promotionMain.slice(start, end);
}

test("D-13b: «Повышение» renders the shared action bar: the branches in the nav slot, the queue message in the status slot, no draft buttons", () => {
  assert.match(promotionMain, /import \{ EditorActionBar \} from "@\/components\/portia-editor-tab-shell";/);
  assert.equal(promotionMain.split("<EditorActionBar").length - 1, 1, "one bar for the whole tab");
  const bar = promotionSlice("<EditorActionBar", "{message && conflict &&");
  assert.ok(bar.includes('<EditorActionBar label="Разделы повышения" nav={<nav className="promotion-editor-branches" aria-label="Разделы повышения">'), "the branch nav is the nav slot, its label is the bar's");
  assert.ok(bar.includes('aria-current={branch === id ? "true" : undefined}'), "the current branch is aria-current");
  assert.ok(!bar.includes("aria-pressed"), "branches are sections, not toggles");
  assert.ok(bar.includes("aria-label={`${label}: ${count}`} onKeyDown={moveButtonTab}"), "the accessible name with its count and the arrow keys stay");
  assert.ok(bar.includes('{label}<span className="tab-count" aria-hidden="true">{count}</span>'), "the count is the house plaque");
  assert.ok(bar.includes("['requests','ЗАПРОСЫ',ordinaryCount + qualificationCount],['tasks','ЗАДАНИЯ',banks.taskBanks.length],['qualification','КВАЛИФИКАЦИЯ',qualificationCount]"), "the same three branches and counts");
  assert.ok(bar.includes('statusText={message} tone={message ? (note.ok ? "saved" : "error") : ""} '), "the queue message is the polite status of the bar; WR-04: a success is not red");
  // 26.1-16 (owner 2026-11-21, item 13): the one thing in the actions slot is the toggle of the live mode; the draft buttons are still not here
  assert.ok(bar.includes('actions={<LiveModeToggle on={live} onToggle={() => setLive((current) => !current)} />} />'), "the live toggle is the only action of the bar");
  for (const gone of ["СОХРАНИТЬ", "ОТМЕНИТЬ", "unsavedCount"]) assert.ok(!bar.includes(gone), `${gone}: no editor draft action on this bar`);
  assert.ok(!promotionMain.includes("promotion-editor-message"), "the old message line is gone");
  assert.doesNotMatch(styles, /\.promotion-editor-message/, "and so is its rule");
  // T-26-16: the closed workspace is returned before the bar is ever drawn.
  const denied = promotionMain.indexOf('if (denied) return <div className="promotion-editor"><div className="empty-state" role="alert"><strong>Доступ закрыт</strong></div></div>;');
  assert.ok(denied > 0 && denied < promotionMain.indexOf("<EditorActionBar"), "the denied state stays first");
});

test("D-12: the request queue is a list/detail body under the filters; a phone keeps the queue-or-detail switch", () => {
  const requests = promotionSlice('{branch === "requests" ? <>', "{confirm && <PromotionConfirmDialog");
  const toolbar = requests.indexOf('<div className="promotion-requests-toolbar">');
  const workbench = requests.indexOf('<div className="promotion-editor-workbench etab-body">');
  assert.ok(toolbar > 0 && workbench > toolbar, "the filters and the device reset stay above the workbench");
  assert.ok(requests.includes('<div className="promotion-queue-filters" role="group" aria-label="Типы запросов">'), "the filters are a group");
  assert.ok(requests.includes('{(!isPhone || requestView === "queue") && <aside className="promotion-request-list etab-list">'), "the list pane");
  assert.ok(requests.includes('{(!isPhone || requestView === "detail") && <article className="promotion-request-detail etab-detail">'), "the detail pane");
  assert.ok(requests.includes("← НАЗАД К ЗАПРОСАМ"), "the phone back button stays");
});

test("D-12/D-13: «Повышение» styles — the bar flush on top, the branches flush in the nav, the request list 280px on a PC", () => {
  assert.equal(declaredIn(promotionRules, ".etab-nav > .promotion-editor-branches", "margin"), "0");
  assert.equal(declaredIn(promotionRules, ".promotion-editor-branches .tab-count", "margin-left"), "0", "the button gap spaces the plaque");
  assert.equal(declaredIn(promotionRules, ".promotion-editor:has(> .etab-bar)", "padding-top", DESKTOP), "0", "sticky counts from the inner edge, so the bar lies on it");
  assert.equal(declaredIn(promotionRules, ".promotion-editor:has(> .etab-bar)", "overflow", PHONE), "clip", "the page scrolls on a phone and the bar sticks under the system bar");
  assert.equal(declaredIn(promotionRules, ".promotion-editor-workbench.etab-body", "grid-template-columns", DESKTOP), "280px minmax(0, 1fr)");
  for (const selector of [".promotion-editor-branches button", ".promotion-queue-filters button"]) {
    for (const context of [undefined, PHONE]) {
      for (const list of [rules, promotionRules]) assert.doesNotMatch(declaredIn(list, selector, "flex", context) ?? "", /^[1-9]/, `${selector}: as wide as its label`);
    }
  }
});

test("D-12: the banks are list/detail with the same 280px list on a PC; the workflow tabs are as wide as their labels; a phone is unchanged", () => {
  assert.equal(declaredIn(promotionRules, ".promotion-bank-workflow .promotion-bank-layout.etab-body", "grid-template-columns", DESKTOP), "280px minmax(0, 1fr)");
  assert.equal(declaredIn(promotionRules, ".promotion-bank-workflow .promotion-bank-layout", "grid-template-columns"), undefined, "the old 180–230px list column is gone");
  for (const context of [undefined, PHONE]) {
    for (const list of [rules, promotionRules]) {
      for (const property of ["flex", "flex-grow"]) {
        assert.doesNotMatch(declaredIn(list, ".promotion-bank-workflow-tabs button", property, context) ?? "", /^[1-9]/, `workflow tabs ${property} ${context ?? ""}`);
      }
      assert.doesNotMatch(declaredIn(list, ".promotion-bank-workflow-tabs button", "width", context) ?? "", /^100%/);
    }
  }
  // The phone keeps the sequential view: the bodies are blocks and the old list or detail steps decide what shows.
  assert.equal(declaredIn(promotionRules, ".promotion-editor-workbench", "display", PHONE), "block");
  assert.equal(declaredIn(promotionRules, ".promotion-bank-workflow .promotion-bank-layout", "display", PHONE), "block");
});

// ---- quick 261117-bi1 (R2): «Отзыв привязки по нику» stands in the bar's strip next to the three branches on a PC ----

test("261117-bi1 R2: the device-reset form is defined once, stands in the branch strip on a PC and in the request toolbar on a phone", () => {
  assert.equal(promotionMain.split('className="promotion-device-reset"').length - 1, 1, "one form definition, two placements");
  assert.ok(promotionMain.includes('{canManageEditors && <form className="promotion-device-reset"'), "the owner-only guard stays on the form itself");
  const bar = promotionSlice("<EditorActionBar", "{message && conflict &&");
  const mapEnd = bar.indexOf("</button>)}");
  assert.ok(mapEnd > 0, "the branch buttons are mapped");
  assert.ok(bar.slice(mapEnd).includes("{!isPhone && deviceReset}</nav>"), "on a PC the form follows the three branch buttons in the strip");
  const toolbar = promotionSlice('<div className="promotion-requests-toolbar">', '<div className="promotion-editor-workbench etab-body">');
  assert.ok(toolbar.includes("{isPhone && deviceReset}"), "on a phone the form keeps its place in the request toolbar");
  assert.ok(toolbar.indexOf("{isPhone && deviceReset}") > toolbar.indexOf("promotion-queue-filters"), "after the filters, as before");
  for (const text of ['<span className="sr-only">Точный ник для отзыва привязки</span>', 'placeholder="Ник для сброса привязки"', "disabled={!resetNickname.trim()}>СБРОСИТЬ ПРИВЯЗКУ</button>", "maxLength={64}", 'confirmLabel: "Сбросить привязку", cancelLabel: "Не сбрасывать", run: () => void resetDevice(key)']) {
    assert.equal(promotionMain.split(text).length - 1, 1, `${text}: unchanged, once`);
  }
});

test("261117-bi1 R2: the form in the strip is inline and frameless, wraps to a second line of the strip on a narrow window", () => {
  const form = ".promotion-editor-branches > .promotion-device-reset";
  assert.equal(declaredIn(promotionRules, form, "margin", DESKTOP), "0 0 0 auto");
  assert.equal(declaredIn(promotionRules, form, "padding", DESKTOP), "0");
  assert.equal(declaredIn(promotionRules, form, "border", DESKTOP), "0");
  assert.equal(declaredIn(promotionRules, form, "flex", DESKTOP), "none");
  assert.equal(declaredIn(promotionRules, `${form} label`, "display", DESKTOP), "flex");
  assert.equal(declaredIn(promotionRules, `${form} label`, "align-items", DESKTOP), "center");
  assert.equal(declaredIn(promotionRules, ".promotion-editor-branches:has(> .promotion-device-reset)", "flex-wrap", DESKTOP), "wrap", "a narrow window wraps the form instead of hiding it in a scroll");
});

test("261117-bi1 R2 fix: in the strip the form is one compact row, centred on the branch buttons (owner screenshot 2026-11-17)", () => {
  const form = ".promotion-editor-branches > .promotion-device-reset";
  assert.equal(declaredIn(promotionRules, form, "align-self", DESKTOP), "center", "centred on the 40px branch buttons, not dropped to the bottom");
  assert.equal(declaredIn(promotionRules, form, "align-items", DESKTOP), "center");
  assert.equal(declaredIn(promotionRules, `${form} input`, "width", DESKTOP), "180px", "the field carries its own hint, so it can be short");
  assert.equal(declaredIn(promotionRules, `${form} input`, "min-height", DESKTOP), "40px", "same height as the branch buttons");
  assert.equal(declaredIn(promotionRules, `${form} button`, "min-height", DESKTOP), "40px");
});

// ---- 26-09 (D-12, D-11 step 4): «Пользователи» on a PC — the sections in the bar's nav slot, the rows on the left, the detail on the right ----
// components/portia-users-tab.tsx is not a part of the portia-editor family; it calls the seam directly. A phone keeps the Phase 22 markup.

const usersTab = stripComments(lf(readFileSync(new URL("../components/portia-users-tab.tsx", import.meta.url), "utf8")));

/** The JSX of the users tab from `from` up to `to`. */
function usersSlice(from: string, to: string) {
  const start = usersTab.indexOf(from);
  const end = usersTab.indexOf(to, start + 1);
  assert.ok(start >= 0 && end > start, `${from} … ${to} is found`);
  return usersTab.slice(start, end);
}

test("D-13b: «Пользователи» on a PC renders the shared action bar: three sections in the nav slot, «Ожидают: N», the owner's bulk approval", () => {
  assert.match(usersTab, /import \{ EditorActionBar, EditorDraftBar, EditorEmptyDetail, EditorTabBody \} from "@\/components\/portia-editor-tab-shell";/);
  assert.equal(usersTab.split("<EditorActionBar").length - 1, 1, "one bar for the whole tab");
  assert.ok(usersTab.includes("{!isPhone ? <EditorActionBar"), "the bar is drawn on a PC only; a phone keeps the action window (WR-01: and the draft bar, if the draft is unsaved)");
  const bar = usersSlice("<EditorActionBar", "/> : <EditorDraftBar banner={staleBanner} />}");
  assert.ok(bar.includes('label={usersCopy.sectionsLabel}'), "the bar's label lives in users-copy");
  assert.ok(bar.includes('nav={<nav className="users-sections" aria-label={usersCopy.sectionsLabel}>'), "the section nav is the nav slot");
  assert.ok(bar.includes("{USERS_SECTIONS.map((kind) => ("), "the three sections in their order");
  assert.ok(bar.includes('aria-current={activeSection === kind ? "true" : undefined}'), "the current section is aria-current");
  assert.ok(bar.includes("data-users-tab={kind}"), "the nav button of a section can be found to take the focus");
  assert.ok(bar.includes("{usersCopy.sectionTab(usersCopy.sectionTitles[kind], list[kind].total)}"), "«Заявки · N», «Люди · N», «Отклонённые и отозванные · N»");
  assert.ok(bar.includes("statusText={usersCopy.pendingStatus(list.pendingTotalAll)}"), "the status is «Ожидают: N»");
  assert.ok(bar.includes('actions={callerIsOwner && ownerBulk.visible ? <button type="button" className="primary-control" disabled={ownerBulk.disabled || bulkLoading} onClick={() => void openBulk()}>{usersCopy.bulkButton}</button> : undefined}'), "the owner's bulk approval is the primary action, same conditions");
  for (const gone of ["СОХРАНИТЬ", "ОТМЕНИТЬ", "unsavedCount", "aria-pressed"]) assert.ok(!bar.includes(gone), `${gone}: no draft action on this bar`);
  assert.ok(usersTab.includes('const USERS_SECTIONS = ["pending", "people", "closed"] as const;'), "the sections and their order");
});

test("D-12: «Пользователи» on a PC is a list/detail body: the rows of the active section, the detail or the empty detail", () => {
  const body = usersSlice("<EditorTabBody", "{dialogContext ?");
  assert.ok(body.includes("list={<div className=\"users-pane\" data-users-section={activeSection}>"), "the list pane holds the active section");
  assert.ok(body.includes("<UsersRows rows={activeView.rows} section={activeSection} isPhone={false}"), "the rows of the active section");
  assert.ok(body.includes("detail={selectedContext ? <UsersActionBody key={selectedContext.row.key}"), "the picked row opens in the detail");
  assert.ok(body.includes(": <EditorEmptyDetail title={usersCopy.detailEmptyTitle} lines={[usersCopy.detailEmptyHint]} />}"), "nothing picked: the empty detail");
  // A phone keeps the Phase 22 sections and the closed details block.
  const phone = usersSlice("{isPhone ? (", "<EditorTabBody");
  for (const kept of ['<section data-users-section="pending"', '<section data-users-section="people"', '<details className="users-closed" data-users-section="closed">']) assert.ok(phone.includes(kept), kept);
});

test("D-12: «Пользователи» styles — the bar lies on the top edge on a PC; the picked row has the shared selected look", () => {
  assert.equal(declared(".content-editor:has(> .users-tab > .etab-bar)", "padding-top", DESKTOP), "0", "sticky counts from the inner edge");
  assert.equal(declared(".content-editor:has(> .users-tab > .etab-bar) > .editor-header", "margin-top", DESKTOP), "28px");
  assert.equal(declared(".etab-nav > .users-sections", "margin"), "0");
  assert.match(styles, /\.editor-section-tabs nav button\[aria-current="true"\], \.users-sections button\[aria-current="true"\]/, "the current section has the tab family's 3px line");
  assert.equal(declared(".users-pick-row", "width"), "100%", "the row button fills its row");
  assert.equal(declared('.users-row:has(> .users-pick-row[aria-current="true"])', "background"), "var(--teal-soft)");
  assert.equal(declared('.users-row:has(> .users-pick-row[aria-current="true"])', "border-color"), "var(--teal-dim)");
});

// ---- 26.1-08 (OWN-09): hold to drag, no drawn handle ----

const dossierCode = stripComments(dossierSeam);
const handleSource = (() => {
  const start = dossierCode.indexOf("let dragHandoff");
  const end = dossierCode.indexOf("export function ArchivedVirusEditor(");
  assert.ok(start >= 0 && end > start, "OrderDragHandle is found in the dossier seam");
  return dossierCode.slice(start, end);
})();

test("OWN-09: the row itself is held to drag: the hold model, the zone of the row, a lifted marker, no timer of 170 ms on the button", () => {
  assert.match(dossierSeam, /import \{[^}]*\bHOLD_MS\b[^}]*\bholdStep\b[^}]*\} from "@\/lib\/hold-gesture"/, "the seam uses the pure model");
  assert.ok(handleSource.includes("holdStep("), "the gesture advances through holdStep");
  assert.ok(handleSource.includes("holdTargetAllowed("), "a field, a link or an action button never starts a hold");
  assert.ok(handleSource.includes('closest<HTMLElement>("[data-sort-index]")'), "the row is the element that is held");
  assert.ok(handleSource.includes('querySelector<HTMLElement>(":scope > .nested-editor-head")'), "a card is held by its head");
  assert.ok(handleSource.includes('zone.addEventListener("pointerdown"'), "the press is listened to on the zone of the row");
  assert.ok(!/onPointerDown/.test(handleSource), "the button no longer starts the gesture");
  assert.ok(!handleSource.includes(", 170)"), "the 170 ms wait on the handle is replaced by HOLD_MS");
  assert.ok(handleSource.includes("HOLD_MS"), "the wait is HOLD_MS");
  assert.ok(handleSource.includes('row.dataset.lifted = "true"') && handleSource.includes("delete row.dataset.lifted"), "the row is marked lifted while it is dragged");
  assert.ok(handleSource.includes('button.current.dataset.dragging = "true"') && handleSource.includes("dataset.dragId"), "one drag is still one undo step: the button carries data-dragging and data-drag-id (editKeyFor)");
});

test("OWN-09: the click after a drag is swallowed once, the page does not scroll or select while the element is lifted", () => {
  assert.ok(/addEventListener\("click", [a-zA-Z]+, \{ capture: true \}\)/.test(handleSource), "a one-shot click listener in the capture phase");
  assert.ok(handleSource.includes("suppressClick"), "the model says when the click is swallowed");
  assert.ok(handleSource.includes('"touchmove"') && handleSource.includes("passive: false"), "a non-passive touchmove stops the page scroll once lifted");
  assert.ok(handleSource.includes('"selectstart"'), "no text selection while dragging");
  // 26.1 WR-05: the browser decides at touchstart whether the touch can be cancelled, so a standing non-passive listener sits on the zone from mount and
  // refuses the scroll only while the hold is lifted; the one added at the lift stays as a second line.
  assert.ok(handleSource.includes('zone.addEventListener("touchmove", refuseScrollWhileLifted, { passive: false })'), "a standing non-passive touchmove on the zone");
  assert.ok(handleSource.includes('zone.removeEventListener("touchmove", refuseScrollWhileLifted)'), "removed with the effect");
  assert.ok(handleSource.includes('hold.current.phase === "lifted" && event.cancelable'), "it refuses only while lifted");
  assert.ok(handleSource.indexOf("refuseScrollWhileLifted, { passive: false }") < handleSource.indexOf('zone.addEventListener("pointerdown"'), "registered with the effect, before any press");
});

test("OWN-09: the order button stays for the keyboard: label, arrows, the ≡ only inside the plaque", () => {
  assert.ok(handleSource.includes("aria-label={`Изменить порядок: ${label}`}"));
  assert.ok(handleSource.includes('className="order-drag-handle"'));
  assert.ok(handleSource.includes('aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"'), "left and right are synonyms of up and down (tabs and columns read sideways)");
  assert.ok(!handleSource.includes("title="), "no tooltip (D-18)");
  assert.ok(dossierSeam.includes("owner 2026-11-20 (OWN-09): the row itself is held to drag; the button is the keyboard and screen reader way"), "the seam says why");
});

test("OWN-09: the handle is invisible, the lifted element is visible", () => {
  assert.equal(declared("button.order-drag-handle", "position"), "absolute");
  assert.equal(declared("button.order-drag-handle", "width"), "1px");
  assert.equal(declared("button.order-drag-handle", "height"), "1px");
  assert.equal(declared("button.order-drag-handle", "overflow"), "hidden");
  assert.equal(declared("button.order-drag-handle", "clip-path"), "inset(50%)");
  assert.equal(declared(".order-drag-handle:focus-visible", "clip-path"), "none", "a plaque when the keyboard is on it");
  assert.equal(declared(".order-drag-handle:focus-visible", "width"), "24px");
  assert.equal(declared(".order-drag-handle:focus-visible", "height"), "24px");
  const lifted = '[data-sort-index][data-lifted="true"]';
  assert.equal(declared(lifted, "z-index"), "5");
  assert.equal(declared(lifted, "cursor"), "grabbing");
  assert.match(declared(lifted, "box-shadow") ?? "", /^0 10px 24px/, "the shadow is always there");
  assert.equal(declared(lifted, "translate"), undefined, "the rise is not in the plain rule: reduced and off keep only the shadow");
  assert.equal(declared(`html[data-motion="full"] ${lifted}`, "translate"), "0 -2px");
  assert.equal(declared(`html[data-motion="full"] ${lifted}`, "scale"), "1.015");
  assert.equal(declared(lifted, "user-select"), "none");
});

test("OWN-09: the grids that kept a column for the handle give it up", () => {
  assert.equal(declared(".editor-record-row", "grid-template-columns"), "minmax(0, 1fr)");
  assert.equal(declared(".info-table-row", "grid-template-columns"), "minmax(0, 1fr) minmax(0, 1fr) auto");
  assert.equal(declared(".info-table-head", "grid-template-columns"), "minmax(0, 1fr) minmax(0, 1fr) auto");
  assert.equal(declared(".info-table-row", "grid-template-columns", PHONE), "minmax(0, 1fr)");
  assert.equal(declared(".recommendation-order-row", "grid-template-columns", PHONE), "minmax(0, 1fr)");
});

test("OWN-09: arrows on the order button: ↑ and ← one step back, ↓ and → one step on, the button keeps the focus", () => {
  assert.ok(handleSource.includes('event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : 0'));
  assert.ok(handleSource.includes("onMove(index, index + step)"));
  assert.ok(editor.includes("keepSectionHandleFocus"), "the editor still returns the focus to the button after a keyboard move");
});

test("OWN-09: where a hold may start: the head of a card, the whole row of a list or a table; never a field, a link, the action buttons or the delete button", () => {
  assert.ok(handleSource.includes('element.closest("input, textarea, select, a")'), "fields and links");
  assert.ok(handleSource.includes('element.closest(".nested-editor-actions, .info-table-row > button, .live-tools")'), "the actions of a card, the delete button of a table row and the tools of the live mode (26.1-10)");
  assert.ok(handleSource.includes("nested !== null && nested !== row"), "a nested row belongs to its own handle");
  assert.ok(handleSource.includes("isContentEditable"), "editable text");
});

test("OWN-09: on a mouse the hold zones show a grab hand, fields keep their own cursor; a lifted element shows grabbing everywhere inside", () => {
  const MOUSE = "hover: hover";
  assert.equal(declared(".editor-section-tabs nav > .editor-section-tab > button:not(.order-drag-handle)", "cursor", MOUSE), "grab");
  assert.equal(declared("[data-sort-index] > .nested-editor-head", "cursor", MOUSE), "grab");
  assert.equal(declared("[data-sort-index] > .nested-editor-head > .nested-editor-toggle", "cursor", MOUSE), "grab");
  assert.equal(declared(".editor-record-row[data-sort-index] > button:not(.order-drag-handle)", "cursor", MOUSE), "grab");
  assert.equal(declared(".info-table-row[data-sort-index]", "cursor", MOUSE), "grab");
  assert.equal(declared(".info-table-head > [data-column]", "cursor", MOUSE), "grab");
  assert.equal(declared(".info-table-row input", "cursor", MOUSE), undefined, "a field in a table row keeps the text cursor");
  assert.match(declared('[data-sort-index][data-lifted="true"] *', "cursor") ?? "", /^grabbing/);
  // The touch-action of a card head is not changed: a finger scrolls the page until the element is lifted.
  assert.equal(declared(".nested-editor-head", "touch-action"), undefined);
  assert.equal(declared("[data-sort-index] > .nested-editor-head", "touch-action"), undefined);
});

test("OWN-09: the e2e drag holds the head of the card 450 ms and no longer grabs the handle", () => {
  const spec = lf(readFileSync(new URL("../tests/e2e/specs/editor-layout.spec.ts", import.meta.url), "utf8"));
  assert.ok(!spec.includes("nested-editor-head .order-drag-handle"), "no helper drags by the handle");
  assert.ok(spec.includes("button.nested-editor-toggle"), "the head of the card is the thing held");
  assert.ok(spec.includes("waitForTimeout(450)"), "the hold lasts longer than 400 ms");
  assert.ok(spec.includes('toHaveAttribute("data-lifted", "true")'), "the lifted card is checked before the move");
});

test("OWN-09: ColumnSwapHandle lives in the dossier seam, is held by the header cell and keeps the arrows; the editor only imports it", () => {
  const start = dossierCode.indexOf("export function ColumnSwapHandle(");
  assert.ok(start >= 0, "exported from the seam");
  const swap = dossierCode.slice(start, dossierCode.indexOf("export function ", start + 10) >= 0 ? dossierCode.indexOf("export function ", start + 10) : undefined);
  assert.ok(!editor.includes("function ColumnSwapHandle"), "no copy in the protected editor file (D-21)");
  assert.match(editor, /import \{[^}]*\bColumnSwapHandle\b[^}]*\} from "@\/components\/portia-editor-dossier";/, "the editor imports it from the seam");
  assert.equal(editor.split("<ColumnSwapHandle ").length - 1, 2, "the two calls in TableBlockEditor stay");
  assert.ok(swap.includes("holdStep("), "the header is held through the same model");
  assert.ok(swap.includes('closest<HTMLElement>("[data-column]")'), "the header cell is the zone and the thing that is lifted");
  assert.ok(swap.includes('cell.addEventListener("pointerdown"'));
  assert.ok(swap.includes('cell.dataset.lifted = "true"') && swap.includes("delete cell.dataset.lifted"));
  assert.ok(swap.includes('dataset.dragging = "column"'), "'column', not 'true': editKeyFor folds only row drags, a swap is one change on drop");
  assert.ok(swap.includes("onSwapRef.current()"), "a drop on the other header swaps");
  assert.ok(swap.includes("Переставить столбец «${label}»") && swap.includes('aria-keyshortcuts="ArrowLeft ArrowRight"'), "the name and the arrows are as before");
  assert.ok(swap.includes('event.key !== "ArrowLeft" && event.key !== "ArrowRight"'));
  assert.ok(swap.includes("owner 2026-11-20 (OWN-09)") || dossierSeam.includes("Two table columns swap"), "the comment moved with the function");
  assert.ok(!swap.includes("title="), "no tooltip (D-18)");
});

test("OWN-09: a lifted column header looks lifted too", () => {
  const lifted = '.info-table-head > [data-column][data-lifted="true"]';
  assert.equal(declared(lifted, "z-index"), "5");
  assert.equal(declared(lifted, "cursor"), "grabbing");
  assert.match(declared(lifted, "box-shadow") ?? "", /^0 10px 24px/);
  assert.equal(declared(lifted, "translate"), undefined);
  assert.equal(declared(`html[data-motion="full"] ${lifted}`, "translate"), "0 -2px");
  assert.match(declared(`${lifted} *`, "cursor") ?? "", /^grabbing/);
});

// ---- 26.1-15 (OWN-09, owner 2026-11-20 after 26.1-08): «нельзя переносить, хотя появляется курсор захвата» ----
// Root cause: a mouse press that is dragged at once drifts past 6 px long before the 400 ms of the hold, the model cancelled it, and the open hand was shown all the time.

const swapSource = (() => {
  const start = dossierCode.indexOf("export function ColumnSwapHandle(");
  assert.ok(start >= 0, "ColumnSwapHandle is found in the dossier seam");
  return dossierCode.slice(start);
})();

test("OWN-09 (26.1-15): both gestures tell the model which pointer pressed, so a mouse lifts by moving and a finger by holding", () => {
  assert.ok(handleSource.includes("pointerType: event.pointerType"), "OrderDragHandle passes the kind of pointer on the press");
  assert.ok(swapSource.includes("pointerType: event.pointerType"), "ColumnSwapHandle passes the kind of pointer on the press");
  assert.ok(handleSource.includes("pressed: event.buttons !== 0") && swapSource.includes("pressed: event.buttons !== 0"), "a missed release (button up, no pointerup) ends the press instead of dragging with no button down");
});

test("OWN-09 (26.1-15): the tracker follows the pointer after the lift whether or not the hold timer is still set (it is cleared at the lift)", () => {
  assert.ok(!/holdTimer\.current === null\) return/.test(handleSource), "OrderDragHandle: the tracker does not stop when the lift timer is cleared");
  assert.ok(!/timer === null\) return/.test(swapSource), "ColumnSwapHandle: the tracker does not stop when the lift timer is cleared");
  assert.ok(handleSource.includes('hold.current.phase === "idle"'), "OrderDragHandle: the tracker is gated by the phase of the hold");
  assert.ok(swapSource.includes('state.phase === "idle"'), "ColumnSwapHandle: the tracker is gated by the phase of the hold");
  assert.ok(handleSource.includes("liftPressed()") && /const liftPressed = \(\) => \{[^}]*window\.clearTimeout\(holdTimer\.current\)/.test(handleSource), "a lift by a move cancels the 400 ms timer, so it cannot fire a second lift");
});

test("OWN-09 (26.1-15): a lift by a move starts following the pointer in the same event", () => {
  const track = handleSource.slice(handleSource.indexOf("const onTrack"));
  assert.ok(track.indexOf("liftPressed()") >= 0 && track.indexOf("liftPressed()") < track.indexOf("if (active.current) moveTo("), "lift first, then the swap under the pointer, in one move event");
});

test("OWN-09 (26.1-15): the e2e spec has the second gesture, press and drag at once, next to the 450 ms hold", () => {
  const spec = lf(readFileSync(new URL("../tests/e2e/specs/editor-layout.spec.ts", import.meta.url), "utf8"));
  assert.ok(spec.includes("press and drag at once"), "a test named for the immediate drag");
  assert.ok(spec.includes("// OWN-09 (26.1-15): no pause between the press and the move"), "the drag begins right after the press: no waitForTimeout between down and move");
});

test("OWN-09 (26.1-15): a row with nowhere to go (the selected card under its tab strip) is marked, shows no open hand and starts no hold", () => {
  assert.match(dossierSeam, /import \{[^}]*\bhasPlaceToGo\b[^}]*\} from "@\/lib\/hold-gesture"/, "the seam uses the pure rule");
  assert.equal(handleSource.split("hasPlaceToGo(").length - 1, 1, "one call: the helper that counts the places");
  assert.ok(handleSource.split("movable(").length - 1 >= 3, "the helper is used by the press and by the marker");
  assert.ok(handleSource.includes('row.dataset.sortAlone = "true"') && handleSource.includes("delete row.dataset.sortAlone"), "the row is marked while it is alone");
  assert.ok(handleSource.includes("|| !movable()) return;"), "a lone row never starts a hold");
  const MOUSE = "hover: hover";
  assert.equal(declared("[data-sort-index][data-sort-alone] > .nested-editor-head", "cursor", MOUSE), "auto");
  assert.equal(declared("[data-sort-index][data-sort-alone] > .nested-editor-head > .nested-editor-toggle", "cursor", MOUSE), "pointer");
  assert.equal(declared(".editor-section-tabs nav > [data-sort-alone] > button:not(.order-drag-handle)", "cursor", MOUSE), "pointer");
  assert.equal(declared(".editor-card-tabs nav > .editor-card-tab[data-sort-alone] > button:not(.order-drag-handle)", "cursor", MOUSE), "pointer");
  assert.equal(declared(".editor-record-row[data-sort-alone] > button:not(.order-drag-handle)", "cursor", MOUSE), "pointer");
  assert.equal(declared(".info-table-row[data-sort-alone]", "cursor", MOUSE), "auto");
});

// 26.1-09 (OWN-10): the cards of a section are tabs, like the sections; the strip and its selection live in a seam (D-21), the editor only calls it.
const cardTabsSeam = family.find((part) => part.file === "portia-editor-card-tabs.tsx")?.text ?? "";
const cardTabsCode = stripComments(cardTabsSeam);

test("owner 2026-11-20 OWN-10: the card tab strip is a seam: tabs of the same markup as the section tabs, the order button only with onMove, the selection by the pure rule", () => {
  assert.ok(cardTabsSeam, "components/portia-editor-card-tabs.tsx exists and belongs to the portia-editor family");
  assert.match(cardTabsSeam, /^"use client";/);
  assert.match(cardTabsCode, /export function CardTabs\(/);
  assert.match(cardTabsCode, /export function useCardTabSelection\(/);
  assert.match(cardTabsCode, /export const cardTabsCopy = \{/);
  assert.ok(cardTabsCode.includes('<div className="editor-card-tabs">') && cardTabsCode.includes("<nav aria-label={label} ref={navRef}>"), "div.editor-card-tabs > nav[aria-label]");
  assert.ok(cardTabsCode.includes('className="editor-card-tab"'), "one span per tab");
  assert.ok(cardTabsCode.includes('aria-current={item.id === activeId ? "true" : undefined}'), "the selected tab is aria-current");
  assert.ok(cardTabsCode.includes("{onMove && <OrderDragHandle index={index} label={item.title || cardTabsCopy.item} onMove={onMove} />}"), "the order button only when the tabs can move");
  assert.ok(cardTabsCode.includes("data-sort-index={onMove ? index : undefined}"), "a tab that cannot move is no sort row");
  assert.ok(cardTabsCode.includes("item.title || cardTabsCopy.untitled"), "an empty title reads «Без названия»");
  assert.ok(cardTabsCode.includes("if (items.length === 0 && !add) return null;"), "no strip without cards (26.1-20: unless the strip carries the add action)");
  assert.match(cardTabsCode, /import \{ resolveCardTab[^}]*\} from "@\/lib\/card-tab-selection"/, "the choice is the pure rule");
  assert.ok(cardTabsCode.includes("getBoundingClientRect") && !cardTabsCode.includes("scrollIntoView"), "only the strip scrolls sideways, the page does not jump");
  assert.doesNotMatch(cardTabsCode, /dangerouslySetInnerHTML|title=\{/, "T-26.1-19: titles are text through React, no tooltip (D-18)");
});

test("owner 2026-11-20 OWN-10: guide cards are tabs: the strip before the list, only the selected card under it, a new card and a jump from the contents select it", () => {
  assert.match(editor, /import \{ CardTabs, cardTabsCopy, useCardTabSelection \} from "@\/components\/portia-editor-card-tabs";/);
  assert.ok(editor.includes("  const cardTabs = useCardTabSelection();\n"), "the selection is kept in the editor");
  const guide = editorSlice('{tab === "guide" && (', '{tab === "recycle"');
  const strip = guide.indexOf("<CardTabs label={cardTabsCopy.cards}");
  const list = guide.indexOf('<div className="info-subsection-list" data-sort-group="guide-cards"');
  assert.ok(strip > 0 && list > strip, "the strip stands before the list of cards");
  const stripText = guide.slice(strip, list);
  assert.ok(stripText.includes("items={section.cards.map((card) => ({ id: card.id, title: card.title }))}"), "the titles go as data");
  assert.ok(stripText.includes("activeId={cardTabs.active(section.id, section.cards.map((card) => card.id))}"));
  assert.ok(stripText.includes("moveArrayItem(target.cards, from, to)"), "a tab is moved among the cards of the section");
  assert.ok(guide.includes("section.cards.map((card, cardIndex) => card.id === cardTabs.active(section.id, section.cards.map((item) => item.id)) && ("), "only the selected card is drawn");
  assert.ok(stripText.includes("cardTabs.select(section.id, id)") && stripText.includes("setOpen([id], true)"), "a click selects and opens the card");
  assert.ok(editor.includes("if (found?.card) cardTabs.select(found.section.id, id);"), "a jump from the contents selects the tab");
  assert.ok(!editor.includes('"Карточки раздела"'), "D-58: the strip's name lives in the seam");
});

test("T-26.1-20: leaving a card by its tab closes the format panel for the fields of the section's cards; the draft is shared, hiding only stops drawing", () => {
  const guide = editorSlice('{tab === "guide" && (', '{tab === "recycle"');
  const strip = guide.slice(guide.indexOf("<CardTabs label={cardTabsCopy.cards}"), guide.indexOf('<div className="info-subsection-list" data-sort-group="guide-cards"'));
  assert.ok(strip.includes("closeFormatterFor(...section.cards.flatMap((card) => card.blocks.map((block) => portiaTextKey.guideBlock(block.id))))"));
  assert.ok(strip.indexOf("closeFormatterFor(") < strip.indexOf("cardTabs.select("), "the panel closes before the other card shows");
});

test("OWN-10: the card tab strip is one row that scrolls sideways, the current tab is accent-coloured, a phone tab has the tap target; the order button stays hidden", () => {
  assert.equal(declared(".editor-card-tabs nav", "overflow-x"), "auto");
  assert.equal(declared(".editor-card-tabs nav", "flex-wrap"), "nowrap");
  assert.equal(declared(".editor-card-tabs nav button:not(.order-drag-handle)", "min-height"), "32px");
  assert.equal(declared(".editor-card-tabs nav button:not(.order-drag-handle)", "min-height", PHONE), "var(--tap-target)");
  assert.equal(declared('.editor-card-tabs nav button[aria-current="true"]', "color"), "var(--teal)");
  assert.match(declared('.editor-card-tabs nav button[aria-current="true"]', "box-shadow") ?? "", /var\(--teal\)/);
  assert.ok(!rules.some((rule) => rule.selectors.some((selector) => selector.startsWith(".editor-card-tabs") && /(^|[ >])button(\[|$)/.test(selector) && !selector.includes(":not(.order-drag-handle)") && !selector.includes("[aria-current")) ), "no rule resizes every button of the strip, the order button included");
  assert.ok(styles.indexOf(".editor-card-tabs nav") < styles.indexOf("/* ui-unify:start"), "the block of ui-unify stays the last");
  assert.ok(styles.trimEnd().endsWith("/* ui-unify:end */"));
  assert.ok(styles.includes(".editor-card-tabs nav > .editor-card-tab[data-sort-index] > button:not(.order-drag-handle)"), "a movable tab shows the open hand on a mouse");
});

test("owner 2026-11-20 OWN-10: the subsections of an «Информация» section are tabs: the strip before the list, only the selected one under it, a jump from the contents selects it", () => {
  const info = editorSlice('{tab === "info" && (', '{tab === "guide" && (');
  const strip = info.indexOf("<CardTabs label={cardTabsCopy.subsections}");
  const list = info.indexOf('<div className="info-subsection-list">');
  assert.ok(strip > 0 && list > strip, "the strip stands before the list of subsections");
  const stripText = info.slice(strip, list);
  assert.ok(stripText.includes("items={section.subsections.map((subsection) => ({ id: subsection.id, title: subsection.title }))}"), "the titles go as data");
  assert.ok(stripText.includes("moveArrayItem(target.subsections, from, to)"), "a tab is moved among the subsections of the section");
  assert.ok(stripText.includes("closeFormatterFor(...section.subsections.flatMap((sub) => sub.blocks.map((block) => portiaTextKey.infoBlock(block.id))))"), "T-26.1-20: the panel closes before another subsection shows");
  assert.ok(info.includes("subsection.id === cardTabs.active(section.id, section.subsections.map((item) => item.id)) && ("), "only the selected subsection is drawn");
  assert.ok(editor.includes("if (found?.subsection) cardTabs.select(found.section.id, id);"), "a jump from the contents selects the tab");
  assert.ok(!editor.includes('"Подразделы"'), "D-58: the strip's name lives in the seam");
});

// Mutations have no id (their texts are bound to the number), so their tabs only switch; scientist records are tabs by id. A selected tab is the only card drawn.
test("owner 2026-11-20 OWN-10: the mutations and the scientist records of a virus are tabs; the mutation tabs have no order button, the panel closes on a switch", () => {
  const virus = editorSlice('{dossierTab === "mutations" && <EditorGroup title="Мутации" stack>', '{tab === "info" && (');
  const mutations = virus.slice(virus.indexOf("<CardTabs label={cardTabsCopy.mutations}"), virus.indexOf("\n                {selectedVirus.mutations.map("));
  assert.ok(mutations.length > 0 && mutations.includes("items={selectedVirus.mutations.map((mutation, index) => ({ id: String(index), title: mutation.name }))}"), "a mutation tab is its number, its title is the name");
  assert.ok(!mutations.includes("onMove"), "no order for mutations: the texts are bound to the number");
  assert.ok(mutations.includes("setFormatTarget(null); setFormatterOpen(false); cardTabs.select(`${selectedVirus.id}:mutations`, id);"), "T-26.1-20: the panel closes before another mutation shows");
  assert.ok(virus.includes("{selectedVirus.mutations.map((mutation, index) => String(index) === cardTabs.active(`${selectedVirus.id}:mutations`, Object.keys(selectedVirus.mutations)) && ("), "only the selected mutation is drawn");
  const logs = virus.slice(virus.indexOf("<CardTabs label={cardTabsCopy.logs}"), virus.indexOf("\n                {selectedVirus.scientistLogs.map("));
  assert.ok(logs.includes("items={selectedVirus.scientistLogs.map((log) => ({ id: log.id, title: log.title }))}") && !logs.includes("onMove"), "a record tab is its id; the records have no order either");
  assert.ok(logs.includes("setFormatTarget(null); setFormatterOpen(false); cardTabs.select(`${selectedVirus.id}:logs`, id);"));
  assert.ok(virus.includes("{selectedVirus.scientistLogs.map((log, index) => log.id === cardTabs.active(`${selectedVirus.id}:logs`, selectedVirus.scientistLogs.map((item) => item.id)) && ("), "only the selected record is drawn");
});

test("owner 2026-11-20 OWN-10: the full record of a virus in the recycle bin has the same tabs; the groups are told apart by the virus", () => {
  const archived = stripComments(dossierSeam);
  assert.match(archived, /import \{ CardTabs, cardTabsCopy, useCardTabSelection \} from "@\/components\/portia-editor-card-tabs";/);
  assert.ok(archived.includes("  const cardTabs = useCardTabSelection();\n  return <div className=\"editor-form virus-editor-form etab-detail\">"), "its own selection");
  assert.ok(archived.includes("<CardTabs label={cardTabsCopy.mutations} items={virus.mutations.map((mutation, index) => ({ id: String(index), title: mutation.name }))} activeId={cardTabs.active(`${virus.id}:mutations`, Object.keys(virus.mutations))}"));
  assert.ok(archived.includes("<CardTabs label={cardTabsCopy.logs} items={virus.scientistLogs.map((log) => ({ id: log.id, title: log.title }))} activeId={cardTabs.active(`${virus.id}:logs`, virus.scientistLogs.map((log) => log.id))}"));
  assert.ok(archived.includes("String(index) === cardTabs.active(`${virus.id}:mutations`, Object.keys(virus.mutations)) && <div") && archived.includes("log.id === cardTabs.active(`${virus.id}:logs`, virus.scientistLogs.map((item) => item.id)) && <div"), "only the selected one is drawn");
  assert.equal(archived.split("<CardTabs ").length - 1, 2, "no strip for what is not a long list of cards");
  assert.ok(!archived.includes("<CardTabs label={cardTabsCopy.mutations} items={virus.mutations.map((mutation, index) => ({ id: String(index), title: mutation.name }))} activeId={cardTabs.active(`${virus.id}:mutations`, Object.keys(virus.mutations))} onMove"), "no order for mutations");
});

test("owner 2026-11-20 OWN-10: the mutations of «Шаблон» are tabs of their own selection; the panel closes on a switch", () => {
  const builder = stripComments(readFileSync(new URL("../components/portia-template-builder.tsx", import.meta.url), "utf8"));
  assert.match(builder, /import \{ CardTabs, cardTabsCopy, useCardTabSelection \} from "@\/components\/portia-editor-card-tabs";/);
  assert.ok(builder.includes('  const [dossierTab, setDossierTab] = useState<DossierTab>("main");\n  const cardTabs = useCardTabSelection();'), "the selection lives in the builder");
  const strip = builder.slice(builder.indexOf("<CardTabs label={cardTabsCopy.mutations}"), builder.indexOf("{virus.mutations.map((mutation, index) => String(index)"));
  assert.ok(strip.length > 0 && !strip.includes("onMove"), "the tabs only switch");
  assert.ok(strip.includes('onSelect={(id) => { closeFormatter(); cardTabs.select("template:mutations", id); }}'), "T-26.1-20: the panel closes on a switch");
  assert.ok(builder.includes('String(index) === cardTabs.active("template:mutations", Object.keys(virus.mutations)) && ('), "only the selected mutation is drawn");
});

test("owner 2026-11-20 OWN-10: where the strip is not drawn: blocks inside a card, the feed, the lists that are already list and detail, the recommendations", () => {
  const all = stripComments(editor);
  // Blocks of a card and a subsection stay a page feed, in the card; the order of a feed is its content.
  assert.equal(all.split("<CardTabs ").length - 1, 4, "the guide cards, the info subsections, the mutations and the records of the viruses: four strips, no other place in the editor");
  const feed = editorSlice('{tab === "broadcasts" && (', '{tab === "recycle" && (');
  assert.ok(!feed.includes("<CardTabs"), "«Сводка» is a feed by date with its own filter and contents");
  const recycle = editorSlice('{tab === "recycle" && (', '{tab === "search" && (');
  assert.ok(!recycle.includes("<CardTabs"), "the recycle bin is a list and a detail already");
});

// ---- 26.1-20 (owner 2026-11-21, item 16): «Корзина» — список на всю высоту вкладки при любом размере окна ----
test("owner 2026-11-21 item 16: the recycle bin list fills the whole height of the tab on a PC window, the long list scrolls inside the column", () => {
  const maximized = ".app-window.is-maximized";
  const layout = ".content-editor > .recycle-editor-layout";
  assert.equal(declared(layout, "flex", DESKTOP), "1 1 0", "the bin takes the rest of the editor height, as «Сотрудники»");
  assert.equal(declared(layout, "min-height", DESKTOP), "320px");
  assert.equal(declared(".virus-editor-layout.recycle-editor-layout", "align-items", DESKTOP), "stretch");
  assert.equal(declared(".virus-editor-layout.recycle-editor-layout", "grid-template-rows", DESKTOP), "minmax(0, 1fr)");
  const column = ".recycle-editor-layout > .editor-record-list";
  assert.equal(declared(column, "min-height", DESKTOP), "0");
  assert.equal(declared(column, "overflow-y", DESKTOP), "auto");
  assert.equal(declared(column, "align-content", DESKTOP), "start");
  assert.equal(declared(column, "max-height", DESKTOP), "none", "the 62svh / 620px cap of the common list does not stop the column");
  assert.equal(declared(".recycle-editor-layout > :not(.editor-record-list):not(.editor-back-to-list)", "min-height", DESKTOP), "0", "the detail is scrolled inside, so the row stays one fr tall");
  assert.equal(declared(".recycle-editor-layout > :not(.editor-record-list):not(.editor-back-to-list)", "overflow-y", DESKTOP), "auto");
  // The sticky column of the maximized window (quick 261117-bi1) names the bin out, as it names out «Сотрудники».
  const sticky = rules.filter((rule) => rule.selectors.some((selector) => selector.startsWith(maximized) && selector.includes("> .etab-body:not(.employee-editor-layout)")));
  assert.ok(sticky.length > 0, "the maximized sticky rules are found");
  for (const rule of sticky) {
    for (const selector of rule.selectors.filter((item) => item.includes("> .etab-body:not(.employee-editor-layout)"))) {
      assert.ok(selector.includes(":not(.recycle-editor-layout)"), `${selector} leaves the bin to its own full-height layout`);
    }
  }
  // Nothing of it is outside the PC query, and the phone list stays one column of its own.
  assert.equal(declared(layout, "flex"), undefined);
  assert.equal(declared(column, "overflow-y"), undefined);
  // «База вирусов» keeps the page-scroll list and detail: its long form scrolls the page, the column sticks (quick 261117-bi1), so no fixed-height row.
  assert.equal(declared(".content-editor > .virus-editor-layout:not(.recycle-editor-layout):not(.employee-editor-layout)", "flex", DESKTOP), undefined);
});

// ---- 26.1-20 (owner 2026-11-21, item 17): «+ ДОБАВИТЬ КАРТОЧКУ» — в конце полосы вкладок карточек ----
test("owner 2026-11-21 item 17: the strip of card tabs ends with the add action: the button and the limit note in the seam, without `add` the strip is as before", () => {
  assert.ok(cardTabsCode.includes('addCard: "+ ДОБАВИТЬ КАРТОЧКУ"'), "the label lives in the seam (D-58)");
  assert.ok(cardTabsCode.includes("add?: { onAdd: () => void; disabled: boolean; note?: ReactNode }"), "the add action is optional data");
  assert.ok(cardTabsCode.includes("if (items.length === 0 && !add) return null;"), "no strip without cards, unless there is the add action: an empty section shows the same button");
  assert.ok(cardTabsCode.includes('className="editor-card-tab-add"') && cardTabsCode.includes("{cardTabsCopy.addCard}"), "button.editor-card-tab-add with the label of the seam");
  assert.ok(cardTabsCode.includes("disabled={add.disabled}") && cardTabsCode.includes("onClick={add.onAdd}"), "the editor's action and its limit");
  assert.ok(cardTabsCode.includes("aria-describedby={add.note ? noteId : undefined}") && cardTabsCode.includes("id={noteId}"), "the button is described by the limit note");
  const navEnd = cardTabsCode.indexOf("</nav>");
  const button = cardTabsCode.indexOf('className="editor-card-tab-add"');
  assert.ok(navEnd > 0 && button > navEnd, "the action stands after the scrolling strip, at its end, so many tabs never push it out of sight");
  assert.match(cardTabsCode.slice(button - 80, button + 40), /type="button"/, "a button of the strip submits nothing");
  assert.equal(declared(".editor-card-tabs > .editor-card-tab-add-bar", "flex"), "none");
  assert.equal(declared(".editor-card-tabs button.editor-card-tab-add", "min-height"), "32px", "as tall as a tab");
  assert.equal(declared(".editor-card-tabs button.editor-card-tab-add", "min-height", PHONE), "var(--tap-target)");
  assert.equal(declared(".editor-card-tabs", "flex-wrap", PHONE), "wrap", "a phone strip leaves the action its own row when it does not fit");
  assert.ok(styles.indexOf(".editor-card-tab-add") < styles.indexOf("/* users-tab:start"), "the new rules stand before users-tab");
  assert.ok(styles.trimEnd().endsWith("/* ui-unify:end */"), "the block of ui-unify stays the last");
});

test("owner 2026-11-21 item 17: the editor gives the strip of the guide cards its add action and no longer draws the button under the list", () => {
  const guide = editorSlice('{tab === "guide" && (', '{tab === "recycle"');
  const strip = guide.slice(guide.indexOf("<CardTabs label={cardTabsCopy.cards}"), guide.indexOf('<div className="info-subsection-list" data-sort-group="guide-cards"'));
  assert.ok(strip.includes("add={{ onAdd: () => { const id = makeId(\"card\"); changeDraft((next) => { updateById(next.guideSections, section.id, (item) => { item.cards.push({ id, title: \"НОВАЯ КАРТОЧКА\", cover: \"\", blocks: [] }); }); }); setOpen([id], true); }, disabled: section.cards.length >= MAX_SUBSECTIONS, note: <LimitNote id={`limit-cards-${section.id}`} count={section.cards.length} max={MAX_SUBSECTIONS} /> }}"), "the same add action, the limit and the note");
  assert.ok(!guide.includes("limit-add\" type=\"button\" disabled={section.cards.length >= MAX_SUBSECTIONS}"), "the old button under the list is gone");
  assert.equal(guide.split("limit-cards-").length - 1, 1, "one limit note of the cards");
  assert.ok(guide.includes("В разделе нет карточек. Добавьте первую кнопкой «+ ДОБАВИТЬ КАРТОЧКУ»."), "the empty section still names the button");
  assert.ok(!stripComments(editor).includes("<button className=\"secondary-control limit-add\" type=\"button\" disabled={section.cards.length"), "no limit-add button of the cards left in the file");
});
