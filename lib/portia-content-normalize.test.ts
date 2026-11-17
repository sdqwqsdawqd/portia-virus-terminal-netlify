import test from "node:test";
import assert from "node:assert/strict";
import { MAX_BLOCK_TEXT, MAX_CONDITIONS, MAX_SCIENTIST_LOGS } from "./content-limits.ts";
import { classificationOptions, createVirusRecycleFiles, findInfo, type InfoSection } from "./portia-content.ts";
import { portiaContentFixture } from "./testing/portia-content-fixture.ts";
import { contentRefusal } from "./editor-tabs.ts";
import { buildSearchIndex, matchSearch } from "./search-index.ts";
import { normalizeBroadcasts, normalizeGuideSections, normalizeInfoSections, normalizePortiaContent, parseYoutubeId } from "./portia-content-normalize.ts";

test("a save from before Phase 13 reads as an empty guide (D-00f)", () => {
  const old: Record<string, unknown> = structuredClone(portiaContentFixture);
  delete old.guideSections;
  assert.deepEqual(normalizePortiaContent(old)?.guideSections, []);
  assert.deepEqual(normalizeGuideSections("garbage"), []);
  assert.deepEqual(normalizeGuideSections(null), []);
  assert.deepEqual(normalizeGuideSections({ id: "s" }), []);
});

test("guide blocks keep every text and blank only bad media (D-01..D-06)", () => {
  const input = [{
    id: "s1", title: "Раздел  ", photo: "/assets/a.png",
    cards: [{
      id: "c1", title: " Карточка", cover: "//evil.example/x.png",
      blocks: [
        { id: "b1", type: "heading", text: "Как найти лабораторию" },
        { id: "b2", type: "text", text: "Абзац" },
        { id: "b3", type: "table", rows: [{ id: "r1", key: "Уровень", value: "III" }] },
        { id: "b4", type: "photo", url: "https://ok.example/p.png", caption: "Подпись" },
        { id: "b5", type: "video", videoId: "dQw4w9WgXcQ" },
        { id: "b6", type: "callout", label: "ВАЖНО", text: "Не открывать" },
        { id: "b7", type: "video", videoId: "not-an-id" },
        { id: "b8", type: "gallery" },
      ],
    }],
  }];
  const [section] = normalizeGuideSections(input);
  assert.equal(section.title, "Раздел  ");
  assert.equal(section.photo, "/assets/a.png");
  const [card] = section.cards;
  assert.equal(card.title, " Карточка");
  assert.equal(card.cover, "");
  assert.deepEqual(card.blocks, [
    { id: "b1", type: "heading", text: "Как найти лабораторию" },
    { id: "b2", type: "text", text: "Абзац" },
    { id: "b3", type: "table", rows: [{ id: "r1", key: "Уровень", value: "III" }] },
    { id: "b4", type: "photo", url: "https://ok.example/p.png", caption: "Подпись" },
    { id: "b5", type: "video", videoId: "dQw4w9WgXcQ" },
    { id: "b6", type: "callout", label: "ВАЖНО", text: "Не открывать" },
    { id: "b7", type: "video", videoId: "" },
  ]);
  assert.deepEqual(normalizeGuideSections(normalizeGuideSections(input)), normalizeGuideSections(input));
});

test("guide sections, cards and blocks without ids get positional ids", () => {
  const [section] = normalizeGuideSections([{ cards: [{ blocks: [{ type: "text" }, "x", { type: "text", text: "t" }] }] }]);
  assert.equal(section.id, "guide-0");
  assert.equal(section.cards[0].id, "guide-0-card-0");
  assert.deepEqual(section.cards[0].blocks.map((block) => block.id), ["guide-0-card-0-block-0", "guide-0-card-0-block-2"]);
  assert.deepEqual(normalizeGuideSections([{ id: "a" }, 5, { id: "b" }]).map((item) => item.id), ["a", "b"]);
});

test("a save round-trip keeps every field", () => {
  const once = normalizePortiaContent(structuredClone(portiaContentFixture));
  assert.ok(once);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
  assert.equal(once.viruses.length, portiaContentFixture.viruses.length);
  assert.equal(once.viruses[0].external, portiaContentFixture.viruses[0].external);
  assert.equal(once.infoSections.length, portiaContentFixture.infoSections.length);
  assert.equal(once.broadcasts.length, portiaContentFixture.broadcasts.length);
});

test("broken payloads are rejected instead of saved", () => {
  assert.equal(normalizePortiaContent(null), null);
  assert.equal(normalizePortiaContent({ viruses: [] }), null);
});

test("unsafe media links are cleaned", () => {
  const content = structuredClone(portiaContentFixture);
  content.viruses[0].infectedImage = "javascript:alert(1)";
  content.viruses[0].scientistLogs = Array.from({ length: 7 }, (_, index) => ({
    id: `log-${index}`, title: "", scientist: "", lockedLevel: 2, content: ["text"],
  }));
  const normalized = normalizePortiaContent(content);
  assert.ok(normalized);
  assert.equal(normalized.viruses[0].infectedImage, "");
});

test("protocol-relative and backslash image links are cleaned (CONT-09)", () => {
  const content = structuredClone(portiaContentFixture);
  content.recycleFiles = [
    { id: "r1", name: "a", location: "", kind: "image", content: "", image: "//evil.example/x.png", virusId: "" },
    { id: "r2", name: "b", location: "", kind: "image", content: "", image: "/local.png", virusId: "" },
  ];
  content.viruses[0].infectedImage = "/\\evil/x.png";
  content.viruses[0].mutations[0].image = "//evil/m.png";
  content.viruses[1].infectedImage = "https://ok.example/a.png";
  content.infoSections[0].subsections = [{
    id: "sub-1",
    title: "",
    blocks: [
      { id: "b1", type: "photo", url: "//evil/p.png" },
      { id: "b2", type: "photo", url: "/local.png" },
    ],
  }];
  const normalized = normalizePortiaContent(content);
  assert.ok(normalized);
  assert.equal(normalized.recycleFiles[0].image, "");
  assert.equal(normalized.recycleFiles[1].image, "/local.png");
  assert.equal(normalized.viruses[0].infectedImage, "");
  assert.equal(normalized.viruses[0].mutations[0].image, "");
  assert.equal(normalized.viruses[1].infectedImage, "https://ok.example/a.png");
  const blocks = normalized.infoSections[0].subsections[0].blocks;
  assert.deepEqual(blocks.map((block) => block.type === "photo" ? block.url : null), ["", "/local.png"]);
});

test("scientist logs stay capped at MAX_SCIENTIST_LOGS", () => {
  const content = structuredClone(portiaContentFixture);
  content.viruses[0].scientistLogs = Array.from({ length: 7 }, (_, index) => ({
    id: `log-${index}`, title: "", scientist: "", lockedLevel: 2, content: ["text"],
  }));
  assert.equal(normalizePortiaContent(content)?.viruses[0].scientistLogs.length, MAX_SCIENTIST_LOGS);
});

