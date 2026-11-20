import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { MAX_BLOCKS, MAX_SCIENTIST_LOGS, MAX_SUBSECTIONS } from "./content-limits.ts";
import { LIVE_EXCLUDED, LIVE_TABS, TEXT_LIMIT, applyLiveAdd, applyLiveCards, applyLiveFraming, applyLiveImage, applyLiveMove, applyLiveRemove, applyLiveText, liveAddKinds, liveAppForTab, liveMediaUrls, liveAddBlocked, liveBroadcastFeed, liveContainerFull, liveNewId, liveRemovedKeys, liveTextKey, applyLiveDate, applyLiveFlag, liveDateError, applyLiveChoice, applyLiveLogText, liveRecycleKeys, applyLivePhrase, liveFormatKey, livePhraseLines, livePhraseSlice, applyLiveSettings, liveSettingsOk } from "./live-edit.ts";
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
  assert.deepEqual([...LIVE_TABS], ["guide", "info", "broadcasts", "viruses", "recycle", "assistant"]);
  assert.equal(liveAppForTab("info"), "info", "26.1-11: «Информация» has its live mode");
  assert.equal(liveAppForTab("guide"), "guide");
  assert.equal(liveAppForTab("users"), null);
  assert.equal(liveAppForTab("search"), null, "owner 2026-11-20: no live search");
  assert.equal(liveAppForTab("employees"), null, "owner 2026-11-20: no live employees");
  assert.deepEqual(Object.keys(LIVE_EXCLUDED).sort(), ["access", "employees", "promo", "search", "users"]);
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
  assert.match(seam, /<FormattedTextarea\b[\s\S]*area=\{richAreaOf\(target\)\}/);
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
  assert.deepEqual([...LIVE_TABS], ["guide", "info", "broadcasts", "viruses", "recycle", "assistant"]);
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

// ---- 26.1-12: «База вирусов» и «Корзина» ----

function draftWithViruses(): PortiaContent {
  const virus = (id: string, name: string) => ({
    id, code: `VIR-${id}`, name, status: "НАБЛЮДЕНИЕ", infectedImage: "", external: "Внешность", ppu: { health: "1", speed: "2", abilities: "3" }, physiology: "Физиология",
    mutations: [], classification: { danger: "Гефест", spread: "Номос", transmission: "Аэрозольный", escapeRisk: "Низкий", mind: "Нет", appearance: "Нет", behavior: "Нет" }, scientistLogs: [],
  });
  return { viruses: [virus("a", "Альфа"), virus("b", "Бета"), virus("c", "Гамма")], recycledViruses: [virus("r", "Сдана")], formattedText: {} } as unknown as PortiaContent;
}

test("LIVE-01 (26.1-12): the tab «База вирусов» has its live mode", () => {
  assert.equal(liveAppForTab("viruses"), "viruses");
});

test("LIVE-02 (26.1-12): the name, the code and the status of a virus change in place, cut to the lengths of the template (120, 40, 80)", () => {
  const draft = draftWithViruses();
  assert.equal(applyLiveText(draft, { kind: "virus-name", virusId: "b" }, "Новое имя"), true);
  assert.equal(draft.viruses[1].name, "Новое имя");
  assert.equal(draft.viruses[0].name, "Альфа");
  applyLiveText(draft, { kind: "virus-name", virusId: "a" }, "а".repeat(200));
  applyLiveText(draft, { kind: "virus-code", virusId: "a" }, "К".repeat(90));
  applyLiveText(draft, { kind: "virus-status", virusId: "a" }, "С".repeat(150));
  assert.deepEqual([draft.viruses[0].name.length, draft.viruses[0].code.length, draft.viruses[0].status.length], [120, 40, 80]);
  assert.equal(applyLiveText(draft, { kind: "virus-name", virusId: "nope" }, "x"), false);
});

test("LIVE-02 (26.1-12): the five texts of a virus are kept whole and keyed like the editor's own fields", () => {
  const draft = draftWithViruses();
  const fields = [["external", "external"], ["physiology", "physiology"], ["ppu-health", "health"], ["ppu-speed", "speed"], ["ppu-abilities", "abilities"]] as const;
  for (const [field, where] of fields) {
    const target = { kind: "virus-text", virusId: "a", field } as const;
    assert.equal(liveTextKey(target), portiaTextKey.virus("a", field));
    assert.equal(applyLiveText(draft, target, `текст ${field}`.repeat(60)), true);
    const written = field === "external" || field === "physiology" ? draft.viruses[0][field] : draft.viruses[0].ppu[where as "health" | "speed" | "abilities"];
    assert.equal(written, `текст ${field}`.repeat(60), "a formatted text is not cut to the line limit");
  }
  assert.equal(draft.viruses[1].external, "Внешность");
});

test("LIVE-02 (26.1-12): a virus that sits in the recycle bin is edited by the same places", () => {
  const draft = draftWithViruses();
  assert.equal(applyLiveText(draft, { kind: "virus-name", virusId: "r" }, "Из корзины"), true);
  assert.equal(draft.recycledViruses[0].name, "Из корзины");
  assert.equal(applyLiveText(draft, { kind: "virus-text", virusId: "r", field: "external" }, "Тело"), true);
  assert.equal(draft.recycledViruses[0].external, "Тело");
});

test("LIVE-02 (26.1-12): the viruses of the list are moved like moveArrayItem; out of range changes nothing", () => {
  const draft = draftWithViruses();
  assert.equal(applyLiveMove(draft, { kind: "viruses" }, 0, 2), true);
  assert.deepEqual(draft.viruses.map((item) => item.id), ["b", "c", "a"]);
  assert.equal(applyLiveMove(draft, { kind: "viruses" }, 0, 9), false);
  assert.equal(applyLiveMove(draft, { kind: "viruses" }, 1, 1), false);
});

