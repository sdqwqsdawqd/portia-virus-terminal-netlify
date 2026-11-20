import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAX_BLOCKS, MAX_SUBSECTIONS } from "./content-limits.ts";
import { LIVE_EXCLUDED, LIVE_TABS, TEXT_LIMIT, applyLiveAdd, applyLiveCards, applyLiveFraming, applyLiveImage, applyLiveMove, applyLiveRemove, applyLiveText, liveAddKinds, liveAppForTab, liveMediaUrls, liveAddBlocked, liveBroadcastFeed, liveContainerFull, liveNewId, liveRemovedKeys, liveTextKey, applyLiveDate, applyLiveFlag, liveDateError } from "./live-edit.ts";
import { broadcastFeed } from "./broadcasts.ts";
import { portiaTextKey, type PortiaContent } from "./portia-content.ts";

// LIVE-01..05 (26.1-10): the pure model of the live editing mode. The draft is the editor's draft; every function edits it in place, as the editor's updaters do.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

function draftWithGuide(): PortiaContent {
  return {
    guideSections: [
      { id: "s1", title: "Первый", photo: "", cards: [{ id: "c1", title: "Карточка один", cover: "", blocks: [] }, { id: "c2", title: "Карточка два", cover: "", blocks: [] }] },
      { id: "s2", title: "Второй", photo: "", cards: [] },
    ],
    formattedText: {},
  } as unknown as PortiaContent;
}

test("LIVE-01: the live mode knows its tabs; search and employees are not among them", () => {
  assert.deepEqual([...LIVE_TABS], ["guide", "info", "broadcasts"]);
  assert.equal(liveAppForTab("info"), "info", "26.1-11: «Информация» has its live mode");
  assert.equal(liveAppForTab("guide"), "guide");
  assert.equal(liveAppForTab("users"), null);
  assert.equal(liveAppForTab("search"), null, "owner 2026-11-20: no live search");
  assert.equal(liveAppForTab("employees"), null, "owner 2026-11-20: no live employees");
  assert.deepEqual([...LIVE_EXCLUDED].sort(), ["employees", "search"]);
});

test("LIVE-02: a section title and a card title change in place and nothing else", () => {
  const draft = draftWithGuide();
  const before = JSON.stringify(draft);
  assert.equal(applyLiveText(draft, { kind: "guide-section-title", sectionId: "s1" }, "Оружие"), true);
  assert.equal(draft.guideSections[0].title, "Оружие");
  assert.equal(draft.guideSections[1].title, "Второй");
  assert.equal(draft.guideSections[0].cards[0].title, "Карточка один");
  assert.equal(applyLiveText(draft, { kind: "guide-card-title", cardId: "c2" }, "Пистолеты"), true);
  assert.equal(draft.guideSections[0].cards[1].title, "Пистолеты");
  assert.equal(draft.guideSections[0].cards[0].title, "Карточка один");
  assert.notEqual(JSON.stringify(draft), before);
});

test("LIVE-02: an unknown id changes nothing and says so", () => {
  const draft = draftWithGuide();
  const before = JSON.stringify(draft);
  assert.equal(applyLiveText(draft, { kind: "guide-section-title", sectionId: "nope" }, "x"), false);
  assert.equal(applyLiveText(draft, { kind: "guide-card-title", cardId: "nope" }, "x"), false);
  assert.equal(JSON.stringify(draft), before);
});

test("LIVE-02: a title is cut to the 300 signs of the editor fields", () => {
  assert.equal(TEXT_LIMIT, 300);
  const draft = draftWithGuide();
  applyLiveText(draft, { kind: "guide-section-title", sectionId: "s1" }, "а".repeat(400));
  assert.equal(draft.guideSections[0].title.length, 300);
});