test("runs, run text and formatted keys beyond the old caps are kept whole", () => {
  const content = structuredClone(portiaContentFixture);
  content.formattedText = {
    big: { runs: [{ text: "x".repeat(150_000) }, ...Array.from({ length: 599 }, () => ({ text: "r" }))] },
    ...Object.fromEntries(Array.from({ length: 1199 }, (_, index) => [`k${index}`, { runs: [{ text: "t" }] }])),
  };
  const once = normalizePortiaContent(content);
  assert.ok(once);
  assert.equal(once.formattedText.big.runs.length, 600);
  assert.equal(once.formattedText.big.runs[0].text.length, 150_000);
  assert.equal(Object.keys(once.formattedText).length, 1200);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
});

test("line breaks inside text survive normalization", () => {
  const content = structuredClone(portiaContentFixture);
  content.formattedText = { note: { runs: [{ text: "first\nsecond\n" }] } };
  assert.equal(normalizePortiaContent(content)?.formattedText.note.runs[0].text, "first\nsecond\n");
});

test("broadcasts saved before 03.2 normalize to not important and keep their fields", () => {
  const old = { id: "a", type: "quest", title: "T", body: "B", published: true };
  assert.deepEqual(normalizeBroadcasts([old]), [{ ...old, important: false, startsAt: "", endsAt: "", conditions: "", sectionId: "" }]);
});

test("important is a strict boolean and junk entries are dropped in order", () => {
  const base = { id: "x", type: "news", title: "", body: "", published: false };
  const out = normalizeBroadcasts([
    { ...base, id: "1", important: true, startsAt: "", endsAt: "", conditions: "" },
    null,
    { ...base, id: "2", important: "yes" },
    "str",
    { ...base, id: "3", important: 1 },
    { ...base, id: "4", important: null },
  ]);
  assert.deepEqual(out.map((item) => [item.id, item.important]), [["1", true], ["2", false], ["3", false], ["4", false]]);
  assert.deepEqual(normalizeBroadcasts("nope"), []);
});

test("normalizePortiaContent stays idempotent with old and new broadcasts", () => {
  const content = structuredClone(portiaContentFixture);
  content.broadcasts = [
    { id: "a", type: "news", title: "A", body: "", published: true, important: true, startsAt: "", endsAt: "", conditions: "" },
    { id: "b", type: "task", title: "B", body: "", published: true } as never,
  ];
  const once = normalizePortiaContent(content);
  assert.ok(once);
  assert.deepEqual(once.broadcasts.map((item) => item.important), [true, false]);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
});

test("quest dates keep only strict YYYY-MM-DD and conditions keep line breaks and are kept whole", () => {
  const base = { id: "q", type: "quest", title: "", body: "", published: true };
  const at = (fields: object) => normalizeBroadcasts([{ ...base, ...fields }])[0];
  assert.equal(at({ startsAt: "2026-10-20" }).startsAt, "2026-10-20");
  for (const bad of ["20.10.2026", "2026-1-5", 20261020, "2026-10-20T00:00", null, " 2026-10-20"]) {
    assert.equal(at({ startsAt: bad, endsAt: bad }).startsAt, "");
    assert.equal(at({ startsAt: bad, endsAt: bad }).endsAt, "");
  }
  assert.equal(at({ conditions: "a\nb" }).conditions, "a\nb");
  assert.equal(at({ conditions: 5 }).conditions, "");
  assert.equal(at({ conditions: "x".repeat(MAX_CONDITIONS + 100) }).conditions.length, MAX_CONDITIONS + 100);
});

test("normalizePortiaContent stays idempotent with quest fields present", () => {
  const content = structuredClone(portiaContentFixture);
  content.broadcasts = [{ id: "q", type: "quest", title: "Q", body: "", published: true, important: false, startsAt: "2026-10-20", endsAt: "2026-10-25", conditions: "a\nb", sectionId: "" }];
  const once = normalizePortiaContent(content);
  assert.ok(once);
  assert.deepEqual(once.broadcasts[0], content.broadcasts[0]);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
});

test("a flat section saved before 03.3 gains empty subsections and keeps everything else", () => {
  const out = normalizeInfoSections([{ id: "a", title: "T", body: "B" }, null, "x", { title: 5, body: 7 }]);
  assert.deepEqual(out, [
    { id: "a", title: "T", body: "B", subsections: [] },
    { id: "info-3", title: "", body: "", subsections: [] },
  ]);
  assert.deepEqual(normalizeInfoSections("nope"), []);
});

test("junk blocks are dropped, ids filled and nothing is cut", () => {
  const [section] = normalizeInfoSections([{
    id: "s",
    title: "T",
    body: "B",
    subsections: [
      { title: "x".repeat(400), blocks: [
        { type: "text", text: "y".repeat(20_001) },
        { type: "nope" },
        { id: "t", type: "table", rows: [null, { key: "k".repeat(600), value: 5 }, { key: "a", value: "b" }] },
        { type: "photo", url: "javascript:alert(1)" },
        { type: "photo", url: "https://x/y.png" },
        { type: "video", videoId: "dQw4w9WgXcQ" },
        { type: "video", videoId: "https://youtu.be/dQw4w9WgXcQ" },
        { type: "video", videoId: "abc" },
      ] },
      { id: "keep", blocks: "bad" },
      ...Array.from({ length: 60 }, (_, index) => ({ id: `extra-${index}`, title: "", blocks: [] })),
    ],
  }]);
  assert.equal(section.subsections.length, 62);
  const first = section.subsections[0];
  assert.equal(first.id, "s-sub-0");
  assert.equal(first.title.length, 400);
  assert.deepEqual(first.blocks.map((block) => block.type), ["text", "table", "photo", "photo", "video", "video", "video"]);
  assert.equal(first.blocks[0].id, "s-sub-0-block-0");
  assert.equal((first.blocks[0] as { text: string }).text.length, 20_001);
  assert.deepEqual((first.blocks[1] as { rows: unknown }).rows, [{ id: "t-row-0", key: "k".repeat(600), value: "" }, { id: "t-row-1", key: "a", value: "b" }]);
  assert.equal((first.blocks[2] as { url: string }).url, "");
  assert.equal((first.blocks[3] as { url: string }).url, "https://x/y.png");
  assert.deepEqual(first.blocks.slice(4).map((block) => (block as { videoId: string }).videoId), ["dQw4w9WgXcQ", "", ""]);
  assert.deepEqual(section.subsections[1], { id: "keep", title: "", blocks: [] });
});

test("tables, blocks and rows beyond the old caps are kept whole", () => {
  const [section] = normalizeInfoSections([{ id: "s", title: "", body: "", subsections: [{ id: "u", title: "", blocks: [
    ...Array.from({ length: 105 }, (_, index) => ({ id: `b${index}`, type: "table", rows: Array.from({ length: 120 }, () => ({ key: "k", value: "v" })) })),
  ] }] }]);
  assert.equal(section.subsections[0].blocks.length, 105);
  assert.equal((section.subsections[0].blocks[0] as { rows: unknown[] }).rows.length, 120);
});

const tableRows = (rows: unknown[]) => (normalizeInfoSections([{ id: "s", title: "", body: "", subsections: [{ id: "u", title: "", blocks: [
  { id: "tb", type: "table", rows },
] }] }])[0].subsections[0].blocks[0] as { rows: { id: string; key: string; value: string }[] }).rows;

test("table rows keep their ids and order", () => {
  assert.deepEqual(tableRows([{ id: "r2", key: "b", value: "2" }, { id: "r1", key: "a", value: "1" }]),
    [{ id: "r2", key: "b", value: "2" }, { id: "r1", key: "a", value: "1" }]);
});