test("LIVE-01/02/04 (26.1-12): the card asks for the live API and every live place stands behind it; without a provider it draws its old markup", () => {
  const card = read("components/portia-virus-card.tsx");
  assert.match(card, /useLiveEdit\("viruses"\)/);
  assert.match(card, /live\.rich\(/);
  for (const part of ['live.text({ kind: "virus-name"', 'live.text({ kind: "virus-code"', 'live.text({ kind: "virus-status"', 'kind: "virus-text"']) assert.ok(card.includes(part), part);
  // the card imports the shared context only, never the editor seam
  assert.doesNotMatch(card, /portia-editor/);
  // the old markup stays for the template and the visitor
  assert.ok(card.includes("plain(virus.name)") && card.includes("plain(virus.code)") && card.includes("plain(virus.status)"));
  assert.match(card, /<FormattedText className="lead-copy" text=\{virus\.external\}/);
  // a live card never turns the links to GIFs back into text (the template does, T-20-87)
  const seam = read("components/portia-editor-live.tsx");
  assert.doesNotMatch(seam, /embedMedia=\{false\}/); // planner-discipline-allow: embedMedia={false}
  assert.doesNotMatch(read("components/portia-desktop-dossier.tsx"), /embedMedia=\{false\}/); // planner-discipline-allow: embedMedia={false}
});

test("LIVE-02 (26.1-12): the live «База вирусов» draws the visitor's list rows and the card of the chosen virus inside the provider", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /data-live-app="viruses"/);
  assert.match(seam, /<VirusRecord\b/);
  assert.match(seam, /bridge\.setVirusId\(/);
  assert.ok(seam.includes('live.order({ kind: "viruses" }'));
  assert.match(seam, /className=\{`virus-row/);
  assert.match(seam, /liveCopy\.virusesEmpty/);
});

// ---- 26.1-12, task 2: the classification, the photo, the mutations and the records of scientists ----

function draftWithCard(): PortiaContent {
  const draft = draftWithViruses();
  draft.viruses[0].mutations = [
    { name: "М1", description: "Первая", image: "https://x/1.gif", imageFraming: { x: 10, y: 20, zoom: 1.5 } },
    { name: "М2", description: "Вторая", image: "" },
    { name: "М3", description: "Третья", image: "" },
  ];
  draft.viruses[0].scientistLogs = [
    { id: "l1", title: "Запись 1", scientist: "Доктор", lockedLevel: 1, content: ["один", "два"], richContent: { runs: [{ text: "один\n\nдва" }] } },
    { id: "l2", title: "Запись 2", scientist: "Иной", lockedLevel: 2, content: [""], richContent: { runs: [{ text: "" }] } },
  ];
  draft.formattedText = {
    [portiaTextKey.mutation("a", 0)]: { runs: [{ text: "Первая" }] },
    [portiaTextKey.mutation("a", 1)]: { runs: [{ text: "Вторая" }] },
    [portiaTextKey.mutation("a", 2)]: { runs: [{ text: "Третья" }] },
  };
  return draft;
}

test("LIVE-02 (26.1-12): the name and the text of a mutation change in place, found by position", () => {
  const draft = draftWithCard();
  assert.equal(applyLiveText(draft, { kind: "mutation-name", virusId: "a", index: 1 }, "Новая"), true);
  assert.equal(draft.viruses[0].mutations[1].name, "Новая");
  assert.equal(applyLiveText(draft, { kind: "mutation-description", virusId: "a", index: 2 }, "Текст".repeat(80)), true);
  assert.equal(draft.viruses[0].mutations[2].description.length, 400, "a formatted text is kept whole");
  assert.equal(liveTextKey({ kind: "mutation-description", virusId: "a", index: 2 }), portiaTextKey.mutation("a", 2));
  assert.equal(applyLiveText(draft, { kind: "mutation-name", virusId: "a", index: 9 }, "x"), false, "no mutation there");
});

test("LIVE-02 (26.1-12): the title, the pseudonym and the text of a scientist record change in place; the text keeps its formatting document", () => {
  const draft = draftWithCard();
  assert.equal(applyLiveText(draft, { kind: "log-title", virusId: "a", logId: "l2" }, "Новое"), true);
  assert.equal(applyLiveText(draft, { kind: "log-scientist", virusId: "a", logId: "l2" }, "Псевдо"), true);
  assert.deepEqual([draft.viruses[0].scientistLogs[1].title, draft.viruses[0].scientistLogs[1].scientist], ["Новое", "Псевдо"]);
  const target = { kind: "log-text", virusId: "a", logId: "l1" } as const;
  assert.equal(liveTextKey(target), "scientist:l1", "the format key the editor's own field uses");
  const document = { runs: [{ text: "новый " }, { text: "жирный", style: { fontWeight: 700 } }] };
  assert.equal(applyLiveLogText(draft, target, "новый жирный", document), true);
  assert.deepEqual(draft.viruses[0].scientistLogs[0].content, ["новый жирный"]);
  assert.deepEqual(draft.viruses[0].scientistLogs[0].richContent, document);
  applyLiveLogText(draft, target, "а\n\nб", { runs: [{ text: "а\n\nб" }] });
  assert.deepEqual(draft.viruses[0].scientistLogs[0].content, ["а", "б"], "paragraphs are split as the editor splits them");
  assert.equal(applyLiveLogText(draft, { kind: "log-text", virusId: "a", logId: "nope" }, "x", document), false);
});

test("LIVE-02 (26.1-12): a classification axis takes only a value of its list; the routes take the canonical string; the level of a record takes 1 to 5", () => {
  const draft = draftWithCard();
  assert.equal(applyLiveChoice(draft, { kind: "virus-class", virusId: "a", axis: "danger" }, "Протей"), true);
  assert.equal(draft.viruses[0].classification.danger, "Протей");
  assert.equal(applyLiveChoice(draft, { kind: "virus-class", virusId: "a", axis: "danger" }, "Выдумка"), false, "not a choice of the list");
  assert.equal(draft.viruses[0].classification.danger, "Протей");
  assert.equal(applyLiveChoice(draft, { kind: "virus-class", virusId: "a", axis: "transmission" }, "Аэрозольный, Половой путь"), true);
  assert.equal(draft.viruses[0].classification.transmission, "Аэрозольный, Половой путь");
  assert.equal(applyLiveChoice(draft, { kind: "log-level", virusId: "a", logId: "l1" }, "4"), true);
  assert.equal(draft.viruses[0].scientistLogs[0].lockedLevel, 4);
  assert.equal(applyLiveChoice(draft, { kind: "log-level", virusId: "a", logId: "l1" }, "9"), false);
  assert.equal(applyLiveChoice(draft, { kind: "log-level", virusId: "a", logId: "l1" }, "abc"), false);
  assert.equal(draft.viruses[0].scientistLogs[0].lockedLevel, 4);
});

test("LIVE-02 (26.1-12): the photo after infection and the picture of a mutation replace the address and drop the frame; the frame can be set and cleared", () => {
  const draft = draftWithCard();
  const photo = { kind: "virus-infected", virusId: "a" } as const;
  assert.equal(applyLiveImage(draft, photo, "https://x/photo.gif"), true);
  assert.equal(draft.viruses[0].infectedImage, "https://x/photo.gif");
  assert.equal(applyLiveFraming(draft, photo, { x: 5, y: 6, zoom: 2 }), true);
  assert.deepEqual(draft.viruses[0].infectedImageFraming, { x: 5, y: 6, zoom: 2 });
  applyLiveImage(draft, photo, "https://x/other.gif");
  assert.equal(draft.viruses[0].infectedImageFraming, undefined, "the frame belonged to the old picture");
  const mutation = { kind: "mutation-image", virusId: "a", index: 0 } as const;
  applyLiveImage(draft, mutation, "https://x/1.gif");
  assert.deepEqual(draft.viruses[0].mutations[0].imageFraming, { x: 10, y: 20, zoom: 1.5 }, "the same address keeps its frame");
  applyLiveImage(draft, mutation, "https://x/2.gif");
  assert.equal(draft.viruses[0].mutations[0].image, "https://x/2.gif");
  assert.equal(draft.viruses[0].mutations[0].imageFraming, undefined);
  assert.equal(applyLiveImage(draft, { kind: "mutation-image", virusId: "a", index: 7 }, "x"), false);
});

test("LIVE-02 (26.1-12): the bar of a virus adds a mutation and a scientist record with the shape of the editor's own buttons", () => {
  const draft = draftWithCard();
  assert.deepEqual(liveAddKinds({ kind: "virus", virusId: "a" }), ["mutation", "log"]);
  assert.ok(applyLiveAdd(draft, { kind: "virus", virusId: "a" }, "mutation") !== null);
  assert.deepEqual(draft.viruses[0].mutations[3], { name: "НОВАЯ МУТАЦИЯ", description: "", image: "" });
  const id = liveNewId({ kind: "virus", virusId: "a" }, "log");
  assert.equal(applyLiveAdd(draft, { kind: "virus", virusId: "a" }, "log", id), id);
  assert.deepEqual(draft.viruses[0].scientistLogs[2], { id, title: "ЗАПИСЬ 03", scientist: "ИМЯ УЧЁНОГО", lockedLevel: 1, content: [""], richContent: { runs: [{ text: "" }] } });
  assert.equal(applyLiveAdd(draft, { kind: "virus", virusId: "nope" }, "mutation"), null);
  assert.equal(applyLiveAdd(draft, { kind: "virus", virusId: "a" }, "text"), null, "a virus takes no other kind");
});

test("LIVE-02 (26.1-12): the records of scientists stop at the limit of the editor and the bar disables the button", () => {
  const draft = draftWithCard();
  const container = { kind: "virus", virusId: "a" } as const;
  while (draft.viruses[0].scientistLogs.length < MAX_SCIENTIST_LOGS) assert.ok(applyLiveAdd(draft, container, "log"));
  assert.equal(applyLiveAdd(draft, container, "log"), null);
  assert.equal(liveAddBlocked(draft, container, "log"), true);
  assert.equal(liveAddBlocked(draft, container, "mutation"), false);
  assert.equal(draft.viruses[0].scientistLogs.length, MAX_SCIENTIST_LOGS);
});

test("LIVE-02 (26.1-12): removing a mutation moves the later formatting keys down by one, like the editor; the format panel is told which keys go", () => {
  const draft = draftWithCard();
  assert.deepEqual(liveRemovedKeys(draft, { kind: "mutation", virusId: "a", index: 1 }), [portiaTextKey.mutation("a", 1), portiaTextKey.mutation("a", 2)]);
  assert.equal(applyLiveRemove(draft, { kind: "mutation", virusId: "a", index: 1 }), true);
  assert.deepEqual(draft.viruses[0].mutations.map((item) => item.name), ["М1", "М3"]);
  assert.equal(draft.formattedText[portiaTextKey.mutation("a", 1)]?.runs[0].text, "Третья", "the third one is the second now");
  assert.equal(draft.formattedText[portiaTextKey.mutation("a", 2)], undefined);
  assert.equal(draft.formattedText[portiaTextKey.mutation("a", 0)]?.runs[0].text, "Первая");
  assert.equal(applyLiveRemove(draft, { kind: "mutation", virusId: "a", index: 5 }), false);
});

test("LIVE-02 (26.1-12): removing a scientist record takes it out and names its format key", () => {
  const draft = draftWithCard();
  assert.deepEqual(liveRemovedKeys(draft, { kind: "log", virusId: "a", logId: "l1" }), ["scientist:l1"]);
  assert.equal(applyLiveRemove(draft, { kind: "log", virusId: "a", logId: "l1" }), true);
  assert.deepEqual(draft.viruses[0].scientistLogs.map((item) => item.id), ["l2"]);
  assert.equal(applyLiveRemove(draft, { kind: "log", virusId: "a", logId: "l1" }), false);
});

test("LIVE-02/04 (26.1-12): the live card puts the choice, the picture, the mutations and the bar behind the live API, and the seam draws them", () => {
  const card = read("components/portia-virus-card.tsx");
  for (const part of ['live.choice({ kind: "virus-class"', 'live.image({ kind: "virus-infected"', 'live.image({ kind: "mutation-image"', 'live.text({ kind: "mutation-name"', 'kind: "mutation-description"', 'live.remove({ kind: "mutation"', 'live.addBar({ kind: "virus"']) assert.ok(card.includes(part), part);
  assert.match(card, /key=\{live \? index : `\$\{mutation\.name\}-\$\{index\}`\}/, "a name typed in place does not remount the card");
  const dossier = read("components/portia-desktop-dossier.tsx");
  for (const part of ['kind: "log-title"', 'kind: "log-scientist"', 'live.choice({ kind: "log-level"', 'kind: "log-text"', 'live.remove({ kind: "log"']) assert.ok(dossier.includes(part), part);
  const shared = read("components/portia-live-edit.tsx");
  assert.match(shared, /choice: \(target: LiveChoiceTarget/);
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /export function LiveChoice\(/);
  assert.match(seam, /<ClassificationField\b/);
  assert.match(seam, /<LevelPicker\b/);
  assert.match(seam, /applyLiveChoice\(/);
  assert.match(seam, /applyLiveLogText\(/);
  assert.match(seam, /choice: \(target, value, options\) =>/);
});

// ---- 26.1-12, task 3: «Корзина» ----

function draftWithBin(): PortiaContent {
  const draft = draftWithCard();
  draft.recycleFiles = [
    { id: "f1", name: "один.txt", location: "C:\\A", kind: "text", content: "Тело", image: "" , virusId: "" },
    { id: "f2", name: "два.png", location: "C:\\B", kind: "image", content: "", image: "https://x/p.gif", imageFraming: { x: 1, y: 2, zoom: 1.2 }, virusId: "" },
  ];
  draft.recycleOrder = ["file:f2", "virus:r", "file:f1"];
  draft.formattedText[portiaTextKey.recycle("f1")] = { runs: [{ text: "Тело" }] };
  draft.formattedText[portiaTextKey.virus("r", "external")] = { runs: [{ text: "Внешность" }] };
  draft.recycledViruses[0].scientistLogs = [{ id: "rl", title: "З", scientist: "Я", lockedLevel: 1, content: [""], richContent: { runs: [{ text: "" }] } }];
  return draft;
}

test("LIVE-01 (26.1-12): the tab «Корзина» has its live mode", () => {
  assert.equal(liveAppForTab("recycle"), "recycle");
  assert.deepEqual([...LIVE_TABS], ["guide", "info", "broadcasts", "viruses", "recycle", "assistant"]);
});

test("LIVE-02 (26.1-12): the name, the place and the text of a file of the bin change in place; the text is kept whole and keyed like the editor's field", () => {
  const draft = draftWithBin();
  assert.equal(applyLiveText(draft, { kind: "recycle-file-name", fileId: "f1" }, "и".repeat(400)), true);
  assert.equal(draft.recycleFiles[0].name.length, 300);
  assert.equal(applyLiveText(draft, { kind: "recycle-file-location", fileId: "f1" }, "C:\\НОВОЕ"), true);
  assert.equal(draft.recycleFiles[0].location, "C:\\НОВОЕ");
  const target = { kind: "recycle-file-text", fileId: "f1" } as const;
  assert.equal(liveTextKey(target), portiaTextKey.recycle("f1"));
  assert.equal(applyLiveText(draft, target, "т".repeat(500)), true);
  assert.equal(draft.recycleFiles[0].content.length, 500);
  assert.equal(draft.recycleFiles[1].name, "два.png");
  assert.equal(applyLiveText(draft, { kind: "recycle-file-name", fileId: "nope" }, "x"), false);
});

test("LIVE-02 (26.1-12): the type of a file takes one of three, the linked virus takes none or one of the archive", () => {
  const draft = draftWithBin();
  assert.equal(applyLiveChoice(draft, { kind: "recycle-file-kind", fileId: "f1" }, "image"), true);
  assert.equal(draft.recycleFiles[0].kind, "image");
  assert.equal(applyLiveChoice(draft, { kind: "recycle-file-kind", fileId: "f1" }, "exe"), false);
  assert.equal(draft.recycleFiles[0].kind, "image");
  assert.equal(applyLiveChoice(draft, { kind: "recycle-file-virus", fileId: "f1" }, "b"), true);
  assert.equal(draft.recycleFiles[0].virusId, "b");
  assert.equal(applyLiveChoice(draft, { kind: "recycle-file-virus", fileId: "f1" }, ""), true);
  assert.equal(applyLiveChoice(draft, { kind: "recycle-file-virus", fileId: "f1" }, "nope"), false);
  assert.equal(draft.recycleFiles[0].virusId, "");
});

test("LIVE-02 (26.1-12): the picture of a file replaces the address and drops the frame; the frame can be set and cleared", () => {
  const draft = draftWithBin();
  const target = { kind: "recycle-file-image", fileId: "f2" } as const;
  applyLiveImage(draft, target, "https://x/p.gif");
  assert.deepEqual(draft.recycleFiles[1].imageFraming, { x: 1, y: 2, zoom: 1.2 }, "the same address keeps the frame");
  applyLiveImage(draft, target, "https://x/q.gif");
  assert.equal(draft.recycleFiles[1].imageFraming, undefined);
  assert.equal(applyLiveFraming(draft, target, { x: 3, y: 4, zoom: 2 }), true);
  assert.deepEqual(draft.recycleFiles[1].imageFraming, { x: 3, y: 4, zoom: 2 });
  assert.equal(applyLiveImage(draft, { kind: "recycle-file-image", fileId: "nope" }, "x"), false);
});

test("LIVE-02 (26.1-12): the bar adds a file like «+ ДОБАВИТЬ ФАЙЛ» and puts it last in the order", () => {
  const draft = draftWithBin();
  assert.deepEqual(liveAddKinds({ kind: "recycle" }), ["file"]);
  const id = liveNewId({ kind: "recycle" }, "file");
  assert.equal(applyLiveAdd(draft, { kind: "recycle" }, "file", id), id);
  assert.deepEqual(draft.recycleFiles[2], { id, name: "НОВЫЙ_ФАЙЛ.txt", location: "C:\\PORTIA\\RECYCLE_BIN", kind: "text", content: "", image: "", virusId: "" });
  assert.deepEqual(draft.recycleOrder, ["file:f2", "virus:r", "file:f1", `file:${id}`]);
  assert.equal(liveAddBlocked(draft, { kind: "recycle" }, "file"), false);
  assert.equal(applyLiveAdd(draft, { kind: "recycle" }, "text"), null);
});

test("LIVE-02 (26.1-12): the rows of the bin are moved in the order the editor keeps (recycleOrder), files and viruses together", () => {
  const draft = draftWithBin();
  assert.deepEqual(liveRecycleKeys(draft), ["file:f2", "virus:r", "file:f1"]);
  assert.equal(applyLiveMove(draft, { kind: "recycle" }, 0, 2), true);
  assert.deepEqual(draft.recycleOrder, ["virus:r", "file:f1", "file:f2"]);
  assert.equal(applyLiveMove(draft, { kind: "recycle" }, 0, 5), false);
  assert.equal(applyLiveMove(draft, { kind: "recycle" }, 1, 1), false);
  assert.deepEqual(draft.recycleOrder, ["virus:r", "file:f1", "file:f2"]);
  // an order that misses a row or holds a stale key is read as the editor reads it: stale dropped, missing rows appended
  draft.recycleOrder = ["file:gone", "file:f1"];
  assert.deepEqual(liveRecycleKeys(draft), ["file:f1", "file:f2", "virus:r"]);
});

test("LIVE-02 (26.1-12): removing a file or a virus of the bin takes its formatting and its place in the order", () => {
  const draft = draftWithBin();
  assert.deepEqual(liveRemovedKeys(draft, { kind: "recycle-file", fileId: "f1" }), [portiaTextKey.recycle("f1")]);
  assert.equal(applyLiveRemove(draft, { kind: "recycle-file", fileId: "f1" }), true);
  assert.deepEqual(draft.recycleFiles.map((item) => item.id), ["f2"]);
  assert.equal(draft.formattedText[portiaTextKey.recycle("f1")], undefined);
  assert.deepEqual(draft.recycleOrder, ["file:f2", "virus:r"]);
  const keys = liveRemovedKeys(draft, { kind: "recycled-virus", virusId: "r" });
  assert.ok(keys.includes(portiaTextKey.virus("r", "external")) && keys.includes("scientist:rl"));
  assert.equal(applyLiveRemove(draft, { kind: "recycled-virus", virusId: "r" }), true);
  assert.deepEqual(draft.recycledViruses, []);
  assert.equal(draft.formattedText[portiaTextKey.virus("r", "external")], undefined);
  assert.deepEqual(draft.recycleOrder, ["file:f2"]);
  assert.equal(applyLiveRemove(draft, { kind: "recycled-virus", virusId: "r" }), false);
  assert.equal(applyLiveRemove(draft, { kind: "recycle-file", fileId: "nope" }), false);
});

test("LIVE-02/04 (26.1-12): the window of the desktop draws the rows and the viewer of the bin through the seam, with no provider and no live class", () => {
  const desktop = read("components/portia-desktop.tsx");
  assert.match(desktop, /<TrashFileRow\b/);
  assert.match(desktop, /<TrashViewer\b/);
  const trash = read("components/portia-desktop-trash.tsx");
  assert.match(trash, /export function TrashFileRow\(/);
  assert.match(trash, /export function TrashViewer\(/);
  assert.match(trash, /useLiveEdit\("recycle"\)/);
  assert.doesNotMatch(trash, /LiveEditContext\.Provider/);
  assert.doesNotMatch(trash, /portia-editor/);
  assert.doesNotMatch(trash, /embedMedia=\{false\}/); // planner-discipline-allow: embedMedia={false}
  assert.match(trash, /live\.rich\(/, "the text of a file is the visitor's FormattedText at rest");
  assert.match(trash, /<PortiaImage\b/, "the picture of a file is the visitor's PortiaImage, so a GIF plays");
  for (const part of ['live.text({ kind: "recycle-file-name"', 'live.text({ kind: "recycle-file-location"', 'kind: "recycle-file-text"', 'live.image({ kind: "recycle-file-image"', 'live.choice({ kind: "recycle-file-kind"', 'live.remove({ kind: "recycle-file"', 'live.remove({ kind: "recycled-virus"']) assert.ok(trash.includes(part), part);
  // every live class of the seam stands in a branch of live, so a visitor's bin carries none
  const lines = trash.split("\n");
  for (const [index, line] of lines.entries()) {
    if (!/["`]live-[a-z]/.test(line)) continue;
    const near = lines.slice(Math.max(0, index - 5), index + 1).join(" ");
    assert.ok(/\blive\b\s*(\?|&&)|if \(!?live\)|\{live\b/.test(near), `a live class outside a live branch: ${line.trim().slice(0, 100)}`);
  }
});

