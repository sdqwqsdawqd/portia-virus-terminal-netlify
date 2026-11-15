// Offline contract of the server redaction (Phase 24, plan 24-01): canary strings must never leave the server above the
// viewer's level. Postgres/RLS, live roles and the browser are BLOCKED until their phase proves them; nothing here claims
// them. Every value is invented.
import test from "node:test";
import assert from "node:assert/strict";
import { slotKeyFactory } from "./content-response.ts";
import { redactContentForViewer, withoutViewerMarkers } from "./level-redact.ts";
import { mergePlaceholders } from "./level-placeholders.ts";
import { defaultPortiaContent, type PortiaContent } from "./portia-content.ts";
import { normalizePortiaContent } from "./portia-content-normalize.ts";
import type { AccessLevel } from "./access-levels.ts";

const slotOf = slotKeyFactory("s".repeat(48));
const LEVELS: AccessLevel[] = [1, 2, 3, 4, 5];

// n = 0 is the virus without a level field.
function virus(n: number): Record<string, unknown> {
  const tag = `CANARY_L${n}`;
  return {
    id: `${tag}_ID`,
    code: `${tag}_CODE`,
    name: `${tag}_NAME`,
    status: `${tag}_STATUS`,
    infectedImage: `https://images.example/${tag}_IMAGE.png`,
    external: `${tag}_EXTERNAL`,
    ppu: { health: `${tag}_HEALTH`, speed: "", abilities: "" },
    physiology: `${tag}_PHYSIOLOGY`,
    mutations: [{ name: `${tag}_MUTATION`, description: "", image: "" }],
    classification: {},
    scientistLogs: [],
    ...(n === 0 ? {} : { level: n }),
  };
}

const doc = (text: string) => ({ runs: [{ text }] });

function contentOf(order: number[]): PortiaContent {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const formattedText: Record<string, unknown> = { "mystery:CANARY_PREFIX": doc("CANARY_PREFIX_TEXT"), "broadcast:keep:body": doc("KEEP_BROADCAST") };
  for (const n of order) {
    formattedText[`virus:CANARY_L${n}_ID:external`] = doc(`CANARY_L${n}_TEXT`);
    formattedText[`virus:CANARY_L${n}_ID:mutation:0:description`] = doc(`CANARY_L${n}_MUTATION_TEXT`);
  }
  const broadcasts = [{ id: "keep", type: "news", title: "KEEP_TITLE", body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "" }];
  const content = normalizePortiaContent({ ...base, viruses: order.map(virus), recycledViruses: [], recycleFiles: [], recycleOrder: [], broadcasts, formattedText });
  assert.ok(content);
  return content;
}

const ordered = [0, 1, 2, 3, 4, 5];
const idOf = (n: number) => `CANARY_L${n}_ID`;
const keysOf = (n: number) => [`virus:${idOf(n)}:external`, `virus:${idOf(n)}:mutation:0:description`];

test("LVL-05: на каждом уровне 1–5 приманки выше уровня посетителя не уходят ни в одно поле, равные и ниже — на месте", () => {
  const input = contentOf(ordered);
  const snapshot = structuredClone(input);
  for (const level of LEVELS) {
    const result = redactContentForViewer(input, level, slotOf);
    const json = JSON.stringify(result);
    for (const n of ordered) {
      const open = n <= level; // n = 0 is level 1
      for (const part of ["ID", "CODE", "NAME", "STATUS", "IMAGE", "EXTERNAL", "HEALTH", "PHYSIOLOGY", "MUTATION", "TEXT", "MUTATION_TEXT"]) {
        assert.equal(json.includes(`CANARY_L${n}_${part}`), open, `level ${level}: CANARY_L${n}_${part} ${open ? "must be" : "must not be"} in the response`);
      }
      // The closed record's text keys are gone from formattedText, the open ones stay.
      for (const key of keysOf(n)) assert.equal(key in result.formattedText, open, `level ${level}: ${key}`);
    }
  }
  assert.deepEqual(input, snapshot, "the input is not changed");
});

test("LVL-05: запись уровня L видна посетителю уровня L, запись уровня L+1 — заглушка", () => {
  const input = contentOf(ordered);
  for (const level of LEVELS) {
    const result = redactContentForViewer(input, level, slotOf);
    assert.ok(result.viruses.some((item) => item.id === idOf(level)), `level ${level} sees its own level`);
    if (level < 5) {
      assert.ok(!result.viruses.some((item) => item.id === idOf(level + 1)));
      assert.ok(result.redaction?.viruses.some((node) => node.requiredLevel === level + 1));
    }
    assert.ok(result.viruses.some((item) => item.id === idOf(0)), "no level field is visible at every level");
  }
});

