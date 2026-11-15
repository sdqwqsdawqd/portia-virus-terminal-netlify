// Offline contract of GET /api/content by viewer (Phase 24, plan 24-01): stored payload -> body -> JSON -> client
// normalization -> merge. Postgres/RLS, live roles and the browser are BLOCKED until their phase proves them; nothing here
// claims them. All values are invented.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { componentFamily, lf } from "./component-source.ts";
import { contentAccessRequired, contentBodyFor, slotKeyFactory } from "./content-response.ts";
import { embeddedDocuments } from "./embedded-documents.ts";
import { viewerOf } from "./access-viewer.ts";
import { mergePlaceholders } from "./level-placeholders.ts";
import { defaultPortiaContent, type Virus } from "./portia-content.ts";
import { normalizePortiaContent } from "./portia-content-normalize.ts";
import type { GateDecision } from "./access-gate.ts";
import { requiredLevelOf } from "./access-levels.ts";

const SECRET = "x".repeat(40);
const slotOf = slotKeyFactory(SECRET);

function virus(id: string, name: string, level?: unknown): Record<string, unknown> {
  return {
    id,
    code: `CODE_${name}`,
    name,
    status: `STATUS_${name}`,
    infectedImage: `https://images.example/${name}.png`,
    external: `EXTERNAL_${name}`,
    ppu: { health: "", speed: "", abilities: "" },
    physiology: `PHYSIOLOGY_${name}`,
    mutations: [],
    classification: {},
    scientistLogs: [],
    ...(level === undefined ? {} : { level }),
  };
}

const doc = (text: string) => ({ runs: [{ text }] });

// A, B (level 3), C (no level), D (damaged level "x"): the tracer fixture of the plan.
function storedPayload(): Record<string, unknown> {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  return {
    ...base,
    viruses: [virus("vA", "CANARY_A_OPEN", 1), virus("vB", "CANARY_B_LEVEL3", 3), virus("vC", "CANARY_C_NOFIELD"), virus("vD", "CANARY_D_DAMAGED", "x")],
    recycledViruses: [],
    recycleFiles: [],
    recycleOrder: [],
    formattedText: {
      "virus:vA:external": doc("TEXT_A"),
      "virus:vB:external": doc("CANARY_B_TEXT"),
      "virus:vB:mutation:0:description": doc("CANARY_B_MUTATION"),
      "virus:vC:physiology": doc("TEXT_C"),
      "virus:vD:ppu-health": doc("CANARY_D_TEXT"),
    },
  };
}

const row = (payload: unknown) => ({ payload, revision: 7, updated_at: "2026-11-15T00:00:00.000Z" });
const roundTrip = (body: unknown) => JSON.parse(JSON.stringify(body)) as { content: unknown; viewer: unknown };

test("трассер LVL-04/LVL-05: закрытый вирус идёт от поля level до строки-заглушки на своей позиции", () => {
  const body = contentBodyFor({ editor: false, level: 2 }, row(storedPayload()), { slotOf });
  const json = JSON.stringify(body);
  for (const canary of ["CANARY_B", "CANARY_D", "vB", "vD", "CODE_CANARY_B", "images.example/CANARY_B", "images.example/CANARY_D"]) {
    assert.ok(!json.includes(canary), `the response must not contain ${canary}`);
  }
  assert.deepEqual(body.viewer, { level: 2, editor: false });

  const content = normalizePortiaContent(roundTrip(body).content);
  assert.ok(content?.redaction, "the visitor copy carries the marker");
  assert.deepEqual(Object.keys(content.redaction.slots).filter((id) => id.startsWith("v")).sort(), ["vA", "vC"]);
  assert.ok(!("vB" in content.redaction.slots) && !("vD" in content.redaction.slots));
  assert.equal(content.redaction.level, 2);

  const rows = mergePlaceholders(content.viruses, content.redaction.viruses);
  assert.deepEqual(rows.map((entry) => [entry.kind, entry.position]), [["item", 0], ["redacted", 1], ["item", 2], ["redacted", 3]]);
  const redacted = rows.filter((entry) => entry.kind === "redacted");
  assert.deepEqual(redacted.map((entry) => entry.requiredLevel), [3, 5], "no field = 1, a damaged value = 5");
  assert.deepEqual(rows.filter((entry) => entry.kind === "item").map((entry) => entry.item.id), ["vA", "vC"]);
  // A placeholder node holds only slot, requiredLevel and at.
  for (const node of content.redaction.viruses) assert.deepEqual(Object.keys(node).sort(), ["at", "requiredLevel", "slot"]);
  // Normalizing again changes nothing.
  assert.deepEqual(normalizePortiaContent(content), content);
});