test("LIVE-01/02/05 (26.1-12): the live «Корзина» draws the visitor's columns, held rows, the viewer and the bar «Файл»; a virus of the bin is the same live card", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /data-live-app="recycle"/);
  assert.match(seam, /<TrashFileRow\b/);
  assert.match(seam, /<TrashViewer\b/);
  assert.ok(seam.includes('live.order({ kind: "recycle" }'));
  assert.ok(seam.includes('live.addBar({ kind: "recycle" })'));
  assert.match(seam, /liveRecycleKeys\(/);
  assert.doesNotMatch(seam, /embedMedia=\{false\}/); // planner-discipline-allow: embedMedia={false}
  // both live surfaces draw the card through VirusRecord/VirusCardBody, which embed pictures (a GIF plays) unlike the template (T-20-87)
  assert.doesNotMatch(read("components/portia-desktop-dossier.tsx"), /embedMedia=\{false\}/); // planner-discipline-allow: embedMedia={false}
  assert.match(read("components/portia-virus-card.tsx"), /embedMedia = true/);
  assert.match(read("components/portia-virus-card.tsx"), /useLiveEdit\("recycle"\)/, "a virus of the bin asks for the tools of the bin");
});

// ---- 26.1-13: «Вивьян» (the phrases of the assistant) and the border of the live mode ----