test("LVL-05: ключи formattedText — только известные префиксы; неизвестный префикс отброшен на всех уровнях (fail closed)", () => {
  const input = contentOf(ordered);
  for (const level of LEVELS) {
    const result = redactContentForViewer(input, level, slotOf);
    const keys = Object.keys(result.formattedText);
    assert.ok(!keys.includes("mystery:CANARY_PREFIX"), `level ${level}`);
    assert.ok(keys.includes("broadcast:keep:body"), "a known prefix stays");
    assert.ok(!JSON.stringify(result).includes("CANARY_PREFIX"));
  }
});

test("LVL-02/LVL-04: порядок открытых сохранён, at — индекс в полном списке, соседние заглушки не сливаются", () => {
  const shuffled = [3, 0, 5, 1, 4, 2];
  const input = contentOf(shuffled);
  const result = redactContentForViewer(input, 2, slotOf);
  assert.deepEqual(result.viruses.map((item) => item.id), [idOf(0), idOf(1), idOf(2)], "open records keep their own order");
  assert.deepEqual(result.redaction?.viruses.map((node) => [node.at, node.requiredLevel]), [[0, 3], [2, 5], [4, 4]]);
  const rows = mergePlaceholders(result.viruses, result.redaction?.viruses);
  assert.deepEqual(
    rows.map((entry) => (entry.kind === "item" ? entry.item.id : `placeholder:${entry.requiredLevel}`)),
    shuffled.map((n) => (n <= 2 ? idOf(n) : `placeholder:${n}`)),
    "the merge restores the full order",
  );
  assert.deepEqual(rows.map((entry) => entry.position), [0, 1, 2, 3, 4, 5]);

  // Three closed records in a row (V3, V4, V5 at level 2): three separate nodes, each with its own level.
  const adjacent = redactContentForViewer(contentOf(ordered), 2, slotOf);
  assert.deepEqual(adjacent.redaction?.viruses.map((node) => [node.at, node.requiredLevel]), [[3, 3], [4, 4], [5, 5]]);
  assert.equal(new Set(adjacent.redaction?.viruses.map((node) => node.slot)).size, 3);
});

test("LVL-05: уровень 5 — все записи на месте, redaction есть и пуст; у открытых записей есть slots, у закрытых нет", () => {
  const input = contentOf(ordered);
  const top = redactContentForViewer(input, 5, slotOf);
  assert.deepEqual(top.viruses.map((item) => item.id), ordered.map(idOf));
  assert.ok(top.redaction);
  assert.deepEqual(top.redaction.viruses, []);
  assert.deepEqual(top.redaction.recycle, []);
  assert.deepEqual(top.redaction.infoSections, []);
  assert.deepEqual(top.redaction.guideSections, []);

  const low = redactContentForViewer(input, 1, slotOf);
  assert.deepEqual(Object.keys(low.redaction?.slots ?? {}).filter((id) => id.startsWith("CANARY")).sort(), [idOf(0), idOf(1)]);
  for (const slot of Object.values(low.redaction?.slots ?? {})) assert.ok(!slot.includes("CANARY"));
});

test("withoutViewerMarkers: копия без redaction и без withheld, вход не меняется", () => {
  const input = contentOf(ordered);
  const marked = redactContentForViewer(input, 2, slotOf);
  const withLog = structuredClone(marked);
  withLog.viruses[0].scientistLogs = [{ id: "l1", title: "T", scientist: "S", lockedLevel: 3, content: ["x"], withheld: true }];
  const before = structuredClone(withLog);
  const clean = withoutViewerMarkers(withLog);
  assert.ok(!("redaction" in clean));
  assert.ok(!JSON.stringify(clean).includes("withheld"));
  assert.deepEqual(withLog, before);
});

// ---------------------------------------------------------------------------------------------------------------------
// Plan 24-05: every surface of the phase on one pure function. The fixture is built here (not a copy of defaultPortiaContent):
// each level-bound object carries a canary of its own effective level in every text field, image URL, id and formatting key.
// ---------------------------------------------------------------------------------------------------------------------

type Canary = { level: number; text: string };

