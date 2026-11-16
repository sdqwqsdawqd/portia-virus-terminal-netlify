import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { componentFamily, lf } from "./component-source.ts";
import { accessCheckFailedText } from "./app-state.ts";

const desktopFamily = componentFamily("portia-desktop");
const editorFamily = componentFamily("portia-editor");
const source = desktopFamily.map((part) => part.text).join("\n");
const editorSource = editorFamily.map((part) => part.text).join("\n");
const styles = lf(readFileSync(new URL("../app/portia.css", import.meta.url), "utf8"));
const icons = readFileSync(new URL("../components/portia-icons.tsx", import.meta.url), "utf8");

// Index of the "}" that closes the "{" at `open`; braces inside strings or template literals are not special-cased.
function closingBrace(text: string, open: number) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

test("state updaters stay pure: no storage access, state setter or timer inside one", () => {
  // set<Name>((arg) => { ... }) with a block body; Strict Mode replays these, so a side effect runs twice.
  const header = /\bset[A-Z]\w*\(\s*\(\s*\w+(?:\s*:[^)]*)?\)\s*=>\s*\{/g;
  const offenders: string[] = [];
  let updaters = 0;
  for (const match of source.matchAll(header)) {
    const open = match.index + match[0].length - 1;
    const body = source.slice(open, closingBrace(source, open) + 1);
    updaters += 1;
    const line = source.slice(0, match.index).split("\n").length;
    if (/\blocalStorage\b|\bsessionStorage\b|\bset[A-Z]\w*\(/.test(body)) offenders.push(`line ${line}: ${match[0].slice(0, 40)}`);
  }
  assert.ok(updaters >= 3, `expected at least 3 block-bodied updaters, found ${updaters}`);
  assert.deepEqual(offenders, []);
});

test("every embedded frame is sandboxed with the one shared set (SEC-03)", () => {
  const tags = source.match(/<iframe\b[^>]*>/g) ?? [];
  assert.equal(tags.length, 2);
  for (const tag of tags) assert.ok(tag.includes("sandbox={embedSandbox}"), `missing shared sandbox: ${tag.slice(0, 60)}`);
  const value = /const embedSandbox = "([^"]+)"/.exec(source)?.[1] ?? "";
  for (const flag of ["allow-scripts", "allow-same-origin", "allow-popups", "allow-popups-to-escape-sandbox"]) assert.ok(value.split(" ").includes(flag), flag);
  assert.ok(!value.includes("allow-top-navigation"));
  assert.ok((tags.find((tag) => tag.includes("youtube-nocookie")) ?? "").includes("allowFullScreen"));
});

test("zoom listens to Ctrl, Cmd only on a Mac, and clears on every way out (ZOOM-01)", () => {
  const metaLines = source.split("\n").filter((line) => line.includes("metaKey"));
  assert.equal(metaLines.length, 1);
  assert.ok(metaLines[0].includes("const zoomModifier"));
  const start = source.indexOf("function EmbeddedDocument");
  const body = source.slice(start, source.indexOf("\nfunction ", start + 1));
  for (const call of ['addEventListener("visibilitychange"', 'removeEventListener("visibilitychange"', 'addEventListener("blur"', 'removeEventListener("blur"']) assert.ok(body.includes(call), call);
  const layer = /<div className="document-app-zoom-layer"[^\n]*\/>/.exec(body)?.[0] ?? "";
  assert.ok(layer.includes("onPointerMove") && layer.includes("onPointerDown"), layer);
});

test("the zoom reset button is named by its percent (ZOOM-02)", () => {
  const button = /<button\b[^\n]*?>\{Math\.round\(zoom \* 100\)\}%<\/button>/.exec(source)?.[0] ?? "";
  assert.ok(button, "reset button not found");
  assert.ok(!button.includes("aria-label") && !button.includes("title="), button);
  assert.ok(source.includes('aria-label="Масштаб документа"'));
});

test("the quest notice is not a live region itself and closes on Escape from anywhere (A11Y-01)", () => {
  const start = source.indexOf("function QuestToast");
  const body = source.slice(start, source.indexOf("\nfunction ", start + 1));
  const aside = /<aside\b[^>]*>/.exec(body)?.[0] ?? "";
  assert.ok(aside.includes("quest-toast") && !aside.includes("role=") && !aside.includes("onKeyDown"), aside);
  assert.ok(body.includes('<span role="status" className="sr-only">Новый квест: '));
  for (const call of ['window.document.addEventListener("keydown"', 'window.document.removeEventListener("keydown"', "defaultPrevented", "dialog[open]"]) assert.ok(body.includes(call), call);
});

test("virus rows are options of the listbox only when there are rows (A11Y-01)", () => {
  const row = /<button key=\{virus\.id\}[^\n]*>/.exec(source)?.[0] ?? "";
  assert.ok(row.includes('role="option"') && row.includes("aria-selected={virus.id === activeVirus?.id}"), row);
  assert.ok(source.includes("const virusListbox = contentReady && filteredViruses.length > 0;"));
  const list = /<div className="virus-list"[^\n]*>/.exec(source)?.[0] ?? "";
  assert.ok(list.includes('role={virusListbox ? "listbox" : undefined}') && list.includes('aria-label={virusListbox ? "Записи вирусов" : undefined}'), list);
});

test("the Roblox portrait link has its tooltip and the plain portrait none (A11Y-02)", () => {
  const link = /<a className="personnel-portrait"[^>]*>/.exec(source)?.[0] ?? "";
  assert.ok(link.includes("title={`Профиль Roblox: ${selectedEmployee.nickname}`}"), link);
  assert.ok(!/<figure className="personnel-portrait"[^>]*title=/.test(source));
  assert.equal(source.match(/title=\{`Профиль Roblox:/g)?.length, 1);
});

test("the ≡ handle keeps no tooltip (D-18)", () => {
  const handle = /<[a-z]+\b[^>]*className="order-drag-handle"[^>]*>/.exec(editorSource)?.[0] ?? "";
  assert.ok(handle, "handle not found");
  assert.ok(!handle.includes("title="), handle);
});

test("the editor imports rich-text-style once and ships no joke or empty labels (TEST-02, A11Y-03)", () => {
  for (const part of editorFamily) assert.ok(part.text.split('from "@/lib/rich-text-style"').length - 1 <= 1, `${part.file} imports rich-text-style twice`);
  assert.ok(editorSource.includes('from "@/lib/rich-text-style"'));
  assert.doesNotMatch(editorSource, /<small>\s*<\/small>|<small\s*\/>/);
  for (const word of ["\u0444\u0438\u0433\u043d\u0438", "\u0434\u0440\u0443\u0436\u043e\u043a", "\u043f\u0438\u0440\u043e\u0436\u043e\u043a"]) {
    assert.ok(!editorSource.includes(word), `joke word ${word} is back`);
  }
});

test("component families start with the full main file", () => {
  const mainFile = (name: string) => lf(readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), "utf8"));
  assert.equal(desktopFamily[0].text, mainFile("portia-desktop"));
  assert.equal(editorFamily[0].text, mainFile("portia-editor"));
});

test("component families import only their own seams and the known shared components", () => {
  const allowed = {
    // portia-virus-card: the archive's virus card, shared with the template builder (D-55, 20-43).
    // portia-redacted: the static «ЗАСЕКРЕЧЕНО · нужен допуск N» placeholder (Phase 24, D-08/D-09).
    "portia-desktop": ["portia-icons", "portia-wallpaper", "custom-color-picker", "portia-promotion", "portia-virus-card", "portia-redacted"],
    // portia-desktop-states: the shared «Доступ закрыт» panel the editor shows when the rights check fails (STAB-APP-09).
    // portia-image-framing: the block «Видимая часть» under a picture field (D-63, 20-53), shared with the template builder through ImageEditorField.
    // portia-users-tab: the «Пользователи» tab body (USR-01, Phase 22).
    // portia-level-picker: the shared «Нужен допуск 1–5» control of the editor forms (Phase 24, D-16).
    // portia-image-rewrite: the «change the address of a picture» hook beside the level picker (Phase 25, D-13/D-14); it keeps the editor file's requests and texts out of it.
    "portia-editor": ["custom-color-picker", "portia-promotion-editor", "portia-desktop-states", "portia-image-framing", "portia-users-tab", "portia-level-picker", "portia-image-rewrite"],
  } as const;
  for (const [main, family] of [["portia-desktop", desktopFamily], ["portia-editor", editorFamily]] as const) {
    const members = family.map((part) => part.file.replace(/\.tsx$/, ""));
    for (const part of family) {
      for (const match of part.text.matchAll(/(from |import\()\s*"@\/components\/([a-z0-9-]+)"/g)) {
        const name = match[2];
        const dynamic = match[1] === "import(";
        if (main === "portia-desktop" && name === "portia-editor") {
          assert.ok(dynamic, `${part.file}: the editor must stay behind next/dynamic, not a static import`);
          continue;
        }
        assert.ok(members.includes(name) || (allowed[main] as readonly string[]).includes(name), `${part.file} imports components/${name}, which is not a ${main} seam or a known shared component`);
      }
    }
  }
});

test("STAB-DESK-07: app ids, storage keys and API endpoints stay as pinned", () => {
  const keys = (text: string) => [...new Set([...text.matchAll(/"(portia-[a-z0-9-]+-v\d+)"/g)].map((match) => match[1]))].sort();
  const endpoints = (text: string) => {
    const found: Record<string, number> = {};
    for (const match of text.matchAll(/["`](\/api\/[a-z/-]+)/g)) found[match[1]] = (found[match[1]] ?? 0) + 1;
    return found;
  };
  assert.equal(/type AppId = ([^;]+);/.exec(source)?.[1], '"archive" | "employees" | "search" | "info" | "guide" | "promotion" | "settings" | "broadcasts" | "trash" | "sheet" | "charter" | "editor"');
  // IN-05 (Phase 25): the two device-cache keys live only in lib/device-cache.ts; the desktop imports them.
  assert.deepEqual(keys(source), ["portia-broadcasts-read-signature-v1", "portia-desktop-shortcuts-v3", "portia-guide-collapsed-v2", "portia-quests-seen-v1", "portia-taskbar-order-v1"]);
  assert.match(source, /import \{[^}]*\bCONTENT_CACHE_KEY\b[^}]*\bEMPLOYEES_CACHE_KEY\b[^}]*\} from "@\/lib\/device-cache";/);
  assert.deepEqual(keys(editorSource), ["portia-format-panel-v1"]);
  assert.deepEqual(endpoints(source), { "/api/content": 2, "/api/access": 1, "/api/employees": 1 });
  assert.deepEqual(endpoints(editorSource), { "/api/uploads": 1, "/api/employees/editor": 1, "/api/employees": 3, "/api/editors": 4 });
});

test("every desktop shortcut owns a default position and saved positions override only itself", () => {
  const layout = /const defaultShortcutLayout:[\s\S]*?\n};/.exec(source)?.[0] ?? "";
  for (const id of ["search", "archive", "employees", "broadcasts", "info", "guide", "promotion", "settings", "charter", "sheet", "trash"]) {
    assert.match(layout, new RegExp(`\\n  ${id}: shortcutLayout\\(`), `missing independent layout for ${id}`);
  }
  assert.ok(source.includes("position ? savedShortcutLayout(position) : defaultShortcutLayout[shortcutId]"));
  assert.ok(source.includes('"--shortcut-left": `max(8px, min(${position.x}px, calc(100% - 118px)))`'));
  assert.doesNotMatch(styles, /\.desktop-icon\[data-shortcut=/);
  assert.ok(source.includes('const shortcutPositionsStorageKey = "portia-desktop-shortcuts-v3"'));
});