function draftWithAssistant(): PortiaContent {
  return {
    assistantAdvice: ["Первый совет", "Второй совет", "Третий совет"],
    assistantOffendedPhrase: "Обида один",
    assistantOffendedPhrases: ["Обида один", "Обида два"],
    assistantIdlePhrases: ["Бездействие"],
    assistantActivityPhrases: ["Активность"],
    assistantPatienceSeconds: 3,
    assistantPatienceVariants: [3],
    assistantIdleEnabled: true,
    assistantActivityEnabled: true,
    assistantAutoTimingMode: "random",
    assistantAutoIntervalSeconds: 60,
    assistantAutoMinSeconds: 45,
    assistantAutoMaxSeconds: 120,
    // the first line is bold, the third is red: an edit of the second must keep both
    formattedText: { [portiaTextKey.assistantAdvice]: { runs: [{ text: "Первый совет", style: { fontWeight: 700 } }, { text: "\nВторой совет\n" }, { text: "Третий совет", style: { color: "#ff0000" } }] } },
  } as unknown as PortiaContent;
}

test("LIVE-01 (26.1-13): the live mode has exactly six apps; the five others are named with the reason", () => {
  assert.deepEqual([...LIVE_TABS], ["guide", "info", "broadcasts", "viruses", "recycle", "assistant"]);
  assert.equal(liveAppForTab("assistant"), "assistant");
  for (const tab of ["search", "employees", "users", "promo", "access"]) assert.equal(liveAppForTab(tab), null, tab);
  assert.match(LIVE_EXCLUDED.search, /решение владельца 2026-11-20/);
  assert.match(LIVE_EXCLUDED.employees, /решение владельца 2026-11-20/);
  for (const tab of ["users", "promo", "access"] as const) assert.match(LIVE_EXCLUDED[tab], /нет вида участника/, tab);
  // every tab of the editor is either live or excluded, never both and never neither
  for (const tab of ["viruses", "info", "guide", "broadcasts", "recycle", "search", "assistant", "employees", "users", "promo", "access"]) {
    assert.equal((LIVE_TABS as readonly string[]).includes(tab) !== (tab in LIVE_EXCLUDED), true, tab);
  }
});