function surfaces() {
  const canaries: Canary[] = [];
  // A canary text ends in "__" so that no canary is the beginning of another one.
  const c = (level: number, label: string) => {
    const text = `CANARY_L${level}_${label}__`;
    canaries.push({ level, text });
    return text;
  };
  const formatted: Record<string, unknown> = { "mystery:x": doc("CANARY_PREFIX_TEXT"), "broadcast:ghost:body": doc("CANARY_GHOST_TEXT"), "assistant:advice": doc("ASSISTANT_KEEP") };
  const viruses: unknown[] = [];
  const recycled: unknown[] = [];
  const files: unknown[] = [];
  const order: string[] = [];
  const info: unknown[] = [];
  const guide: unknown[] = [];

  for (const n of LEVELS) {
    const vid = c(n, `V${n}_ID`);
    viruses.push({
      id: vid, code: c(n, `V${n}_CODE`), name: c(n, `V${n}_NAME`), status: c(n, `V${n}_STATUS`), level: n,
      infectedImage: `https://images.example/${c(n, `V${n}_IMG`)}.png`, external: c(n, `V${n}_EXT`),
      ppu: { health: c(n, `V${n}_HP`), speed: "", abilities: "" }, physiology: c(n, `V${n}_PHYS`),
      mutations: [{ name: c(n, `V${n}_MUT`), description: "", image: "" }], classification: {}, scientistLogs: [],
    });
    formatted[`virus:${vid}:external`] = doc(c(n, `V${n}_FT`));
    formatted[`virus:${vid}:mutation:0:description`] = doc(c(n, `V${n}_MUTFT`));

    const rid = c(n, `RV${n}_ID`);
    recycled.push({
      id: rid, code: c(n, `RV${n}_CODE`), name: c(n, `RV${n}_NAME`), status: c(n, `RV${n}_STATUS`), level: n,
      infectedImage: `https://images.example/${c(n, `RV${n}_IMG`)}.png`, external: "", ppu: { health: "", speed: "", abilities: "" },
      physiology: "", mutations: [], classification: {}, scientistLogs: [],
    });
    formatted[`virus:${rid}:physiology`] = doc(c(n, `RV${n}_FT`));
    order.push(`virus:${rid}`);

    // A recycle file of a live virus and a recycle file of a recycled virus: both follow the virus.
    for (const [tag, target] of [["F", vid], ["FR", rid]] as const) {
      const fid = c(n, `${tag}${n}_ID`);
      files.push({
        id: fid, name: c(n, `${tag}${n}_NAME`), location: "C:\\X", kind: "virus", content: c(n, `${tag}${n}_TEXT`),
        image: `https://images.example/${c(n, `${tag}${n}_IMG`)}.png`, virusId: target,
      });
      formatted[`recycle:${fid}:content`] = doc(c(n, `${tag}${n}_FT`));
      order.push(`file:${fid}`);
    }

    const sid = c(n, `S${n}_ID`);
    const block = (tag: string, effective: number) => ({ id: c(effective, `${tag}_BLK`), type: "text", text: c(effective, `${tag}_TEXT`) });
    const sa = { id: c(n, `SA${n}_ID`), title: c(n, `SA${n}_TITLE`), blocks: [block(`SA${n}`, n)] };
    const sb = { id: c(5, `SB${n}_ID`), title: c(5, `SB${n}_TITLE`), level: 5, blocks: [block(`SB${n}`, 5)] };
    const sc = { id: c(n, `SC${n}_ID`), title: c(n, `SC${n}_TITLE`), level: 1, blocks: [block(`SC${n}`, n)] };
    info.push({ id: sid, title: c(n, `S${n}_TITLE`), body: c(n, `S${n}_BODY`), level: n, subsections: [sa, sb, sc] });
    formatted[`info:${sid}:body`] = doc(c(n, `S${n}_FT`));
    for (const sub of [sa, sb, sc]) formatted[`info-block:${sub.blocks[0].id}:text`] = doc(c("level" in sub && sub.level === 5 ? 5 : n, `${sub.id}_BFT`));

    const gid = c(n, `G${n}_ID`);
    const gblock = (tag: string, effective: number) => ({ id: c(effective, `${tag}_GBLK`), type: "text", text: c(effective, `${tag}_GTEXT`) });
    const card = (tag: string, effective: number, own?: number) => ({
      id: c(effective, `${tag}_ID`), title: c(effective, `${tag}_TITLE`), cover: `https://images.example/${c(effective, `${tag}_COVER`)}.png`,
      blocks: [gblock(tag, effective), { id: c(effective, `${tag}_HBLK`), type: "heading", text: c(effective, `${tag}_HEAD`) }],
      ...(own === undefined ? {} : { level: own }),
    });
    const ca = card(`CA${n}`, n);
    const cb = card(`CB${n}`, 5, 5);
    guide.push({ id: gid, title: c(n, `G${n}_TITLE`), photo: `https://images.example/${c(n, `G${n}_PHOTO`)}.png`, level: n, cards: [ca, cb] });
    formatted[`guide-block:${ca.blocks[0].id}:text`] = doc(c(n, `${ca.id}_GFT`));
    formatted[`guide-block:${cb.blocks[0].id}:text`] = doc(c(5, `${cb.id}_GFT`));
  }

  // Scientist records: the virus is level 1 (title and scientist are level 1), each record's text is of its own lockedLevel.
  const logs = [2, 3, 4, 5].map((m) => ({
    id: `LOG${m}`, title: c(1, `LOG${m}_TITLE`), scientist: c(1, `LOG${m}_WHO`), lockedLevel: m,
    content: [c(m, `LOG${m}_TEXT`)], richContent: { runs: [{ text: c(m, `LOG${m}_RICH`) }] }, internalNote: c(m, `LOG${m}_NOTE`),
  }));
  viruses.push({
    id: "VLOGS", code: "VLOGS", name: "VLOGS", status: "", infectedImage: "", external: "", ppu: { health: "", speed: "", abilities: "" },
    physiology: "", mutations: [], classification: {}, scientistLogs: logs,
  });

  // Search: a line that names a record carries that record's canary name, so it goes with the record.
  const recs = [...LEVELS.map((n) => `подробнее ${c(n, `V${n}_NAME`)}`), "Безопасная строка"];
  formatted["search:recommendations"] = doc(c(5, "RECDOC"));
  const broadcasts = [{ id: "bc", type: "news", title: "BC_TITLE", body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "" }];
  formatted["broadcast:bc:body"] = doc("BC_KEEP");

  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const content = normalizePortiaContent({
    ...base, viruses, recycledViruses: recycled, recycleFiles: files, recycleOrder: order, infoSections: info, guideSections: guide, broadcasts,
    searchRecommendations: recs, broadcastSections: [{ id: "bs", title: "BS_CANARY", subsections: [] }], searchRecommendationSections: [{ id: "rs", title: "RS_CANARY", items: recs, subsections: [] }],
    formattedText: formatted, appLevels: { charter: 4 },
  });
  assert.ok(content);
  return { content, canaries };
}