test("a missing or repeated row id gets its position", () => {
  assert.deepEqual(tableRows([{ id: "x", key: "a", value: "1" }, { id: "x", key: "b", value: "2" }, { key: "c", value: "3" }, { id: 7, key: "d", value: "4" }]).map((row) => row.id),
    ["x", "tb-row-1", "tb-row-2", "tb-row-3"]);
});

test("a column swap survives normalization", () => {
  assert.deepEqual(tableRows([{ id: "r1", key: "1", value: "A" }, { id: "r2", key: "2", value: "B" }]),
    [{ id: "r1", key: "1", value: "A" }, { id: "r2", key: "2", value: "B" }]);
});

test("a guide text block up to and beyond MAX_BLOCK_TEXT is kept whole", () => {
  const [section] = normalizeInfoSections([{ id: "s", title: "", body: "", subsections: [{ id: "u", title: "", blocks: [
    { id: "t", type: "text", text: "z".repeat(MAX_BLOCK_TEXT + 50_000) },
  ] }] }]);
  assert.equal((section.subsections[0].blocks[0] as { text: string }).text.length, MAX_BLOCK_TEXT + 50_000);
});

test("normalizePortiaContent normalizes guides, keeps section formatting and is idempotent", () => {
  const content = structuredClone(portiaContentFixture);
  content.infoSections.push({ id: "guide", title: "G", body: "", subsections: [{ id: "g1", title: "Sub", blocks: [
    { id: "b1", type: "text", text: "hello" },
    { id: "b2", type: "table", rows: [{ id: "r1", key: "a", value: "b" }] },
    { id: "b3", type: "photo", url: "/img/a.png" },
    { id: "b4", type: "video", videoId: "dQw4w9WgXcQ" },
  ] }] });
  content.formattedText = { "info:what-is-virus:body": { runs: [{ text: "keep" }] } };
  const once = normalizePortiaContent(content);
  assert.ok(once);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
  assert.deepEqual(once.infoSections.at(-1), content.infoSections.at(-1));
  assert.equal(once.formattedText["info:what-is-virus:body"].runs[0].text, "keep");
  const legacy = { ...structuredClone(portiaContentFixture), infoSections: [{ id: "old", title: "Old", body: "text" }] };
  assert.deepEqual(normalizePortiaContent(legacy)?.infoSections, [{ id: "old", title: "Old", body: "text", subsections: [] }]);
});

test("findInfo resolves a section, a subsection or nothing", () => {
  const sections: InfoSection[] = [
    { id: "a", title: "A", body: "", subsections: [{ id: "a1", title: "A1", blocks: [] }] },
    { id: "b", title: "B", body: "", subsections: [] },
  ];
  assert.deepEqual(findInfo(sections, "b"), { section: sections[1], subsection: null });
  assert.deepEqual(findInfo(sections, "a1"), { section: sections[0], subsection: sections[0].subsections[0] });
  assert.equal(findInfo(sections, "zzz"), null);
});