test("LIVE-02/03 (26.1-13): a phrase changes in place; only its line changes and the styles of the other lines stay", () => {
  const draft = draftWithAssistant();
  assert.equal(applyLiveText(draft, { kind: "assistant-phrase", group: "advice", index: 1 }, "Новый совет"), true);
  assert.deepEqual(draft.assistantAdvice, ["Первый совет", "Новый совет", "Третий совет"]);
  const doc = draft.formattedText[portiaTextKey.assistantAdvice];
  assert.equal(doc.runs.map((run) => run.text).join(""), "Первый совет\nНовый совет\nТретий совет");
  assert.deepEqual(doc.runs[0], { text: "Первый совет", style: { fontWeight: 700 } });
  assert.deepEqual(doc.runs[doc.runs.length - 1], { text: "Третий совет", style: { color: "#ff0000" } });
  assert.deepEqual(draft.assistantOffendedPhrases, ["Обида один", "Обида два"], "another group is untouched");
});

test("LIVE-02 (26.1-13): a phrase with its own formatting writes that formatting into the group document at its place", () => {
  const draft = draftWithAssistant();
  assert.equal(applyLivePhrase(draft, { kind: "assistant-phrase", group: "advice", index: 1 }, "Второй совет", { runs: [{ text: "Второй", style: { color: "#00ff00" } }, { text: " совет" }] }), true);
  const doc = draft.formattedText[portiaTextKey.assistantAdvice];
  assert.deepEqual(doc.runs.map((run) => [run.text, run.style]), [["Первый совет", { fontWeight: 700 }], ["\n", undefined], ["Второй", { color: "#00ff00" }], [" совет\n", undefined], ["Третий совет", { color: "#ff0000" }]]);
  assert.deepEqual(livePhraseSlice(draft, "advice", 1)?.runs, [{ text: "Второй", style: { color: "#00ff00" } }, { text: " совет" }], "the slice of the line is what the visitor's bubble draws");
  assert.equal(livePhraseSlice(draftWithAssistant(), "idle", 0), undefined, "no stored formatting: the plain text is drawn");
});