test("LVL-05 (приманки 1–5): ни одна приманка выше уровня посетителя не уходит ни в одно поле и ни в один ключ formattedText", () => {
  const { content, canaries } = surfaces();
  const snapshot = structuredClone(content);
  // The fixture survives normalization whole: with every level open, every canary is there.
  const full = redactContentForViewer(content, 5, slotOf);
  const fullText = `${JSON.stringify(full)}${Object.keys(full.formattedText).join("")}`;
  for (const canary of canaries) assert.ok(fullText.includes(canary.text), `fixture: ${canary.text} must survive normalization at level 5`);
  assert.ok(canaries.length > 150);

  for (const level of LEVELS) {
    const result = redactContentForViewer(content, level, slotOf);
    const json = JSON.stringify(result);
    const keys = Object.keys(result.formattedText).join("\n");
    for (const canary of canaries) {
      const open = canary.level <= level;
      assert.equal(json.includes(canary.text), open, `level ${level}: ${canary.text} ${open ? "must be" : "must not be"} in the response`);
      if (keys.includes(canary.text)) assert.ok(open, `level ${level}: ${canary.text} must not be a formattedText key`);
    }
    for (const word of ["CANARY_PREFIX", "CANARY_GHOST", "BS_CANARY", "RS_CANARY"]) assert.ok(!json.includes(word), `${word} never reaches a visitor`);
    assert.ok(!("appLevels" in result), "appLevels is not in the visitor copy");
  }
  assert.deepEqual(content, snapshot, "the input is not changed");
});

test("D-12: закрытая запись учёного остаётся на месте с названием и учёным, без текста и неизвестных ключей; открытая — целиком", () => {
  const { content } = surfaces();
  for (const level of LEVELS) {
    const result = redactContentForViewer(content, level, slotOf);
    const holder = result.viruses.find((item) => item.id === "VLOGS");
    assert.ok(holder, "the virus stays");
    assert.deepEqual(holder.scientistLogs.map((log) => log.id), ["LOG2", "LOG3", "LOG4", "LOG5"], "records keep their places");
    for (const log of holder.scientistLogs) {
      assert.ok(log.title.startsWith("CANARY_L1_") && log.scientist.startsWith("CANARY_L1_"), "title and scientist stay");
      if (log.lockedLevel > level) {
        assert.deepEqual(Object.keys(log).sort(), ["content", "id", "lockedLevel", "scientist", "title", "withheld"], `level ${level}: ${log.id}`);
        assert.deepEqual(log.content, []);
        assert.equal(log.withheld, true);
      } else {
        assert.ok(!("withheld" in log));
        assert.ok(log.content[0].startsWith("CANARY_L"), "an open record is whole");
        assert.ok(log.richContent && "internalNote" in log);
      }
    }
  }
});

test("D-12: исключение узкое — закрытый вирус, раздел, подраздел и карточка не остаются на месте с названием", () => {
  const { content } = surfaces();
  const result = redactContentForViewer(content, 1, slotOf);
  const json = JSON.stringify(result);
  for (const part of ["CANARY_L3_V3_NAME__", "CANARY_L3_S3_TITLE__", "CANARY_L3_SA3_TITLE__", "CANARY_L3_G3_TITLE__", "CANARY_L3_CA3_TITLE__", "CANARY_L5_SB1_TITLE__", "CANARY_L3_RV3_NAME__", "CANARY_L3_F3_NAME__"]) assert.ok(!json.includes(part), part);
  assert.ok(result.viruses.every((item) => item.scientistLogs.every((log) => item.id === "VLOGS" || !log.withheld)), "no withheld marker outside the scientist records");
});

