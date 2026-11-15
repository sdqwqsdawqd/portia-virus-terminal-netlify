// Source-level tests of the access-level placeholder surfaces (Phase 24, plan 24-02): the component forms, the exact placeholder
// string and the CSS block. The browser, the live roles and the physical devices stay BLOCKED until plan 24-11 proves them;
// nothing here claims them. Plans 24-06, 24-09 and 24-10 append their own checks below.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { lf } from "./component-source.ts";
import { levelCopy } from "./level-copy.ts";

const componentsDir = new URL("../components/", import.meta.url);

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const componentSource = (name: string) => stripComments(lf(readFileSync(new URL(name, componentsDir), "utf8")));

const redacted = componentSource("portia-redacted.tsx");

test("D-08 the placeholder has five forms: row, index, tile, bar, block", () => {
  const match = redacted.match(/export type RedactedVariant = ([^;]+);/);
  assert.ok(match, "RedactedVariant is missing");
  assert.deepEqual([...match[1].matchAll(/"(\w+)"/g)].map((entry) => entry[1]), ["row", "index", "tile", "bar", "block"]);
  assert.ok(redacted.includes('variant === "block"'), "the block form is not drawn");
  assert.ok(redacted.includes('variant === "row" || variant === "index"'), "only row and index show a number");
});

test("D-09 the block form is a status region that can take focus by script only", () => {
  assert.equal((redacted.match(/role="status"/g) ?? []).length, 1);
  assert.equal((redacted.match(/tabIndex=\{-1\}/g) ?? []).length, 1);
  assert.ok(redacted.includes("levelCopy.redacted(level)"), "the block title is not the placeholder string");
  assert.ok(redacted.includes('aria-hidden="true"'), "the lock icon must be hidden from assistive technology");
});

test("D-09/T-24-36 no form has a handler, a link, a button, data attributes, a tab stop, aria-expanded or a second name", () => {
  assert.doesNotMatch(redacted, /\bon[A-Z][A-Za-z]*\s*=/, "event handler");
  assert.doesNotMatch(redacted, /\bhref\s*=|<a[\s>]|<button[\s>]|<input[\s>]|<img[\s>]/, "link, control or picture");
  assert.doesNotMatch(redacted, /\bdata-[a-z-]+\s*=/, "data attribute");
  assert.doesNotMatch(redacted, /tabIndex=\{(?!-1\})/, "a tab stop other than -1");
  assert.doesNotMatch(redacted, /aria-expanded|aria-label|aria-controls|title=/, "state or a second name");
});

test("T-24-36 the placeholder takes only level, variant, index, listItem and className", () => {
  const props = redacted.match(/RedactedPlaceholder\(\{([\s\S]*?)\}: \{([\s\S]*?)\n\}\)/);
  assert.ok(props, "props are missing");
  assert.deepEqual(props[1].split(",").map((name) => name.trim()).filter(Boolean), ["level", "variant", "index", "listItem", "className"]);
  assert.deepEqual([...props[2].matchAll(/^\s{2}(\w+)\??:/gm)].map((entry) => entry[1]), ["level", "variant", "index", "listItem", "className"]);
});

test("EDGE LVL-04/encoding: the placeholder string is ЗАСЕКРЕЧЕНО, U+0020 U+00B7 U+0020, «нужен допуск », an Arabic digit - compared by code points", () => {
  const word = [0x417, 0x410, 0x421, 0x415, 0x41a, 0x420, 0x415, 0x427, 0x415, 0x41d, 0x41e];
  const need = [0x43d, 0x443, 0x436, 0x435, 0x43d, 0x20, 0x434, 0x43e, 0x43f, 0x443, 0x441, 0x43a, 0x20];
  for (const level of [1, 2, 3, 4, 5]) {
    const expected = [...word, 0x20, 0xb7, 0x20, ...need, 0x30 + level];
    assert.deepEqual([...levelCopy.redacted(level)].map((char) => char.codePointAt(0)), expected, `level ${level}`);
  }
});