test("LIVE-02 (26.1-13): the group «обида» keeps the single phrase in step with the list, as the editor's field does", () => {
  const draft = draftWithAssistant();
  assert.equal(applyLiveText(draft, { kind: "assistant-phrase", group: "offended", index: 0 }, "Я в обиде"), true);
  assert.deepEqual(draft.assistantOffendedPhrases, ["Я в обиде", "Обида два"]);
  assert.equal(draft.assistantOffendedPhrase, "Я в обиде");
  assert.deepEqual(livePhraseLines(draft, "idle"), ["Бездействие"]);
  assert.deepEqual(livePhraseLines(draft, "activity"), ["Активность"]);
});

test("LIVE-02 (26.1-13): a gone phrase changes nothing and says so; a line break in a phrase makes a new phrase", () => {
  const draft = draftWithAssistant();
  const before = JSON.stringify(draft);
  assert.equal(applyLiveText(draft, { kind: "assistant-phrase", group: "advice", index: 3 }, "x"), false);
  assert.equal(applyLiveText(draft, { kind: "assistant-phrase", group: "advice", index: -1 }, "x"), false);
  assert.equal(JSON.stringify(draft), before);
  assert.equal(applyLiveText(draft, { kind: "assistant-phrase", group: "advice", index: 2 }, "Третий\nчетвёртый"), true);
  assert.deepEqual(draft.assistantAdvice, ["Первый совет", "Второй совет", "Третий", "четвёртый"]);
});

test("LIVE-05 (26.1-13): the text key of a phrase is the stored key of its group, the format key is one per phrase", () => {
  assert.equal(liveTextKey({ kind: "assistant-phrase", group: "advice", index: 2 }), portiaTextKey.assistantAdvice);
  assert.equal(liveTextKey({ kind: "assistant-phrase", group: "offended", index: 0 }), portiaTextKey.assistantOffended);
  assert.equal(liveTextKey({ kind: "assistant-phrase", group: "idle", index: 0 }), portiaTextKey.assistantIdle);
  assert.equal(liveTextKey({ kind: "assistant-phrase", group: "activity", index: 0 }), portiaTextKey.assistantActivity);
  const keys = [0, 1, 2].map((index) => liveFormatKey({ kind: "assistant-phrase", group: "advice", index }));
  assert.equal(new Set(keys).size, 3, "two phrases never share a format key, so the format panel never mixes their lines");
  assert.equal(liveFormatKey({ kind: "virus-name", virusId: "v" }), "");
});

test("LIVE-01/02/05 (26.1-13): the live «Вивьян» draws the bubbles of the visitor in four groups, in the provider of the seam", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /data-live-app="assistant"/);
  assert.match(seam, /function AssistantSurface\(/);
  assert.match(seam, /className="assistant-bubble/, "the bubble carries the visitor's own class");
  assert.match(seam, /assistant-formatted-text/, "the text of a phrase is drawn with the visitor's class");
  assert.match(seam, /kind: "assistant-phrase"/);
  assert.doesNotMatch(seam, /embedMedia=\{false\}/); // planner-discipline-allow: embedMedia={false}
  assert.match(seam, /<FormattedText\b[^>]*eagerMedia/, "a GIF of a phrase at rest is loaded at once and plays");
  assert.match(seam, /<EmbeddedMediaStrip text=\{text\} eager \/>/, "while a phrase is edited its GIFs stay on show under the field");
  assert.match(seam, /if \(app === "assistant"\) return <AssistantSurface bridge=\{bridge\} \/>;/);
});