// A small tree for the hierarchy and ordering rules.
function tree(): PortiaContent {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const sub = (id: string, level?: number) => ({ id, title: `T_${id}`, ...(level === undefined ? {} : { level }), blocks: [{ id: `b_${id}`, type: "text", text: `X_${id}` }] });
  const card = (id: string, level?: number) => ({ id, title: `T_${id}`, cover: "", ...(level === undefined ? {} : { level }), blocks: [{ id: `b_${id}`, type: "text", text: `X_${id}` }] });
  const formattedText: Record<string, unknown> = {};
  for (const id of ["u1", "u2", "u3", "u4"]) formattedText[`info-block:b_${id}:text`] = doc(`I_${id}`);
  for (const id of ["k1", "k2", "k3"]) formattedText[`guide-block:b_${id}:text`] = doc(`G_${id}`);
  formattedText["info:S3:body"] = doc("I_S3_BODY");
  formattedText["info:S1:body"] = doc("I_S1_BODY");
  const content = normalizePortiaContent({
    ...base,
    infoSections: [
      { id: "S1", title: "T_S1", body: "B", subsections: [sub("u4")] },
      { id: "S3", title: "T_S3", body: "B", level: 3, subsections: [sub("u1"), sub("u2", 4), sub("u3", 2)] },
    ],
    guideSections: [
      { id: "H3", title: "T_H3", photo: "", level: 3, cards: [card("k1"), card("k2", 5)] },
      { id: "H1", title: "T_H1", photo: "", cards: [card("k3", 4)] },
    ],
    formattedText,
  });
  assert.ok(content);
  return content;
}

test("D-10: закрытый раздел — ровно один узел, число и уровни его подразделов и карточек не раскрываются; ребёнок = max(свой, раздела)", () => {
  const input = tree();
  const low = redactContentForViewer(input, 2, slotOf);
  assert.deepEqual(low.infoSections.map((item) => item.id), ["S1"]);
  assert.deepEqual(low.redaction?.infoSections.map((node) => [node.at, node.requiredLevel]), [[1, 3]]);
  assert.deepEqual(low.redaction?.infoSubsections, {}, "no key for the closed section, and none for S1 (nothing closed inside)");
  assert.deepEqual(low.redaction?.guideSections.map((node) => [node.at, node.requiredLevel]), [[0, 3]]);
  assert.deepEqual(low.redaction?.guideCards, { H1: [{ slot: slotOf("k3"), requiredLevel: 4, at: 0 }] });
  assert.deepEqual(Object.keys(low.formattedText).sort(), ["info-block:b_u4:text", "info:S1:body"].sort());
  const json = JSON.stringify(low);
  for (const part of ["T_S3", "T_u1", "T_u2", "T_u3", "T_H3", "T_k1", "T_k2", "X_u1", "X_u2", "X_k1", "I_S3_BODY"]) assert.ok(!json.includes(part), part);

  const mid = redactContentForViewer(input, 3, slotOf);
  assert.deepEqual(mid.infoSections.map((item) => item.id), ["S1", "S3"]);
  assert.deepEqual(mid.infoSections[1].subsections.map((item) => item.id), ["u1", "u3"], "u3 own level 2 is lifted to the section's 3; u2 (4) is closed");
  assert.deepEqual(mid.redaction?.infoSubsections, { S3: [{ slot: slotOf("u2"), requiredLevel: 4, at: 1 }] });
  assert.deepEqual(mid.redaction?.guideCards, { H3: [{ slot: slotOf("k2"), requiredLevel: 5, at: 1 }], H1: [{ slot: slotOf("k3"), requiredLevel: 4, at: 0 }] });
  assert.ok("info-block:b_u1:text" in mid.formattedText && "info-block:b_u3:text" in mid.formattedText && !("info-block:b_u2:text" in mid.formattedText));
  assert.ok("info:S3:body" in mid.formattedText);
  assert.deepEqual(Object.keys(mid.redaction?.slots ?? {}).filter((id) => !id.includes("vir-")).sort(), ["H1", "H3", "S1", "S3", "k1", "u1", "u3", "u4"].sort());
});

test("EDGE LVL-05/ordering: порядок открытых записей во всех списках после очистки совпадает с исходным", () => {
  const input = tree();
  const open = redactContentForViewer(input, 5, slotOf);
  assert.deepEqual(open.infoSections.map((item) => item.id), input.infoSections.map((item) => item.id));
  assert.deepEqual(open.guideSections.map((item) => item.id), input.guideSections.map((item) => item.id));
  const { content } = surfaces();
  for (const level of LEVELS) {
    const result = redactContentForViewer(content, level, slotOf);
    const expectOrder = (all: readonly { id: string }[], kept: readonly { id: string }[]) =>
      assert.deepEqual(kept.map((item) => item.id), all.filter((item) => kept.some((other) => other.id === item.id)).map((item) => item.id));
    expectOrder(content.viruses, result.viruses);
    expectOrder(content.recycledViruses, result.recycledViruses);
    expectOrder(content.recycleFiles, result.recycleFiles);
    expectOrder(content.infoSections, result.infoSections);
    expectOrder(content.guideSections, result.guideSections);
    for (const section of result.infoSections) expectOrder(content.infoSections.find((item) => item.id === section.id)?.subsections ?? [], section.subsections);
    for (const section of result.guideSections) expectOrder(content.guideSections.find((item) => item.id === section.id)?.cards ?? [], section.cards);
    const kept = new Set(result.recycleOrder);
    assert.deepEqual(result.recycleOrder, content.recycleOrder.filter((key) => kept.has(key)));
  }
});