test("уровень посетителя 3 открывает вирус уровня 3, мусорный остаётся заглушкой; уровень 5 открывает всё", () => {
  const level3 = normalizePortiaContent(roundTrip(contentBodyFor({ editor: false, level: 3 }, row(storedPayload()), { slotOf })).content);
  assert.deepEqual(level3?.viruses.map((item) => item.id), ["vA", "vB", "vC"]);
  assert.deepEqual(level3?.redaction?.viruses.map((node) => [node.at, node.requiredLevel]), [[3, 5]]);

  const level5 = normalizePortiaContent(roundTrip(contentBodyFor({ editor: false, level: 5 }, row(storedPayload()), { slotOf })).content);
  assert.deepEqual(level5?.viruses.map((item) => item.id), ["vA", "vB", "vC", "vD"]);
  assert.ok(level5?.redaction, "a level 5 visitor copy is still marked");
  assert.deepEqual(level5?.redaction?.viruses, []);
});

test("редактор получает полный контент без redaction и с уровнем 5", () => {
  const body = contentBodyFor({ editor: true, level: 5 }, row(storedPayload()), { slotOf });
  const content = normalizePortiaContent(roundTrip(body).content);
  assert.deepEqual(content?.viruses.map((item) => item.id), ["vA", "vB", "vC", "vD"]);
  assert.equal(content?.redaction, undefined);
  assert.ok(!("redaction" in (body.content as object)));
  assert.deepEqual(body.viewer, { level: 5, editor: true });
});

test("нормализация сохраняет level вируса: число, мусор = 5, нет поля = нет ключа", () => {
  const content = normalizePortiaContent(storedPayload());
  const byId = (id: string) => content?.viruses.find((item) => item.id === id) as Virus;
  assert.equal(byId("vB").level, 3);
  assert.equal(byId("vD").level, 5);
  assert.ok(!("level" in byId("vC")));
  const marker = { level: 2, slots: { vA: "slotA" }, viruses: [{ slot: "s1", requiredLevel: 4, at: 1 }], recycle: [], infoSections: [], infoSubsections: {}, guideSections: [], guideCards: {}, apps: {} };
  const kept = normalizePortiaContent({ ...storedPayload(), redaction: marker });
  assert.deepEqual(kept?.redaction, marker);
  assert.deepEqual(normalizePortiaContent(kept), kept);
  const damaged = normalizePortiaContent({ ...storedPayload(), redaction: { level: "x", viruses: [{ slot: "", at: 1 }, { slot: "ok", at: 1.5 }, { slot: "fine", at: 2 }] } });
  assert.equal(damaged?.redaction?.level, 1, "a damaged level is the lowest: the viewer sees less");
  assert.deepEqual(damaged?.redaction?.viruses, [{ slot: "fine", requiredLevel: 5, at: 2 }], "a node without a level reads as the highest");
});

test("requiredLevelOf: нет поля = 1, целое 1..5 как есть, всё остальное = 5", () => {
  assert.equal(requiredLevelOf(undefined), 1);
  for (const level of [1, 2, 3, 4, 5]) assert.equal(requiredLevelOf(level), level);
  for (const damaged of ["x", "3", 0, 6, 2.5, null, NaN, {}]) assert.equal(requiredLevelOf(damaged), 5);
});

