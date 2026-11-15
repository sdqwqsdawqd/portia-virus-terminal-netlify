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
  const content = normalizePortiaContent({ ...base, viruses: order.map(virus), recycledViruses: [], recycleFiles: [], recycleOrder: [], formattedText });
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
  assert.deepEqual(Object.keys(low.redaction?.slots ?? {}).sort(), [idOf(0), idOf(1)]);
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