function bin(): PortiaContent {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const v = (id: string, level?: number) => ({ ...virus(0), id, code: `C_${id}`, name: `N_${id}`, ...(level === undefined ? {} : { level }) });
  const file = (id: string, kind: string, virusId = "") => ({ id, name: `F_${id}`, location: "C:\\X", kind, content: `TXT_${id}`, image: "", virusId });
  const content = normalizePortiaContent({
    ...base,
    viruses: [v("LIVE_OPEN", 1), v("LIVE_CLOSED", 4)],
    recycledViruses: [v("B", 4), v("D", 2)],
    recycleFiles: [file("a", "text"), file("vfile_closed", "virus", "LIVE_CLOSED"), file("c", "image"), file("vfile_open", "virus", "LIVE_OPEN"), file("vfile_rb", "virus", "B"), file("orphan", "virus", "NOWHERE")],
    recycleOrder: ["file:a", "virus:B", "file:vfile_closed", "file:c", "virus:D", "file:vfile_open", "file:vfile_rb", "file:orphan"],
    formattedText: { "recycle:a:content": doc("R_a"), "recycle:vfile_closed:content": doc("R_closed"), "recycle:c:content": doc("R_c"), "virus:B:external": doc("V_B"), "virus:D:external": doc("V_D") },
  });
  assert.ok(content);
  return content;
}

test("«Корзина»: закрытый вирус и файл закрытого вируса опущены с ключами; на их месте узел с индексом в полном порядке; смежные открытые на своих местах", () => {
  const input = bin();
  const result = redactContentForViewer(input, 3, slotOf);
  assert.deepEqual(result.recycleOrder, ["file:a", "file:c", "virus:D", "file:vfile_open"], "open entries keep their order around the closed ones");
  assert.deepEqual(result.redaction?.recycle.map((node) => [node.at, node.requiredLevel]), [[1, 4], [2, 4], [6, 4], [7, 5]]);
  assert.deepEqual(result.recycledViruses.map((item) => item.id), ["D"]);
  assert.deepEqual(result.recycleFiles.map((item) => item.id), ["a", "c", "vfile_open"]);
  assert.deepEqual(Object.keys(result.formattedText).sort(), ["recycle:a:content", "recycle:c:content", "virus:D:external"]);
  const json = JSON.stringify(result);
  for (const part of ["LIVE_CLOSED", "vfile_closed", "vfile_rb", "N_B", "C_B", "F_vfile_closed", "R_closed", "V_B", "F_orphan", "TXT_orphan"]) assert.ok(!json.includes(part), part);
  for (const node of result.redaction?.recycle ?? []) assert.deepEqual(Object.keys(node).sort(), ["at", "requiredLevel", "slot"]);

  const top = redactContentForViewer(input, 5, slotOf);
  assert.deepEqual(top.recycleOrder, input.recycleOrder);
  assert.deepEqual(top.redaction?.recycle, []);
  assert.deepEqual(input, bin(), "the input is not changed");
});

test("EDGE LVL-05/adjacency: закрытый файл между двумя открытыми — открытые на местах, ключа нет, at равен индексу в полном порядке", () => {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const files = [
    { id: "x1", name: "X1", location: "C:\\X", kind: "text", content: "", image: "", virusId: "" },
    { id: "x2", name: "CLOSED_FILE", location: "C:\\X", kind: "virus", content: "", image: "", virusId: "VC" },
    { id: "x3", name: "X3", location: "C:\\X", kind: "text", content: "", image: "", virusId: "" },
  ];
  const content = normalizePortiaContent({
    ...base, viruses: [{ ...virus(0), id: "VC", level: 5 }], recycledViruses: [], recycleFiles: files, recycleOrder: ["file:x1", "file:x2", "file:x3"],
    formattedText: { "recycle:x2:content": doc("NO"), "recycle:x1:content": doc("YES") },
  });
  assert.ok(content);
  const result = redactContentForViewer(content, 1, slotOf);
  assert.deepEqual(result.recycleOrder, ["file:x1", "file:x3"]);
  assert.deepEqual(result.redaction?.recycle.map((node) => [node.at, node.requiredLevel]), [[1, 5]]);
  assert.deepEqual(Object.keys(result.formattedText), ["recycle:x1:content"]);
  assert.ok(!JSON.stringify(result).includes("CLOSED_FILE"));
});