test("LIVE-04: the shared module reads the context and imports nothing of the editor or the desktop", () => {
  const shared = read("components/portia-live-edit.tsx");
  assert.match(shared, /export const LiveEditContext/);
  assert.match(shared, /export function useLiveEdit\(/);
  assert.doesNotMatch(shared, /from "@\/components\/portia-editor/);
  assert.doesNotMatch(shared, /from "@\/components\/portia-desktop/);
});

test("LIVE-04: only the editor seam provides the context; the desktop never does, and never imports the seam", () => {
  assert.match(read("components/portia-editor-live.tsx"), /LiveEditContext\.Provider/);
  for (const file of ["components/portia-desktop.tsx", "components/portia-desktop-documents.tsx", "components/portia-desktop-dossier.tsx", "components/portia-desktop-media.tsx"]) {
    const text = read(file);
    assert.doesNotMatch(text, /LiveEditContext\.Provider/, `${file} must not provide the context`);
    assert.doesNotMatch(text, /portia-editor-live/, `${file} must not import the seam`);
  }
});

test("LIVE-04: GuideApp asks for the live API and every live class stands in a branch of live, so a visitor's page carries none", () => {
  const guide = read("components/portia-desktop-documents.tsx");
  assert.match(guide, /useLiveEdit\("guide"\)/);
  const lines = guide.split("\n");
  const classed = lines.flatMap((line, index) => (/["`]live-[a-z]/.test(line) ? [{ line, before: lines.slice(Math.max(0, index - 4), index).join(" ") }] : []));
  assert.equal(classed.length, 4, "the live classes of GuideApp: block row, fold button, section tools, tile row");
  for (const { line, before } of classed) {
    // The compiler already keeps `live.x(` out of a visitor's render (live may be null); a bare class needs its guard on the line or within the four above.
    assert.ok(/\blive\.\w+|\blive &&|\blive \?/.test(line) || /\{live \?/.test(before), `a live class outside a live branch: ${line.trim().slice(0, 100)}`);
  }
  // Without a provider GuideApp draws the old markup: the section head is the old button, the tile the old button, the block the bare view.
  assert.match(guide, /<\/div> : <button type="button" className=\{`guide-section-head/);
  assert.match(guide, /if \(!live\) return view;/);
  assert.match(guide, /return live \? <div className="live-tile"[^\n]*: tile;/);
});

test("LIVE-02: GuideApp offers the bar in its four places and the order, remove and text places of its rows", () => {
  const guide = read("components/portia-desktop-documents.tsx");
  for (const container of ["guide-root", "guide-section", "guide-card", "guide-table"]) assert.ok(guide.includes(`live.addBar({ kind: "${container}"`), container);
  for (const list of ["guide-sections", "guide-cards", "guide-blocks"]) assert.ok(guide.includes(`live.order({ kind: "${list}"`), list);
  for (const item of ["guide-section", "guide-card", "guide-block", "guide-table-row"]) assert.ok(guide.includes(`live.remove({ kind: "${item}"`), item);
  for (const target of ["guide-section-title", "guide-card-title", "guide-heading", "guide-callout-label", "guide-photo-caption", "guide-table-key", "guide-table-value"]) assert.ok(guide.includes(`kind: "${target}"`), target);
  for (const call of ["live.rich(", "live.video(", "live.cards(", "live.image("]) assert.ok(guide.includes(call), call);
  assert.ok(read("app/portia.css").includes(".live-add-bar"));
});

test("LIVE-05: the live text at rest is the visitor's FormattedText with its GIFs, pressed it is the editor's field with the strip of the same GIFs", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.doesNotMatch(seam, /embedMedia=\{false\}/, "a link to a GIF is never turned back into text");
  assert.match(seam, /<FormattedText\b/);
  assert.match(seam, /<EmbeddedMediaStrip\b/);
  assert.match(seam, /<FormattedTextarea\b[\s\S]*area=\{target\.kind === "broadcast-body" \? "broadcast" : "info"\}/);
  assert.match(seam, /const key = liveTextKey\(target\);/);
  assert.match(seam, /onActivate=\{bridge\.activateFormatter\}/);
  const card = read("components/portia-virus-card.tsx");
  const strip = card.slice(card.indexOf("export function EmbeddedMediaStrip"), card.indexOf("export function DossierSection"));
  assert.match(strip, /<EmbeddedImage\b/);
  assert.doesNotMatch(strip, /<FormattedText|embedMedia/);
  // Covers, section photos and photo blocks are the visitor's PortiaImage; the seam adds only the way to change them and draws no still frame, canvas or poster.
  const guide = read("components/portia-desktop-documents.tsx");
  assert.match(guide, /children: block\.url \? picture : null/);
  assert.doesNotMatch(seam, /<canvas|poster=|<PortiaImage/);
});

test("LIVE-02: the seam makes rows with the held order and a confirmed remove, and closes the format panel for what is removed", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /rowProps: \{ "data-sort-index": index \}/);
  assert.match(seam, /<OrderDragHandle\b/);
  assert.match(seam, /<ConfirmDialog\b/);
  assert.match(seam, /bridge\.closeFormatterFor\(\.\.\.liveRemovedKeys\(/);
  assert.match(seam, /applyLiveMove\(next, list, from, to\)/);
  for (const call of ["applyLiveAdd(", "applyLiveRemove(", "applyLiveImage(", "applyLiveFraming(", "applyLiveCards("]) assert.ok(seam.includes(call), call);
});

test("LIVE-03: leaving the live mode keeps the draft: the toggle holds no content and the surface draws the editor's draft", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /sections=\{bridge\.draft\.guideSections\} formattedText=\{bridge\.draft\.formattedText\}/);
  const mode = seam.slice(seam.indexOf("export function useLiveMode"), seam.indexOf("export function LiveModeToggle"));
  assert.doesNotMatch(mode, /changeDraft|draft/);
  const editor = read("components/portia-editor.tsx");
  assert.match(editor, /const live = useLiveMode\(tab,/);
  assert.match(editor, /\{live\.on \? <LiveSurface tab=\{tab\} bridge=\{\{/);
});

test("LIVE-03: the seam keeps no content state of its own: every change goes through the editor bridge", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.doesNotMatch(seam, /useState<PortiaContent/);
  assert.doesNotMatch(seam, /useReducer/);
  assert.match(seam, /bridge\.changeDraft\(/);
  assert.match(seam, /bridge\.changeFormattedText\(/);
  for (const match of seam.matchAll(/applyLive(Text|Add|Move|Remove)\(/g)) assert.ok(match.index >= 0);
});

function draftWithBlocks(): PortiaContent {
  return {
    guideSections: [
      { id: "s1", title: "Первый", photo: "", cards: [{ id: "c1", title: "К1", cover: "", blocks: [
        { id: "b1", type: "heading", text: "Заголовок" },
        { id: "b2", type: "text", text: "Текст" },
        { id: "b3", type: "table", rows: [{ id: "r1", key: "а", value: "б" }, { id: "r2", key: "в", value: "г" }] },
        { id: "b4", type: "photo", url: "https://x/y.gif", caption: "Подпись", framing: { x: 10, y: 20, zoom: 1.5 } },
        { id: "b5", type: "video", videoId: "" },
        { id: "b6", type: "callout", label: "Метка", text: "Врезка" },
        { id: "b7", type: "cards", cardIds: [] },
      ] }] },
      { id: "s2", title: "Второй", photo: "", cards: [] },
    ],
    formattedText: { "guide-block:b2:text": { runs: [{ text: "Текст" }] }, "guide-block:b6:text": { runs: [{ text: "Врезка" }] } },
  } as unknown as PortiaContent;
}

test("LIVE-02: the text places of a card page: heading, callout label, photo caption, table cells, block text", () => {
  const draft = draftWithBlocks();
  const blocks = () => draft.guideSections[0].cards[0].blocks;
  assert.equal(applyLiveText(draft, { kind: "guide-heading", cardId: "c1", blockId: "b1" }, "Новый"), true);
  assert.equal((blocks()[0] as { text: string }).text, "Новый");
  assert.equal(applyLiveText(draft, { kind: "guide-callout-label", cardId: "c1", blockId: "b6" }, "Важно"), true);
  assert.equal((blocks()[5] as { label: string }).label, "Важно");
  assert.equal(applyLiveText(draft, { kind: "guide-photo-caption", cardId: "c1", blockId: "b4" }, "Фото"), true);
  assert.equal((blocks()[3] as { caption: string }).caption, "Фото");
  assert.equal(applyLiveText(draft, { kind: "guide-table-key", cardId: "c1", blockId: "b3", rowId: "r2" }, "ключ"), true);
  assert.equal(applyLiveText(draft, { kind: "guide-table-value", cardId: "c1", blockId: "b3", rowId: "r2" }, "значение"), true);
  assert.deepEqual((blocks()[2] as { rows: unknown[] }).rows, [{ id: "r1", key: "а", value: "б" }, { id: "r2", key: "ключ", value: "значение" }]);
  assert.equal(applyLiveText(draft, { kind: "guide-block-text", cardId: "c1", blockId: "b2" }, "а".repeat(500)), true);
  assert.equal((blocks()[1] as { text: string }).text.length, 500, "a block text is not cut to the line limit");
  assert.equal(applyLiveText(draft, { kind: "guide-block-text", cardId: "c1", blockId: "b6" }, "Врезка 2"), true);
  assert.equal((blocks()[5] as { text: string }).text, "Врезка 2");
  assert.equal(applyLiveText(draft, { kind: "guide-table-key", cardId: "c1", blockId: "b3", rowId: "nope" }, "x"), false);
  assert.equal(applyLiveText(draft, { kind: "guide-heading", cardId: "c1", blockId: "b2" }, "x"), false, "a heading place does not write into a text block");
});

test("LIVE-02: the video link is read as a YouTube address; anything else leaves no video", () => {
  const draft = draftWithBlocks();
  const video = () => (draft.guideSections[0].cards[0].blocks[4] as { videoId: string }).videoId;
  assert.equal(applyLiveText(draft, { kind: "guide-video-url", cardId: "c1", blockId: "b5" }, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
  assert.equal(video(), "dQw4w9WgXcQ");
  applyLiveText(draft, { kind: "guide-video-url", cardId: "c1", blockId: "b5" }, "https://example.com/watch?v=dQw4w9WgXcQ");
  assert.equal(video(), "");
});

test("LIVE-02: a new address replaces a picture and drops its frame; the same address keeps it; the frame can be set and cleared", () => {
  const draft = draftWithBlocks();
  const photo = () => draft.guideSections[0].cards[0].blocks[3] as { url: string; framing?: unknown };
  const target = { kind: "guide-photo-url", cardId: "c1", blockId: "b4" } as const;
  assert.equal(applyLiveImage(draft, target, "https://x/y.gif"), true);
  assert.ok(photo().framing, "the same address keeps the frame");
  applyLiveImage(draft, target, "https://x/z.png");
  assert.equal(photo().url, "https://x/z.png");
  assert.equal(photo().framing, undefined);
  assert.equal(applyLiveFraming(draft, target, { x: 1, y: 2, zoom: 1 }), true);
  assert.deepEqual(photo().framing, { x: 1, y: 2, zoom: 1 });
  applyLiveFraming(draft, target, undefined);
  assert.equal(photo().framing, undefined);
  applyLiveImage(draft, { kind: "guide-card-cover", cardId: "c1" }, "https://x/cover.gif");
  assert.equal(draft.guideSections[0].cards[0].cover, "https://x/cover.gif");
  applyLiveImage(draft, { kind: "guide-section-photo", sectionId: "s2" }, "https://x/band.png");
  assert.equal(draft.guideSections[1].photo, "https://x/band.png");
  assert.equal(applyLiveImage(draft, { kind: "guide-card-cover", cardId: "nope" }, "https://x/a.png"), false);
  assert.equal(applyLiveImage(draft, { kind: "guide-photo-url", cardId: "c1", blockId: "b1" }, "https://x/a.png"), false, "a heading has no picture");
});

test("LIVE-02: the cards of a block «Карточки» are set as given", () => {
  const draft = draftWithBlocks();
  assert.equal(applyLiveCards(draft, { kind: "guide-cards-block", cardId: "c1", blockId: "b7" }, ["c1"]), true);
  assert.deepEqual((draft.guideSections[0].cards[0].blocks[6] as { cardIds: string[] }).cardIds, ["c1"]);
  assert.equal(applyLiveCards(draft, { kind: "guide-cards-block", cardId: "c1", blockId: "b1" }, ["c1"]), false);
});

test("LIVE-02: the bar adds a section, a card and every block with the shape of the editor's own buttons and returns the new id", () => {
  const draft = draftWithGuide();
  const section = applyLiveAdd(draft, { kind: "guide-root" }, "section");
  assert.ok(section);
  assert.deepEqual(draft.guideSections.at(-1), { id: section, title: "НОВЫЙ РАЗДЕЛ", photo: "", cards: [] });
  const card = applyLiveAdd(draft, { kind: "guide-section", sectionId: "s2" }, "card");
  assert.ok(card);
  assert.deepEqual(draft.guideSections[1].cards, [{ id: card, title: "НОВАЯ КАРТОЧКА", cover: "", blocks: [] }]);
  const shapes: Record<string, unknown> = {
    heading: { type: "heading", text: "" },
    text: { type: "text", text: "" },
    photo: { type: "photo", url: "", caption: "" },
    video: { type: "video", videoId: "" },
    callout: { type: "callout", label: "", text: "" },
    cards: { type: "cards", cardIds: [] },
  };
  for (const [kind, shape] of Object.entries(shapes)) {
    const id = applyLiveAdd(draft, { kind: "guide-card", cardId: card! }, kind as "heading");
    assert.ok(id, kind);
    assert.deepEqual(draft.guideSections[1].cards[0].blocks.at(-1), { id, ...(shape as object) }, kind);
  }
  const table = applyLiveAdd(draft, { kind: "guide-card", cardId: card! }, "table");
  const made = draft.guideSections[1].cards[0].blocks.at(-1) as unknown as { id: string; type: string; rows: { id: string; key: string; value: string }[] };
  assert.equal(made.id, table);
  assert.equal(made.type, "table");
  assert.equal(made.rows.length, 1);
  assert.deepEqual([made.rows[0].key, made.rows[0].value], ["", ""]);
  const row = applyLiveAdd(draft, { kind: "guide-table", cardId: card!, blockId: table! }, "row");
  assert.ok(row);
  assert.equal(made.rows.length, 2);
});

test("LIVE-02: the bar respects the limits and what a container takes", () => {
  const draft = draftWithGuide();
  draft.guideSections[1].cards = Array.from({ length: MAX_SUBSECTIONS }, (_, index) => ({ id: `k${index}`, title: "", cover: "", blocks: [] }));
  assert.equal(applyLiveAdd(draft, { kind: "guide-section", sectionId: "s2" }, "card"), null, "a full section takes no card");
  draft.guideSections[0].cards[0].blocks = Array.from({ length: MAX_BLOCKS }, (_, index) => ({ id: `b${index}`, type: "heading" as const, text: "" }));
  assert.equal(applyLiveAdd(draft, { kind: "guide-card", cardId: "c1" }, "text"), null, "a full card takes no block");
  assert.equal(applyLiveAdd(draft, { kind: "guide-root" }, "text"), null, "the list of sections takes only sections");
  assert.equal(applyLiveAdd(draft, { kind: "guide-section", sectionId: "nope" }, "card"), null);
  assert.deepEqual(liveAddKinds({ kind: "guide-root" }), ["section"]);
  assert.deepEqual(liveAddKinds({ kind: "guide-section", sectionId: "s1" }), ["card"]);
  assert.deepEqual(liveAddKinds({ kind: "guide-card", cardId: "c1" }), ["heading", "text", "table", "photo", "video", "callout", "cards"]);
  assert.deepEqual(liveAddKinds({ kind: "guide-table", cardId: "c1", blockId: "b3" }), ["row"]);
});

test("LIVE-05: liveMediaUrls finds the GIFs and pictures of a text as the visitor's text does", () => {
  assert.deepEqual(liveMediaUrls("текст https://media.giphy.com/media/abc/giphy.gif ещё"), ["https://media.giphy.com/media/abc/giphy.gif"]);
  assert.deepEqual(liveMediaUrls("https://giphy.com/gifs/x-abc"), ["https://media.giphy.com/media/abc/giphy.gif"]);
  assert.deepEqual(liveMediaUrls("смотри https://klipy.com/gifs/anime-tsundere-6."), ["https://static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/e0/d8/GIVgKXMP.gif"]);
  assert.deepEqual(liveMediaUrls("просто текст и https://example.com/page"), []);
  assert.deepEqual(liveMediaUrls(""), []);
});

test("LIVE-02: sections, cards and blocks are moved like moveArrayItem; out of range changes nothing", () => {
  const draft = draftWithGuide();
  assert.equal(applyLiveMove(draft, { kind: "guide-sections" }, 0, 1), true);
  assert.deepEqual(draft.guideSections.map((section) => section.id), ["s2", "s1"]);
  assert.equal(applyLiveMove(draft, { kind: "guide-cards", sectionId: "s1" }, 1, 0), true);
  assert.deepEqual(draft.guideSections[1].cards.map((card) => card.id), ["c2", "c1"]);
  const withBlocks = draftWithBlocks();
  assert.equal(applyLiveMove(withBlocks, { kind: "guide-blocks", cardId: "c1" }, 0, 6), true);
  assert.deepEqual(withBlocks.guideSections[0].cards[0].blocks.map((block) => block.id), ["b2", "b3", "b4", "b5", "b6", "b7", "b1"]);
  const before = JSON.stringify(draft);
  assert.equal(applyLiveMove(draft, { kind: "guide-sections" }, 0, 5), false);
  assert.equal(applyLiveMove(draft, { kind: "guide-sections" }, -1, 0), false);
  assert.equal(applyLiveMove(draft, { kind: "guide-sections" }, 1, 1), false);
  assert.equal(applyLiveMove(draft, { kind: "guide-cards", sectionId: "nope" }, 0, 1), false);
  assert.equal(JSON.stringify(draft), before);
});

test("LIVE-02: removing goes through lib/editor-items: the formatting leaves with the block, the card; a table row just goes", () => {
  const draft = draftWithBlocks();
  assert.deepEqual(liveRemovedKeys(draft, { kind: "guide-block", cardId: "c1", blockId: "b2" }), ["guide-block:b2:text"]);
  assert.deepEqual(liveRemovedKeys(draft, { kind: "guide-section", sectionId: "s1" }), ["b1", "b2", "b3", "b4", "b5", "b6", "b7"].map((id) => `guide-block:${id}:text`));
  assert.deepEqual(liveRemovedKeys(draft, { kind: "guide-table-row", cardId: "c1", blockId: "b3", rowId: "r1" }), []);
  assert.equal(applyLiveRemove(draft, { kind: "guide-table-row", cardId: "c1", blockId: "b3", rowId: "r1" }), true);
  assert.deepEqual((draft.guideSections[0].cards[0].blocks[2] as { rows: { id: string }[] }).rows.map((row) => row.id), ["r2"]);
  assert.equal(applyLiveRemove(draft, { kind: "guide-block", cardId: "c1", blockId: "b2" }), true);
  assert.equal(draft.formattedText["guide-block:b2:text"], undefined);
  assert.equal(draft.guideSections[0].cards[0].blocks.some((block) => block.id === "b2"), false);
  assert.equal(applyLiveRemove(draft, { kind: "guide-block", cardId: "c1", blockId: "b2" }), false, "already gone");
  assert.equal(applyLiveRemove(draft, { kind: "guide-card", cardId: "c1" }), true);
  assert.equal(draft.formattedText["guide-block:b6:text"], undefined);
  assert.equal(draft.guideSections[0].cards.length, 0);
  assert.equal(applyLiveRemove(draft, { kind: "guide-section", sectionId: "s2" }), true);
  assert.deepEqual(draft.guideSections.map((section) => section.id), ["s1"]);
  assert.equal(applyLiveRemove(draft, { kind: "guide-section", sectionId: "s2" }), false);
});

test("T-26.1-22: the live text reads only textContent, takes a paste as plain text and puts a string in the draft", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.ok(seam.includes('getData("text/plain")'), "a paste is plain text");
  assert.ok(seam.includes("event.currentTarget.textContent"), "only textContent is read");
  assert.ok(!seam.includes("innerHTML") && !seam.includes("dangerouslySetInnerHTML"), "no markup goes in or out");
  assert.ok(seam.includes('"plaintext-only"') && seam.includes('"true"'), "a browser without plaintext-only still edits as plain text");
});

test("LIVE-04: the live mode covers guide, info, broadcasts, viruses, recycle and assistant by type; search and employees are excluded", () => {
  const model = read("lib/live-edit.ts");
  assert.ok(model.includes('export type LiveApp = "guide" | "info" | "broadcasts" | "viruses" | "recycle" | "assistant";'));
  assert.ok(!/LiveApp = [^;]*"(search|employees)"/.test(model));
});

// ---- 26.1-11: «Информация» и «Сводка» ----

function draftWithInfo(): PortiaContent {
  return {
    infoSections: [
      { id: "i1", title: "Первый", body: "Тело", subsections: [{ id: "u1", title: "Под", blocks: [] }] },
      { id: "i2", title: "Второй", body: "", subsections: [] },
    ],
    formattedText: {},
  } as unknown as PortiaContent;
}

test("LIVE-02 (26.1-11): the title and the body of an info section change in place; the body is kept whole", () => {
  const draft = draftWithInfo();
  assert.equal(applyLiveText(draft, { kind: "info-section-title", sectionId: "i1" }, "Правила"), true);
  assert.equal(draft.infoSections[0].title, "Правила");
  assert.equal(draft.infoSections[1].title, "Второй");
  const long = "б".repeat(TEXT_LIMIT + 50);
  assert.equal(applyLiveText(draft, { kind: "info-section-body", sectionId: "i1" }, long), true);
  assert.equal(draft.infoSections[0].body.length, TEXT_LIMIT + 50, "a formatted text is not cut like a line");
  assert.equal(applyLiveText(draft, { kind: "info-section-title", sectionId: "nope" }, "x"), false);
  assert.equal(applyLiveText(draft, { kind: "info-section-body", sectionId: "nope" }, "x"), false);
});

test("LIVE-02 (26.1-11): the formatting key of a live text is the editor's own key for that place", () => {
  assert.equal(liveTextKey({ kind: "info-section-body", sectionId: "i1" }), portiaTextKey.info("i1"));
  assert.equal(liveTextKey({ kind: "guide-block-text", cardId: "c", blockId: "b" }), portiaTextKey.guideBlock("b"));
});

test("LIVE-01/04 (26.1-11): the desktop draws the info article through InfoArticle of its seam; the seam asks for the live API and the surface carries data-live-app=info", () => {
  const info = read("components/portia-desktop-info.tsx");
  assert.match(info, /export function InfoArticle\(/);
  assert.match(info, /useLiveEdit\("info"\)/);
  assert.match(read("components/portia-desktop.tsx"), /<InfoArticle\b/);
  assert.match(read("components/portia-editor-live.tsx"), /data-live-app="info"/);
  assert.match(info, /live\.text\(\{ kind: "info-section-title"/);
  assert.match(info, /live\.rich\(\{ kind: "info-section-body"/);
  assert.doesNotMatch(info, /LiveEditContext\.Provider|portia-editor-live/);
});

function draftWithInfoBlocks(): PortiaContent {
  return {
    infoSections: [
      { id: "i1", title: "Первый", body: "Тело", subsections: [
        { id: "u1", title: "Под один", blocks: [
          { id: "k1", type: "text", text: "Текст" },
          { id: "k2", type: "table", rows: [{ id: "r1", key: "а", value: "б" }, { id: "r2", key: "в", value: "г" }] },
          { id: "k3", type: "photo", url: "https://x/y.gif", framing: { x: 10, y: 20, zoom: 1.5 } },
          { id: "k4", type: "video", videoId: "" },
        ] },
        { id: "u2", title: "Под два", blocks: [] },
      ] },
      { id: "i2", title: "Второй", body: "", subsections: [] },
    ],
    formattedText: { "info:i1:body": { runs: [{ text: "Тело" }] }, "info-block:k1:text": { runs: [{ text: "Текст" }] } },
  } as unknown as PortiaContent;
}

test("LIVE-02 (26.1-11): the places of a subsection article: title, block text, table cells, video link", () => {
  const draft = draftWithInfoBlocks();
  assert.equal(applyLiveText(draft, { kind: "info-subsection-title", subsectionId: "u2" }, "Новое имя"), true);
  assert.equal(draft.infoSections[0].subsections[1].title, "Новое имя");
  assert.equal(applyLiveText(draft, { kind: "info-block-text", subsectionId: "u1", blockId: "k1" }, "Новый текст"), true);
  assert.equal((draft.infoSections[0].subsections[0].blocks[0] as { text: string }).text, "Новый текст");
  assert.equal(liveTextKey({ kind: "info-block-text", subsectionId: "u1", blockId: "k1" }), portiaTextKey.infoBlock("k1"));
  assert.equal(applyLiveText(draft, { kind: "info-table-key", subsectionId: "u1", blockId: "k2", rowId: "r2" }, "ключ"), true);
  assert.equal(applyLiveText(draft, { kind: "info-table-value", subsectionId: "u1", blockId: "k2", rowId: "r2" }, "значение"), true);
  const rows = (draft.infoSections[0].subsections[0].blocks[1] as { rows: { key: string; value: string }[] }).rows;
  assert.deepEqual(rows.map((row) => [row.key, row.value]), [["а", "б"], ["ключ", "значение"]]);
  assert.equal(applyLiveText(draft, { kind: "info-video-url", subsectionId: "u1", blockId: "k4" }, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
  assert.equal((draft.infoSections[0].subsections[0].blocks[3] as { videoId: string }).videoId, "dQw4w9WgXcQ");
  assert.equal(applyLiveText(draft, { kind: "info-video-url", subsectionId: "u1", blockId: "k4" }, "не ссылка"), true);
  assert.equal((draft.infoSections[0].subsections[0].blocks[3] as { videoId: string }).videoId, "", "nothing recognised leaves no video");
});

test("LIVE-02 (26.1-11): a place of the wrong kind or a vanished id changes nothing", () => {
  const draft = draftWithInfoBlocks();
  const before = JSON.stringify(draft);
  assert.equal(applyLiveText(draft, { kind: "info-block-text", subsectionId: "u1", blockId: "k2" }, "x"), false, "a table has no text");
  assert.equal(applyLiveText(draft, { kind: "info-table-key", subsectionId: "u1", blockId: "k1", rowId: "r1" }, "x"), false);
  assert.equal(applyLiveText(draft, { kind: "info-subsection-title", subsectionId: "nope" }, "x"), false);
  assert.equal(applyLiveText(draft, { kind: "info-video-url", subsectionId: "u1", blockId: "k3" }, "x"), false);
  assert.equal(JSON.stringify(draft), before);
});

test("LIVE-02 (26.1-11): the address of a photo block replaces the picture and drops its frame; the frame can be set and cleared", () => {
  const draft = draftWithInfoBlocks();
  const target = { kind: "info-photo-url", subsectionId: "u1", blockId: "k3" } as const;
  const photo = () => draft.infoSections[0].subsections[0].blocks[2] as { url: string; framing?: unknown };
  assert.equal(applyLiveImage(draft, target, "https://x/y.gif"), true);
  assert.ok(photo().framing, "the same address keeps the frame");
  assert.equal(applyLiveImage(draft, target, "https://x/z.png"), true);
  assert.equal(photo().url, "https://x/z.png");
  assert.equal(photo().framing, undefined);
  assert.equal(applyLiveFraming(draft, target, { x: 1, y: 2, zoom: 2 }), true);
  assert.deepEqual(photo().framing, { x: 1, y: 2, zoom: 2 });
  assert.equal(applyLiveImage(draft, { kind: "info-photo-url", subsectionId: "u1", blockId: "k1" }, "https://x/q.png"), false, "a text block has no picture");
});

test("LIVE-02 (26.1-11): the bar adds a section, a subsection and every info block with the shape of the editor's own buttons", () => {
  const draft = draftWithInfoBlocks();
  const section = applyLiveAdd(draft, { kind: "info-index", sectionId: "i1" }, "section");
  assert.ok(section);
  assert.deepEqual(draft.infoSections.at(-1), { id: section, title: "НОВЫЙ РАЗДЕЛ", body: "", subsections: [] });
  const sub = applyLiveAdd(draft, { kind: "info-index", sectionId: "i2" }, "subsection");
  assert.ok(sub);
  assert.deepEqual(draft.infoSections[1].subsections, [{ id: sub, title: "НОВЫЙ ПОДРАЗДЕЛ", blocks: [] }]);
  for (const kind of ["text", "table", "photo", "video"] as const) {
    const id = applyLiveAdd(draft, { kind: "info-subsection", subsectionId: "u2" }, kind);
    assert.ok(id, kind);
  }
  const blocks = draft.infoSections[0].subsections[1].blocks;
  assert.deepEqual(blocks.map((block) => block.type), ["text", "table", "photo", "video"]);
  assert.deepEqual(blocks[0], { id: blocks[0].id, type: "text", text: "" });
  assert.equal((blocks[1] as { rows: unknown[] }).rows.length, 1);
  assert.deepEqual(blocks[2], { id: blocks[2].id, type: "photo", url: "" });
  assert.deepEqual(blocks[3], { id: blocks[3].id, type: "video", videoId: "" });
  assert.ok(applyLiveAdd(draft, { kind: "info-table", subsectionId: "u1", blockId: "k2" }, "row"));
  assert.equal((draft.infoSections[0].subsections[0].blocks[1] as { rows: unknown[] }).rows.length, 3);
  assert.equal(applyLiveAdd(draft, { kind: "info-subsection", subsectionId: "u2" }, "heading"), null, "an info block is not a guide heading");
  assert.equal(applyLiveAdd(draft, { kind: "info-index", sectionId: "nope" }, "subsection"), null);
  assert.equal(applyLiveAdd(draft, { kind: "info-subsection", subsectionId: "nope" }, "text"), null);
  assert.deepEqual(liveAddKinds({ kind: "info-index", sectionId: "i1" }), ["section", "subsection"]);
  assert.deepEqual(liveAddKinds({ kind: "info-subsection", subsectionId: "u1" }), ["text", "table", "photo", "video"]);
  assert.deepEqual(liveAddKinds({ kind: "info-table", subsectionId: "u1", blockId: "k2" }), ["row"]);
});

test("LIVE-02 (26.1-11): an id made beforehand is the id the new element gets, so the surface can show it", () => {
  const draft = draftWithInfoBlocks();
  const container = { kind: "info-index", sectionId: "i1" } as const;
  const id = liveNewId(container, "subsection");
  assert.equal(applyLiveAdd(draft, container, "subsection", id), id);
  assert.equal(draft.infoSections[0].subsections.at(-1)?.id, id);
});

test("LIVE-02 (26.1-11): the bar respects the limits of subsections and blocks", () => {
  const draft = draftWithInfoBlocks();
  draft.infoSections[1].subsections = Array.from({ length: MAX_SUBSECTIONS }, (_, index) => ({ id: `f${index}`, title: "", blocks: [] }));
  assert.equal(applyLiveAdd(draft, { kind: "info-index", sectionId: "i2" }, "subsection"), null);
  assert.equal(liveAddBlocked(draft, { kind: "info-index", sectionId: "i2" }, "subsection"), true);
  assert.equal(liveAddBlocked(draft, { kind: "info-index", sectionId: "i2" }, "section"), false, "sections have no limit");
  assert.equal(liveAddBlocked(draft, { kind: "info-index", sectionId: "" }, "subsection"), true, "no section to add to");
  draft.infoSections[0].subsections[1].blocks = Array.from({ length: MAX_BLOCKS }, (_, index) => ({ id: `b${index}`, type: "text" as const, text: "" }));
  assert.equal(applyLiveAdd(draft, { kind: "info-subsection", subsectionId: "u2" }, "text"), null);
  assert.equal(liveContainerFull(draft, { kind: "info-subsection", subsectionId: "u2" }), true);
  assert.equal(liveContainerFull(draft, { kind: "info-subsection", subsectionId: "u1" }), false);
});

test("LIVE-02 (26.1-11): sections, subsections and blocks of «Информации» move like moveArrayItem", () => {
  const draft = draftWithInfoBlocks();
  assert.equal(applyLiveMove(draft, { kind: "info-sections" }, 0, 1), true);
  assert.deepEqual(draft.infoSections.map((item) => item.id), ["i2", "i1"]);
  assert.equal(applyLiveMove(draft, { kind: "info-subsections", sectionId: "i1" }, 1, 0), true);
  assert.deepEqual(draft.infoSections[1].subsections.map((item) => item.id), ["u2", "u1"]);
  assert.equal(applyLiveMove(draft, { kind: "info-blocks", subsectionId: "u1" }, 0, 3), true);
  assert.deepEqual(draft.infoSections[1].subsections[1].blocks.map((item) => item.id), ["k2", "k3", "k4", "k1"]);
  assert.equal(applyLiveMove(draft, { kind: "info-blocks", subsectionId: "u1" }, 0, 9), false);
  assert.equal(applyLiveMove(draft, { kind: "info-blocks", subsectionId: "nope" }, 0, 1), false);
});

test("LIVE-02 (26.1-11): removing in «Информации» goes through lib/editor-items: the formatting leaves with the element", () => {
  const draft = draftWithInfoBlocks();
  assert.deepEqual(liveRemovedKeys(draft, { kind: "info-block", subsectionId: "u1", blockId: "k1" }), [portiaTextKey.infoBlock("k1")]);
  assert.deepEqual(liveRemovedKeys(draft, { kind: "info-subsection", sectionId: "i1", subsectionId: "u1" }).sort(), [portiaTextKey.infoBlock("k1"), portiaTextKey.infoBlock("k2"), portiaTextKey.infoBlock("k3"), portiaTextKey.infoBlock("k4")].sort());
  assert.ok(liveRemovedKeys(draft, { kind: "info-section", sectionId: "i1" }).includes(portiaTextKey.info("i1")), "the body of the section goes too");
  assert.equal(applyLiveRemove(draft, { kind: "info-block", subsectionId: "u1", blockId: "k1" }), true);
  assert.equal(draft.formattedText[portiaTextKey.infoBlock("k1")], undefined);
  assert.equal(draft.infoSections[0].subsections[0].blocks.length, 3);
  assert.equal(applyLiveRemove(draft, { kind: "info-table-row", subsectionId: "u1", blockId: "k2", rowId: "r1" }), true);
  assert.equal((draft.infoSections[0].subsections[0].blocks[0] as { rows: unknown[] }).rows.length, 1);
  assert.equal(applyLiveRemove(draft, { kind: "info-subsection", sectionId: "i1", subsectionId: "u2" }), true);
  assert.deepEqual(draft.infoSections[0].subsections.map((item) => item.id), ["u1"]);
  assert.equal(applyLiveRemove(draft, { kind: "info-section", sectionId: "i1" }), true);
  assert.equal(draft.formattedText[portiaTextKey.info("i1")], undefined);
  assert.deepEqual(draft.infoSections.map((item) => item.id), ["i2"]);
  assert.equal(applyLiveRemove(draft, { kind: "info-section", sectionId: "i1" }), false);
  assert.equal(applyLiveRemove(draft, { kind: "info-block", subsectionId: "u1", blockId: "k9" }), false);
});

test("LIVE-02/05 (26.1-11): InfoArticle offers the places of its rows; a text block is rich (the visitor's FormattedText at rest), a photo is the visitor's PortiaImage", () => {
  const info = read("components/portia-desktop-info.tsx");
  for (const call of ["live.rich(", "live.video(", "live.image(", "live.text("]) assert.ok(info.includes(call), call);
  assert.ok(info.includes('live.addBar({ kind: "info-subsection"'));
  assert.ok(info.includes('live.addBar({ kind: "info-table"'));
  assert.ok(info.includes('live.order({ kind: "info-blocks"'));
  assert.ok(info.includes('live.remove({ kind: "info-block"'));
  for (const target of ["info-subsection-title", "info-block-text", "info-table-key", "info-table-value", "info-video-url", "info-photo-url"]) assert.ok(info.includes(`kind: "${target}"`), target);
  assert.match(info, /<PortiaImage\b[^>]*priority="lazy"/);
  assert.doesNotMatch(info, /embedMedia=\{false\}/, "no live path turns a GIF link back into text"); // planner-discipline-allow: embedMedia={false}
  assert.doesNotMatch(info, /<canvas|poster=/);
});

test("LIVE-02 (26.1-11): the live table of contents holds the order, the remove and the bar for sections and subsections", () => {
  const seam = read("components/portia-editor-live.tsx");
  const surface = seam.slice(seam.indexOf("function InfoSurface"), seam.indexOf("/** The tools of the live mode of `app`"));
  for (const part of ['live.order({ kind: "info-sections" }', 'live.order({ kind: "info-subsections"', 'live.remove({ kind: "info-section"', 'live.remove({ kind: "info-subsection"', 'live.addBar({ kind: "info-index"']) assert.ok(surface.includes(part), part);
  assert.match(surface, /<nav className="info-index"/);
  assert.match(seam, /liveNewId\(container, kind\)/);
});

function draftWithBroadcasts(): PortiaContent {
  const base = { published: true, important: false, startsAt: "", endsAt: "", conditions: "" };
  return {
    broadcasts: [
      { ...base, id: "n1", type: "news", title: "Новость", body: "Тело новости", important: true },
      { ...base, id: "n2", type: "news", title: "Вторая", body: "", published: false },
      { ...base, id: "q1", type: "quest", title: "Квест", body: "Тело квеста", startsAt: "2026-11-10", endsAt: "2026-11-20", conditions: "Условие" },
      { ...base, id: "t1", type: "task", title: "Задача", body: "", published: false },
    ],
    formattedText: { "broadcast:n1:body": { runs: [{ text: "Тело новости" }] } },
  } as unknown as PortiaContent;
}

test("LIVE-01 (26.1-11): «Сводка» has its live mode", () => {
  assert.deepEqual([...LIVE_TABS], ["guide", "info", "broadcasts"]);
  assert.equal(liveAppForTab("broadcasts"), "broadcasts");
});

test("LIVE-02 (26.1-11): the title, the body and the conditions of an entry change in place; the conditions keep their lines", () => {
  const draft = draftWithBroadcasts();
  assert.equal(applyLiveText(draft, { kind: "broadcast-title", broadcastId: "n2" }, "Заголовок"), true);
  assert.equal(draft.broadcasts[1].title, "Заголовок");
  assert.equal(draft.broadcasts[0].title, "Новость");
  const long = "в".repeat(TEXT_LIMIT + 20);
  assert.equal(applyLiveText(draft, { kind: "broadcast-body", broadcastId: "n1" }, long), true);
  assert.equal(draft.broadcasts[0].body.length, TEXT_LIMIT + 20, "a formatted text is not cut like a line");
  assert.equal(applyLiveText(draft, { kind: "broadcast-conditions", broadcastId: "q1" }, "Первая\nВторая"), true);
  assert.equal(draft.broadcasts[2].conditions, "Первая\nВторая");
  assert.equal(liveTextKey({ kind: "broadcast-body", broadcastId: "n1" }), portiaTextKey.broadcast("n1"));
  assert.equal(applyLiveText(draft, { kind: "broadcast-title", broadcastId: "nope" }, "x"), false);
});

test("LIVE-02 (26.1-11): the flags: «Показывать посетителям» for every entry, «Важно» for news only", () => {
  const draft = draftWithBroadcasts();
  assert.equal(applyLiveFlag(draft, { kind: "broadcast-published", broadcastId: "n2" }, true), true);
  assert.equal(draft.broadcasts[1].published, true);
  assert.equal(applyLiveFlag(draft, { kind: "broadcast-important", broadcastId: "n2" }, true), true);
  assert.equal(draft.broadcasts[1].important, true);
  assert.equal(applyLiveFlag(draft, { kind: "broadcast-important", broadcastId: "q1" }, true), false, "D-19: a quest is never important");
  assert.equal(draft.broadcasts[2].important, false);
  assert.equal(applyLiveFlag(draft, { kind: "broadcast-published", broadcastId: "nope" }, true), false);
});

test("LIVE-02/T-26.1-25 (26.1-11): a quest date is checked before it reaches the draft: a bad day or an end before the start is not written", () => {
  const draft = draftWithBroadcasts();
  const ends = { kind: "broadcast-ends", broadcastId: "q1" } as const;
  const starts = { kind: "broadcast-starts", broadcastId: "q1" } as const;
  assert.equal(liveDateError(draft, ends, "2026-11-05"), true, "the end is before the start 2026-11-10");
  assert.equal(applyLiveDate(draft, ends, "2026-11-05"), false);
  assert.equal(draft.broadcasts[2].endsAt, "2026-11-20", "nothing written");
  assert.equal(liveDateError(draft, ends, "2026-11-25"), false);
  assert.equal(applyLiveDate(draft, ends, "2026-11-25"), true);
  assert.equal(draft.broadcasts[2].endsAt, "2026-11-25");
  assert.equal(applyLiveDate(draft, starts, "2026-12-01"), false, "the start after the end");
  assert.equal(applyLiveDate(draft, starts, "2026-11-12"), true);
  assert.equal(applyLiveDate(draft, ends, ""), true, "a date can be cleared");
  assert.equal(draft.broadcasts[2].endsAt, "");
  assert.equal(applyLiveDate(draft, starts, "завтра"), false, "not a day");
  assert.equal(applyLiveDate(draft, starts, "2026-13-45"), false, "not a real day");
  assert.equal(applyLiveDate(draft, { kind: "broadcast-starts", broadcastId: "n1" }, "2026-11-12"), false, "news have no dates");
  assert.equal(applyLiveDate(draft, { kind: "broadcast-starts", broadcastId: "nope" }, "2026-11-12"), false);
});

test("LIVE-02 (26.1-11): the bar adds a news or a quest at the top, blank and not shown to visitors, like the editor's button", () => {
  const draft = draftWithBroadcasts();
  const news = applyLiveAdd(draft, { kind: "broadcasts" }, "news");
  assert.ok(news);
  assert.deepEqual(draft.broadcasts[0], { id: news, type: "news", title: "", body: "", published: false, important: false, startsAt: "", endsAt: "", conditions: "" });
  const quest = applyLiveAdd(draft, { kind: "broadcasts" }, "quest");
  assert.equal(draft.broadcasts[0].id, quest);
  assert.equal(draft.broadcasts[0].type, "quest");
  assert.deepEqual(liveAddKinds({ kind: "broadcasts" }), ["news", "quest"]);
  assert.equal(applyLiveAdd(draft, { kind: "broadcasts" }, "section"), null);
  assert.equal(liveAddBlocked(draft, { kind: "broadcasts" }, "news"), false);
  const id = liveNewId({ kind: "broadcasts" }, "quest");
  assert.equal(applyLiveAdd(draft, { kind: "broadcasts" }, "quest", id), id);
});

test("LIVE-02 (26.1-11): removing an entry takes its formatting with it", () => {
  const draft = draftWithBroadcasts();
  assert.deepEqual(liveRemovedKeys(draft, { kind: "broadcast", broadcastId: "n1" }), [portiaTextKey.broadcast("n1")]);
  assert.equal(applyLiveRemove(draft, { kind: "broadcast", broadcastId: "n1" }), true);
  assert.deepEqual(draft.broadcasts.map((item) => item.id), ["n2", "q1", "t1"]);
  assert.equal(draft.formattedText[portiaTextKey.broadcast("n1")], undefined);
  assert.equal(applyLiveRemove(draft, { kind: "broadcast", broadcastId: "n1" }), false);
});

test("LIVE-02 (26.1-11): the live feed is the visitor's order by dates, with the entries not yet shown to visitors; it never reorders by hand", () => {
  const draft = draftWithBroadcasts();
  const news = liveBroadcastFeed(draft.broadcasts, "news", "2026-11-15");
  assert.deepEqual(news.map((item) => item.id), ["n1", "n2"], "important first, the draft entry stays in the list");
  assert.deepEqual(news.map((item) => item.published), [true, false], "the real flag is kept");
  const quests = liveBroadcastFeed(draft.broadcasts, "quests", "2026-11-25");
  assert.deepEqual(quests.map((item) => item.id), ["t1", "q1"], "a task counts as active, the finished quest goes last");
  assert.equal(draft.broadcasts[1].published, false, "the draft itself is not touched");
  // the visitor's own feed still hides what is not published
  assert.deepEqual(broadcastFeed(draft.broadcasts, "news", "2026-11-15").map((item) => item.id), ["n1"]);
});

test("LIVE-02/04 (26.1-11): BroadcastCard is the visitor's card, drawn by the desktop with no context, with the live places only behind live", () => {
  const info = read("components/portia-desktop-info.tsx");
  assert.match(info, /export function BroadcastCard\(/);
  assert.match(info, /useLiveEdit\("broadcasts"\)/);
  assert.match(read("components/portia-desktop.tsx"), /<BroadcastCard\b/);
  for (const part of ['live.text({ kind: "broadcast-title"', 'live.text({ kind: "broadcast-conditions"', 'live.rich({ kind: "broadcast-body"', 'live.date({ kind: "broadcast-starts"', 'live.date({ kind: "broadcast-ends"', 'live.flag({ kind: "broadcast-published"', 'live.flag({ kind: "broadcast-important"', 'live.remove({ kind: "broadcast"']) assert.ok(info.includes(part), part);
  assert.doesNotMatch(info, /live\.order\(\{ kind: "broadcast/, "the feed is ordered by dates: nothing to reorder");
  assert.doesNotMatch(info, /embedMedia=\{false\}/); // planner-discipline-allow: embedMedia={false}
  // every live class of the seam stands in a branch of live, so a visitor's card carries none
  const lines = info.split("\n");
  for (const [index, line] of lines.entries()) {
    if (!/["`]live-[a-z]|\blive-draft\b/.test(line)) continue;
    const near = lines.slice(Math.max(0, index - 5), index + 1).join(" ");
    assert.ok(/\blive\b\s*(\?|&&)|if \(!?live\)|\{live\b/.test(near), `a live class outside a live branch: ${line.trim().slice(0, 100)}`);
  }
});

test("LIVE-01/02 (26.1-11): the live «Сводка» draws the visitor's header, tabs and the live feed with the bar «Новость / Квест»", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /data-live-app="broadcasts"/);
  assert.match(seam, /liveBroadcastFeed\(/);
  assert.match(seam, /<BroadcastCard\b/);
  assert.match(seam, /bridge\.setBroadcastTab\(/);
  assert.ok(seam.includes('live.addBar({ kind: "broadcasts" })'));
  assert.match(seam, /export function LiveDate\(/);
  assert.match(seam, /export function LiveFlag\(/);
  assert.match(seam, /liveDateError\(/);
  // the date never goes to the draft when it is wrong, and the short error stands beside it (T-26.1-25)
  const date = seam.slice(seam.indexOf("export function LiveDate("), seam.indexOf("export function LiveFlag("));
  assert.match(date, /liveDateError\(/);
  assert.match(date, /role="alert"|aria-invalid/);
});