test("promotion is a standalone desktop application with its own window geometry", () => {
  assert.match(source, /type AppId = [^;]*"promotion"/);
  assert.match(source, /promotion: \{ label: "Повышение", path: "Повышение", icon: "promotion" \}/);
  assert.match(source, /promotion: \[760, 620\]/);
  assert.match(source, /promotion: \{ width: 620, height: 480 \}/);
  assert.ok(source.includes('<DesktopIcon app="promotion"'));
  assert.ok(source.includes('<AppWindow app="promotion"'));
  assert.ok(source.includes("visible={activeApp === \"promotion\" && !windows.promotion.minimized}"));
  assert.ok(source.includes('meta="Повышение"'));
  assert.ok(!source.includes('meta="Portia Promotion"'));
});

test("global search is built by buildSearchIndex from every existing collection and opens the owner app (D-13, D-14)", () => {
  assert.ok(source.includes("globalSearchAppIds.map"));
  assert.ok(source.includes("buildSearchIndex({"));
  assert.ok(source.includes("matchSearch(searchIndex, globalQuery)"));
  assert.ok(!source.includes("const escapeSearch"), "one normalisation: normalizeSearch from lib/search-index");
  assert.ok(source.includes('openApp("employees")'));
  for (const collection of ["content.viruses", "content.infoSections", "content.guideSections", "content.broadcasts", "content.recycleFiles", "recycledViruses", "employees"]) {
    assert.ok(source.includes(collection), collection);
  }
});

// Text of a block that opens at `header` and closes with its matching brace.
function blockAt(header: string) {
  const at = source.indexOf(header);
  assert.ok(at >= 0, header);
  const open = source.indexOf("{", at + header.length - 1);
  return source.slice(open, closingBrace(source, open) + 1);
}