function withRecommendations(lines: string[], viruses: Record<string, unknown>[]): PortiaContent {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const content = normalizePortiaContent({ ...base, viruses, recycledViruses: [], recycleFiles: [], recycleOrder: [], searchRecommendations: lines, formattedText: { "search:recommendations": doc("RECDOC"), "assistant:advice": doc("ADV") } });
  assert.ok(content);
  return content;
}

test("рекомендации поиска: строка, называющая закрытое, удалена вместе с ключом общего документа; без удалений ключ остаётся", () => {
  const named = (id: string, name: string, level: number, code = "") => ({ ...virus(0), id, name, code, level });
  const content = withRecommendations(["МОРОК", "Протей", "КАЛ"], [named("v1", "МОРОК", 1), named("v2", "КАЛЛИСТО", 4)]);
  const result = redactContentForViewer(content, 2, slotOf);
  assert.deepEqual(result.searchRecommendations, ["МОРОК", "Протей"]);
  assert.ok(!("search:recommendations" in result.formattedText));
  assert.ok("assistant:advice" in result.formattedText);
  assert.deepEqual(result.searchRecommendationSections, []);
  assert.deepEqual(result.broadcastSections, []);

  const open = redactContentForViewer(content, 4, slotOf);
  assert.deepEqual(open.searchRecommendations, ["МОРОК", "Протей", "КАЛ"]);
  assert.ok("search:recommendations" in open.formattedText, "nothing removed - the key stays");

  // The code, a longer line containing the name, yo/ye and case are all matched; a one-letter name is not a match key.
  const more = withRecommendations(["Код zx-9 в картотеке", "ёжик ЕЖИК", "ещё строка", "а"], [named("v3", "Тест", 5, "ZX-9"), named("v4", "ЁЖ", 5), named("v5", "а", 5)]);
  assert.deepEqual(redactContentForViewer(more, 1, slotOf).searchRecommendations, ["ещё строка", "а"]);
});

test("рекомендации поиска: названия закрытых разделов, подразделов, карточек и файлов корзины тоже вычёркивают строки", () => {
  const content = tree();
  const withLines = { ...content, searchRecommendations: ["про T_S3", "про T_u2", "про T_u4", "про T_k2", "про T_H3", "про T_k3"] };
  const low = redactContentForViewer(withLines, 2, slotOf);
  assert.deepEqual(low.searchRecommendations, ["про T_u4"]);
  const mid = redactContentForViewer(withLines, 3, slotOf);
  assert.deepEqual(mid.searchRecommendations, ["про T_S3", "про T_u4", "про T_H3"]);
});

test("formattedText: неизвестный префикс, несуществующее объявление и чужие ключи отброшены всегда; ассистент и объявление на месте", () => {
  const { content } = surfaces();
  for (const level of LEVELS) {
    const keys = Object.keys(redactContentForViewer(content, level, slotOf).formattedText);
    assert.ok(!keys.includes("mystery:x") && !keys.includes("broadcast:ghost:body"));
    assert.ok(keys.includes("assistant:advice") && keys.includes("broadcast:bc:body"));
  }
  // Allow-list by exact id: the key of a closed virus id that is the beginning of an open id is not kept for the open one.
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const input = normalizePortiaContent({
    ...base, viruses: [{ ...virus(0), id: "a", level: 5 }, { ...virus(0), id: "a:b" }], recycledViruses: [], recycleFiles: [], recycleOrder: [],
    formattedText: { "virus:a:b:external": doc("OPEN_B"), "virus:a:external": doc("CLOSED_A"), "virus:a:b:unknown-field": doc("UNKNOWN_FIELD") },
  });
  assert.ok(input);
  const result = redactContentForViewer(input, 1, slotOf);
  assert.deepEqual(Object.keys(result.formattedText), ["virus:a:b:external"]);
});

test("«Устав»: закрытый уровнем — узел apps.charter, appLevels в ответе нет; достаточный — узла нет", () => {
  const { content } = surfaces();
  const closed = redactContentForViewer(content, 3, slotOf);
  assert.deepEqual(closed.redaction?.apps, { charter: { requiredLevel: 4 } });
  assert.ok(!("appLevels" in closed));
  const open = redactContentForViewer(content, 4, slotOf);
  assert.deepEqual(open.redaction?.apps, {});
  const noLevel = redactContentForViewer({ ...content, appLevels: undefined }, 1, slotOf);
  assert.deepEqual(noLevel.redaction?.apps, {}, "no appLevels = level 1");
});

test("явная сборка ответа: незнакомое поле верхнего уровня хранимого контента не доходит до посетителя", () => {
  const { content } = surfaces();
  const withExtra = { ...content, futureField: "CANARY_FUTURE_FIELD" } as PortiaContent;
  for (const level of LEVELS) assert.ok(!JSON.stringify(redactContentForViewer(withExtra, level, slotOf)).includes("CANARY_FUTURE_FIELD"));
});