test("T-24-05 no component imports the server redaction or the response builder, so the interface never filters by itself", () => {
  const files = readdirSync(componentsDir).filter((name) => name.endsWith(".tsx"));
  assert.ok(files.length > 0);
  for (const name of files) {
    assert.doesNotMatch(componentSource(name), /(?:@\/lib\/|\.\.?\/(?:lib\/)?)(?:level-redact|content-response)\b/, `${name} imports redaction`);
  }
});

test("T-24-36 the placeholder file imports only the icons and the copy", () => {
  const imports = [...redacted.matchAll(/^import .* from "([^"]+)";$/gm)].map((entry) => entry[1]);
  assert.deepEqual(imports, ["@/components/portia-icons", "@/lib/level-copy"]);
});

// The CSS block of the placeholder. app/portia.css is one file; the block is cut out by its markers.
const portiaCss = lf(readFileSync(new URL("../app/portia.css", import.meta.url), "utf8"));
const accessBlock = portiaCss.match(/^\/\* access-levels:start[\s\S]*?^\/\* access-levels:end \*\/$/m)?.[0] ?? "";

type CssRule = { selector: string; body: string; media: string | null };

// Rules of the block with the media query they stand in; the block has no deeper nesting than one media query.
function blockRules(block: string): CssRule[] {
  const rules: CssRule[] = [];
  const text = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const media of text.matchAll(/@media\s*([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    for (const rule of media[2].matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push({ selector: rule[1].trim(), body: rule[2], media: media[1].trim() });
  }
  const withoutMedia = text.replace(/@media\s*[^{]+\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "");
  for (const rule of withoutMedia.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push({ selector: rule[1].trim(), body: rule[2], media: null });
  return rules;
}

const rules = blockRules(accessBlock);
const ruleFor = (selector: string, media: string | null = null) => rules.find((rule) => rule.selector === selector && rule.media === media);
const declaration = (rule: CssRule | undefined, property: string) => rule?.body.match(new RegExp(String.raw`(?:^|[;\s])${property}\s*:\s*([^;]+)`))?.[1].trim();

test("the access-levels block exists once and the placeholder is styled only inside it", () => {
  assert.ok(accessBlock.startsWith("/* access-levels:start"), "the block is missing");
  assert.equal(portiaCss.match(/^\/\* access-levels:start/gm)?.length, 1);
  assert.equal(portiaCss.match(/^\/\* access-levels:end \*\/$/gm)?.length, 1);
  const outside = portiaCss.replace(accessBlock, "");
  assert.doesNotMatch(outside, /\.access-redacted/, "the placeholder is styled outside the block");
  assert.ok(portiaCss.indexOf("/* access-levels:end */") < portiaCss.indexOf("/* users-tab:start"), "users-tab must stay last");
  for (const variant of ["row", "index", "tile", "bar", "block"]) assert.ok(ruleFor(`.access-redacted-${variant}`), `.access-redacted-${variant} is not styled`);
});

test("S2 long-text: the two segments never break, the wrapper wraps anywhere, so a 320px line breaks only at the middle point", () => {
  assert.equal(declaration(ruleFor(".access-redacted-word"), "white-space"), "nowrap");
  assert.equal(declaration(ruleFor(".access-redacted-need"), "white-space"), "nowrap");
  assert.equal(declaration(ruleFor(".access-redacted"), "overflow-wrap"), "anywhere");
  assert.equal(declaration(ruleFor(".access-redacted"), "max-width"), "100%");
});

test("D-09 the placeholder is static: no hover, no pointer, no animation in any rule that names it", () => {
  // Phase 24, plan 24-07: the level picker shares the block and is interactive (hover, pointer), so only the rules that name the placeholder are held static.
  const placeholderRules = rules.filter((rule) => rule.selector.includes(".access-redacted"));
  assert.ok(placeholderRules.length > 0);
  for (const rule of placeholderRules) {
    assert.doesNotMatch(rule.selector, /:hover|:active|:focus/, rule.selector);
    assert.doesNotMatch(rule.body, /cursor\s*:\s*pointer/, rule.selector);
  }
  assert.equal(declaration(ruleFor(".access-redacted"), "cursor"), "default");
});

test("S1 populated: a placeholder row has the height of a virus row, on the phone too", () => {
  assert.equal(declaration(ruleFor(".access-redacted-row"), "min-height"), "65px");
  const phone = ruleFor(".virus-list > .access-redacted-row", "(max-width: 900px)");
  assert.ok(phone, "the phone rule is missing");
  assert.equal(declaration(phone, "min-height"), "62px");
  assert.equal(declaration(phone, "min-width"), "210px");
  assert.equal(declaration(phone, "scroll-snap-align"), "start");
});

test("S1 overflow: no placeholder rule is wider than the 210px of a phone row or scrolls sideways", () => {
  for (const rule of rules.filter((entry) => entry.selector.includes(".access-redacted"))) {
    for (const property of ["width", "min-width"]) {
      const value = declaration(rule, property);
      if (value?.endsWith("px")) assert.ok(Number.parseFloat(value) <= 210, `${rule.selector} ${property}: ${value}`);
    }
    assert.doesNotMatch(rule.body, /overflow-x|white-space\s*:\s*pre\b/, rule.selector);
  }
});

test("D-08 the block keeps sharp corners and uses no token of the site that is not declared", () => {
  assert.doesNotMatch(accessBlock, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:|--muted|#[0-9a-fA-F]{3,8}\b/);
});

// Phase 24, plan 24-09: «База вирусов», «Информация» and «Справочник» draw the placeholders and switch the open window. Source-level only:
// the live downgrade in a browser, the focus move and the announcement stay BLOCKED until backstop S6 (plan 24-11).
const desktop = componentSource("portia-desktop.tsx");
const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `${from} is missing`);
  const end = text.indexOf(to, start + from.length);
  assert.ok(end > start, `${to} is missing after ${from}`);
  return text.slice(start, end);
};

test("D-20/D-22 every answer and the device copy reconcile the three windows through reconcileSelection and the slot chains", () => {
  const fetchBody = between(desktop, "const fetchContent = useCallback(", "const retryContent = useCallback(");
  assert.ok(fetchBody.includes("applySelections(contentRef.current, fetched)"), "fetchContent does not reconcile");
  assert.ok(fetchBody.indexOf("applySelections(") < fetchBody.indexOf("setContent(fetched)"), "the old copy must be read before the new one is set");
  const cacheBody = between(desktop, "const cachedContent = normalizePortiaContent(parsed.content);", "const savedAt");
  assert.ok(cacheBody.includes("applySelections(contentRef.current, cachedContent)"), "the device copy does not reconcile");
  assert.ok((desktop.match(/reconcileSelection\(/g) ?? []).length >= 3, "one rule for virus, info and guide");
  for (const chain of ["simpleSlotChain(previous, current.id)", "infoSlotChain(previous, current.id)", "guideSlotChain(previous, current.id)"]) assert.ok(desktop.includes(chain), chain);
  // The old "keep it or take the first" updaters are gone: they would show the first record in place of a closed one.
  assert.doesNotMatch(desktop, /setActiveVirusId\(\(current\)|setSelectedInfoId\(\(current\)/);
});

test("T-24-30 a window left on a closed record shows the block and never the first record or the old one", () => {
  assert.ok(desktop.includes("const activeVirus = virusLostShown ? undefined :"), "no first-record fallback while the record is lost");
  assert.ok(desktop.includes("const selectedInfoEntry = infoLostShown ? null :"));
  assert.ok(desktop.includes('<RedactedPlaceholder variant="block" level={virusLostShown.level} />'), "the dossier block");
  assert.ok(desktop.includes('<RedactedPlaceholder variant="block" level={infoLostShown.level} />'), "the article block");
  // What is kept of the lost record is its slot and the level of the placeholder, nothing of its copy.
  assert.ok(desktop.includes("type LostSelection = { slot: string; level: number } | null;"));
});

test("D-10 the table of contents draws a closed section and a closed subsection as an index line and the marker counts them", () => {
  assert.ok(desktop.includes('variant="index"'));
  const index = between(desktop, '<aside className="info-index">', "</aside>");
  assert.ok(index.includes("mergePlaceholders(section.subsections, content.redaction?.infoSubsections?.[section.id])"));
  assert.ok(index.includes("{subRows.length}"), "the marker counts placeholders");
  const closedSection = between(index, 'if (row.kind === "redacted")', "const section = row.item;");
  assert.doesNotMatch(closedSection, /aria-expanded|onClick|<button/, "a closed section is static");
  // The pinned buttons of open rows keep their search marks.
  assert.ok(index.includes('hitAttrs("info", section.id)') && index.includes('hitAttrs("info", sub.id)'));
});

test("S1 empty: a copy of placeholders only is not an empty database; the dossier, the article and the list say nothing is open", () => {
  assert.ok(desktop.includes("levelCopy.archiveNoOpen.heading") && desktop.includes("levelCopy.archiveNoOpen.body"));
  assert.ok(desktop.includes("levelCopy.sectionsNoOpen.heading") && desktop.includes("levelCopy.sectionsNoOpen.body"));
  assert.ok(desktop.includes("count: virusRecordCount"), "the archive counts placeholders");
  assert.ok(desktop.includes("content.infoSections.length + (content.redaction?.infoSections.length ?? 0)"));
  // A database with nothing at all keeps its own empty text.
  assert.ok(desktop.includes("emptyCopy.archive.heading") && desktop.includes("emptyCopy.info.heading"));
});

test("UI-SPEC section 4 the focus moves to the next open row, the search box, the window title, or the block; other focus is left alone", () => {
  assert.ok(desktop.includes("function captureRedactionFocus()"));
  assert.ok(desktop.includes('.access-redacted-block'), "focus goes to the block of the replaced content");
  assert.ok(desktop.includes("if (focused.isConnected) return;"), "an element that is still on screen is never moved");
  assert.ok(desktop.includes("compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING"), "the next row after the focused one");
  assert.ok(desktop.includes('".window-identity"'), "the window title is the last resort");
  const fetchBody = between(desktop, "const fetchContent = useCallback(", "const retryContent = useCallback(");
  assert.ok(fetchBody.indexOf("captureRedactionFocus()") < fetchBody.indexOf("setContent(fetched)") && fetchBody.indexOf("restoreFocus?.()") > fetchBody.indexOf("setContent(fetched)"));
});

test("D-10 the guide draws a closed section as a bar and a closed card as a tile, merged by place, and a closed card page as the block", () => {
  const guide = componentSource("portia-desktop-documents.tsx");
  assert.ok(guide.includes('variant="bar"') && guide.includes('variant="tile"') && guide.includes('variant="block"'));
  assert.ok(guide.includes("mergePlaceholders(sections, placeholders?.sections)"));
  assert.ok(guide.includes("mergePlaceholders(section.cards, placeholders?.cards[section.id])"));
  assert.ok(guide.includes("levelCopy.sectionsNoOpen.heading") && guide.includes("levelCopy.sectionsNoOpen.body"));
  // A closed section has no head button, no photo, no chevron and no grid: its bar is the whole section.
  const bar = between(guide, 'if (row.kind === "redacted")', "const section = row.item;");
  assert.doesNotMatch(bar, /<button|PortiaImage|chevron|guide-grid|aria-expanded/);
  assert.doesNotMatch(guide, /<img[\s>]/, "lib/portia-desktop.test.ts keeps picture tags out of this file");
  // Only open sections fold: the folded ids are filtered by the open sections.
  assert.ok(guide.includes("sections.some((section) => section.id === id)"));
});

test("D-20 the desktop passes the guide placeholders and the lost level, and any card chosen ends a lost selection", () => {
  assert.ok(desktop.includes("placeholders={{ sections: content.redaction?.guideSections ?? [], cards: content.redaction?.guideCards ?? {} }}"));
  assert.ok(desktop.includes("lostLevel={guideLostShown?.level ?? null}"));
  assert.ok(desktop.includes("const openGuideCard = (id: string) => { setGuideCardId(id); setGuideLost(null); };"));
  assert.ok(desktop.includes("guideSlotChain(previous, current.id)"));
});

// Plan 24-10, task 1: the recycle bin (O-3, assumption A-4, not an owner decision).
test("O-3 the recycle bin draws a closed file or virus as a row placeholder on its place, with no name, location or type", () => {
  assert.ok(desktop.includes("mergePlaceholders(trashOrder, content.redaction?.recycle)"));
  const list = between(desktop, '<div className="trash-files">', "</div>\n                {trashLostShown");
  const closedRow = between(list, 'if (row.kind === "redacted")', "const key = row.item;");
  assert.ok(closedRow.includes('variant="row"') && closedRow.includes("key={row.slot}"));
  assert.doesNotMatch(closedRow, /<button|onClick|file\.name|file\.location|recycleFileType/, "a closed row is static and names nothing");
  // The pinned buttons of open rows keep their search marks.
  assert.ok(list.includes('hitAttrs("file", file.id)') && list.includes('hitAttrs("file", `virus:${virus.id}`)'));
});

test("O-3 the window counter counts the placeholders, and an empty bin means no files and no placeholders", () => {
  assert.ok(desktop.includes('meta={`ФАЙЛОВ ${String(trashRows.length).padStart(2, "0")}`}'));
  assert.ok(desktop.includes("(content.redaction?.recycle.length ?? 0)"), "the empty state counts the placeholders");
});

test("D-20 a file that became closed while viewed is replaced by the block; the head keeps only the close button", () => {
  assert.ok(desktop.includes("reconcileTrashSelection(previous, next, current.trash)"));
  assert.ok(desktop.includes("trashLost"), "the lost placeholder is remembered");
  const lost = between(desktop, "{trashLostShown && <div", "{activeTrashVirus && <div");
  assert.ok(lost.includes('<RedactedPlaceholder variant="block" level={trashLostShown.level} />'));
  assert.ok(lost.includes('aria-label="Закрыть файл"'));
  assert.doesNotMatch(lost, /\.name|\.code|ТОЛЬКО ДЛЯ ЧТЕНИЯ|ВИРУС В КОРЗИНЕ/, "no name in the head of the block");
  // The chain of a recycled virus is read through its plain id, the ids of the answer carry the virus: prefix.
  assert.ok(desktop.includes("simpleSlotChain(previous, trashRecordId(current.id))"));
});

// Plan 24-10, task 2: the «Устав» window, the search index, the Arabic level in the window title and the boot line.
const clientFiles = readdirSync(componentsDir).filter((name) => /\.tsx?$/.test(name));

test("D-11/T-24-31 the «Устав» address is not in the client code: the window reads it from the answer of the server", async () => {
  const { embeddedDocuments } = await import("./embedded-documents.ts");
  assert.ok(!desktop.includes("embeddedDocuments.charter.src"), "the address module is server only");
  assert.ok(!desktop.includes(embeddedDocuments.charter.src), "the address of the «Устав» is in the desktop source");
  for (const name of clientFiles) assert.ok(!readFileSync(new URL(name, componentsDir), "utf8").includes(embeddedDocuments.charter.src), `${name} holds the address of the «Устав»`);
  const embedded = between(desktop, "const embeddedApps = {", "} as const;");
  assert.ok(embedded.includes("sheet:") && !embedded.includes("charter"), "only the «Таблица» stays (O-1)");
  assert.ok(desktop.includes("documents.charter"), "the window takes the address from documents");
  assert.ok(desktop.includes("documents.charter.src") && desktop.includes("documents.charter.external"));
});

test("D-11/D-20 below the level the «Устав» window shows only the block; no frame, zoom bar or link is drawn, and the icon stays", () => {
  const windows = between(desktop, '{(["sheet", "charter"] as const).map((app) =>', "<AppWindow app=\"trash\"");
  assert.ok(windows.includes('meta="ДОКУМЕНТ ОТДЕЛА"'));
  const charterBranch = windows.slice(windows.indexOf("charterClosed"));
  assert.ok(charterBranch.startsWith('charterClosed\n                ? <RedactedPlaceholder variant="block" level={charterClosed.requiredLevel} />'), "the closed test comes first and draws the block");
  assert.ok(charterBranch.indexOf("<RedactedPlaceholder") < charterBranch.indexOf("<EmbeddedDocument"), "the frame is behind the closed test");
  assert.ok(windows.includes('contentFatal("flaskEmpty")') && windows.includes('<AppSkeleton shape="document" />'));
  assert.ok(desktop.includes('<DesktopIcon app="charter"'), "the desktop icon stays (D-11)");
});

test("LVL-05 the search index and the existence check of an app result use the list without a closed «Устав»", () => {
  assert.ok(desktop.includes("apps: searchApps"));
  assert.ok(!desktop.includes("apps: globalSearchApps"));
  assert.ok(desktop.includes("return searchApps.some((app) => app.id === result.id);"));
  assert.ok(desktop.includes('globalSearchApps.filter((app) => app.id !== "charter")'));
  assert.ok(desktop.includes("content.redaction?.apps?.charter"), "the filter follows the marker of the answer");
});

test("D-15 the archive window title and the boot line show the level in Arabic digits, from the answer or from the gate decision", () => {
  assert.ok(desktop.includes("levelCopy.archiveMeta("));
  assert.ok(desktop.includes("contentReady ? shownViewerLevel(content, viewerLevel) : viewerLevel"));
  assert.ok(desktop.includes("levelCopy.bootCheck("));
  assert.ok(desktop.includes("<BootScreen visible={booting} level={viewerLevel} />"));
  for (const name of clientFiles) {
    const text = readFileSync(new URL(name, componentsDir), "utf8");
    assert.doesNotMatch(text, /ДОПУСК II|УРОВЕНЬ II/, `${name} shows a Roman numeral of the level`);
  }
  assert.doesNotMatch(desktop, /meta="ДОПУСК/, "the archive title is built from the level");
  assert.equal(levelCopy.archiveMeta(3), "ДОПУСК 3");
  assert.equal(levelCopy.archiveMeta(null), "ДОПУСК");
  assert.equal(levelCopy.bootCheck(3), "ПРОВЕРКА ДОПУСКА… УРОВЕНЬ 3");
  assert.equal(levelCopy.bootCheck(null), "ПРОВЕРКА ДОПУСКА… OK");
});

test("SEC-07 no component and no copy of the visitor says that the links of the «Устав» or the «Таблица» are closed", () => {
  // The same detector as lib/level-docs.test.ts: a sentence that names a link and says closed or protected.
  const claims = (text: string) => text.split(/[.\n]/).filter((sentence) => /ссылк/i.test(sentence) && /(?:закрыт|защищ)/i.test(sentence));
  for (const name of clientFiles) assert.deepEqual(claims(lf(readFileSync(new URL(name, componentsDir), "utf8"))), [], name);
  assert.deepEqual(claims(lf(readFileSync(new URL("../lib/level-copy.ts", import.meta.url), "utf8"))), []);
});

// Plan 24-10, task 3: the editor wiring (LVL-08, D-05, D-17).
test("LVL-08 the desktop tells the editor that the content is incomplete and shows the line of the server's level lift", () => {
  assert.ok(desktop.includes("contentIncomplete={isViewerShapedContent(content)}"));
  assert.ok(desktop.includes("saveNotice={saveNotice}"));
  const save = between(desktop, "const saveContent = async", "const virusLostShown");
  assert.ok(save.includes("setSaveNotice(\"\")"), "the line of the previous save goes when a new save starts");
  assert.ok(save.includes("payload.levelsRaised") && save.includes("levelCopy.savedRaised("));
  // The server saved a lifted copy: the known revision is dropped and the copy is read, after the cache of the saved content.
  const raised = between(save, "if (typeof levelsRaised", 'setSaveState("saved")');
  assert.ok(raised.includes("levelsRaised > 0") && raised.includes("knownRevision.current = -1") && raised.includes("void fetchContent()"));
  assert.ok(save.indexOf("localStorage.setItem") < save.indexOf("if (typeof levelsRaised"), "the read follows the cache write of the saved copy");
});

test("D-17 the refusal of a viewer-shaped PUT shows the reason of the server, and the conflict branch is unchanged", () => {
  const save = between(desktop, "const saveContent = async", "const virusLostShown");
  assert.ok(save.includes('if (typeof body?.error === "string") setSaveError(body.error);'), "any refusal shows its reason");
  assert.ok(/setSaveState\("conflict"\);[\s\S]{0,200}void fetchContent\(\)/.test(save));
  assert.equal(levelCopy.savedRaised(2), "Уровни приведены к иерархии: изменено 2.", "the line follows 24-UI-SPEC");
});