test("viewerOf берёт зрителя только из решения шлюза", () => {
  const closed = (extra: object): GateDecision => ({ mode: "closed", state: { state: "none" }, allowed: false, level: null, editor: false, ...extra });
  assert.deepEqual(viewerOf(closed({ editor: true, allowed: true, level: 5 })), { editor: true, level: 5 });
  assert.deepEqual(viewerOf(closed({ allowed: true, level: 4 })), { editor: false, level: 4 });
  assert.equal(viewerOf(closed({})), null);
  assert.deepEqual(viewerOf({ mode: "open", state: { state: "approved", nickname: "n", level: 3, origin: "sheet" } }), { editor: false, level: 3 });
  const states = [{ state: "none" }, { state: "pending", nickname: "n" }, { state: "rejected", nickname: "n", retryAt: null }, { state: "revoked", nickname: "n", retryAt: null }] as const;
  for (const state of states) assert.deepEqual(viewerOf({ mode: "open", state }), { editor: false, level: 1 }, state.state);
});

test("contentBodyFor: строки нет — стандартное содержимое проходит ту же очистку; хранимые маркеры снимаются", () => {
  const empty = contentBodyFor({ editor: false, level: 1 }, null, { slotOf });
  assert.equal(empty.revision, 0);
  assert.equal(empty.updatedAt, null);
  assert.ok(empty.content.redaction);
  assert.deepEqual(Object.keys(empty.documents), ["charter"], "the default content has no level on the charter");

  const forged = storedPayload();
  forged.redaction = { level: 1, slots: { vB: "forged" }, viruses: [{ slot: "forged", requiredLevel: 1, at: 0 }] };
  (forged.viruses as Record<string, unknown>[])[0].scientistLogs = [{ id: "l1", title: "T", scientist: "S", lockedLevel: 3, content: ["x"], withheld: true }];
  const editorBody = contentBodyFor({ editor: true, level: 5 }, row(forged), { slotOf });
  assert.ok(!("redaction" in editorBody.content), "no stored marker reaches the editor");
  assert.ok(!JSON.stringify(editorBody.content).includes("withheld"));
  const visitorBody = contentBodyFor({ editor: false, level: 2 }, row(forged), { slotOf });
  assert.ok(!JSON.stringify(visitorBody).includes("forged"), "the visitor marker is built anew");
  // D-12: the forged log (lockedLevel 3) is closed for level 2, so the server sets its own marker and drops the text.
  const [forgedLog] = visitorBody.content.viruses[0].scientistLogs;
  assert.deepEqual(forgedLog, { id: "l1", title: "T", scientist: "S", lockedLevel: 3, content: [], withheld: true });
  assert.deepEqual(visitorBody.content.redaction?.viruses.map((node) => node.at), [1, 3]);
});