// RLS24-02 (review round 1, M-1): a virus file whose virus cannot be found (an empty or a dangling virusId) is not level 1: it
// carries the name and code of a virus that may have been closed and then deleted, so it fails closed to the top level.
test("«Корзина»: файл вируса с пустым или битым virusId закрыт на уровне 5 (fail closed), открыт только на 5 и не светит имя", () => {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const file = (id: string, kind: string, virusId: unknown) => ({ id, name: kind === "virus" ? `${id}_CLOSED_NAME_CLOSED_CODE.virus` : `${id}.txt`, location: "C:\\X", kind, content: `TXT_${id}`, image: "", virusId });
  const content = normalizePortiaContent({
    ...base, viruses: [], recycledViruses: [],
    recycleFiles: [file("dangling", "virus", "GONE"), file("empty", "virus", ""), file("absent", "virus", undefined), file("plain", "text", "")],
    recycleOrder: ["file:dangling", "file:empty", "file:absent", "file:plain"],
    formattedText: { "recycle:dangling:content": doc("SECRET_DANGLING"), "recycle:empty:content": doc("SECRET_EMPTY"), "recycle:plain:content": doc("PLAIN_OK") },
  });
  assert.ok(content);
  for (const level of [1, 2, 3, 4] as AccessLevel[]) {
    const result = redactContentForViewer(content, level, slotOf);
    assert.deepEqual(result.recycleOrder, ["file:plain"], `level ${level}`);
    assert.deepEqual(result.recycleFiles.map((item) => item.id), ["plain"]);
    assert.deepEqual(result.redaction?.recycle.map((node) => [node.at, node.requiredLevel]), [[0, 5], [1, 5], [2, 5]]);
    const json = JSON.stringify(result);
    for (const part of ["CLOSED_NAME", "CLOSED_CODE", "SECRET_DANGLING", "SECRET_EMPTY", "TXT_dangling", "TXT_empty"]) assert.ok(!json.includes(part), `${part} at level ${level}`);
    assert.deepEqual(Object.keys(result.formattedText), ["recycle:plain:content"]);
  }
  const top = redactContentForViewer(content, 5, slotOf);
  assert.deepEqual(top.recycleOrder, ["file:dangling", "file:empty", "file:absent", "file:plain"]);
  assert.deepEqual(top.redaction?.recycle, []);
});

// RLS24-05 (L-4): a draft broadcast is not shown to a visitor by the site, so it does not travel to the visitor at all.
test("сводки: черновик (published: false) не уходит посетителю ни телом, ни ключом formattedText; опубликованная остаётся", () => {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const bc = (id: string, published: boolean, body: string) => ({ id, type: "news", title: `T_${id}`, body, published, important: false, startsAt: "", endsAt: "", conditions: "" });
  const content = normalizePortiaContent({
    ...base, viruses: [], recycledViruses: [], recycleFiles: [], recycleOrder: [],
    broadcasts: [bc("pub", true, "PUB_BODY"), bc("draft", false, "DRAFT_NAMES_CLOSED_RECORD")],
    formattedText: { "broadcast:pub:body": doc("PUB_DOC"), "broadcast:draft:body": doc("DRAFT_DOC") },
  });
  assert.ok(content);
  assert.equal(content.broadcasts.length, 2, "fixture: the draft survives normalization");
  for (const level of LEVELS) {
    const result = redactContentForViewer(content, level, slotOf);
    assert.deepEqual(result.broadcasts.map((item) => item.id), ["pub"], `level ${level}`);
    assert.deepEqual(Object.keys(result.formattedText), ["broadcast:pub:body"], `level ${level}`);
    const json = JSON.stringify(result);
    assert.ok(!json.includes("DRAFT_NAMES_CLOSED_RECORD") && !json.includes("DRAFT_DOC"));
  }
});

// RLS24-06 (L-5): the assistant keeps its four exact keys, not any key that starts with "assistant:".
test("formattedText: ассистент — только четыре точных ключа редактора, любой другой суффикс отброшен", () => {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  const content = normalizePortiaContent({
    ...base, viruses: [], recycledViruses: [], recycleFiles: [], recycleOrder: [],
    formattedText: {
      "assistant:advice": doc("A1"), "assistant:offended": doc("A2"), "assistant:idle": doc("A3"), "assistant:activity": doc("A4"),
      "assistant:virus:SOME_ID:external": doc("SMUGGLED_1"), "assistant:": doc("SMUGGLED_2"), "assistant:advice:extra": doc("SMUGGLED_3"),
    },
  });
  assert.ok(content);
  for (const level of LEVELS) {
    const keys = Object.keys(redactContentForViewer(content, level, slotOf).formattedText).sort();
    assert.deepEqual(keys, ["assistant:activity", "assistant:advice", "assistant:idle", "assistant:offended"], `level ${level}`);
  }
});
