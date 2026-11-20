import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAX_BLOCKS, MAX_SUBSECTIONS } from "./content-limits.ts";
import { LIVE_EXCLUDED, LIVE_TABS, TEXT_LIMIT, applyLiveAdd, applyLiveCards, applyLiveFraming, applyLiveImage, applyLiveMove, applyLiveRemove, applyLiveText, liveAddKinds, liveAppForTab, liveMediaUrls, liveRemovedKeys } from "./live-edit.ts";
import type { PortiaContent } from "./portia-content.ts";

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
  assert.deepEqual([...LIVE_TABS], ["guide"]);
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
  assert.match(seam, /<FormattedTextarea\b[\s\S]*area="info"/);
  assert.match(seam, /portiaTextKey\.guideBlock\(blockId\)/);
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