test("slotKeyFactory: 22 символа base64url, не равен id и не содержит его, стабилен; короткий секрет — исключение", () => {
  const key = slotKeyFactory(SECRET)("vB");
  assert.match(key, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(key, "vB");
  assert.ok(!key.includes("vB"));
  assert.equal(slotKeyFactory(SECRET)("vB"), key);
  assert.notEqual(slotKeyFactory("y".repeat(40))("vB"), key);
  assert.notEqual(slotKeyFactory(SECRET)("vC"), key);
  assert.throws(() => slotKeyFactory("short"));
  assert.equal(contentAccessRequired.code, "access-required");
});

const withoutComments = (text: string) => lf(text).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("исходник GET: шлюз, зритель, тело по зрителю, no-store на каждом ответе, публичного кэша нет", () => {
  const source = withoutComments(readFileSync(new URL("../app/api/content/route.ts", import.meta.url), "utf8"));
  const start = source.indexOf("export async function GET");
  const get = source.slice(start, source.indexOf("export async function PUT"));
  assert.ok(start >= 0 && get.length > 0);
  for (const call of ["resolveGateFor(", "viewerOf(", "contentBodyFor("]) assert.ok(get.includes(call), call);
  assert.ok(!get.includes("editorAccess:"), "IN-04: the gate dependencies are built only in lib/gate-for-request.ts");
  assert.ok(get.indexOf("resolveGateFor(") < get.indexOf("viewerOf("), "gate first, then the viewer");
  // T-25-05: a failed read logs the kind of the failure and nothing else, and answers a plain 503 without the cause.
  assert.ok(get.includes('console.error("PORTIA content read failed", error.kind);'));
  assert.ok(get.includes('{ error: "Данные временно недоступны." }, { status: 503, headers: noStoreHeaders }'));
  assert.ok(get.includes("readContentRow("), "Phase 25: the row is read by the signed server function");
  assert.ok(!get.includes('.from("portia_content")'), "Phase 25: GET no longer reads the table directly");
  assert.ok(get.indexOf("viewerOf(") < get.indexOf("readContentRow("), "the row is read only after the viewer is known");
  const responses = get.split("Response.json(").slice(1);
  assert.ok(responses.length >= 4);
  for (const response of responses) assert.ok(response.slice(0, response.indexOf(";\n")).includes("noStoreHeaders"), response.slice(0, 80));
  assert.ok(!/publicCacheHeaders|Netlify-Cache-Tag|contentCacheTag/.test(get));
  assert.ok(!source.includes("publicCacheHeaders"));
});

test("исходник «Базы вирусов»: список строится слиянием с маркером сервера, заглушка — row", () => {
  const source = componentFamily("portia-desktop").map((part) => part.text).join("\n");
  assert.ok(source.includes("mergePlaceholders(content.viruses, content.redaction?.viruses)"));
  assert.match(source, /<RedactedPlaceholder[^>]*variant="row"/);
  assert.ok(source.includes("row.position + 1"));
  assert.ok(!/level-redact/.test(source), "the browser never runs the redaction");
});

test("D-11 «Устав»: ссылка приходит редактору и посетителю с достаточным уровнем; ниже — нет ни src, ни external, есть узел apps.charter", () => {
  const stored = (charter: number | undefined) => ({ ...storedPayload(), ...(charter === undefined ? {} : { appLevels: { charter } }) });
  const editor = contentBodyFor({ editor: true, level: 5 }, row(stored(4)), { slotOf });
  assert.deepEqual(editor.documents.charter, embeddedDocuments.charter);
  assert.ok(editor.content.appLevels?.charter === 4 && !editor.content.redaction, "the editor sees and edits the level itself");

  const enough = contentBodyFor({ editor: false, level: 3 }, row(stored(3)), { slotOf });
  assert.deepEqual(enough.documents.charter, embeddedDocuments.charter);
  assert.ok(!enough.content.redaction?.apps.charter, "open: no node");

  const closed = contentBodyFor({ editor: false, level: 3 }, row(stored(4)), { slotOf });
  assert.deepEqual(closed.documents, {});
  assert.deepEqual(closed.content.redaction?.apps, { charter: { requiredLevel: 4 } });
  const json = JSON.stringify(closed);
  assert.ok(!json.includes(embeddedDocuments.charter.src) && !json.includes(embeddedDocuments.charter.external) && !json.includes("github.io"));
  assert.ok(!("appLevels" in closed.content));

  // EDGE SEC-07/empty: the «Таблица» address is not leveled and not in the answer (O-1).
  for (const body of [editor, enough, closed]) assert.ok(!JSON.stringify(body.documents).includes("docs.google.com") && !("sheet" in body.documents));
  const lowOpen = contentBodyFor({ editor: false, level: 1 }, row(stored(undefined)), { slotOf });
  assert.ok(lowOpen.documents.charter, "no appLevels = level 1");
});

test("D-11: ни один файл components/ и app/ (вне app/api) не импортирует embedded-documents", () => {
  const offenders: string[] = [];
  for (const root of ["components", "app"]) {
    for (const entry of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      const path = entry.replaceAll("\\", "/");
      if (!/\.(ts|tsx)$/.test(path) || (root === "app" && path.startsWith("api/"))) continue;
      if (readFileSync(`${root}/${path}`, "utf8").includes("embedded-documents")) offenders.push(`${root}/${path}`);
    }
  }
  assert.deepEqual(offenders, []);
  // The module itself brings in nothing from the client side.
  const own = readFileSync("lib/embedded-documents.ts", "utf8");
  assert.ok(!/from "(?:@\/)?(?:components|app)\//.test(own));
});