test("LIVE-02 (26.1-13): a phrase is added to every group, empty, at the end; the document of the group stays fitted to the lines", () => {
  for (const group of ["advice", "offended", "idle", "activity"] as const) {
    const draft = draftWithAssistant();
    const before = livePhraseLines(draft, group).length;
    assert.deepEqual(liveAddKinds({ kind: "assistant-group", group }), ["phrase"]);
    assert.equal(liveAddBlocked(draft, { kind: "assistant-group", group }, "phrase"), false);
    assert.equal(liveContainerFull(draft, { kind: "assistant-group", group }), false);
    assert.equal(applyLiveAdd(draft, { kind: "assistant-group", group }, "phrase"), String(before));
    assert.equal(livePhraseLines(draft, group).length, before + 1, group);
    assert.equal(livePhraseLines(draft, group)[before], "");
  }
  const draft = draftWithAssistant();
  applyLiveAdd(draft, { kind: "assistant-group", group: "advice" }, "phrase");
  const doc = draft.formattedText[portiaTextKey.assistantAdvice];
  assert.equal(doc.runs.map((run) => run.text).join(""), "Первый совет\nВторой совет\nТретий совет\n", "the new line is an empty line of the document");
  assert.deepEqual(doc.runs[0], { text: "Первый совет", style: { fontWeight: 700 } });
  assert.equal(applyLiveAdd(draft, { kind: "assistant-group", group: "advice" }, "row"), null, "a container takes only its own kind");
  // a phrase typed into the new line is written like any other
  assert.equal(applyLiveText(draft, { kind: "assistant-phrase", group: "advice", index: 3 }, "Четвёртый"), true);
  assert.deepEqual(draft.assistantAdvice, ["Первый совет", "Второй совет", "Третий совет", "Четвёртый"]);
});

test("LIVE-02 (26.1-13): a phrase is removed with its formatting; the last phrase of obida, idle and activity stays (the save would bring a default back)", () => {
  const draft = draftWithAssistant();
  assert.equal(applyLiveRemove(draft, { kind: "assistant-phrase", group: "advice", index: 1 }), true);
  assert.deepEqual(draft.assistantAdvice, ["Первый совет", "Третий совет"]);
  const doc = draft.formattedText[portiaTextKey.assistantAdvice];
  assert.equal(doc.runs.map((run) => run.text).join(""), "Первый совет\nТретий совет");
  assert.deepEqual(doc.runs[0], { text: "Первый совет", style: { fontWeight: 700 } });
  assert.deepEqual(doc.runs[doc.runs.length - 1], { text: "Третий совет", style: { color: "#ff0000" } });
  assert.equal(applyLiveRemove(draft, { kind: "assistant-phrase", group: "advice", index: 5 }), false);

  assert.equal(applyLiveRemove(draft, { kind: "assistant-phrase", group: "offended", index: 0 }), true);
  assert.deepEqual(draft.assistantOffendedPhrases, ["Обида два"]);
  assert.equal(draft.assistantOffendedPhrase, "Обида два", "the single phrase follows the list");
  const before = JSON.stringify(draft);
  for (const group of ["offended", "idle", "activity"] as const) assert.equal(applyLiveRemove(draft, { kind: "assistant-phrase", group, index: 0 }), false, group);
  assert.equal(JSON.stringify(draft), before, "nothing written for a phrase that has to stay");

  // advice may be empty: the visitor then has no tips
  assert.equal(applyLiveRemove(draft, { kind: "assistant-phrase", group: "advice", index: 0 }), true);
  assert.equal(applyLiveRemove(draft, { kind: "assistant-phrase", group: "advice", index: 0 }), true);
  assert.deepEqual(draft.assistantAdvice, []);
});

test("LIVE-02 (26.1-13): a removed phrase frees its format key and the keys of the phrases after it, which move up", () => {
  const draft = draftWithAssistant();
  assert.deepEqual(liveRemovedKeys(draft, { kind: "assistant-phrase", group: "advice", index: 1 }), [`${portiaTextKey.assistantAdvice}#1`, `${portiaTextKey.assistantAdvice}#2`]);
  assert.deepEqual(liveRemovedKeys(draft, { kind: "assistant-phrase", group: "idle", index: 0 }), [`${portiaTextKey.assistantIdle}#0`]);
});

test("LIVE-05 (26.1-13): a GIF in a phrase is found as the visitor's bubble finds it, and its link stays in the text of the phrase", () => {
  const draft = draftWithAssistant();
  const gif = "https://media.giphy.com/media/abc/giphy.gif";
  assert.equal(applyLiveText(draft, { kind: "assistant-phrase", group: "advice", index: 1 }, `Смотри ${gif}`), true);
  assert.deepEqual(liveMediaUrls(livePhraseLines(draft, "advice")[1]), [gif]);
  assert.equal(livePhraseSlice(draft, "advice", 1)?.runs.map((run) => run.text).join(""), `Смотри ${gif}`);
  assert.deepEqual(liveMediaUrls("https://giphy.com/gifs/x-abc"), ["https://media.giphy.com/media/abc/giphy.gif"]);
  assert.deepEqual(liveMediaUrls("https://klipy.com/gifs/anime-tsundere-6"), ["https://static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/e0/d8/GIVgKXMP.gif"]);
  assert.deepEqual(liveMediaUrls("https://example.org/a.gif"), ["https://example.org/a.gif"], "a direct link to a .gif");
});

test("LIVE-02/03 (26.1-13): the settings of the timing change through the same limits as the form of the editor, all or nothing (T-26.1-29)", () => {
  const draft = draftWithAssistant();
  assert.equal(applyLiveSettings(draft, { idleEnabled: false, activityEnabled: false, autoTimingMode: "fixed", autoIntervalSeconds: 90, patienceVariants: [4, 7] }), true);
  assert.equal(draft.assistantIdleEnabled, false);
  assert.equal(draft.assistantActivityEnabled, false);
  assert.equal(draft.assistantAutoTimingMode, "fixed");
  assert.equal(draft.assistantAutoIntervalSeconds, 90);
  assert.deepEqual(draft.assistantPatienceVariants, [4, 7]);
  assert.equal(draft.assistantPatienceSeconds, 4, "the first variant is the patience, as the field of the editor sets it");
  assert.equal(applyLiveSettings(draft, { autoMinSeconds: 10, autoMaxSeconds: 3600 }), true);
  assert.equal(draft.assistantAutoMinSeconds, 10);
  assert.equal(draft.assistantAutoMaxSeconds, 3600);
  assert.equal(applyLiveSettings(draft, { autoIntervalSeconds: 1 }), true);
  assert.equal(applyLiveSettings(draft, {}), true, "an empty patch is not an error and writes nothing");
});

