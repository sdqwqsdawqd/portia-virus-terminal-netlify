import test from "node:test";
import assert from "node:assert/strict";
import { MAX_BLOCK_TEXT, MAX_CONDITIONS, MAX_SCIENTIST_LOGS } from "./content-limits.ts";
import { defaultPortiaContent, findInfo, type InfoSection } from "./portia-content.ts";
import { normalizeBroadcasts, normalizeInfoSections, normalizePortiaContent, parseYoutubeId } from "./portia-content-normalize.ts";

test("a save round-trip keeps every field", () => {
  const once = normalizePortiaContent(structuredClone(defaultPortiaContent));
  assert.ok(once);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
  assert.equal(once.viruses.length, defaultPortiaContent.viruses.length);
  assert.equal(once.viruses[0].external, defaultPortiaContent.viruses[0].external);
  assert.equal(once.infoSections.length, defaultPortiaContent.infoSections.length);
  assert.equal(once.broadcasts.length, defaultPortiaContent.broadcasts.length);
});

test("broken payloads are rejected instead of saved", () => {
  assert.equal(normalizePortiaContent(null), null);
  assert.equal(normalizePortiaContent({ viruses: [] }), null);
});

test("unsafe media links are cleaned", () => {
  const content = structuredClone(defaultPortiaContent);
  content.viruses[0].infectedImage = "javascript:alert(1)";
  content.viruses[0].scientistLogs = Array.from({ length: 7 }, (_, index) => ({
    id: `log-${index}`, title: "", scientist: "", lockedLevel: 2, content: ["text"],
  }));
  const normalized = normalizePortiaContent(content);
  assert.ok(normalized);
  assert.equal(normalized.viruses[0].infectedImage, "");
});

test("scientist logs stay capped at MAX_SCIENTIST_LOGS", () => {
  const content = structuredClone(defaultPortiaContent);
  content.viruses[0].scientistLogs = Array.from({ length: 7 }, (_, index) => ({
    id: `log-${index}`, title: "", scientist: "", lockedLevel: 2, content: ["text"],
  }));
  assert.equal(normalizePortiaContent(content)?.viruses[0].scientistLogs.length, MAX_SCIENTIST_LOGS);
});

test("runs, run text and formatted keys beyond the old caps are kept whole", () => {
  const content = structuredClone(defaultPortiaContent);
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
  const content = structuredClone(defaultPortiaContent);
  content.formattedText = { note: { runs: [{ text: "first\nsecond\n" }] } };
  assert.equal(normalizePortiaContent(content)?.formattedText.note.runs[0].text, "first\nsecond\n");
});

test("broadcasts saved before 03.2 normalize to not important and keep their fields", () => {
  const old = { id: "a", type: "quest", title: "T", body: "B", published: true };
  assert.deepEqual(normalizeBroadcasts([old]), [{ ...old, important: false, startsAt: "", endsAt: "", conditions: "" }]);
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
  const content = structuredClone(defaultPortiaContent);
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
  const content = structuredClone(defaultPortiaContent);
  content.broadcasts = [{ id: "q", type: "quest", title: "Q", body: "", published: true, important: false, startsAt: "2026-10-20", endsAt: "2026-10-25", conditions: "a\nb" }];
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
  const content = structuredClone(defaultPortiaContent);
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
  const legacy = { ...structuredClone(defaultPortiaContent), infoSections: [{ id: "old", title: "Old", body: "text" }] };
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
  const content = structuredClone(defaultPortiaContent);
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
  assert.equal(virus.scientistLogs[0].lockedLevel, 3);
  assert.equal(once.recycledViruses[0].id, "recycled-0");
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
});