test("search result opens its owner app, marks the record and never touches the search window (D-14, STAB-SEARCH-02)", () => {
  const open = blockAt("const openSearchResult = (result: SearchItem, position = 0) => {");
  assert.ok(open.includes('setSearchHit({ appId: "archive", type: "virus", id: result.id })'));
  assert.ok(open.includes('openApp("archive")'));
  assert.ok(!/closeApp|minimizeApp|requestExit|setWindows|setActiveApp|modal/.test(open), "the search window stays open, not minimised, not modal");
  assert.ok(source.includes('{...hitAttrs("virus", virus.id)}'));
  assert.ok(/"data-search-hit": "true", "aria-current": "true"/.test(source));
  const effect = source.slice(source.indexOf("if (!searchHit) return;"), source.indexOf("}, [searchHit]);"));
  assert.ok(effect.length > 200);
  assert.ok(effect.includes("window.setTimeout(clear, 2400)"));
  assert.ok(effect.includes('scrollIntoView({ block: "center", behavior: document.documentElement.dataset.motion === "full" ? "smooth" : "auto" })'));
  assert.ok(effect.includes('"pointerdown"') && effect.includes('"focusin"'));
  assert.ok(/\.search-hit[^{]*\{[^}]*outline: 1px solid var\(--teal\)/.test(styles));
  assert.ok(/\.search-hit[^{]*\{[^}]*var\(--teal-soft\)/.test(styles));
});

test("every result type opens its owner and marks its record; a vanished record opens the app without a selection (D-14, STAB-SEARCH-02)", () => {
  const open = blockAt("const openSearchResult = (result: SearchItem, position = 0) => {");
  for (const [appId, type] of [["archive", "virus"], ["employees", "employee"], ["info", "info"], ["guide", "guide"], ["broadcasts", "broadcast"], ["trash", "file"]]) {
    assert.ok(open.includes(`setSearchHit({ appId: "${appId}", type: "${type}", id: result.id })`), type);
  }
  assert.ok(open.includes('setSearchHit({ appId: result.id as AppId, type: "app", id: result.id })'));
  assert.ok((source.match(/setSearchHit\(/g) ?? []).length >= 7);
  // The missing-record branch comes first, opens the owner and selects nothing.
  const missing = open.slice(open.indexOf("if (!searchTargetExists(result))"), open.indexOf("setUnavailableResults([]);\n    if (result.type"));
  assert.ok(missing.includes("setSearchHit(null)") && missing.includes("setUnavailableResults([{ item: result, position }])") && missing.includes("openApp(owner)"));
  assert.ok(!/setActiveVirusId|setSelectedEmployeeId|setSelectedInfoId|setGuideCardId|setActiveTrashFileId/.test(missing));
  assert.ok(source.includes("Запись недоступна") && source.includes("aria-disabled={unavailable || undefined}"));
  assert.ok(!/toast|assistant|Vivian|Вивьян/i.test(open), "no assistant or toast message for a vanished record");
  // Every owner list carries the mark.
  for (const mark of ['hitAttrs("employee", employee.id)', 'hitAttrs("info", section.id)', 'hitAttrs("info", sub.id)', 'hitAttrs("broadcast", item.id)', 'hitAttrs("file", file.id)', 'hitAttrs("file", `virus:${virus.id}`)', 'hitId={searchHit?.type === "guide"']) {
    assert.ok(source.includes(mark), mark);
  }
});

test("device copies of content and roster are stamped with their data source and foreign copies are dropped (owner UAT 19-14)", () => {
  // IN-03 (Phase 25): one function writes the content copy; after a poll and after a save it is called, never written inline.
  assert.equal((source.match(/setItem\(CONTENT_CACHE_KEY, JSON\.stringify\(stampCacheSource\(/g) ?? []).length, 1, "the content write is stamped and happens once");
  assert.equal((source.match(/setItem\(CONTENT_CACHE_KEY/g) ?? []).length, 1, "no content write outside writeContentCache");
  assert.equal((source.match(/\bwriteContentCache\(/g) ?? []).length, 3, "declaration, poll and save");
  const writer = source.slice(source.indexOf("function writeContentCache("), source.indexOf("setItem(CONTENT_CACHE_KEY"));
  assert.ok(writer.length > 0 && !writer.includes("setItem(CONTENT_CACHE_KEY"));
  const stamp = source.slice(source.indexOf("setItem(CONTENT_CACHE_KEY"), source.indexOf("setItem(CONTENT_CACHE_KEY") + 400);
  for (const field of ["content", "revision", "viewer", "person", "documents", "updatedAt", "savedAt"]) assert.ok(stamp.includes(field + ":"), "content copy field " + field);
  // D-16: the roster copy carries the viewer and the person too.
  assert.ok(source.includes("setItem(EMPLOYEES_CACHE_KEY, JSON.stringify(stampCacheSource({ ...payload, viewer: viewerKeyRef.current, person: viewerPersonRef.current }, deviceCacheSource())))"));
  assert.ok(/!cacheMatchesSource\(JSON\.parse\(cached\), cacheSource\)\) \{ window\.localStorage\.removeItem\(CONTENT_CACHE_KEY\)/.test(source));
  assert.ok(/!cacheMatchesSource\(JSON\.parse\(employeeCache\), cacheSource\)\) \{ window\.localStorage\.removeItem\(EMPLOYEES_CACHE_KEY\)/.test(source));
  assert.ok(!/setItem\(CONTENT_CACHE_KEY, JSON\.stringify\(\{/.test(source), "no unstamped content write");
  // D-16: both copies are checked for the viewer and the person before they are shown, at load and when the viewer changes.
  assert.ok(source.includes("cacheMatchesViewer(JSON.parse(cached), viewerKeyRef.current, viewerPersonRef.current)"));
  assert.ok(source.includes("cacheMatchesViewer(JSON.parse(employeeCache), viewerKeyRef.current, viewerPersonRef.current)"));
  assert.ok(source.includes("[viewerKey, viewerPerson]"), "the copies are rechecked when the viewer or the person changes");
});

test("IN-07 and the roster 401: only the answer to the newest request may wipe the copies; an access-required roster answer is a lost access", () => {
  const content = source.slice(source.indexOf("const fetchContent = useCallback"), source.indexOf("const retryContent = useCallback"));
  assert.ok(content.includes('denied?.code === "access-required" && requestSeq === contentRequestSeq.current'));
  assert.ok(content.indexOf("requestSeq === contentRequestSeq.current") < content.indexOf("clearDeviceContentCaches(() => window.localStorage)"));
  const employees = source.slice(source.indexOf("const fetchEmployees = useCallback"), source.indexOf("const retryEmployees = useCallback"));
  assert.ok(employees.includes("response.status === 401"));
  assert.ok(employees.includes('denied?.code === "access-required"'));
  assert.ok(employees.includes("clearDeviceContentCaches(() => window.localStorage)"));
  assert.ok(employees.includes("onAccessLostRef.current?.()"));
  assert.ok(employees.indexOf("clearDeviceContentCaches") < employees.indexOf("failureFromResponse(response.status"), "the 401 branch comes before the generic failure");
});

test("on a phone the trash list grows with its rows and scrolls with the page, like the virus archive (owner UAT 19-14)", () => {
  // iOS (Firefox/Safari on iPhone 16) could not scroll the nested overflow:auto list. The first attempt only dropped the
  // clipping, but `flex: 1 1 370px` kept the box at 370px and rows spilled over its border; the box must not flex.
  const phone = styles.slice(styles.indexOf("@media (max-width: 900px) {"), styles.indexOf("@media (max-width: 520px) {"));
  assert.match(phone, /\.trash-app:not\(\.is-viewing\)\s*\{[^}]*height:\s*auto[^}]*max-height:\s*none[^}]*overflow:\s*visible/);
  assert.match(phone, /\.trash-app:not\(\.is-viewing\) \.trash-layout\s*\{[^}]*flex:\s*0 0 auto[^}]*max-height:\s*none[^}]*overflow:\s*visible/);
  assert.match(phone, /\.trash-app:not\(\.is-viewing\) \.trash-files\s*\{[^}]*height:\s*auto[^}]*overflow:\s*visible/);
  // An opened file keeps its own scrolling viewer.
  assert.match(styles, /\.trash-viewer-body\s*\{[^}]*overflow:\s*auto/);
});

test("search-hit attributes never precede key, so list rows keep the jsx runtime (owner UAT 19-14: trash key warning)", () => {
  // `{...spread} key={…}` compiles to createElement with a children array, and React then demands keys on the inner spans.
  for (const match of source.matchAll(/<(\w+)\b([^>]*?)\{\.\.\.hitAttrs\(/g)) {
    const rest = source.slice(match.index + match[0].length, source.indexOf(">", match.index + match[0].length + 40));
    assert.ok(!/\bkey=/.test(rest), `key must come before {...hitAttrs(...)} in <${match[1]}${match[2].slice(0, 60)}`);
  }
});

test("search states: loading rows with aria-busy, distinct empty text, no roster status line (owner, 20-33), long meta wraps (UI E4)", () => {
  const window = source.slice(source.indexOf('<AppWindow app="search"'), source.indexOf('<AppWindow app="info"'));
  assert.ok(window.includes("Ищем…") && window.includes("aria-busy={!contentReady}"));
  assert.ok(window.includes("[0, 1, 2].map") && window.includes("global-result global-result-skeleton skeleton-block"));
  assert.ok(window.includes("Совпадений нет") && window.includes("Измените запрос или выберите рекомендацию."));
  assert.ok(!window.includes("global-search-degraded") && !window.includes("rosterNote"), "no message about the employee list in search");
  assert.ok(source.includes("rosterOutOfSearch ? [] : employees"), "no last-good roster: no employees in the index");
  assert.ok(!styles.includes(".global-search-degraded"));
  assert.ok(/\.global-result-heading small\s*\{[^}]*overflow-wrap: anywhere/.test(styles));
  assert.ok(/\.global-result-skeleton\s*\{[^}]*min-height: 78px/.test(styles));
});

test("search keyboard follows owner verdict 3: one window handler and one Ctrl/Cmd+K listener, Tab untouched, a phone keeps Enter only", () => {
  const handler = blockAt("const onSearchKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {");
  assert.ok(handler.includes("searchKeyAction(searchKeyContext(event, {"));
  assert.ok(handler.includes("scope: searchKeyScope"));
  assert.ok(!handler.includes('"Tab"'), "Tab keeps the native order");
  for (const action of ["focus-input", "next", "prev", "clear", "close"]) assert.ok(handler.includes(`"${action}"`), action);
  assert.ok(handler.includes('closeApp("search")'), "Escape on an empty field closes the window");
  assert.ok(source.includes('className="global-search-app" onKeyDown={onSearchKeyDown}'));
  assert.equal((source.match(/searchKeyAction\(searchKeyContext\(event, \{/g) ?? []).length, 1, "only the window handler reads the arrows");
  assert.equal((source.match(/globalSearchKeyAction\(event\)/g) ?? []).length, 1, "the global shortcut opens the search on Ctrl/Cmd+K alone (D-44, D-46)");
  assert.ok(source.includes('if (window.matchMedia("(max-width: 900px)").matches) return;'), "a phone intercepts no Ctrl+K");
  assert.ok(source.includes("qualificationLockedRef.current) return;"), "the shortcut does not break through a qualification");
  assert.ok(source.includes("tabIndex={searchRoving ?"), "roving tabindex over the results");
  assert.ok(source.includes('focusApp("search")'), "an open search only takes the focus");
});

test("editor collections scroll inside bounded panes and the table of contents no longer follows the page", () => {
  assert.match(styles, /\.editor-record-list\s*\{[^}]*max-height:[^;}]+;[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.editor-record-list\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(styles, /\.virus-editor-layout\s*\{[^}]*grid-template-columns:\s*clamp\(240px, 28vw, 300px\)/);
  assert.match(styles, /\.editor-toc\s*\{[^}]*position:\s*relative/);
  assert.match(styles, /\.promotion-request-list, \.promotion-bank-list\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.promotion-bank-editor, \.promotion-preview\s*\{[^}]*overflow-y:\s*auto/);
});

test("editor scrolls as one page and its tabs use the whole window", () => {
  assert.doesNotMatch(styles, /\.content-editor\s*\{\s*overflow-y:\s*hidden/);
  assert.doesNotMatch(styles, /\.flat-editor-form\s*\{[^}]*max-width/);
  for (const cap of [/\.compact-editor\s*\{/, /\.assistant-editor\s*\{/, /\.access-editor\s*\{/]) assert.doesNotMatch(styles, cap);
  assert.match(styles, /\.content-editor > \.promotion-editor\s*\{[^}]*flex:\s*1 1 0/);
  assert.match(styles, /\.recommendation-order-list\s*\{[^}]*max-width:\s*720px/);
  assert.match(styles, /\.access-editor-list\s*\{[^}]*max-width:\s*760px/);
});

test("window tiles keep their own size and the search shows the picked recommendations (D-43)", () => {
  assert.match(styles, /\.broadcast-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*340px\),\s*340px\)\)/);
  assert.match(styles, /\.broadcast-grid\s*\{[^}]*align-items:\s*start/);
  assert.match(styles, /\.broadcast-grid > \.broadcast-empty\s*\{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(styles, /\.guide-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*176px\),\s*176px\)\)/);
  // Phase 26 (UI-06, D-01): a maximized window turns these tiles into a card grid, but only under the maximized hook; the
  // normal window keeps the fixed 340px / 176px tiles above. No rule outside the hook gives them a stretched track.
  for (const tiles of ["broadcast-grid", "guide-grid"]) {
    const rules = [...styles.matchAll(new RegExp(String.raw`([^{}]*\.${tiles}\s*)\{([^}]*)\}`, "g"))];
    const stretched = rules.filter(([, selector, body]) => /grid-template-columns:[^;]*1fr/.test(body) && !selector.includes(".app-window.is-maximized"));
    assert.deepEqual(stretched.map(([, selector]) => selector.trim()).filter((selector) => !(tiles === "guide-grid" && selector === ".guide-grid")), [], `${tiles}: only the maximized rule may stretch`);
    assert.ok(rules.some(([, selector]) => selector.includes(".app-window.is-maximized")), `${tiles}: a maximized rule exists`);
  }
  assert.ok(source.includes("shownRecommendations.map("), "only the picked recommendations are rendered");
  assert.ok(!source.includes("content.searchRecommendations.map("));
});

test("editor form cards keep one fixed width set by a single variable and fill columns on desktop only (D-15)", () => {
  assert.equal(styles.match(/--editor-card-width:/g)?.length, 1);
  assert.match(styles, /--editor-card-width:\s*340px/); // 18-MOTION-APPROVAL item 5
  const desktop = /@media \(min-width: 901px\) \{\s*\.editor-card-columns \{[^}]*\}/.exec(styles)?.[0] ?? "";
  assert.match(desktop, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*var\(--editor-card-width\)\),\s*var\(--editor-card-width\)\)\)/);
  assert.match(desktop, /align-items:\s*start/);
  // Phase 26 (D-19): a maximized editor only gains more columns of the same var(--editor-card-width); no 1fr stretch.
  const maximized = /\.app-window\.is-maximized \.editor-card-columns, \.app-window\.is-maximized \.editor-section-columns \{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.match(maximized, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*var\(--editor-card-width\)\),\s*var\(--editor-card-width\)\)\)/);
  assert.doesNotMatch(maximized, /1fr/);
  assert.match(styles, /\.editor-card-columns > :not\(\.nested-editor-card\)\s*\{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(styles, /\.editor-card-columns > \.nested-editor-card \+ \.nested-editor-card\s*\{[^}]*margin-top:\s*0/);
  // It must follow .flat-editor-form (same specificity) to win the cascade, and the sorted lists stay one column.
  assert.ok(styles.indexOf(".editor-card-columns {") > styles.indexOf(".flat-editor-form { display: grid"));
  for (const list of [".recommendation-order-list", ".access-editor-list"]) assert.doesNotMatch(styles, new RegExp(`\\${list}\\s*\\{[^}]*grid-template-columns`));
  // Phase 24 (O-2): the «Информация» form opens with the «Приложения» level group, then the hint; the other two forms open with their hint.
  const appsGroup = String.raw`(?:          <EditorGroup title=\{levelCopy\.appsGroup\}>\n[\s\S]*?          </EditorGroup>\n)?`;
  for (const lead of ["Каждый блок становится", "Справочник на рабочем столе", "Публикуйте новости"]) {
    assert.match(editorSource, new RegExp(String.raw`<div className="editor-form flat-editor-form editor-card-columns">\n${appsGroup}          <p className="editor-guidance">${lead}`), `${lead}: form must be in columns`);
  }
  // Phase 26 (26-07, D-12/A2): the column form is the detail pane of the tab body, in the same order (form, then the hint).
  for (const lead of ["Каждый блок становится", "Справочник на рабочем столе", "Публикуйте новости"]) {
    assert.match(editorSource, new RegExp(String.raw`<EditorTabBody list=\{[^\n]*\} detail=\{\n        <div className="editor-form flat-editor-form editor-card-columns">\n${appsGroup}          <p className="editor-guidance">${lead}`), `${lead}: the column form is the detail of the tab body`);
  }
  assert.equal(editorSource.match(/editor-card-columns/g)?.length, 3); // never the sorted recommendation or access lists (D-15)
});

test("drag sorting in columns decides by reading order and slides rows along both axes", () => {
  const dossier = readFileSync(new URL("../components/portia-editor-dossier.tsx", import.meta.url), "utf8");
  assert.ok(dossier.includes('from "@/lib/sort-order"'));
  assert.match(dossier, /passesTarget\(/);
  assert.match(dossier, /offsetLeft/);
  assert.match(dossier, /translate\(\$\{previous\.left - left\}px, \$\{previous\.top - top\}px\)/);
  assert.ok(dossier.includes("if (!row) { moveAcross(parent, hits, x, y); return; }")); // moveAcross and the same-parent rule are untouched
});

test("on phone Vivian is hidden while a window is open and is a sibling of the workspace (STAB-DESK-04)", () => {
  const phone = /@media \(max-width: 900px\) \{\s*\.quest-toast[\s\S]*?\n\}/.exec(styles)?.[0] ?? "";
  assert.match(phone, /\.workspace\.mobile-app-open ~ \.desktop-assistant\s*\{\s*display:\s*none;\s*\}/);
  assert.match(source, /<main className=\{`workspace\$\{[^`]*" mobile-app-open"/);
  assert.ok(source.indexOf('className={`desktop-assistant') > source.indexOf("</main>"), "the sibling selector needs the assistant after <main>");
});

test("Vivian follows the interface accent without painful overexposure or greying the image itself", () => {
  assert.match(styles, /\.assistant-button\s*\{[^}]*filter:\s*var\(--assistant-filter\) brightness\(1\.1\) saturate\(1\.08\)/);
  assert.match(styles, /\.assistant-button img\s*\{[^}]*filter:\s*none/);
});

test("shortcut motion survives pointer exit until every delayed icon part reaches its terminal frame", () => {
  assert.ok(source.includes("const shortcutAnimationMs = 700"));
  assert.ok(source.includes("function useShortcutAnimation()"));
  assert.ok(source.includes('iconAnimation.playing ? " is-icon-animating"'));
  assert.ok(source.includes("<StartPanelButton"));
  assert.match(styles, /\.desktop-icon\.is-icon-animating/);
  assert.match(styles, /\.start-panel > button\.is-icon-animating/);
  assert.doesNotMatch(styles, /\.desktop-icon:is\(:hover, :focus-visible, \.is-icon-animating\)/);
});

test("active remote media receives connection and fetch priority while background collections stay lazy", () => {
  assert.match(source, /import \{ preconnect, preload \} from "react-dom"/);
  assert.match(source, /preload\(src, \{ as: "image", fetchPriority: "high", referrerPolicy: "no-referrer" \}\)/);
  // Priority lives in one place: mediaLoadingAttrs, applied by PortiaImage.
  assert.match(source, /export function PortiaImage/);
  assert.match(source, /\{\.\.\.mediaLoadingAttrs\(priority\)\}/);
  assert.match(source, /function LoadingMedia[\s\S]*<PortiaImage[\s\S]*priority=\{priority\}/);
});

test("PortiaImage checks the link first, mounts per record, times out and cleans up (D-15, STAB-MEDIA-03)", () => {
  const media = desktopFamily.find((part) => part.file === "portia-desktop-media.tsx")?.text ?? "";
  assert.ok(media.includes("mediaSource(src)"), "the link goes through mediaSource before any <img>");
  assert.ok(media.includes("key={`${recordId}|${link}`}"), "a new record or link mounts a fresh frame");
  assert.ok(media.includes('referrerPolicy="no-referrer"'), "no Referer to image hosts");
  assert.match(media, /useVisibleTimeout\(frameRef, state, MEDIA_SLOW_MS,/);
  assert.ok(media.includes('data-media-armed={String(visible && state === "loading")}'));
  assert.ok(!media.includes("window.setTimeout(() => setState"), "the image has no mount-time timeout");
  assert.match(media, /onError=\{\(\) => setState\(\(current\) => \(current === "loaded" \? current : "failed"\)\)\}/, "a late error never flips a loaded picture");
  assert.match(media, /state !== "failed" && /, "a failed frame renders no <img>");
  assert.equal((media.match(/Изображение недоступно/g) ?? []).length, 1);
  // prioritizeImage is private to PortiaImage and only runs for the hero.
  assert.match(media, /if \(link && priority === "hero"\) prioritizeImage\(link\)/);
  assert.equal(source.split("prioritizeImage(").length - 1, 2, "one definition, one call, both in portia-desktop-media.tsx");
  assert.ok(!desktopFamily.some((part) => part.file !== "portia-desktop-media.tsx" && part.text.includes("prioritizeImage(")));
});

const NL = String.fromCharCode(10);
test("every record picture goes through PortiaImage with its record id and the right priority (STAB-MEDIA-03, D-15)", () => {
  const part = (file: string) => desktopFamily.find((entry) => entry.file === file)?.text ?? "";
  const all = desktopFamily.flatMap((entry) => [...entry.text.matchAll(/<PortiaImage(?= )[^>]*>/g)].map((match) => ({ file: entry.file, tag: match[0] })));
  assert.ok(all.length >= 8, "portraits, dossier, information, trash and the reference book are all ported");
  for (const { tag } of all) {
    assert.match(tag, /recordId=\{/, tag);
    // LoadingMedia forwards the priority its MediaBlock caller chose; every other call site names it literally.
    assert.match(tag, /priority="(?:hero|lazy)"|priority=\{priority\}/, tag);
  }
  // The card (portia-virus-card.tsx) names each picture place; the dossier hands them to MediaBlock as they are.
  const card = readFileSync(new URL("../components/portia-virus-card.tsx", import.meta.url), "utf8");
  assert.ok(card.includes('recordId: `${virus.id}:infected`, priority: "hero"'));
  assert.ok(part("portia-desktop-dossier.tsx").includes("recordId={slot.recordId} priority={slot.priority}"));
  const heroes = all.filter(({ tag }) => tag.includes('priority="hero"')).map(({ tag }) => tag);
  assert.equal(heroes.length, 3, "selected employee avatar and the portrait (its linked and plain variants); the dossier hero is checked above");
  assert.ok(heroes.every((tag) => /:avatar`|:portrait`|:infected`/.test(tag)));
  // Collections stay lazy.
  const lazyOf = (file: string) => all.filter((entry) => entry.file === file).map((entry) => entry.tag);
  assert.ok(lazyOf("portia-desktop-documents.tsx").length >= 3 && lazyOf("portia-desktop-documents.tsx").every((tag) => tag.includes('priority="lazy"')));
  assert.ok(lazyOf("portia-desktop.tsx").filter((tag) => tag.includes('priority="lazy"')).length >= 2, "information photo and trash image");
  assert.ok(card.includes('recordId: `${virus.id}:mutation:${index}`, priority: "lazy"'));
  // No loading policy outside PortiaImage; the one fetchPriority left is the PORTIA mark of the boot screen.
  assert.ok(!source.includes('loading="eager"'));
  for (const line of source.split(NL).filter((entry) => entry.includes('fetchPriority="high"'))) assert.ok(line.includes("portia-logo.png"), line);
  // No raw record <img> left in the ported modules: the documents module has none, the dossier keeps only the GIF embed and the PORTIA mark.
  assert.ok(!part("portia-desktop-documents.tsx").includes("<img"));
  const dossierImages = [...part("portia-desktop-dossier.tsx").matchAll(/<img[\s\S]*?(?:\/>|>)/g)].map((match) => match[0]);
  assert.ok(dossierImages.every((tag) => tag.includes("embedded-rich-media") || tag.includes("portia-logo.png")), dossierImages.join(NL));
  assert.ok(!source.includes("trash-image-missing") && !source.includes("EmployeeImage"));
});

test("PortiaImage sizes the box before the picture and keeps motion under the motion contract (UI E5)", () => {
  assert.match(styles, /\.portia-image \{[^}]*aspect-ratio: var\(--portia-image-ratio, 4 \/ 3\)/);
  assert.match(styles, /\.portia-image-placeholder \{[^}]*background: var\(--panel-2\); border: 1px solid var\(--line\)/);
  assert.match(styles, /\.portia-image-placeholder svg \{[^}]*width: 40px; height: 40px/);
  assert.match(styles, /\.portia-image-placeholder-label \{ font: 700 11px\/1\.25 var\(--sans\)/);
  assert.match(styles, /\.portia-image-skeleton \{[^}]*animation: loader-appear 1ms linear 150ms forwards/);
  assert.match(styles, /html\[data-motion="full"\] \.portia-image-skeleton \{[^}]*personnel-image-loading/);
  assert.doesNotMatch(styles.replace(/html\[data-motion="full"\] \.portia-image-skeleton \{[^}]*\}/, ""), /\.portia-image-skeleton[^{]*\{[^}]*personnel-image-loading/, "shimmer only under data-motion=full");
  assert.match(styles, /html\[data-motion\]:not\(\[data-motion="off"\]\) \.portia-image img \{ transition: opacity var\(--motion-fast\)/);
});

test("window drag uses the live frame width and symmetric workspace bounds", () => {
  assert.ok(source.includes("width: rect.width"));
  assert.ok(source.includes("width: operation.parentWidth"));
  assert.ok(source.includes("dragGeometry(operation"));
  const geometry = readFileSync(new URL("./window-geometry.ts", import.meta.url), "utf8");
  assert.ok(geometry.includes("bounds.width - width - margin"));
  assert.doesNotMatch(geometry, /bounds\.width - 160/);
});

test("shared shortcut hover feedback never translates the icon container", () => {
  const hover = /\.desktop-icon:hover \.desktop-icon-symbol[^\{]*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.ok(hover);
  assert.doesNotMatch(hover, /transform\s*:/);
  const transition = /html\[data-motion="full"\][^{]*\.desktop-icon-symbol[^\{]*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.doesNotMatch(transition, /transform/);
  assert.ok(styles.includes('[data-icon="promotion"] .icon-promotion-arrow'));
});

test("shortcut motion is uniform, opt-in, and the guide has its own animation", () => {
  assert.ok(styles.includes('html[data-motion="full"] .desktop-icon.is-dragging'));
  assert.ok(styles.includes('html[data-motion="full"] .desktop-icon.is-dropping'));
  assert.ok(styles.includes('[data-icon="guide"] .icon-guide-front'));
  assert.ok(styles.includes('@keyframes icon-guide-front'));
  const base = /\.desktop-icon \{[\s\S]*?\n}/.exec(styles)?.[0] ?? "";
  assert.doesNotMatch(base, /transition:/, "base shortcut must not move when animations are disabled");
});

test("the five refreshed shortcut icons animate semantic parts except in «Выключены»", () => {
  for (const part of ["icon-virus-core", "icon-broadcast-signal-inner", "icon-info-lines", "icon-guide-front", "icon-settings-knob-a"]) {
    assert.ok(icons.includes(part), `missing semantic icon part ${part}`);
    const animationLine = styles.split("\n").find((line) => line.includes(`.${part}`) && line.includes("animation:")) ?? "";
    assert.ok(animationLine.startsWith('html:not([data-motion="off"])'), `${part} is not gated by html:not([data-motion="off"])`);
  }
  for (const retired of ["icon-turn", "icon-spike", "icon-ripple", "icon-blink", "icon-folder-index", "icon-slide-left", "icon-slide-right"]) {
    assert.ok(!styles.includes(`@keyframes ${retired}`), `retired animation ${retired} is still shipped`);
  }
  // Explicitly excluded by the owner: employees, charter, sheet and trash retain their established gestures.
  for (const kept of ["icon-hop", "icon-lift", "icon-stamp", "icon-write-32", "icon-lid"]) assert.ok(styles.includes(`@keyframes ${kept}`), kept);
});

test("the virus shortcut uses a contained diagnostic scan and returns to its exact resting artwork", () => {
  assert.ok(icons.includes('className="icon-virus-scan"'));
  assert.ok(icons.includes('className="icon-virus-detail"'));
  assert.ok(styles.includes("@keyframes icon-virus-scan"));
  assert.ok(styles.includes("@keyframes icon-virus-detail"));
  assert.match(styles, /@keyframes icon-virus-scan \{[\s\S]*100% \{[^}]*opacity:\s*0/);
});

test("promotion shortcut builds momentum through its levels before the arrow launches", () => {
  for (const part of ["icon-promotion-base", "icon-promotion-level-low", "icon-promotion-level-high", "icon-promotion-arrow"]) {
    assert.ok(icons.includes(part), `missing semantic promotion part ${part}`);
    const animationLine = styles.split("\n").find((line) => line.includes(`.${part}`) && line.includes("animation:")) ?? "";
    assert.ok(animationLine.startsWith('html:not([data-motion="off"])'), `${part} is not gated by html:not([data-motion="off"])`);
  }
  assert.ok(styles.includes("@keyframes icon-promotion-launch"));
  assert.ok(!styles.includes("@keyframes icon-promotion-rise"));
});

test("animated shortcuts keep one precise vector artwork through the resting handoff", () => {
  assert.ok(icons.includes('<svg viewBox="0 0 24 24"'));
  assert.match(styles, /\.desktop-icon-symbol svg[^{]*\{[^}]*shape-rendering:\s*geometricPrecision/);
  assert.match(styles, /\.desktop-icon-symbol svg \*[^{]*\{[^}]*vector-effect:\s*non-scaling-stroke/);
  assert.doesNotMatch(styles, /\[data-icon[^\n]*svg\s*\{[^}]*scale:/);
  const refreshed = [
    "icon-virus-core", "icon-virus-spikes", "icon-virus-tips",
    "icon-broadcast-beacon", "icon-broadcast-wave",
    "icon-info-page", "icon-info-fold", "icon-info-line",
    "icon-guide-back", "icon-guide-front",
    "icon-settings-rails", "icon-settings-a", "icon-settings-b", "icon-settings-c",
    "icon-promotion-base", "icon-promotion-level", "icon-promotion-launch",
  ];
  for (const name of refreshed) {
    const keyframes = new RegExp(`@keyframes ${name} \\{[\\s\\S]*?100% \\{`).exec(styles)?.[0] ?? "";
    assert.ok(keyframes, `${name} has no explicit resting frame`);
  }
  const refreshedAnimationLines = styles.split("\n").filter((line) => refreshed.some((name) => line.includes(`animation: ${name} `)));
  assert.ok(refreshedAnimationLines.length >= refreshed.length);
  assert.ok(refreshedAnimationLines.every((line) => line.includes(" both;")), "refreshed icon animation must retain its exact terminal frame");
});

test("guide sections start folded and the compact back control does not cover card content", () => {
  assert.ok(source.includes('const guideCollapsedStorageKey = "portia-guide-collapsed-v2"'));
  assert.ok(source.includes("useState<string[]>(() => sections.map((section) => section.id))"));
  assert.doesNotMatch(source, /initialCollapsed\.current/);
  const back = /\.guide-back-bar \{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.match(back, /height:\s*36px/);
  assert.match(back, /margin:\s*0 0 16px/);
  assert.doesNotMatch(back, /position:\s*(sticky|absolute|fixed)/);
  assert.doesNotMatch(back, /margin:\s*-/);
});

// ---- Shortcut cycle system (Phase 18-03, 18-MOTION-APPROVAL.md item 1) ----
const shortcutCycleMs = 560; // approved cycle
const shortcutStaggerMs = 90; // max offset between parts
const shortcutMaxMs = 700; // whole cycle incl. offsets
const shortcutsSource = readFileSync(new URL("../components/portia-desktop-shortcuts.tsx", import.meta.url), "utf8");
const cyclePrefix = 'html:not([data-motion="off"]) :is(.desktop-icon.is-icon-animating .desktop-icon-symbol, .start-panel > button.is-icon-animating .start-panel-icon)';

// Every animation declaration that targets one shortcut icon: line, keyframes name, duration/delay (ms), easing token.
function iconCycles(icon: string) {
  return styles.split("\n").filter((line) => line.includes(`[data-icon="${icon}"]`) && line.includes("animation:")).map((line) => {
    const tokens = /animation:([^;}]*)/.exec(line)![1].trim().split(/\s+/);
    const ms = tokens.filter((token) => /^\d+ms$/.test(token)).map((token) => parseInt(token, 10));
    return { line, name: tokens[0], duration: ms[0], delay: ms[1] ?? 0, easing: tokens.find((token) => token.startsWith("var(--ease") || token.startsWith("cubic-bezier")), tokens };
  });
}

function keyframesBody(name: string) {
  const open = styles.indexOf("{", styles.indexOf(`@keyframes ${name} {`));
  return styles.slice(open + 1, closingBrace(styles, open));
}

function assertIconCycle(icon: string) {
  const cycles = iconCycles(icon);
  assert.ok(cycles.length > 0, `${icon}: no cycle rules`);
  for (const cycle of cycles) {
    assert.ok(cycle.line.startsWith(cyclePrefix), `${icon}: rule is not gated by html:not([data-motion="off"]) at top level: ${cycle.name}`);
    assert.equal(cycle.duration, shortcutCycleMs, `${icon}/${cycle.name}: duration`);
    assert.ok(cycle.delay <= shortcutStaggerMs, `${icon}/${cycle.name}: offset ${cycle.delay}ms`);
    assert.ok(cycle.duration + cycle.delay <= shortcutMaxMs, `${icon}/${cycle.name}: whole cycle`);
    assert.equal(cycle.easing, "var(--ease-out)", `${icon}/${cycle.name}: easing must be the token`);
    const body = keyframesBody(cycle.name);
    assert.ok(body, `${icon}: missing @keyframes ${cycle.name}`);
    const final = /(?:100%|to)\s*\{([^}]*)\}/.exec(body)?.[1];
    if (final !== undefined) {
      // The last frame is the resting frame (the virus scan layer rests invisible).
      const rest: Record<string, string[]> = { translate: ["0 0"], opacity: cycle.name === "icon-virus-scan" ? ["0"] : ["1"], scale: ["1", "1 1"], rotate: ["0deg"], "stroke-dashoffset": ["0"] };
      for (const declaration of final.split(";").map((part) => part.trim()).filter(Boolean)) {
        const [property, value] = declaration.split(/:\s*/);
        if (cycle.name === "icon-virus-scan" && property !== "opacity") continue;
        assert.ok(rest[property]?.includes(value), `${cycle.name}: 100% frame ${property}: ${value} is not the resting frame`);
      }
    }
    if (/(?<![\d.])(?!0%|100%)\d+%\s*\{/.test(body)) {
      assert.ok(body.includes("animation-timing-function: var(--ease-in)"), `${cycle.name}: return segment must use --ease-in`);
    }
  }
}

const shortcutIcons = ["search", "virus", "employees", "broadcasts", "info", "guide", "settings", "promotion", "charter", "sheet", "trash", "editor"];

test("shortcut cycle: all 12 icons follow the approved system and end on the resting frame", () => {
  for (const icon of shortcutIcons) assertIconCycle(icon);
  assert.deepEqual(iconCycles("settings").map((cycle) => cycle.delay).sort((a, b) => a - b), [0, 0, 45, 90]);
});

// Frames of one @keyframes body as { at: 0..100, declarations }, "from"/"to" read as 0/100.
function keyframeFrames(name: string) {
  return [...keyframesBody(name).matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap((match) =>
    match[1].split(",").map((selector) => selector.trim()).map((selector) => ({ at: selector === "from" ? 0 : selector === "to" ? 100 : parseFloat(selector), declarations: match[2] })));
}
const cycleKeyframeNames = () => [...new Set(shortcutIcons.flatMap((icon) => iconCycles(icon).map((cycle) => cycle.name)))];

test("shortcut cycle: the segment into the resting frame runs on the rule's --ease-out, so the icon settles instead of clicking into place (quick 261102-d7r)", () => {
  for (const name of cycleKeyframeNames()) {
    const frames = keyframeFrames(name);
    const inner = frames.filter((frame) => frame.at > 0 && frame.at < 100).sort((a, b) => b.at - a.at);
    if (inner.length) assert.ok(frames.some((frame) => frame.at === 100), `${name}: has intermediate frames but no explicit 100% / to`);
    const last = [...frames.filter((frame) => frame.at < 100)].sort((a, b) => b.at - a.at)[0];
    assert.ok(last, `${name}: no frames`);
    assert.ok(!last.declarations.includes("animation-timing-function: var(--ease-in)"), `${name}: the last frame before the rest (${last.at}%) is on --ease-in`);
  }
});

test("shortcut cycle: write-on lines are drawn in full before the class is removed (quick 261102-d7r)", () => {
  // stroke-dasharray is discrete: inside keyframes it flips mid-cycle instead of animating.
  for (const name of cycleKeyframeNames()) assert.doesNotMatch(keyframesBody(name), /stroke-dasharray/, `${name}: dasharray inside keyframes`);
  // non-scaling-stroke makes dashes count in screen px; the largest shortcut symbol sets the worst case.
  const widths = [...styles.matchAll(/\.desktop-icon-symbol\s*\{[^}]*?\bwidth:\s*(\d+)px/g)].map((match) => Number(match[1]));
  const screenPerUnit = (Math.max(...widths) * 0.58) / 24;
  assert.ok(Math.max(...widths) >= 62);
  // Longest sub-path of the animated element in viewBox units (components/portia-icons.tsx): sheet `M4 9h16M4 14h16M10 9v11`, editor `v16`, info `h7`.
  const longest: Record<string, number> = { sheet: 16, editor: 16, info: 7 };
  for (const [icon, units] of Object.entries(longest)) {
    // D-17: the dasharray lives in the rest rule (outside the animating selector), so it is the same before, during and after the cycle.
    const dashed = cycleParts(icon).filter(({ part }) => /^\d+$/.test(restRule(icon, part).get("stroke-dasharray") ?? ""));
    assert.ok(dashed.length > 0, `${icon}: no dashed write-on rule`);
    for (const { cycle, part } of dashed) {
      const length = Number(restRule(icon, part).get("stroke-dasharray"));
      assert.ok(length >= units && length >= units * screenPerUnit, `${icon}: dasharray ${length} does not cover ${units} units / ${(units * screenPerUnit).toFixed(1)}px`);
      const start = keyframeFrames(cycle.name).find((frame) => frame.at === 0);
      assert.match(start?.declarations ?? "", new RegExp(`stroke-dashoffset:\\s*${length}\\b`), `${cycle.name}: starts fully undrawn`);
      assert.match(keyframeFrames(cycle.name).find((frame) => frame.at === 100)?.declarations ?? "", /stroke-dashoffset:\s*0/, `${cycle.name}: ends fully drawn`);
    }
  }
});

test("«База вирусов» is about 0.86 of the other shortcut icons on the desktop and in «Пуск» (size only, artwork untouched)", () => {
  const desktop = /\.desktop-icon-symbol\[data-icon="virus"\] svg\s*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  const start = /\.start-panel-icon\[data-icon="virus"\] svg\s*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  for (const side of ["width", "height"]) {
    const percent = Number(new RegExp(`${side}:\\s*([\\d.]+)%`).exec(desktop)?.[1]);
    const pixels = Number(new RegExp(`${side}:\\s*([\\d.]+)px`).exec(start)?.[1]);
    assert.ok(percent >= 46 && percent <= 52, `desktop ${side} ${percent}% (others 58%)`);
    assert.ok(pixels >= 15 && pixels <= 18, `start panel ${side} ${pixels}px (others 19px)`);
  }
});

test("shortcut animation timer outlasts the longest cycle and does not depend on animationend", () => {
  const timer = /const shortcutAnimationMs = (\d+);/.exec(shortcutsSource)?.[1];
  assert.equal(timer, String(shortcutMaxMs));
  assert.doesNotMatch(shortcutsSource, /onAnimationEnd|addEventListener\("animationend"/);
  for (const icon of shortcutIcons) for (const cycle of iconCycles(icon)) assert.ok(cycle.duration + cycle.delay <= Number(timer));
});

test("the soft-motion blanket rule leaves shortcut icon artwork alone so the cycle plays in Уменьшены", () => {
  const soft = styles.split("\n").find((line) => line.startsWith('html[data-motion="reduced"], html[data-motion="reduced"] *')) ?? "";
  assert.ok(soft, "soft-motion blanket rule not found");
  const exclusion = ":not(:is(.desktop-icon-symbol, .start-panel-icon) svg, :is(.desktop-icon-symbol, .start-panel-icon) svg *)";
  for (const target of ["*", "*::before", "*::after"]) {
    const selector = target.replace("*", `*${exclusion}`);
    assert.ok(soft.includes(`html[data-motion="reduced"] ${selector}`), `soft rule is missing the shortcut exclusion on ${target}`);
  }
});

test("shortcut rules sit outside any hover media query and keep no private easing curves", () => {
  const from = styles.indexOf("/* Hover, keyboard focus and touch on app icons");
  const to = styles.indexOf("@keyframes icon-scan");
  assert.ok(from > 0 && to > from);
  const block = styles.slice(from, to);
  assert.doesNotMatch(block, /@media/);
  assert.doesNotMatch(block, /cubic-bezier/);
  assert.doesNotMatch(block, /^\s+html\[data-motion/m, "no indented (media-wrapped) or full-only shortcut rules");
  // D-17: the origin of every part is constant, never gated by the motion mode and never tied to the animating class.
  assert.ok(block.split(/\r?\n/).includes(':is(.desktop-icon-symbol, .start-panel-icon) svg > * { transform-box: fill-box; transform-origin: center; }'));
  assert.ok(!block.includes('html:not([data-motion="off"]) :is(.desktop-icon-symbol, .start-panel-icon) svg > *'));
  for (const retired of ["cubic-bezier(.2,.72,.25,1)", "cubic-bezier(.2,.85,.25,1)"]) assert.ok(!styles.includes(retired));
});

test("the promotion arrow is not silenced by the soft-mode rule: it plays in Уменьшены and is static only in Выключены", () => {
  const rule = styles.split("\n").find((line) => line.startsWith('html:is([data-motion="reduced"], [data-motion="off"]) :is(.promotion-card')) ?? "";
  assert.ok(rule);
  assert.ok(!rule.includes("icon-promotion-arrow"));
  assert.ok(iconCycles("promotion").some((cycle) => cycle.name === "icon-promotion-launch"));
});

test("shortcut artwork is not redrawn: the cycle animates only translate/scale/rotate/opacity/dash offset", () => {
  for (const icon of shortcutIcons) for (const cycle of iconCycles(icon)) {
    const body = keyframesBody(cycle.name);
    assert.doesNotMatch(body, /(?<![\w-])(filter|transform|viewBox|d):/, `${cycle.name} must not touch filter, transform or geometry`);
  }
});

// Phase 19-08: one set of state components inside the existing window bodies (D-05..D-08, STAB-DESK-08, STAB-APP-10).
const statesSource = desktopFamily.find((part) => part.file === "portia-desktop-states.tsx")?.text ?? "";
const desktopMain = desktopFamily[0].text;
const count = (text: string, needle: string) => text.split(needle).length - 1;

test("the fatal panel and the skeleton are exported once, with one retry label and the alert on the text only (D-06, D-08)", () => {
  assert.equal(statesSource.match(/^export function (AppFatalPanel|AppSkeleton)\b/gm)?.length, 2);
  assert.equal(count(statesSource, "Повторить загрузку"), 1);
  assert.ok(statesSource.includes("Загружаем…"));
  // role="alert" sits on the heading and body, not on the button, so a retry never re-announces the panel.
  const fatal = statesSource.slice(statesSource.indexOf("export function AppFatalPanel"), statesSource.indexOf("export function AppDeniedPanel"));
  assert.equal(count(fatal, 'role="alert"'), 1);
  assert.ok(fatal.indexOf('role="alert"') < fatal.indexOf("<button") && fatal.indexOf("</div>") < fatal.indexOf("<button"), "the alert closes before the retry button");
  assert.match(statesSource, /aria-busy="true"/);
  assert.ok(statesSource.includes("failureCopy") && statesSource.includes("iframeFailureCopy"));
});

test("skeleton and state-panel CSS: shimmer only under data-motion=full, 150ms delayed show, only 11/13/16px fonts", () => {
  assert.ok(styles.includes('html[data-motion="full"] .skeleton-block'));
  assert.ok(/\.skeleton-block\s*\{[^}]*var\(--panel-2\)/.test(styles));
  assert.ok(/\.app-skeleton\s*\{[^}]*loader-appear 1ms linear 150ms forwards/.test(styles));
  assert.ok(/\.app-fatal-panel[^{]*\{[^}]*padding: 32px 24px/.test(styles));
  const rules = styles.split("\n").filter((line) => /^(?:html\[[^\]]*\] )?\.(app-fatal-panel|app-denied-panel|app-skeleton|skeleton-)/.test(line));
  assert.ok(rules.length >= 4);
  for (const rule of rules) for (const size of rule.matchAll(/font(?:-size)?:\s*(?:\d+\s+)?(\d+(?:\.\d+)?)px/g)) assert.ok(["11", "13", "16"].includes(size[1]), `unexpected font size in: ${rule.slice(0, 60)}`);
});

test("«Справочник» body picks its render by appViewState: skeleton, fatal panel with retry, stale strip (D-05, D-06)", () => {
  const start = desktopMain.indexOf('<AppWindow app="guide"');
  const body = desktopMain.slice(start, desktopMain.indexOf("</AppWindow>", start));
  assert.ok(body.includes('<AppSkeleton shape="guide"'));
  assert.match(body, /<AppFatalPanel|contentFatal\(/);
  assert.match(body, /<AppStaleBanner|contentStaleBanner/);
  assert.ok(!body.includes("Загрузка справочника"));
  // the shared fatal panel and stale strip of the content apps both retry through retryContent
  assert.match(desktopMain, /const contentStaleBanner = .*retryContent\(\)/);
  assert.match(desktopMain, /const contentFatal = .*retryContent\(\)/);
  assert.ok(desktopMain.includes("const guideView = appViewState("));
});

function windowBody(app: string) {
  const start = desktopMain.indexOf(`<AppWindow app="${app}"`);
  assert.ok(start >= 0, `window ${app}`);
  return desktopMain.slice(start, desktopMain.indexOf("</AppWindow>", start));
}

test("every data window picks skeleton, fatal panel, stale strip and the shared empty text from appViewState (D-05..D-08)", () => {
  assert.ok(count(desktopMain, "appViewState(") >= 6, "one appViewState call per data window");
  const rows: [string, string, string[]][] = [
    ["archive", "archive", ["archive"]],
    ["employees", "employees", ["employees"]],
    ["info", "info", ["info"]],
    ["broadcasts", "broadcasts", ["[broadcastTab]"]],
    ["trash", "trash", ["trash"]],
  ];
  for (const [app, shape, keys] of rows) {
    const body = windowBody(app);
    assert.ok(body.includes(`<AppSkeleton shape="${shape}"`), `${app} skeleton`);
    assert.match(body, /<AppFatalPanel|contentFatal\(/, `${app} fatal`);
    assert.match(body, /<AppStaleBanner|contentStaleBanner/, `${app} stale`);
    for (const key of keys) assert.ok(body.includes(key.startsWith("[") ? `emptyCopy${key}` : `emptyCopy.${key}`), `${app} empty ${key}`);
    assert.ok(!body.includes("<LoadingState"), `${app} no spinner loader`);
  }
  assert.ok(!desktopMain.includes("В базе пока нет вирусов") && !desktopMain.includes("Квестов и задач пока нет"));
});

test("a failed roster fetch writes employeesSync and never touches the roster; only a complete answer moves lastGoodAt (STAB-APP-02)", () => {
  const start = desktopMain.indexOf("const fetchEmployees = useCallback");
  const body = desktopMain.slice(start, desktopMain.indexOf("useEffect(", start));
  const failed = body.slice(body.indexOf("if (!response.ok)"), body.indexOf("const payload"));
  assert.ok(failed.includes("failureFromResponse(response.status"));
  assert.ok(!failed.includes("setEmployees("));
  assert.ok(body.includes("contentSyncFailed(") && body.includes("contentSyncSucceeded("));
  assert.ok(/degraded !== false/.test(body), "only degraded === false is a complete roster");
  // the last good roster survives in the same state the failure leaves untouched
  assert.equal(count(body, "setEmployees("), 1);
  assert.ok(desktopMain.includes("retryEmployees"));
});

test("«Корзина» shows no restore or delete control on the desktop; the editor's permanent delete says it cannot be restored and refuses by name (STAB-APP-05, T-19-19)", () => {
  const trash = windowBody("trash");
  assert.doesNotMatch(trash, /Восстановить|Удалить навсегда|УДАЛИТЬ НАВСЕГДА|onRestore|onDelete/);
  for (const dialog of ["delete", "delete-file"]) {
    const start = editorSource.indexOf(`dialog === "${dialog}"`);
    assert.ok(start >= 0, dialog);
    const block = editorSource.slice(start, editorSource.indexOf("/>", start));
    assert.ok(block.includes("её не восстановить"), `${dialog} says it cannot be restored`);
    assert.ok(block.includes('label: "УДАЛИТЬ НАВСЕГДА"'), `${dialog} keeps the action label`);
    assert.ok(block.includes('label: "Не удалять"') && !block.includes("ОТМЕНА"), `${dialog} names the refusal`);
  }
});

test("«Таблица» and «Устав»: skeleton until onLoad, fatal panel after the 15s timeout, retry remounts the frame; sandbox and zoom stay (STAB-APP-06, T-19-20)", () => {
  const documents = desktopFamily.find((part) => part.file === "portia-desktop-documents.tsx")?.text ?? "";
  const start = documents.indexOf("export function EmbeddedDocument");
  const embedded = documents.slice(start, documents.indexOf("// v2 starts every section folded", start));
  assert.match(embedded, /<iframe[^>]*key=\{frameKey\}[^>]*onLoad=/);
  assert.ok(embedded.includes("sandbox={embedSandbox}"));
  assert.equal(count(documents, "sandbox={embedSandbox}"), 2, "the document frame and the YouTube frame");
  assert.match(embedded, /useState<"loading" \| "loaded" \| "failed">\("loading"\)/);
  assert.match(embedded, /useVisibleTimeout\(viewportRef, frameState, iframeLoadTimeoutMs,/);
  assert.ok(!embedded.includes("window.setTimeout("), "a hidden frame cannot time out");
  assert.ok(embedded.includes('data-frame-armed={String(visible && frameState === "loading")}'));
  assert.match(embedded, /onLoad=\{\(\) => setFrameState\("loaded"\)\}/);
  assert.ok(embedded.includes('<AppSkeleton shape="document"'));
  assert.match(embedded, /<AppFatalPanel failure="iframe"[^>]*extra=\{/);
  assert.match(embedded, /setFrameKey\(\(key\) => key \+ 1\)/);
  assert.ok(embedded.includes('href={external}'));
  // zoom and fullscreen-facing handlers are unchanged
  for (const kept of ['aria-label="Уменьшить"', 'aria-label="Увеличить"', "onClick={() => setZoom(1)}", "step(event.deltaY < 0 ? 1 : -1)", "zoomModifier(event)"]) assert.ok(embedded.includes(kept), kept);
});

test("AppDeniedPanel shows only «Доступ закрыт» (and one fixed caller line) as an alert, without buttons (D-07)", () => {
  assert.equal(statesSource.match(/^export function AppDeniedPanel\b/gm)?.length, 1);
  const start = statesSource.indexOf("export function AppDeniedPanel");
  const panel = statesSource.slice(start, statesSource.indexOf("\n}\n", start));
  assert.ok(panel.includes("Доступ закрыт") && panel.includes('role="alert"') && panel.includes("detail"));
  assert.ok(!panel.includes("<button") && !panel.includes("onClick"));
});

// ---- Phase 19-09 (D-17): the resting frame of every shortcut icon is its last keyframe ----
const restHost = ":is(.desktop-icon-symbol, .start-panel-icon)";

function ruleParts(line: string) {
  const open = line.indexOf("{");
  const declarations = new Map<string, string>();
  for (const declaration of line.slice(open + 1, line.lastIndexOf("}")).split(";").map((part) => part.trim()).filter(Boolean)) {
    const colon = declaration.indexOf(":");
    declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
  }
  return { selector: line.slice(0, open).trim(), declarations };
}

// The cycle rule for one part: only `animation`, so nothing but the animation disappears when the class is removed.
function cycleParts(icon: string) {
  return iconCycles(icon).map((cycle) => {
    const { selector, declarations } = ruleParts(cycle.line);
    const part = selector.slice(cyclePrefix.length + `[data-icon="${icon}"]`.length);
    return { cycle, part, declarations };
  });
}

// The rest rule for the same part, declared outside the animating selector and outside html:not([data-motion="off"]).
function restRule(icon: string, part: string) {
  const line = styles.split("\n").find((candidate) => candidate.startsWith(`${restHost}[data-icon="${icon}"]${part} {`));
  assert.ok(line, `${icon}${part}: no rest rule outside the animating selector`);
  return ruleParts(line).declarations;
}

function assertIconRest(icon: string) {
  for (const { cycle, part, declarations } of cycleParts(icon)) {
    assert.deepEqual([...declarations.keys()], ["animation"], `${icon}${part}: the animating rule may only carry \`animation\` (everything else is rest)`);
    const rest = restRule(icon, part);
    const last = keyframeFrames(cycle.name).find((frame) => frame.at === 100);
    assert.ok(last, `${cycle.name}: no 100% frame`);
    for (const declaration of last.declarations.split(";").map((item) => item.trim()).filter(Boolean)) {
      const colon = declaration.indexOf(":");
      const property = declaration.slice(0, colon).trim();
      const value = declaration.slice(colon + 1).trim();
      if (property === "animation-timing-function") continue;
      // The virus scan layer is invisible at rest; only its opacity is the resting frame.
      if (cycle.name === "icon-virus-scan" && property !== "opacity") continue;
      assert.equal(rest.get(property), value, `${icon}${part}: rest ${property} must equal the ${cycle.name} 100% frame`);
    }
    if (/stroke-dashoffset/.test(keyframesBody(cycle.name))) {
      assert.match(rest.get("stroke-dasharray") ?? "", /^\d+$/, `${icon}${part}: write-on part keeps its dasharray at rest`);
      assert.equal(rest.get("stroke-dashoffset"), "0");
    }
  }
}

test("shortcut rest (D-17, tracer): «Информация» rests on its last keyframe, outside the animating selector", () => {
  assertIconRest("info");
  assert.equal(restRule("info", " .icon-info-fold").get("transform-origin"), "right top");
  for (const index of [1, 2, 3]) assert.equal(restRule("info", ` .icon-info-lines > :nth-child(${index})`).get("stroke-dasharray"), "16");
});

test("shortcut rest (D-17): all 12 icons rest on their last keyframe, outside the animating selector", () => {
  for (const icon of shortcutIcons) assertIconRest(icon);
  // The «Повышение» levels carry opacity=".65" in the artwork, but the cycle holds opacity 1 (animation-fill both): the rest must be that last frame.
  for (const part of [" .icon-promotion-level-low", " .icon-promotion-level-high"]) assert.equal(restRule("promotion", part).get("opacity"), "1");
});

test("shortcut rest (D-17): the animating selector carries nothing but `animation`, and no line outside a cycle is gated by is-icon-animating", () => {
  const animating = styles.split("\n").filter((line) => line.includes("is-icon-animating") && line.includes("{") && !line.startsWith("/*") && !line.includes("@"));
  assert.ok(animating.length >= 30);
  for (const line of animating) {
    const { declarations } = ruleParts(line);
    if (!line.includes("[data-icon=")) continue; // hover bookkeeping rules of the shortcut itself are not icon parts
    assert.deepEqual([...declarations.keys()], ["animation"], line.slice(0, 160));
  }
});

test("shortcut rest (D-17): parts with their own origin keep it constant, in the same rule as their transform-box", () => {
  const origins: Array<[string, string, string, string]> = [
    ["virus", " .icon-virus-scan", "view-box", "12px 12px"],
    ["virus", " .icon-virus-spikes", "view-box", "12px 12px"],
    ["virus", " .icon-virus-tips", "view-box", "12px 12px"],
    ["broadcasts", " .icon-broadcast-signal", "view-box", "12px 11px"],
  ];
  for (const [icon, part, box, origin] of origins) {
    const rest = restRule(icon, part);
    assert.equal(rest.get("transform-box"), box, `${icon}${part}`);
    assert.equal(rest.get("transform-origin"), origin, `${icon}${part}`);
  }
  // fill-box parts only override the origin: the box itself comes from the constant `svg > *` rule.
  assert.equal(restRule("info", " .icon-info-fold").get("transform-origin"), "right top");
  assert.equal(restRule("guide", " .icon-guide-front").get("transform-origin"), "center bottom");
  assert.equal(restRule("trash", " svg > :nth-child(1)").get("transform-origin"), "left bottom");
  // No animating rule keeps an origin or a box any more.
  assert.doesNotMatch(styles.split("\n").filter((line) => line.startsWith(cyclePrefix)).join("\n"), /transform-(origin|box)/);
});

test("shortcut rest (D-17): shape-rendering and will-change are constant on both hosts and never toggle with the class", () => {
  assert.match(styles, /\.desktop-icon-symbol svg[^{]*\{[^}]*shape-rendering:\s*geometricPrecision/);
  assert.match(/\.start-panel-icon svg\s*\{([^}]*)\}/.exec(styles)?.[1] ?? "", /shape-rendering:\s*geometricPrecision/);
  for (const line of styles.split("\n")) {
    if (line.includes("is-icon-animating") && line.includes("{")) assert.doesNotMatch(line, /will-change/, "will-change must not follow the animating class");
  }
  // will-change names exactly the composited properties each part animates (translate/rotate/scale/opacity), so rest and last frame share one raster path.
  const composited = ["translate", "rotate", "scale", "opacity"];
  for (const icon of shortcutIcons) for (const { cycle, part } of cycleParts(icon)) {
    const animated = new Set([...keyframesBody(cycle.name).matchAll(/(?<![\w-])(translate|rotate|scale|opacity)\s*:/g)].map((match) => match[1]));
    const declared = new Set((restRule(icon, part).get("will-change") ?? "").split(",").map((item) => item.trim()).filter(Boolean));
    assert.deepEqual([...declared].sort(), composited.filter((property) => animated.has(property)).sort(), `${icon}${part}: will-change`);
  }
});

// ---- Phase 19-13 (STAB-APP-09, T-19-27): a failed rights check closes the editor ----
const fetchAccessBody = (() => {
  const start = source.indexOf("const fetchAccess = useCallback");
  return source.slice(start, source.indexOf("\n  }, []);", start));
})();

test("fetchAccess fails closed: a failed or unreadable answer sets accessState failed, 401/403 mean no access (STAB-APP-09)", () => {
  assert.match(source, /useState<"ok" \| "failed">\("ok"\)/);
  assert.doesNotMatch(fetchAccessBody, /if \(!response\.ok\) return;/);
  assert.match(fetchAccessBody, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(fetchAccessBody, /if \(!response\.ok && !denied\) \{ markFailed\(\); return; \}/);
  assert.ok((fetchAccessBody.match(/setAccessState\("failed"\)/g) ?? []).length >= 1, "failure path");
  assert.match(fetchAccessBody, /catch \{[^}]*(markFailed|setAccessState\("failed"\))/);
  assert.match(fetchAccessBody, /setAccessState\("ok"\)/);
  // The access poll goes on while the check is failed, so the editor can come back.
  assert.match(source, /canEditRef\.current \|\| accessFailedRef\.current/);
});

test("an access answer sent before one already applied is dropped, so a late answer cannot bring back a revoked tab (STAB-APP-09 concurrency)", () => {
  assert.match(source, /const accessRequestSeq = useRef\(0\)/);
  assert.match(source, /const accessAppliedSeq = useRef\(0\)/);
  assert.match(fetchAccessBody, /const seq = \+\+accessRequestSeq\.current/);
  assert.ok((fetchAccessBody.match(/seq < accessAppliedSeq\.current/g) ?? []).length >= 2, "every outcome checks the order");
  assert.ok((fetchAccessBody.match(/accessAppliedSeq\.current = seq/g) ?? []).length >= 2);
});

test("a failed check replaces the editor body by «Доступ закрыт» with the verdict-4 line and keeps the draft mounted (owner items 4 and 7)", () => {
  assert.equal(accessCheckFailedText, "Не удалось проверить права. Повторите позже.");
  assert.match(source, /<AppDeniedPanel detail=\{accessCheckFailedText\}/);
  assert.match(source, /accessFailed=\{accessState === "failed"\}/);
  assert.match(editorSource, /accessFailed/);
  assert.match(editorSource, /<AppDeniedPanel detail=\{accessCheckFailedText\}/);
  // The editor is not unmounted and not told "no tabs": a [] list would revert the draft instead of keeping it in memory.
  assert.doesNotMatch(source, /openTabs=\{accessState/);
  // A failed check takes the save and the shortcuts away.
  const save = editorSource.slice(editorSource.indexOf("const save = async"), editorSource.indexOf("inflight.current = true;"));
  // Phase 24 (24-08, LVL-08): the same guard also refuses a viewer-shaped copy; the access failure is still the first operand.
  assert.match(save, /if \(accessFailed(?: \|\| contentIncomplete)?\) return false;/);
  assert.match(editorSource, /if \(!active \|\| dialog \|\| closeAsked \|\| accessFailed\) return;/);
});

// ---- Phase 19-13 (STAB-APP-08, UI E3): the format panel keeps the selection; the editor lists scroll inside ----
test("dragging the panel (mouse or touch) never reads or moves the field selection; the range lives in the target (STAB-APP-08)", () => {
  const drag = editorSource.slice(editorSource.indexOf("const beginDrag"), editorSource.indexOf("// Arrow keys move the panel"));
  assert.ok(drag.includes("const moveDrag") && drag.includes("const endDrag"));
  assert.doesNotMatch(drag, /selection|restoreSelection|removeAllRanges|\.focus\(|getSelection/i);
  // Pointer events cover the mouse and the touch with one path; the header takes no browser pan on a touch screen.
  assert.match(editorSource, /onPointerDown=\{beginDrag\} onPointerMove=\{moveDrag\} onPointerUp=\{endDrag\} onPointerCancel=\{endDrag\}/);
  assert.match(styles, /\.floating-text-format > header \{[^}]*touch-action:\s*none/);
  // The panel never takes focus from the field, so the browser keeps its selection while the panel is pressed or dragged.
  assert.match(editorSource, /onPointerDown=\{keepFieldFocus\} onMouseDown=\{keepFieldFocus\}/);
  // The controls read the stored range, not whatever the DOM holds after a tap.
  assert.match(editorSource, /resolveRange\([^)]*target\.selection\)/);
  // Leaving the panel hands the stored selection back to the field.
  assert.ok((editorSource.match(/restoreSelection\(field, target\.selection\)/g) ?? []).length >= 2, "Escape and the phone close restore the range");
});

test("saving with the format panel open does not close it or replace its target (STAB-APP-08)", () => {
  const start = lf(editorSource).indexOf("const save = async");
  const body = lf(editorSource).slice(start, lf(editorSource).indexOf("// D-10: after a partial save the first refused section's tab takes the focus"));
  assert.ok(body.length > 500, "the save body was found");
  assert.doesNotMatch(body, /setFormatTarget|setFormatterOpen/);
});

test("the editable area uses the font rule of the viewer in every area (STAB-APP-08 typography)", () => {
  for (const area of ["lead", "metric", "mutation", "scientist", "info", "broadcast", "trash", "caption", "search"]) {
    const rule = styles.split("\n").find((line) => line.includes(`.formatted-rich-input[data-area="${area}"]`) && /\{[^}]*\bfont:/.test(line));
    assert.ok(rule, `${area}: a font rule`);
    const selectors = rule.slice(0, rule.indexOf("{")).split(",").map((selector) => selector.trim());
    assert.ok(selectors.some((selector) => !selector.includes("formatted-rich-input")), `${area}: the viewer selector shares the rule`);
  }
});

test("every long editor list scrolls inside its own pane (UI E3 overflow)", () => {
  assert.match(styles, /\.content-editor\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.content-editor\s*\{\s*min-height:\s*0;/);
  assert.match(styles, /\.editor-record-list\s*\{[^}]*max-height:[^;}]+;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain/);
  assert.match(styles, /\.employee-editor-layout > \.editor-record-list\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.employee-editor-layout > \.employee-profile-editor\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.promotion-request-list, \.promotion-bank-list\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.promotion-bank-editor, \.promotion-preview\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/);
});

test("sticky and floating editor layers never cover the content: notices are in the flow, the sticky action bar sits under the panel (UI E3 overflow)", () => {
  const rules = styles.split("\n").filter((line) => /^\.[^{]*\{/.test(line));
  const stickyEditor = rules.filter((line) => /position:\s*sticky/.test(line) && /editor|etab/.test(line.slice(0, line.indexOf("{")))).map((line) => line.slice(0, line.indexOf("{")).trim());
  // 20-22 (D-41): the «Справочник» add-section bar is the one other sticky editor layer. It sits in the flow at the top of the tab, above the TOC, on an opaque panel.
  // Phase 26 (26-06, D-13b): the floating save chip is retired; the action bar of the draft tabs (.etab-bar) is the sticky save layer.
  // Phase 26 (26-07, D-13a): the add bar and the section tabs moved into the bar's nav slot, so the bar is the only sticky editor layer.
  assert.deepEqual(stickyEditor, [".etab-bar"]);
  const bar = rules.find((line) => line.startsWith(".etab-bar {") && /position:\s*sticky/.test(line)) ?? "";
  assert.match(bar, /top:\s*0/);
  assert.match(styles, /\.etab-bar\s*\{[^}]*background:\s*var\(--panel\)/, "the bar is opaque");
  for (const old of [".editor-section-addbar {", ".editor-section-tabs {"]) {
    const rule = rules.find((line) => line.startsWith(old)) ?? "";
    assert.ok(rule, `${old} rule found`);
    assert.doesNotMatch(rule, /position:|top:|z-index:/, `${old} has no layer of its own`);
  }
  for (const notice of [".editor-conflict-panel", ".editor-stale-banner", ".editor-their-edits", ".editor-section-error"]) {
    const rule = rules.find((line) => line.startsWith(`${notice} {`));
    if (!rule) continue;
    assert.doesNotMatch(rule, /position:\s*(sticky|fixed|absolute)/, notice);
  }
  const z = (selector: string) => Number(new RegExp(`${selector.replace(/[.\[\]]/g, "\\$&")} \\{[^}]*z-index:\\s*(\\d+)`).exec(styles)?.[1] ?? NaN);
  assert.ok(z(".floating-text-format") > z(".etab-bar"), "the format panel is above the action bar");
  assert.ok(z(".etab-bar") > z(".editor-toc") && z(".etab-bar") < 10, "the bar is above the TOC and stays a low layer: dialogs and toasts are above it");
  assert.doesNotMatch(styles, /\.editor-save-chip/, "the floating chip is retired");
});

test("the stale banner is a warning strip in the flow with wrapping text (D-11)", () => {
  const rule = styles.split("\n").find((line) => line.startsWith(".editor-stale-banner {")) ?? "";
  assert.ok(rule, "rule found");
  assert.match(rule, /font:\s*400 13px/);
  assert.match(rule, /overflow-wrap:\s*anywhere/);
  assert.match(rule, /oklch\(\.58 \.08 80 \/ \.55\)/);
});

// Phase 26 (UI-08, D-14 … D-16): «Информация» on a phone — a quiet sections bar above an article that is always shown.
const infoWindowSource = () => source.slice(source.indexOf('<AppWindow app="info"'), source.indexOf('<AppWindow app="guide"'));
// The phone media block that holds the «Информация» rules (the one that also turns .info-library into a page).
const phoneBlock = () => {
  const anchor = styles.indexOf("  .info-library { min-height: calc(100svh - 140px)");
  const start = styles.lastIndexOf("@media (max-width: 900px) {", anchor);
  return anchor > 0 && start > 0 ? styles.slice(start, styles.indexOf("\n}\n", anchor)) : "";
};

test("UI-08 D-14: on a phone a sections bar stands above the article; the two-screen model and the back arrow are gone", () => {
  const info = infoWindowSource();
  assert.ok(source.includes('import { infoCurrentTitle, infoNextTarget, infoOverviewVisible, infoSectionsButtonLabel, infoSectionsHitCount, revealInfoForSearch, toggleInfoExpanded, type InfoNextTarget } from "@/lib/info-phone-nav";'));
  assert.ok(source.includes("const [sectionsOpen, setSectionsOpen] = useState(false);"));
  assert.ok(info.includes('className="info-sections-bar"'), "the bar");
  assert.ok(info.includes("aria-expanded={sectionsOpen}") && info.includes('aria-controls="info-sections-list"'));
  assert.match(info, /<nav className="info-index" aria-label="Разделы информации" id="info-sections-list"/);
  assert.ok(info.includes("data-sections-open={infoPhone ? String(sectionsOpen) : undefined}"), "the open state is on the library");
  // The bar sits right above the list, the list right above the article: Tab goes button → list → article.
  assert.ok(info.indexOf('className="info-sections-bar"') < info.indexOf('id="info-sections-list"'));
  assert.ok(info.indexOf('id="info-sections-list"') < info.indexOf('<article className="info-document">'));
  // The article is never conditional on a screen; the bar is not drawn with zero sections.
  assert.ok(info.includes("{infoPhone && infoRows.length > 0 ? <div className=\"info-sections-bar\""));
  for (const retired of ["data-info-screen", "info-phone-back", "Назад к разделам", "setInfoScreen", "openInfoArticle", "closeInfoArticle", "infoReturnIdRef"]) {
    assert.ok(!source.includes(retired), `${retired} is retired`);
  }
  // The glyph is decoration; the name of the current section is plain text, not a tap target.
  assert.ok(info.includes('<span aria-hidden="true">{infoSectionsLabel.glyph}</span>'));
  assert.ok(info.includes('<span className="info-sections-current">{infoSectionsTitle}</span>'));
  assert.ok(source.includes("infoCurrentTitle(content.infoSections, selectedSubsection?.id ?? selectedInfo.id)"));
  // «Далее» stays in the article.
  assert.ok(info.includes('<div className="info-next">'));
});

test("UI-08 D-14: the bar exists only on a phone, in the flow; the desktop .info-index rules are unchanged", () => {
  assert.match(styles, /^\.info-sections-bar \{ display: none; \}$/m, "hidden at 901px and up");
  const phone = phoneBlock();
  const bar = /\.info-sections-bar \{([^}]*)\}/.exec(phone)?.[1] ?? "";
  assert.match(bar, /display: flex/);
  assert.match(bar, /min-height: 44px/);
  assert.match(bar, /margin: 0 0 16px/);
  assert.match(bar, /justify-content: space-between/);
  assert.match(bar, /gap: 8px/);
  assert.doesNotMatch(bar, /position:/, "never fixed or sticky");
  const name = /\.info-sections-current \{([^}]*)\}/.exec(phone)?.[1] ?? "";
  assert.match(name, /min-width: 0/);
  assert.match(name, /text-overflow: ellipsis/);
  assert.match(name, /white-space: nowrap/);
  assert.match(name, /font: 400 13px/);
  // The list is out of the page while it is closed and in the flow under the bar when it is open.
  assert.match(phone, /\.info-library\[data-sections-open="false"\] \.info-index \{ display: none; \}/);
  assert.doesNotMatch(phone, /data-info-screen|info-phone-back/);
  assert.doesNotMatch(styles, /info-phone-back|data-info-screen/);
  // The desktop index keeps its column.
  assert.match(styles, /^\.info-index \{ min-width: 0; overflow-y: auto; padding: 25px 14px; border-right: 1px solid/m);
});

test("UI-08 D-15: picking an article or Escape closes the list and gives the focus back to РАЗДЕЛЫ; the bar comes back into view only from above", () => {
  const info = infoWindowSource();
  assert.ok(source.includes("const infoSectionsButtonRef = useRef<HTMLButtonElement>(null);"));
  assert.ok(source.includes("const infoSectionsBarRef = useRef<HTMLDivElement>(null);"));
  assert.ok(info.includes('<div className="info-sections-bar" ref={infoSectionsBarRef}'));
  assert.ok(info.includes("ref={infoSectionsButtonRef}"));
  const back = source.slice(source.indexOf("const returnToInfoSections = () => {"), source.indexOf("const pickInfoArticle = "));
  assert.ok(back.length > 0, "returnToInfoSections exists before pickInfoArticle");
  assert.match(back, /getBoundingClientRect\(\)\.top < 0/, "only a bar above the screen is scrolled back");
  assert.match(back, /motion === "off" \|\| motion === "reduced" \? "auto" : "smooth"/);
  assert.match(back, /infoSectionsButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  const pick = source.slice(source.indexOf("const pickInfoArticle = "), source.indexOf("const closeInfoSections = "));
  assert.ok(pick.includes("setSelectedInfoId(id);") && pick.includes("setSectionsOpen(false);") && pick.includes("returnToInfoSections();"));
  const close = source.slice(source.indexOf("const closeInfoSections = "), source.indexOf("const onInfoSectionsKeyDown = "));
  assert.ok(close.includes("setSectionsOpen(false);") && close.includes("returnToInfoSections();"));
  const key = source.slice(source.indexOf("const onInfoSectionsKeyDown = "), source.indexOf("const goInfoNext = "));
  assert.match(key, /event\.key !== "Escape" \|\| !infoPhone \|\| !sectionsOpen/);
  assert.ok(key.includes("event.preventDefault();") && key.includes("closeInfoSections();"));
  // The button and the list both hear Escape; section and subsection rows pick through pickInfoArticle.
  assert.ok(info.includes("onKeyDown={onInfoSectionsKeyDown}") && info.split("onKeyDown={onInfoSectionsKeyDown}").length - 1 >= 2);
  assert.ok(info.includes(": pickInfoArticle(section.id)}") && info.includes("infoPhone ? pickInfoArticle(sub.id) : setSelectedInfoId(sub.id)"));
  assert.ok(source.split("setSectionsOpen(false)").length - 1 >= 3, "pick, Escape and a search hit close the list");
});

test("UI-08 D-16: the closed button counts the sections with search hits by the same test as the highlight; a hit keeps the list closed", () => {
  assert.ok(source.includes("infoSectionsHitCount"), "imported and used");
  assert.ok(source.includes('const infoSectionsLabel = infoSectionsButtonLabel(sectionsOpen, infoSectionsHitCount(content.infoSections, (id) => isSearchHit("info", id)));'));
  // The label is read after isSearchHit is declared (a const arrow function used before its line would throw).
  assert.ok(source.indexOf("const infoSectionsLabel = ") > source.indexOf("const isSearchHit = "));
  const info = infoWindowSource();
  assert.ok(info.includes('hitAttrs("info", section.id)') && info.includes('hitAttrs("info", sub.id)'), "rows keep the search look");
  const hit = source.slice(source.indexOf('} else if (result.type === "info") {'), source.indexOf('} else if (result.type === "guide") {'));
  assert.ok(hit.includes("setSelectedInfoId(result.id);"));
  assert.ok(hit.includes("setSectionsOpen(false);"), "the hit opens its article, not the list");
  assert.ok(hit.includes("revealInfoForSearch(content.infoSections, result.id)"), "its section is opened in the list data");
  assert.ok(!hit.includes("setInfoScreen"));
  // Open list rows are touch targets; the hit look is the shared .search-hit.
  const phone = phoneBlock();
  assert.match(phone, /\.info-index button \{ min-height: 44px;/);
  assert.match(phone, /\.info-index \.info-subsections button \{ min-height: 44px;/);
  assert.match(styles, /^\.search-hit, \.app-window\[data-search-hit="true"\] \{ outline: 1px solid var\(--teal\);/m);
});

// ---- Phase 26-11 (UI-09): the shortcuts at 521–900px follow one JS placement rule ----
function tabletShortcutBlock() {
  const start = styles.indexOf("@media (min-width: 521px) and (max-width: 900px) {");
  assert.ok(start > 0, "the 521–900px rule exists");
  return styles.slice(start, closingBrace(styles, styles.indexOf("{", start)) + 1);
}

test("UI-09 tracer: useShortcutPlacement measures .desktop-icons with a ResizeObserver at 521–900px and places through placeShortcuts", () => {
  assert.ok(shortcutsSource.includes("export function useShortcutPlacement("), "the hook lives next to the shortcuts");
  assert.ok(shortcutsSource.includes("new ResizeObserver("));
  assert.ok(shortcutsSource.includes('"(min-width: 521px) and (max-width: 900px)"'));
  assert.ok(/placeShortcuts\(/.test(shortcutsSource), "the hook calls the pure rule");
  assert.ok(shortcutsSource.includes("shortcutCell("), "the cell follows the icon size");
  // The desktop hands the ref of nav.desktop-icons to the hook and the placed spots to every shortcut.
  assert.ok(source.includes("useShortcutPlacement(desktopIconsRef"), "the desktop calls the hook with the nav ref");
  assert.match(source, /<nav className="desktop-icons" ref=\{desktopIconsRef\}/);
  assert.equal((source.match(/placed=\{placedShortcut\(shortcutPlacement, "/g) ?? []).length, 11, "all eleven shortcuts get their placed spot");
  assert.ok(source.includes('"--shortcut-content-height"'), "the workspace grows to the content height");
  // A placed spot wins on this width only; the PC default and the saved-position style stay as they were.
  assert.ok(shortcutsSource.includes("placed ? placedShortcutLayout(placed.position) : position ? savedShortcutLayout(position) : defaultShortcutLayout[shortcutId]"));
  assert.ok(source.includes('const shortcutPositionsStorageKey = "portia-desktop-shortcuts-v3"'), "storage key unchanged");
});

test("UI-09: the 521–900px rule no longer pins shortcuts by right/bottom, does not clip the workspace and lets a finger scroll from a shortcut", () => {
  const block = tabletShortcutBlock();
  assert.doesNotMatch(block, /var\(--shortcut-right\)|var\(--shortcut-bottom\)/, "no PC right/bottom anchors on this width");
  assert.doesNotMatch(block, /overflow:\s*hidden/, "the workspace is not clipped");
  assert.match(block, /\.workspace \{[^}]*min-height: max\(calc\(100svh - 82px\), var\(--shortcut-content-height, 0px\)\)/);
  assert.match(block, /\.workspace \{[^}]*padding: 0 0 56px;/, "the 56px taskbar reserve stays");
  assert.match(block, /\n  \.desktop-icon \{[^}]*touch-action: pan-y pinch-zoom;/);
  assert.doesNotMatch(block, /touch-action: none/);
  // ≤520px keeps its grid reset.
  assert.match(styles, /@media \(max-width: 520px\) \{\n  \.desktop-icon \{ inset: auto !important; \}/);
});

test("UI-09: no stylesheet rule puts overflow: hidden or touch-action on html/body, and no script locks the page scroll", () => {
  const css = [styles, lf(readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")), lf(readFileSync(new URL("../app/portia-promotion-editor.css", import.meta.url), "utf8"))].join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const subjects = match[1].split(",").map((selector) => selector.trim().split(/\s+/).pop() ?? "");
    if (!subjects.some((subject) => /^(html|body)(?![\w-])/.test(subject))) continue;
    assert.doesNotMatch(match[2], /overflow(-y)?:\s*hidden|touch-action/, `${match[1].trim()} locks the page`);
  }
  assert.doesNotMatch(`${source}\n${shortcutsSource}`, /document\.body\.style\.(overflow|touchAction)|documentElement\.style\.overflow/);
});