test("parseYoutubeId takes the id from YouTube links only", () => {
  const id = "dQw4w9WgXcQ";
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `http://youtu.be/${id}`,
    `  https://youtu.be/${id}  `,
  ]) assert.equal(parseYoutubeId(link), id, link);
  for (const bad of [
    "https://vimeo.com/123",
    `https://youtube.com.evil.example/watch?v=${id}`,
    `https://evil.example/youtu.be/${id}`,
    "javascript:alert(1)",
    id,
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/watch?v=${id}%3Cscript%3E`,
    "https://www.youtube.com/channel/abc",
    "",
    null,
    5,
  ]) assert.equal(parseYoutubeId(bad), "", String(bad));
});

test("every parsed YouTube id survives normalizeInfoSections as a video block", () => {
  const videoId = parseYoutubeId("https://youtu.be/dQw4w9WgXcQ");
  const [section] = normalizeInfoSections([{ id: "s", title: "S", body: "", subsections: [{ id: "u", title: "U", blocks: [{ id: "v", type: "video", videoId }] }] }]);
  assert.deepEqual(section.subsections[0].blocks[0], { id: "v", type: "video", videoId });
});

test("wrong-typed broadcast fields become text and nothing else changes", () => {
  const base = { id: "a", type: "news", published: true, important: false, startsAt: "", endsAt: "", conditions: "", extra: "keep" };
  const at = (fields: object) => normalizeBroadcasts([{ ...base, title: "", body: "", ...fields }])[0];
  assert.equal(at({ title: {} }).title, "");
  assert.equal(at({ title: 42 }).title, "42");
  assert.equal(at({ body: true }).body, "true");
  assert.equal(at({ body: [1] }).body, "");
  assert.equal((at({}) as unknown as { extra: string }).extra, "keep");
  assert.equal(at({ published: "yes" }).published, false);
});

test("a broadcast with a missing or blank id gets a stable position id", () => {
  const base = { type: "news", title: "", body: "", published: true };
  const out = normalizeBroadcasts([{ ...base }, { ...base, id: "  " }, { ...base, id: "broadcast-0", type: "wat" }]);
  assert.deepEqual(out.map((item) => item.id), ["broadcast-0-2", "broadcast-1", "broadcast-0"]);
  assert.ok(out.every((item) => !item.id.includes(":")));
  assert.equal(out[2].type, "news");
  assert.deepEqual(normalizeBroadcasts(structuredClone(out)), out);
});

test("only news can be important", () => {
  const base = { title: "", body: "", published: true, important: true };
  const out = normalizeBroadcasts([{ ...base, id: "q", type: "quest" }, { ...base, id: "t", type: "task" }, { ...base, id: "n", type: "news" }]);
  assert.deepEqual(out.map((item) => item.important), [false, false, true]);
});

test("wrong-typed virus fields are coerced and missing records are filled", () => {
  const content = structuredClone(portiaContentFixture);
  const odd = {
    name: 7, ppu: null, classification: "x", mutations: [null],
    scientistLogs: [{ title: {}, lockedLevel: "high", content: ["a"] }],
  };
  content.viruses = [odd, null] as never;
  content.recycledViruses = [{ ...odd, id: "" }] as never;
  const once = normalizePortiaContent(content);
  assert.ok(once);
  assert.equal(once.viruses.length, 1);
  const [virus] = once.viruses;
  assert.equal(virus.id, "virus-0");
  assert.equal(virus.name, "7");
  assert.deepEqual(virus.ppu, { health: "", speed: "", abilities: "" });
  assert.deepEqual(Object.keys(virus.classification).sort(), ["appearance", "behavior", "danger", "escapeRisk", "mind", "spread", "transmission"]);
  assert.ok(Object.values(virus.classification).every((item) => item === ""));
  assert.deepEqual(virus.mutations, [{ name: "", description: "", image: "" }]);
  assert.equal(virus.scientistLogs[0].title, "");
  assert.equal(virus.scientistLogs[0].lockedLevel, 5); // D-03/D-13: мусор = самый строгий
  assert.equal(once.recycledViruses[0].id, "recycled-0");
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
});

// D-35 / D-36(а): the nine renamed classes. Old saved names must read as the new ones, in both lists.
const D36_PAIRS = [
  ["Рубедо", "Люцидиум"], ["Альбедо", "Транзитиум"], ["Нигредо", "Обливиум"],
  ["Фобус", "Стабилар"], ["Ареус", "Импульсар"], ["Селенус", "Инфернар"],
  ["Нюктея", "Изоморф"], ["Морфея", "Полиморф"], ["Дедалея", "Ксеноморф"],
] as const;

function oldVirus(index: number, mind: string, behavior: string, appearance: string) {
  const virus = structuredClone(portiaContentFixture.viruses[0]);
  virus.id = `old-${index}`;
  virus.classification = { ...virus.classification, mind, behavior, appearance };
  return virus;
}

test("D-36 old class names read as the new ones in viruses and recycledViruses", () => {
  const content = structuredClone(portiaContentFixture);
  const olds = D36_PAIRS.map(([old]) => old);
  content.viruses = [
    oldVirus(0, olds[0], olds[3], olds[6]),
    oldVirus(1, olds[1], olds[4], olds[7]),
    oldVirus(2, olds[2], olds[5], olds[8]),
    oldVirus(3, "Неизвестный класс", "Стабила́р", "Изомо́рф"),
  ];
  content.recycledViruses = [oldVirus(4, olds[0], olds[3], olds[6]), oldVirus(5, olds[2], olds[5], olds[8])];
  const result = normalizePortiaContent(content);
  assert.ok(result);
  const pick = (virus: { classification: Record<string, string> }) => [virus.classification.mind, virus.classification.behavior, virus.classification.appearance];
  assert.deepEqual(pick(result.viruses[0]), ["Люцидиум", "Стабилар", "Изоморф"]);
  assert.deepEqual(pick(result.viruses[1]), ["Транзитиум", "Импульсар", "Полиморф"]);
  assert.deepEqual(pick(result.viruses[2]), ["Обливиум", "Инфернар", "Ксеноморф"]);
  assert.deepEqual(pick(result.recycledViruses[0]), ["Люцидиум", "Стабилар", "Изоморф"]);
  assert.deepEqual(pick(result.recycledViruses[1]), ["Обливиум", "Инфернар", "Ксеноморф"]);
  // Unknown values stay as they are; a value with U+0301 reads without the accent mark (D-37).
  assert.equal(result.viruses[3].classification.mind, "Неизвестный класс");
  assert.equal(result.viruses[3].classification.behavior, "Стабилар");
  assert.equal(result.viruses[3].classification.appearance, "Изоморф");
  assert.ok(!Object.values(result.viruses[3].classification).some((value) => value.includes("́")));
  // Other axes and fields stay untouched.
  const source = content.viruses[0];
  assert.equal(result.viruses[0].classification.danger, source.classification.danger);
  assert.equal(result.viruses[0].classification.transmission, source.classification.transmission);
  assert.equal(result.viruses[0].name, source.name);
});

test("D-36 an accented value reads as the plain name and an accented old name as the new name", () => {
  const content = structuredClone(portiaContentFixture);
  content.viruses = [
    oldVirus(0, "Люци́диум", "Стабила́р", "Изомо́рф"),
    oldVirus(1, "Рубе́до", "Фобус", "Нюктея"),
  ];
  const result = normalizePortiaContent(content);
  assert.ok(result);
  assert.deepEqual(
    [result.viruses[0].classification.mind, result.viruses[0].classification.behavior, result.viruses[0].classification.appearance],
    ["Люцидиум", "Стабилар", "Изоморф"],
  );
  assert.equal(result.viruses[1].classification.mind, "Люцидиум");
});

test("D-36 normalizing twice gives the same content", () => {
  const content = structuredClone(portiaContentFixture);
  content.viruses = [oldVirus(0, "Нигредо", "Селенус", "Дедалея"), oldVirus(1, "Неизвестный класс", "Ареус", "Морфея")];
  content.recycledViruses = [oldVirus(2, "Альбедо", "Фобус", "Нюктея")];
  const once = normalizePortiaContent(content);
  assert.ok(once);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
});

test("D-36 prototype member names are not resolved as class names", () => {
  const content = structuredClone(portiaContentFixture);
  content.viruses = [oldVirus(0, "__proto__", "constructor", "toString")];
  const result = normalizePortiaContent(content);
  assert.ok(result);
  assert.deepEqual(
    [result.viruses[0].classification.mind, result.viruses[0].classification.behavior, result.viruses[0].classification.appearance],
    ["__proto__", "constructor", "toString"],
  );
});

test("D-36 a restricted editor without the viruses tab gets no false refusal from the rename", () => {
  const stored = structuredClone(portiaContentFixture);
  stored.viruses = [oldVirus(0, "Рубедо", "Фобус", "Нюктея")];
  const baseline = normalizePortiaContent(stored);
  const draftSource = structuredClone(portiaContentFixture);
  draftSource.viruses = [oldVirus(0, "Люцидиум", "Стабилар", "Изоморф")];
  const draft = normalizePortiaContent(draftSource);
  assert.ok(baseline && draft);
  assert.equal(contentRefusal(baseline, draft, ["info", "broadcasts", "guide"]), null);
});

test("D-36 the three renamed axes keep levels 1, 2, 3 and carry no accent mark (D-35, D-37)", () => {
  for (const axis of ["mind", "behavior", "appearance"] as const) {
    const options = classificationOptions[axis];
    assert.deepEqual(options.map((option) => option.level), [1, 2, 3]);
    assert.ok(options.every((option) => !option.value.includes("́")));
  }
  assert.deepEqual(classificationOptions.mind.map((option) => option.value), ["Люцидиум", "Транзитиум", "Обливиум"]);
  assert.deepEqual(classificationOptions.behavior.map((option) => option.value), ["Стабилар", "Импульсар", "Инфернар"]);
  assert.deepEqual(classificationOptions.appearance.map((option) => option.value), ["Изоморф", "Полиморф", "Ксеноморф"]);
});

// D-47 guard (20-22): the editor note of a «Справочник» section lives in the private store (20-24), never in PortiaContent.
const NOTE_TEXT = "заметка-только-для-редакторов-47";
const sectionWithNote = { id: "g1", title: "Раздел", photo: "", note: NOTE_TEXT, editorNote: NOTE_TEXT, cards: [{ id: "c1", title: "Карточка", cover: "", note: NOTE_TEXT, blocks: [] }] };

test("D-47 normalizeGuideSections returns a section with exactly id, title, photo and cards", () => {
  const [section] = normalizeGuideSections([sectionWithNote]);
  assert.deepEqual(Object.keys(section).sort(), ["cards", "id", "photo", "title"]);
  assert.equal("note" in section, false);
  assert.equal("note" in section.cards[0], false);
});

test("D-47 a note stored inside a guide section does not reach the normalized public content", () => {
  const payload: Record<string, unknown> = structuredClone(portiaContentFixture);
  payload.guideSections = [sectionWithNote];
  const content = normalizePortiaContent(payload);
  assert.ok(content);
  assert.equal(JSON.stringify(content).includes(NOTE_TEXT), false);
});

test("D-47 the search index cannot find a section by its note text", () => {
  const content = normalizePortiaContent({ ...structuredClone(portiaContentFixture), guideSections: [sectionWithNote] });
  assert.ok(content);
  const index = buildSearchIndex({ apps: [], viruses: [], employees: [], infoSections: [], guideSections: content.guideSections, broadcasts: [], recycleFiles: [], recycledViruses: [] });
  assert.equal(index.length > 0, true, "the section's own card is indexed");
  assert.deepEqual(matchSearch(index, NOTE_TEXT), []);
  assert.equal(JSON.stringify(index).includes(NOTE_TEXT), false);
});

// D-63 (20-51): the visible part of a picture. Slice 1 is the photo of a «Справочник» section; the other surfaces follow in the same plan.
test("D-63 a guide section keeps a normalized photo frame only while it has a photo", () => {
  const [kept] = normalizeGuideSections([{ id: "s", title: "T", photo: "/assets/a.png", photoFraming: { x: 20.4, y: 80, zoom: 160, extra: "url(x)" }, cards: [] }]);
  assert.deepEqual(kept.photoFraming, { x: 20, y: 80, zoom: 160 });
  assert.deepEqual(Object.keys(kept), ["id", "title", "photo", "photoFraming", "cards"]);

  const [noPhoto] = normalizeGuideSections([{ id: "s", title: "T", photo: "", photoFraming: { x: 20, y: 80, zoom: 160 }, cards: [] }]);
  assert.equal("photoFraming" in noPhoto, false);

  const [badPhoto] = normalizeGuideSections([{ id: "s", title: "T", photo: "javascript:alert(1)", photoFraming: { x: 20, y: 80, zoom: 160 }, cards: [] }]);
  assert.equal("photoFraming" in badPhoto, false, "a refused link is no picture, so its frame goes too");
});

test("D-63 a garbage or default frame is dropped and a section without a frame keeps today's JSON", () => {
  for (const photoFraming of ["50", [20, 80, 160], { x: "20", y: 80, zoom: 160 }, { x: 20, y: Number.NaN, zoom: 160 }, { x: 20, y: 80 }, { x: 50, y: 50, zoom: 100 }, null, 7]) {
    const [section] = normalizeGuideSections([{ id: "s", title: "T", photo: "/assets/a.png", photoFraming, cards: [] }]);
    assert.equal("photoFraming" in section, false, JSON.stringify(photoFraming));
  }
  const [plain] = normalizeGuideSections([{ id: "s", title: "T", photo: "/assets/a.png", cards: [] }]);
  assert.equal(JSON.stringify(plain), JSON.stringify({ id: "s", title: "T", photo: "/assets/a.png", cards: [] }));
});

test("D-63 the frame of a guide section survives normalizePortiaContent and is idempotent", () => {
  const content: Record<string, unknown> = structuredClone(portiaContentFixture);
  content.guideSections = [{ id: "s", title: "T", photo: "/assets/a.png", photoFraming: { x: 30, y: 70, zoom: 150 }, cards: [] }];
  const once = normalizePortiaContent(content);
  assert.deepEqual(once?.guideSections[0].photoFraming, { x: 30, y: 70, zoom: 150 });
  assert.deepEqual(normalizePortiaContent(once), once);
});

// D-63 (20-51) the other surfaces. `...withoutNote(virus)` and `...withoutNote(mutation)` carry unknown keys through, so the frame fields are overwritten explicitly.
const frameA = { x: 20, y: 80, zoom: 160 };
const hostileFrame = { x: "50; background:url(//evil.example/x)", y: 50, zoom: 120, extra: "expression(alert(1))" };

function contentWith(patch: Record<string, unknown>) {
  return { ...structuredClone(portiaContentFixture), ...patch } as Record<string, unknown>;
}

function virusWith(patch: Record<string, unknown>) {
  return { ...structuredClone(portiaContentFixture.viruses[0]), id: "virus-frame", ...patch };
}

test("D-63 a virus keeps the frame of its photo and of each mutation image, as numbers, and only with a picture", () => {
  const content = normalizePortiaContent(contentWith({
    viruses: [virusWith({
      infectedImage: "/assets/portia-virus-icon.png", infectedImageFraming: { ...frameA, extra: "url(x)" },
      mutations: [
        { name: "A", description: "", image: "/assets/portia-logo.png", imageFraming: { x: 10.4, y: 120, zoom: 999 } },
        { name: "B", description: "", image: "", imageFraming: frameA },
        { name: "C", description: "", image: "/assets/portia-logo.png" },
      ],
    })],
  }));
  const virus = content?.viruses[0];
  assert.deepEqual(virus?.infectedImageFraming, frameA);
  assert.deepEqual(virus?.mutations[0].imageFraming, { x: 10, y: 100, zoom: 300 });
  assert.equal("imageFraming" in (virus?.mutations[1] ?? {}), false, "no picture, no frame");
  assert.equal("imageFraming" in (virus?.mutations[2] ?? {}), false);
});

test("D-63 a frame without a virus photo is dropped and a virus without a frame has no frame key", () => {
  const content = normalizePortiaContent(contentWith({ viruses: [virusWith({ infectedImage: "", infectedImageFraming: frameA }), virusWith({ id: "v2", infectedImage: "/assets/portia-logo.png" })] }));
  assert.equal("infectedImageFraming" in (content?.viruses[0] ?? {}), false);
  assert.equal("infectedImageFraming" in (content?.viruses[1] ?? {}), false);
});

test("D-63 a hostile frame in a virus or a mutation does not pass through the spread of unknown keys", () => {
  for (const framing of [hostileFrame, "50", ["20", "80", "160"], { x: Number.NaN, y: 1, zoom: 150 }, { x: 1, y: 1 }, { x: 50, y: 50, zoom: 100 }, null, { __proto__: { x: 1 } }]) {
    const content = normalizePortiaContent(contentWith({
      viruses: [virusWith({ infectedImage: "/assets/portia-logo.png", infectedImageFraming: framing, mutations: [{ name: "A", description: "", image: "/assets/portia-logo.png", imageFraming: framing }] })],
      recycledViruses: [virusWith({ id: "recycled-frame", infectedImage: "/assets/portia-logo.png", infectedImageFraming: framing })],
    }));
    assert.equal("infectedImageFraming" in (content?.viruses[0] ?? {}), false, JSON.stringify(framing));
    assert.equal("imageFraming" in (content?.viruses[0].mutations[0] ?? {}), false, JSON.stringify(framing));
    assert.equal("infectedImageFraming" in (content?.recycledViruses[0] ?? {}), false, JSON.stringify(framing));
  }
});

test("D-63 a virus in the recycle bin keeps its frames, so a restore keeps them", () => {
  const content = normalizePortiaContent(contentWith({
    recycledViruses: [virusWith({ id: "recycled-frame", infectedImage: "/assets/portia-logo.png", infectedImageFraming: frameA, mutations: [{ name: "A", description: "", image: "/assets/portia-logo.png", imageFraming: frameA }] })],
  }));
  assert.deepEqual(content?.recycledViruses[0].infectedImageFraming, frameA);
  assert.deepEqual(content?.recycledViruses[0].mutations[0].imageFraming, frameA);
});

test("D-63 a guide card keeps the frame of its cover only with a cover", () => {
  const [section] = normalizeGuideSections([{ id: "s", title: "T", photo: "", cards: [
    { id: "c1", title: "A", cover: "/assets/a.png", coverFraming: { ...frameA, extra: 1 }, blocks: [] },
    { id: "c2", title: "B", cover: "", coverFraming: frameA, blocks: [] },
    { id: "c3", title: "C", cover: "//evil.example/x.png", coverFraming: frameA, blocks: [] },
    { id: "c4", title: "D", cover: "/assets/a.png", coverFraming: hostileFrame, blocks: [] },
    { id: "c5", title: "E", cover: "/assets/a.png", blocks: [] },
  ] }]);
  assert.deepEqual(section.cards[0].coverFraming, frameA);
  for (const card of section.cards.slice(1)) assert.equal("coverFraming" in card, false, card.id);
  assert.equal(JSON.stringify(section.cards[4]), JSON.stringify({ id: "c5", title: "E", cover: "/assets/a.png", blocks: [] }));
});

test("D-63 an «Информация» photo block keeps the frame of its picture only with a link", () => {
  const [section] = normalizeInfoSections([{ id: "i", title: "T", body: "", subsections: [{ id: "s", title: "S", blocks: [
    { id: "b1", type: "photo", url: "/assets/a.png", framing: { ...frameA, extra: "url(x)" } },
    { id: "b2", type: "photo", url: "", framing: frameA },
    { id: "b3", type: "photo", url: "/assets/a.png", framing: hostileFrame },
    { id: "b4", type: "photo", url: "/assets/a.png" },
    { id: "b5", type: "text", text: "t", framing: frameA },
  ] }] }]);
  const blocks = section.subsections[0].blocks;
  assert.deepEqual(blocks[0], { id: "b1", type: "photo", url: "/assets/a.png", framing: frameA });
  assert.deepEqual(blocks[1], { id: "b2", type: "photo", url: "" });
  assert.deepEqual(blocks[2], { id: "b3", type: "photo", url: "/assets/a.png" });
  assert.deepEqual(blocks[3], { id: "b4", type: "photo", url: "/assets/a.png" });
  assert.deepEqual(blocks[4], { id: "b5", type: "text", text: "t" });
});

test("D-63 a recycle file keeps the frame of its image only with an image", () => {
  const files = normalizePortiaContent(contentWith({
    recycleFiles: [
      { id: "f1", name: "a", kind: "image", location: "L", content: "", image: "/assets/a.png", imageFraming: { ...frameA, extra: "url(x)" }, virusId: "" },
      { id: "f2", name: "b", kind: "image", location: "L", content: "", image: "", imageFraming: frameA, virusId: "" },
      { id: "f3", name: "c", kind: "image", location: "L", content: "", image: "/assets/a.png", imageFraming: hostileFrame, virusId: "" },
      { id: "f4", name: "d", kind: "image", location: "L", content: "", image: "/assets/a.png", virusId: "" },
    ],
  }))?.recycleFiles ?? [];
  assert.deepEqual(files[0].imageFraming, frameA);
  for (const file of files.slice(1)) assert.equal("imageFraming" in file, false, file.id);
});

test("D-63 the recycle file made from a virus carries the frame of the virus photo", () => {
  const withFrame = virusWith({ infectedImage: "/assets/portia-logo.png", infectedImageFraming: frameA });
  const without = virusWith({ id: "v2" });
  const [first, second] = createVirusRecycleFiles([withFrame, without] as never);
  assert.deepEqual(first.imageFraming, frameA);
  assert.equal("imageFraming" in second, false);
  assert.equal(JSON.stringify(second), JSON.stringify({ id: "recycle-v2", name: `${without.name}_${without.code}.virus`, location: "C:\\PORTIA\\VIRUS_ARCHIVE", kind: "virus", content: "", image: "", virusId: "v2" }));
});

test("D-63 normalizing content with frames on every surface twice gives the same content", () => {
  const input = contentWith({
    viruses: [virusWith({ infectedImage: "/assets/portia-logo.png", infectedImageFraming: frameA, mutations: [{ name: "A", description: "", image: "/assets/portia-logo.png", imageFraming: frameA }] })],
    guideSections: [{ id: "g", title: "G", photo: "/assets/a.png", photoFraming: frameA, cards: [{ id: "c", title: "C", cover: "/assets/a.png", coverFraming: frameA, blocks: [] }] }],
    infoSections: [{ id: "i", title: "I", body: "", subsections: [{ id: "s", title: "S", blocks: [{ id: "b", type: "photo", url: "/assets/a.png", framing: frameA }] }] }],
    recycleFiles: [{ id: "f", name: "n", kind: "image", location: "L", content: "", image: "/assets/a.png", imageFraming: frameA, virusId: "" }],
  });
  const once = normalizePortiaContent(input);
  assert.deepEqual(normalizePortiaContent(once), once);
  assert.equal(JSON.stringify(once).includes("expression"), false);
});

// D-63 / T-20-107 (20-51): the end-to-end case of «запрос PUT». PUT /api/content stores only normalizePortiaContent(body.content) (the route is not changed in this plan),
// so a body with trap frames in all six fields goes through it and nothing but bounded whole numbers may come out.
const TRAP = "TRAPMARK";

function trapFrames(): unknown[] {
  return [
    { x: `1;background:url(//${TRAP}.example/x)`, y: 2, zoom: 150 },
    { x: 1, y: `expression(${TRAP})`, zoom: 150 },
    { x: 1, y: 2, zoom: `150;position:fixed;${TRAP}` },
    { x: { a: `url(${TRAP})` }, y: 2, zoom: 150 },
    { x: [`url(${TRAP})`], y: 2, zoom: 150 },
    { x: 1, y: 2, zoom: 150, extra: `url(${TRAP})`, style: `expression(${TRAP})` },
    JSON.parse(`{"x":1,"y":2,"zoom":150,"__proto__":{"x":"${TRAP};url(","polluted":"${TRAP}"},"constructor":{"x":"${TRAP}"}}`),
    JSON.parse(`{"__proto__":{"x":1,"y":2,"zoom":150}}`),
    { x: 1e9, y: -1e9, zoom: 1e9 },
    { x: -1e9, y: 1e9, zoom: -1e9 },
    { x: Number.MAX_VALUE, y: -Number.MAX_VALUE, zoom: Number.MAX_VALUE },
    `url(${TRAP})`,
    [1, 2, 150],
  ];
}

/** Every frame the normalized content holds, with where it sits. */
function allFrames(content: NonNullable<ReturnType<typeof normalizePortiaContent>>) {
  const found: { path: string; value: unknown }[] = [];
  const add = (path: string, value: unknown, owner: object, key: string) => {
    if (key in owner) found.push({ path, value });
  };
  for (const [listName, viruses] of [["viruses", content.viruses], ["recycledViruses", content.recycledViruses]] as const) {
    viruses.forEach((virus, index) => {
      add(`${listName}[${index}].infectedImageFraming`, (virus as Record<string, unknown>).infectedImageFraming, virus, "infectedImageFraming");
      virus.mutations.forEach((mutation, mutationIndex) => add(`${listName}[${index}].mutations[${mutationIndex}].imageFraming`, (mutation as Record<string, unknown>).imageFraming, mutation, "imageFraming"));
    });
  }
  content.guideSections.forEach((section, index) => {
    add(`guideSections[${index}].photoFraming`, (section as Record<string, unknown>).photoFraming, section, "photoFraming");
    section.cards.forEach((card, cardIndex) => add(`guideSections[${index}].cards[${cardIndex}].coverFraming`, (card as Record<string, unknown>).coverFraming, card, "coverFraming"));
  });
  content.infoSections.forEach((section, index) => section.subsections.forEach((sub, subIndex) => sub.blocks.forEach((block, blockIndex) => {
    if (block.type === "photo") add(`infoSections[${index}].subsections[${subIndex}].blocks[${blockIndex}].framing`, (block as Record<string, unknown>).framing, block, "framing");
  })));
  content.recycleFiles.forEach((file, index) => add(`recycleFiles[${index}].imageFraming`, (file as Record<string, unknown>).imageFraming, file, "imageFraming"));
  return found;
}

test("D-63 T-20-107 a PUT body with trap frames in all six fields leaves only bounded whole numbers or no key", () => {
  for (const [trapIndex, trap] of trapFrames().entries()) {
    const body = contentWith({
      viruses: [virusWith({ infectedImage: "/assets/portia-logo.png", infectedImageFraming: trap, mutations: [{ name: "A", description: "", image: "/assets/portia-logo.png", imageFraming: trap }] })],
      recycledViruses: [virusWith({ id: "recycled-trap", infectedImage: "/assets/portia-logo.png", infectedImageFraming: trap, mutations: [{ name: "B", description: "", image: "/assets/portia-logo.png", imageFraming: trap }] })],
      guideSections: [{ id: "g", title: "G", photo: "/assets/a.png", photoFraming: trap, cards: [{ id: "c", title: "C", cover: "/assets/a.png", coverFraming: trap, blocks: [] }] }],
      infoSections: [{ id: "i", title: "I", body: "", subsections: [{ id: "s", title: "S", blocks: [{ id: "b", type: "photo", url: "/assets/a.png", framing: trap }] }] }],
      recycleFiles: [{ id: "f", name: "n", kind: "image", location: "L", content: "", image: "/assets/a.png", imageFraming: trap, virusId: "" }],
    });
    // The wire: the route reads JSON text, so the body is serialized and parsed the way the request body is.
    const content = normalizePortiaContent(JSON.parse(JSON.stringify(body)));
    assert.ok(content, `trap ${trapIndex} still normalizes`);
    const frames = allFrames(content);
    for (const { path, value } of frames) {
      assert.ok(value && typeof value === "object", `${path} (trap ${trapIndex}) is an object when present`);
      const frame = value as Record<string, unknown>;
      assert.deepEqual(Object.keys(frame).sort(), ["x", "y", "zoom"], `${path} (trap ${trapIndex}) has exactly three keys`);
      assert.ok(Number.isInteger(frame.x) && (frame.x as number) >= 0 && (frame.x as number) <= 100, `${path}.x`);
      assert.ok(Number.isInteger(frame.y) && (frame.y as number) >= 0 && (frame.y as number) <= 100, `${path}.y`);
      assert.ok(Number.isInteger(frame.zoom) && (frame.zoom as number) >= 100 && (frame.zoom as number) <= 300, `${path}.zoom`);
      assert.equal(Object.getPrototypeOf(frame), Object.prototype, `${path} is a plain object`);
    }
    const text = JSON.stringify(content);
    assert.equal(text.includes(TRAP), false, `no part of trap ${trapIndex} is stored`);
    assert.equal(text.includes("url("), false);
    assert.equal(text.includes("expression("), false);
    // Frames, taken alone, hold no character that could open a style value: no «;», «(», quote inside a value or letter outside the three keys.
    const frameText = JSON.stringify(frames.map((frame) => frame.value));
    assert.match(frameText, /^[\d[\]{},:"xyzom-]*$/, `trap ${trapIndex}: frames hold digits and the three keys only`);
    assert.equal(({} as Record<string, unknown>).polluted, undefined, "Object.prototype is untouched");
    assert.equal(({} as Record<string, unknown>).x, undefined);
  }
});

test("D-63 T-20-107 a trap that is a real frame under its junk is kept as the three clamped numbers", () => {
  const body = contentWith({ guideSections: [{ id: "g", title: "G", photo: "/assets/a.png", photoFraming: trapFrames()[5], cards: [] }] });
  const content = normalizePortiaContent(JSON.parse(JSON.stringify(body)));
  assert.deepEqual(content?.guideSections[0].photoFraming, { x: 1, y: 2, zoom: 150 });
  const wild = normalizePortiaContent(JSON.parse(JSON.stringify(contentWith({ guideSections: [{ id: "g", title: "G", photo: "/assets/a.png", photoFraming: trapFrames()[8], cards: [] }] }))));
  assert.deepEqual(wild?.guideSections[0].photoFraming, { x: 100, y: 0, zoom: 300 });
});

test("D-63 T-20-109 a restricted editor without the «Справочник» tab cannot change a frame inside it", () => {
  const stored = contentWith({ guideSections: [{ id: "g", title: "G", photo: "/assets/a.png", photoFraming: frameA, cards: [{ id: "c", title: "C", cover: "/assets/a.png", coverFraming: frameA, blocks: [] }] }] });
  const baseline = normalizePortiaContent(stored);
  const changedPhoto = normalizePortiaContent(contentWith({ guideSections: [{ id: "g", title: "G", photo: "/assets/a.png", photoFraming: { x: 21, y: 80, zoom: 160 }, cards: [{ id: "c", title: "C", cover: "/assets/a.png", coverFraming: frameA, blocks: [] }] }] }));
  const changedCover = normalizePortiaContent(contentWith({ guideSections: [{ id: "g", title: "G", photo: "/assets/a.png", photoFraming: frameA, cards: [{ id: "c", title: "C", cover: "/assets/a.png", coverFraming: { x: 20, y: 80, zoom: 170 }, blocks: [] }] }] }));
  assert.ok(baseline && changedPhoto && changedCover);
  assert.equal(contentRefusal(baseline, baseline, ["info", "broadcasts"]), null, "an unchanged frame is no change");
  assert.equal(contentRefusal(baseline, changedPhoto, ["info", "broadcasts"])?.code, "section-closed");
  assert.equal(contentRefusal(baseline, changedCover, ["info", "broadcasts"])?.code, "section-closed");
  assert.equal(contentRefusal(baseline, changedPhoto, ["info", "broadcasts", "guide"]), null, "with the tab open the same change is allowed");
});

// Phase 24, plan 03: the level of every leveled record survives normalization (D-03, D-13, LVL-02, LVL-07).
const levelContent = (extra: Record<string, unknown>) => ({ ...structuredClone(portiaContentFixture), ...extra }) as unknown;
const normalized = (extra: Record<string, unknown>) => {
  const content = normalizePortiaContent(JSON.parse(JSON.stringify(levelContent(extra))));
  assert.ok(content);
  return content;
};

test("LVL-02 / D-03 info sections and subsections keep and clamp their level", () => {
  const out = normalizeInfoSections([
    { id: "s", title: "S", body: "", level: 3, subsections: [{ id: "u", title: "U", blocks: [], level: 4 }, { id: "v", title: "V", blocks: [], level: "x" }, { id: "w", title: "W", blocks: [] }] },
    { id: "t", title: "T", body: "", level: "x", subsections: [] },
    { id: "n", title: "N", body: "", subsections: [] },
  ]);
  assert.equal(out[0].level, 3);
  assert.deepEqual(out[0].subsections.map((sub) => sub.level), [4, 5, undefined]);
  assert.equal(out[1].level, 5);
  assert.equal("level" in out[2], false, "no field stays no field");
  assert.equal("level" in out[0].subsections[2], false);
});

test("LVL-02 / D-03 guide sections and cards keep and clamp their level", () => {
  const out = normalizeGuideSections([
    { id: "g", title: "G", photo: "", level: 2, cards: [{ id: "c", title: "C", cover: "", blocks: [], level: 5 }, { id: "d", title: "D", cover: "", blocks: [], level: 0 }, { id: "e", title: "E", cover: "", blocks: [] }] },
    { id: "h", title: "H", photo: "", level: 6, cards: [] },
    { id: "i", title: "I", photo: "", cards: [] },
  ]);
  assert.equal(out[0].level, 2);
  assert.deepEqual(out[0].cards.map((card) => card.level), [5, 5, undefined]);
  assert.equal(out[1].level, 5);
  assert.equal("level" in out[2], false);
  assert.equal("level" in out[0].cards[2], false);
});

test("EDGE LVL-02/boundary: level 1 and 5 are kept, 0 and 6 one step outside become 5", () => {
  const out = normalizeInfoSections([1, 5, 0, 6].map((level, index) => ({ id: `s${index}`, title: "", body: "", subsections: [], level })));
  assert.deepEqual(out.map((section) => section.level), [1, 5, 5, 5]);
});

test("EDGE LVL-02/precision: 2.5, a string, null and an object are damaged and read as level 5, with no rounding", () => {
  const out = normalizeInfoSections([2.5, "3", null, {}].map((level, index) => ({ id: `s${index}`, title: "", body: "", subsections: [], level })));
  assert.deepEqual(out.map((section) => section.level), [5, 5, 5, 5]);
});

test("EDGE LVL-02/empty: content with no level stays free of new keys and everything reads as level 1", () => {
  const content = normalized({});
  const text = JSON.stringify(content);
  assert.equal(text.includes('"level"'), false);
  assert.equal("appLevels" in content, false);
  assert.equal(text.includes('"withheld"'), false);
});

test("LVL-02 / D-03 appLevels keeps only known app ids with a clamped level", () => {
  assert.deepEqual(normalized({ appLevels: { charter: 2, sheet: 4, junk: 1 } }).appLevels, { charter: 2 });
  assert.deepEqual(normalized({ appLevels: { charter: "a" } }).appLevels, { charter: 5 });
  assert.deepEqual(normalized({ appLevels: { charter: 0 } }).appLevels, { charter: 5 });
  assert.equal("appLevels" in normalized({ appLevels: 7 }), false);
  assert.equal("appLevels" in normalized({ appLevels: null }), false);
  assert.equal("appLevels" in normalized({ appLevels: [] }), false);
  assert.equal("appLevels" in normalized({ appLevels: { sheet: 3 } }), false, "no known key leaves no key");
  assert.equal("appLevels" in normalized({}), false);
});

const logsOf = (logs: Record<string, unknown>[]) => {
  const virus = { ...structuredClone(portiaContentFixture.viruses[0]), scientistLogs: logs };
  return normalized({ viruses: [virus] }).viruses[0].scientistLogs;
};

test("LVL-07 / D-13 lockedLevel: missing is 1, integers 1..5 as they are, damaged is 5", () => {
  // A virus keeps at most MAX_SCIENTIST_LOGS records, so the cases go through in small groups.
  const levelsOf = (values: unknown[]) => logsOf(values.map((value, index) => ({ id: `l${index}`, title: "", scientist: "", content: [], ...(value === MISSING ? {} : { lockedLevel: value }) }))).map((log) => log.lockedLevel);
  const MISSING = Symbol("missing");
  assert.ok(MAX_SCIENTIST_LOGS >= 4);
  assert.deepEqual(levelsOf([MISSING, 2, 3, 4]), [1, 2, 3, 4]);
  assert.deepEqual(levelsOf(["high", 0, 6, 2.5]), [5, 5, 5, 5]);
  assert.deepEqual(levelsOf(["3", 3.5, null, {}]), [5, 5, 5, 5]);
  assert.deepEqual(levelsOf([1, 5]), [1, 5]);
});

test("EDGE LVL-07/boundary: a log of level 2 shows for a visitor of level 2, a log of level 3 does not", () => {
  const [two, three] = logsOf([
    { id: "a", title: "", scientist: "", lockedLevel: 2, content: [] },
    { id: "b", title: "", scientist: "", lockedLevel: 3, content: [] },
  ]);
  const visitor = 2;
  assert.equal(two.lockedLevel <= visitor, true);
  assert.equal(three.lockedLevel <= visitor, false);
});

test("LVL-07 / D-13 the withheld marker of a scientist log survives as true for any value of the key", () => {
  const logs = logsOf([
    { id: "a", title: "", scientist: "", lockedLevel: 3, content: [], withheld: "yes" },
    { id: "b", title: "", scientist: "", lockedLevel: 3, content: [], withheld: false },
    { id: "c", title: "", scientist: "", lockedLevel: 3, content: [], withheld: true },
    { id: "d", title: "", scientist: "", lockedLevel: 3, content: [], withheld: null },
    { id: "e", title: "", scientist: "", lockedLevel: 3, content: [] },
  ]);
  assert.deepEqual(logs.map((log) => log.withheld), [true, true, true, true, undefined]);
  assert.equal("withheld" in logs[4], false, "no marker stays no key");
});

test("EDGE LVL-06/ordering: scientist logs keep order and id, an empty list stays empty", () => {
  const logs = logsOf([
    { id: "z", title: "1", scientist: "", lockedLevel: 2, content: [] },
    { id: "a", title: "2", scientist: "", lockedLevel: 3, content: [] },
    { id: "m", title: "3", scientist: "", lockedLevel: 4, content: [] },
  ]);
  assert.deepEqual(logs.map((log) => log.id), ["z", "a", "m"]);
  assert.deepEqual(logsOf([]), []);
});

test("EDGE LVL-06/idempotency: normalizing twice equals normalizing once for content with levels, logs, appLevels and redaction", () => {
  const virus = { ...structuredClone(portiaContentFixture.viruses[0]), level: 2, scientistLogs: [
    { id: "a", title: "", scientist: "", lockedLevel: "high", content: ["x"], withheld: "yes" },
    { id: "b", title: "", scientist: "", content: [] },
  ] };
  const input = levelContent({
    viruses: [virus],
    infoSections: [{ id: "s", title: "S", body: "", level: 3, subsections: [{ id: "u", title: "U", blocks: [], level: 4 }, { id: "v", title: "V", blocks: [] }] }],
    guideSections: [{ id: "g", title: "G", photo: "", level: "x", cards: [{ id: "c", title: "C", cover: "", blocks: [], level: 2 }] }],
    appLevels: { charter: 3, sheet: 9 },
    redaction: { level: 2, slots: [], viruses: [] },
  });
  const once = normalizePortiaContent(JSON.parse(JSON.stringify(input)));
  assert.ok(once);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
  assert.deepEqual(once.appLevels, { charter: 3 });
  assert.equal(once.guideSections[0].level, 5);
});
