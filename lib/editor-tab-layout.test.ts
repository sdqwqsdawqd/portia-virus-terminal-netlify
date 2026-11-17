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
  // Two calls since 26-07: the draft tabs share one bar; «Сотрудники» renders its own with its own save (D-12).
  assert.equal(code.split("<EditorActionBar").length - 1, 2, "one bar for the draft tabs and one for «Сотрудники»");
  assert.equal(code.slice(0, code.indexOf("function EmployeeProfilesEditor(")).split("<EditorActionBar").length - 1, 1, "one call for the draft tabs");
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
  assert.equal(code.split("<EditorActionBar").length - 1, 2, "no third action bar: the other tabs reuse their own");
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
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "width"), "24px");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "min-width"), "24px");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "padding"), "0");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "width", PHONE), "var(--tap-target)");
  assert.equal(declared(".editor-section-tabs nav .order-drag-handle", "min-width", PHONE), "var(--tap-target)");
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

test("D-12: «Сотрудники» renders its own action bar with the profile save and its own status; no editor draft buttons", () => {
  const employees = editorSlice("function EmployeeProfilesEditor(", "type TabLists =");
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
  assert.ok(employees.includes("leaving: boolean;") && employees.includes("onLeave(true);") && employees.includes('title="Несохранённые правки сотрудника"'), "the leave guard is unchanged");
  assert.match(employees, /<\/div>\n {2}<\/>;\n\}/, "the fragment closes after the layout");
});

test("D-12: «Сотрудники» is a list/detail body; the picked employee is the current row", () => {
  const employees = editorSlice("function EmployeeProfilesEditor(", "type TabLists =");
  assert.ok(employees.includes('<div className="virus-editor-layout employee-editor-layout etab-body" ref={layoutRef} data-mobile-view={recordOpen ? "record" : "list"}>'));
  assert.ok(employees.includes('<aside className="editor-record-list etab-list">'));
  assert.ok(employees.includes('aria-current={employee.id === selected?.id ? "true" : undefined}'), "the picked employee is aria-current");
  assert.ok(employees.includes('<div className="editor-form employee-profile-editor etab-detail">'));
  assert.ok(employees.includes("editor-back-to-list"), "the phone back button stays");
  assert.doesNotMatch(styles, /\.employee-editor-save/, "no rule of the retired save line");
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
  assert.ok(bar.includes('statusText={message} tone={message ? (note.ok ? "saved" : "error") : ""} />'), "the queue message is the polite status of the bar; WR-04: a success is not red");
  for (const gone of ["actions=", "СОХРАНИТЬ", "ОТМЕНИТЬ", "unsavedCount"]) assert.ok(!bar.includes(gone), `${gone}: no editor draft action on this bar`);
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