test("LIVE-02/03 (26.1-13): a wrong value is not written and nothing else of the patch is either", () => {
  const draft = draftWithAssistant();
  const before = JSON.stringify(draft);
  const wrong: Parameters<typeof applyLiveSettings>[1][] = [
    { autoIntervalSeconds: 0 }, { autoIntervalSeconds: 3601 }, { autoIntervalSeconds: Number.NaN }, { autoIntervalSeconds: Number.POSITIVE_INFINITY }, { autoIntervalSeconds: "5" as unknown as number },
    { autoMinSeconds: 0 }, { autoMaxSeconds: 4000 },
    { autoMinSeconds: 130 }, { autoMaxSeconds: 30 }, { autoMinSeconds: 100, autoMaxSeconds: 50 },
    { patienceVariants: [] }, { patienceVariants: [0] }, { patienceVariants: [3, -1] }, { patienceVariants: [Number.NaN] },
    { autoTimingMode: "never" as unknown as "fixed" },
    { idleEnabled: "yes" as unknown as boolean },
    { idleEnabled: false, autoIntervalSeconds: 0 },
  ];
  for (const patch of wrong) {
    assert.equal(applyLiveSettings(draft, patch), false, JSON.stringify(patch));
    assert.equal(liveSettingsOk(draft, patch), false, JSON.stringify(patch));
    assert.equal(JSON.stringify(draft), before, `nothing written for ${JSON.stringify(patch)}`);
  }
  assert.equal(liveSettingsOk(draft, { autoMinSeconds: 100 }), true, "the check alone writes nothing");
  assert.equal(JSON.stringify(draft), before);
});

test("LIVE-02 (26.1-13): the live Vivian has the bars of its groups, the cross of its phrases and the popover of the timing", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /live\.addBar\(\{ kind: "assistant-group", group \}\)/);
  assert.match(seam, /live\.remove\(\{ kind: "assistant-phrase", group, index \}/);
  assert.match(seam, /function LiveTiming\(/);
  assert.match(seam, /applyLiveSettings\(/);
  assert.match(seam, /Время показа/);
  for (const text of ["Совет", "Фразу обиды", "Фразу бездействия", "Фразу активности"]) assert.ok(seam.includes(`"${text}"`), text);
});

test("LIVE-01 (26.1-13): the six live surfaces of the seam are exactly the six live apps", () => {
  const seam = read("components/portia-editor-live.tsx");
  const surfaces = [...seam.matchAll(/data-live-app="([a-z]+)"/g)].map((match) => match[1]).sort();
  const apps = [...new Set((LIVE_TABS as readonly string[]).map((tab) => liveAppForTab(tab)))].sort();
  assert.deepEqual(surfaces, apps);
  assert.equal(apps.length, 6);
  assert.deepEqual([...seam.matchAll(/createLiveApi\("([a-z]+)"/g)].map((match) => match[1]).sort(), apps, "every surface makes the tools of its own app");
  assert.equal((seam.match(/LiveEditContext\.Provider value=/g) ?? []).length, 6, "one provider per live app");
  // the toggle is drawn for a tab only through liveAppForTab
  assert.match(seam, /const app = liveAppForTab\(tab\);\n  const on = app !== null && enabled\.includes\(tab\);/);
});

test("LIVE-02 (26.1-13): the live Vivian blocks come after the live block and before users-tab in the style file", () => {
  const css = read("app/portia.css");
  const at = css.indexOf(".assistant-live {");
  assert.ok(at > css.indexOf(".live-surface { width: 100%"), "after the live block");
  assert.ok(at < css.indexOf("/* users-tab:start"), "before users-tab");
  assert.ok(css.indexOf("/* users-tab:start") < css.indexOf("/* ui-unify:start"), "users-tab stands before ui-unify");
});

// ---- 26.1-14: the final sweep of LIVE-04 and LIVE-05 over the sources of the whole phase ----

test("LIVE-04 (26.1-14): the context has one provider in all of components/, and no desktop file imports an editor seam statically", () => {
  const files = readdirSync(new URL("../components/", import.meta.url)).filter((name) => name.endsWith(".tsx"));
  assert.deepEqual(files.filter((name) => /LiveEditContext\.Provider/.test(read(`components/${name}`))), ["portia-editor-live.tsx"]);
  const desktop = files.filter((name) => name.startsWith("portia-desktop"));
  assert.ok(desktop.length >= 8, "the scan must see the desktop files");
  for (const name of desktop) {
    const text = read(`components/${name}`);
    // a dynamic import(...) is the only way the desktop reaches the editor; a static `from` is a visitor bundle that carries the editor
    assert.doesNotMatch(text, /from\s+["']@\/components\/portia-editor(?:-[a-z-]+)?["']/, `${name} imports an editor seam statically`);
    assert.doesNotMatch(text, /from\s+["']\.\/portia-editor(?:-[a-z-]+)?["']/, `${name} imports an editor seam statically`);
  }
  assert.match(read("components/portia-desktop.tsx"), /import\("@\/components\/portia-editor"\)/);
});

test("LIVE-04 (26.1-14): the toggle of the live mode exists for exactly the six tabs and for no other tab of the editor", () => {
  const live = ["guide", "info", "broadcasts", "viruses", "recycle", "assistant"];
  assert.equal(LIVE_TABS.length, 6);
  for (const tab of live) assert.notEqual(liveAppForTab(tab), null, tab);
  for (const tab of ["search", "employees", "users", "promo", "access"]) assert.equal(liveAppForTab(tab), null, tab);
});

test("LIVE-05 (26.1-14): no live surface and no live branch of the visitor's components turns the embedding of media off", () => {
  for (const file of ["components/portia-editor-live.tsx", "components/portia-desktop-documents.tsx", "components/portia-desktop-info.tsx", "components/portia-desktop-trash.tsx", "components/portia-desktop-dossier.tsx", "components/portia-desktop-media.tsx", "components/portia-desktop.tsx"]) {
    assert.doesNotMatch(read(file), /embedMedia\s*=\s*\{\s*false\s*\}/, `${file} turns embedMedia off`);
  }
  // the one place that turns it off is the template of the editor: there a link stays text on purpose
  const off = readdirSync(new URL("../components/", import.meta.url)).filter((name) => name.endsWith(".tsx") && /embedMedia\s*=\s*\{\s*false\s*\}/.test(read(`components/${name}`)));
  assert.deepEqual(off, ["portia-template-builder.tsx"]);
  const card = read("components/portia-virus-card.tsx");
  assert.match(card, /embedMedia = true/, "the default of FormattedText and of the card body is to embed");
});

test("LIVE-05 (26.1-14): the live text at rest is FormattedText, pressed it has the strip of the same media", () => {
  const seam = read("components/portia-editor-live.tsx");
  assert.match(seam, /<FormattedText\b/);
  assert.match(seam, /<EmbeddedMediaStrip\b/);
  assert.doesNotMatch(seam, /embedMedia/);
});
