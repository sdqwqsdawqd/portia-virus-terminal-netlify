import { createHash, randomBytes } from "node:crypto";
import * as nodeFs from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { portiaContentFixture } from "../lib/testing/portia-content-fixture.ts";

// Called only after phase16-staging resolveStagingTarget. No env file is read here.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MANIFEST = path.join(ROOT, ".planning/milestones/v1.3-phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/19-MATRIX-DATA-RUN.json");
const SPECS = ["app-states", "search-click", "media-states", "media-offscreen", "search"]
  .map((name) => `tests/e2e/specs/${name}.spec.ts`);
const LISTS = ["viruses", "infoSections", "guideSections", "broadcasts", "recycleFiles", "recycledViruses"];

export class MatrixError extends Error {
  constructor(code) {
    super(`[PORTIA_STAGING:${code}] Check: matrix data.`);
    this.code = code;
  }
}

const fsOf = (deps) => deps.fs ?? nodeFs;
const fileOf = (deps) => deps.manifestFile ?? MANIFEST;
const adminOf = (target, deps) => deps.admin ?? (deps.createClient ?? createClient)(target.url, target.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const refHashOf = (target) => createHash("sha256").update(target.projectId).digest("hex").slice(0, 12);
const output = (deps, value) => (deps.out ?? ((text) => process.stdout.write(text)))(`${JSON.stringify(value)}\n`);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const hash = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const clone = (value) => structuredClone(value);
const check = (error) => { if (error) throw new MatrixError("matrix-db-failed"); };

function readManifest(deps) {
  const fs = fsOf(deps);
  if (!fs.existsSync(fileOf(deps))) return null;
  try {
    const value = JSON.parse(fs.readFileSync(fileOf(deps), "utf8"));
    if (value?.schema !== "portia-matrix-run-v1" || !value.runId || !value.snapshotPath || !value.refHash) throw new Error("invalid");
    return value;
  } catch { throw new MatrixError("matrix-manifest-invalid"); }
}

function writeManifest(value, deps) {
  const fs = fsOf(deps);
  const file = fileOf(deps);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

async function readRow(admin) {
  const { data, error } = await admin.from("portia_content").select("*").eq("id", "main").maybeSingle();
  check(error);
  return data;
}

function verifyTarget(manifest, target) {
  if (manifest.refHash !== refHashOf(target)) throw new MatrixError("matrix-ref-mismatch");
}

function guide(id, title, image) {
  return { id, title, photo: image, cards: [
    { id: `${id}-first`, title: `${title}: обзор`, cover: image, blocks: [
      { id: `${id}-first-heading`, type: "heading", text: title },
      { id: `${id}-first-photo`, type: "photo", url: image, caption: "Иллюстрация" },
    ] },
    { id: `${id}-second`, title: `${title}: подробности`, cover: "/assets/portia-logo.png", blocks: [
      { id: `${id}-second-text`, type: "text", text: "Материал для проверки заполненного состояния." },
    ] },
  ] };
}

function completeGuide(section) {
  const fallback = guide(`matrix-fill-${section.id}`, section.title || "Справочник", "/assets/portia-assistant.png");
  const cards = Array.isArray(section.cards) ? section.cards : [];
  return { ...section, photo: section.photo || fallback.photo,
    cards: [...cards.map((card) => ({ ...card, cover: card.cover || fallback.photo })), ...fallback.cards.slice(cards.length)] };
}

export function matrixPayload(variant, original) {
  if (variant !== "empty" && variant !== "populated") throw new MatrixError("matrix-variant-invalid");
  const base = original && typeof original === "object" && !Array.isArray(original) ? clone(original) : clone(portiaContentFixture);
  if (variant === "empty") {
    for (const key of LISTS) base[key] = [];
    return base;
  }
  const existing = Array.isArray(base.viruses) ? base.viruses : [];
  const sample = clone(existing[0] ?? portiaContentFixture.viruses[0]);
  const ids = new Set(existing.map((item) => item.id));
  let id = "matrix-virus-yo";
  while (ids.has(id)) id += "-extra";
  base.viruses = [...existing, { ...sample, id, code: "MATRIX-Ё", name: "Ёж матрицы" }];
  base.guideSections = [...(Array.isArray(base.guideSections) ? base.guideSections.map(completeGuide) : []),
    guide("matrix-guide-logo", "Знак Портии", "/assets/portia-logo.png"),
    guide("matrix-guide-virus", "Вирусы и наблюдение", "/assets/portia-virus-icon.png"),
  ];
  base.broadcasts = [...(Array.isArray(base.broadcasts) ? base.broadcasts : []),
    { id: "matrix-news", type: "news", title: "Важная новость матрицы", body: "Проверка опубликованной новости.", published: true, important: true, startsAt: "", endsAt: "", conditions: "" },
    { id: "matrix-quest", type: "quest", title: "Квест матрицы", body: "Проверка опубликованного квеста.", published: true, important: false, startsAt: "2099-01-01", endsAt: "", conditions: "" },
    { id: "matrix-draft", type: "news", title: "Черновик матрицы", body: "Не опубликован.", published: false, important: false, startsAt: "", endsAt: "", conditions: "" },
  ];
  return base;
}

function snapshotOf(manifest, deps) {
  try {
    const row = JSON.parse(fsOf(deps).readFileSync(manifest.snapshotPath, "utf8"));
    if ((row?.revision ?? 0) !== manifest.snapshotRevision || hash(row?.payload ?? null) !== manifest.snapshotHash) throw new Error("snapshot mismatch");
    return row;
  } catch { throw new MatrixError("matrix-snapshot-invalid"); }
}

async function restoreOpen(target, manifest, deps) {
  verifyTarget(manifest, target);
  const admin = adminOf(target, deps);
  const snapshot = snapshotOf(manifest, deps);
  const current = await readRow(admin);
  if (!current || current.revision !== manifest.snapshotRevision + 1 || hash(current.payload) !== manifest.variantHash) {
    throw new MatrixError("matrix-content-moved");
  }
  const filter = (query) => query.eq("id", "main").eq("revision", current.revision).eq("updated_at", current.updated_at);
  const result = snapshot
    ? await filter(admin.from("portia_content").update({ payload: snapshot.payload, revision: snapshot.revision, updated_at: snapshot.updated_at, updated_by: snapshot.updated_by })).select("id")
    : await filter(admin.from("portia_content").delete()).select("id");
  check(result.error);
  if (result.data?.length !== 1) throw new MatrixError("matrix-content-moved");
  const after = await readRow(admin);
  if ((after?.revision ?? 0) !== manifest.snapshotRevision || hash(after?.payload ?? null) !== manifest.snapshotHash) throw new MatrixError("matrix-restore-mismatch");
  writeManifest({ ...manifest, restoredAt: new Date().toISOString() }, deps);
}

function playwrightStats(deps, startedAt, exitCode) {
  if (deps.stats) return deps.stats();
  const file = path.join(deps.root ?? ROOT, "test-results/playwright/results.json");
  try {
    if (fsOf(deps).statSync(file).mtimeMs < startedAt) throw new Error("stale report");
    const stats = JSON.parse(fsOf(deps).readFileSync(file, "utf8")).stats;
    if (!stats || ![stats.expected, stats.unexpected, stats.skipped].every(Number.isInteger)) throw new Error("invalid report");
    return { passed: stats.expected, failed: stats.unexpected, skipped: stats.skipped };
  } catch {
    if (exitCode !== 0) return { passed: 0, failed: 1, skipped: 0 };
    throw new MatrixError("matrix-report-missing");
  }
}

export async function matrixRun(target, variant, options = {}, deps = {}) {
  if (variant !== "empty" && variant !== "populated") throw new MatrixError("matrix-variant-invalid");
  // Owner verdict B: the app does not read a staging employee file. Refuse before touching the DB.
  if (options.stagingEmployees) throw new MatrixError("matrix-employees-unavailable");
  const previous = readManifest(deps);
  if (previous && previous.restoredAt === null) throw new MatrixError("matrix-open-run");
  const admin = adminOf(target, deps);
  const before = await readRow(admin);
  const runId = `${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const directory = path.join(deps.tmpdir ?? os.tmpdir(), `portia-matrix-${runId}`);
  const snapshotPath = path.join(directory, "snapshot.json");
  const fs = fsOf(deps);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(snapshotPath, JSON.stringify(before), { mode: 0o600 });
  const variantPayload = matrixPayload(variant, before?.payload);
  const revision = (before?.revision ?? 0) + 1;
  const manifest = {
    schema: "portia-matrix-run-v1", runId, refHash: refHashOf(target), variant,
    snapshotRevision: before?.revision ?? 0, snapshotHash: hash(before?.payload ?? null), variantHash: hash(variantPayload),
    snapshotPath, startedAt: new Date().toISOString(), restoredAt: null,
  };
  writeManifest(manifest, deps);
  let exitCode = 1;
  let wrote = false;
  let startedAt = 0;
  try {
    const changed = before
      ? await admin.from("portia_content").update({ payload: variantPayload, revision, updated_at: new Date().toISOString(), updated_by: null })
        .eq("id", "main").eq("revision", before.revision).eq("updated_at", before.updated_at).select("id")
      : await admin.from("portia_content").insert({ id: "main", payload: variantPayload, revision, updated_by: null }).select("id");
    check(changed.error);
    if (changed.data?.length !== 1) throw new MatrixError("matrix-content-moved");
    wrote = true;
    const childEnv = { ...(deps.env ?? process.env) };
    delete childEnv.PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY;
    delete childEnv.PORTIA_STAGING_DB_URL;
    delete childEnv.PORTIA_PROMOTION_STAGING_ROSTER;
    const args = ["node_modules/@playwright/test/cli.js", "test", ...SPECS,
      "--project=chromium-desktop", "--project=chromium-phone", "--workers=2"];
    startedAt = Date.now();
    const result = (deps.spawn ?? spawnSync)(process.execPath, args, {
      cwd: deps.root ?? ROOT, env: childEnv, shell: false, windowsHide: true, encoding: "utf8",
    });
    exitCode = typeof result.status === "number" ? result.status : 1;
  } finally {
    if (wrote) await restoreOpen(target, manifest, deps);
  }
  output(deps, { variant, ...playwrightStats(deps, startedAt, exitCode), restored: true });
  return exitCode;
}

export async function matrixRestore(target, deps = {}) {
  const manifest = readManifest(deps);
  if (!manifest || manifest.restoredAt !== null) return 0;
  await restoreOpen(target, manifest, deps);
  output(deps, { restored: true });
  return 0;
}

export async function matrixResidual(target, deps = {}) {
  const manifest = readManifest(deps);
  if (!manifest) { output(deps, { open: false, contentMatchesSnapshot: true }); return 0; }
  verifyTarget(manifest, target);
  const row = await readRow(adminOf(target, deps));
  snapshotOf(manifest, deps);
  const contentMatchesSnapshot = (row?.revision ?? 0) === manifest.snapshotRevision && hash(row?.payload ?? null) === manifest.snapshotHash;
  output(deps, { open: manifest.restoredAt === null, contentMatchesSnapshot });
  return 0;
}
