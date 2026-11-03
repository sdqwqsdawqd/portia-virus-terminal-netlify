import { createHash, randomBytes } from "node:crypto";
import * as nodeFs from "node:fs";
import { spawn as spawnProcess } from "node:child_process";
import { get as httpsGet } from "node:https";
import { connect } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createRun, purgeRun, residualOf } from "../tests/e2e/fixtures/staging-harness.ts";
import { promotionTitles, qualificationPromotionTransitions } from "../lib/portia-promotion.ts";

// Temporary acceptance data for the Promotion flow (Phase 19, D-01/D-03/D-04). Every function takes the target already
// resolved by resolveStagingTarget in phase16-staging.mjs; nothing here reads env files or prints keys or passwords.
// Scope: run-prefixed rows, users with the portia_run marker, manifest bank IDs, and rows created within the DB-clock
// run window after subtracting the pre-seed snapshot. v1 manifests retain the legacy time-window rule.

export const MANIFEST_SCHEMA = "portia-acceptance-run-v2";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const MANIFEST_FILE = path.join(
  REPO_ROOT, ".planning", "phases", "PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media", "evidence", "19-ACCEPTANCE-RUN.json",
);
const runIdPattern = /^[0-9a-z]+_[0-9a-f]{8}$/u;
const labelPattern = /^[a-z0-9-]{1,24}$/u;
const SHIFT_KINDS = ["cooldown", "penalty", "deadline", "retake", "cleanup", "rank"];
const DAY = 86_400_000;
const TASK_BANKS = "portia_promo_task_banks";
const QUALIFICATION_BANKS = "portia_promo_qualification_banks";
const BUCKETS = "portia_promo_attempt_buckets";
const ATTEMPTS = "portia_promo_attempts";
const QUALIFICATION_REQUESTS = "portia_promo_qualification_requests";
const SHEET_HEADERS = ["НИК", "Звание", "След. звание", "Анти-Спидран", "Дата"];

// Same message shape as StagingError (phase16-staging.mjs); not imported to keep the two scripts free of an import cycle.
export class AcceptanceError extends Error {
  constructor(code, variableNames = []) {
    super(`[PORTIA_STAGING:${code}] Check: ${variableNames.join(", ") || "wrapper arguments"}.`);
    this.name = "AcceptanceError";
    this.code = code;
  }
}

// PC and phone get independent participants; each device can complete the same acceptance flow without reusing a nickname.
// The sheet date (column E) is the day the next promotion becomes available: promotion day + title cooldown.
const PARTICIPANTS = ["pc", "ph"].flatMap((device) => [
  { label: `${device}-ordinary`, titleId: "academic", daysAgo: 60 },
  { label: `${device}-qual3`, titleId: "trainee", daysAgo: 60 },
  { label: `${device}-qual5`, titleId: "researcher", daysAgo: 60 },
  { label: `${device}-qual7`, titleId: "scientist", daysAgo: 60 },
  { label: `${device}-retake`, titleId: "trainee", daysAgo: 60 },
  { label: `${device}-cooldown`, titleId: "academic", daysAgo: 1 },
]).concat([{ label: "probe", titleId: "academic", daysAgo: 60 }]);

const titleOf = (id) => promotionTitles.find((title) => title.id === id);
const nextTitleOf = (id) => promotionTitles.at(titleOf(id).level);
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const likePrefix = (prefix) => `${prefix.replace(/[\\%_]/gu, "\\$&")}%`;
const runPrefix = (runId) => `__portia_live_${runId}`;
const nickOf = (runId, label) => `${runPrefix(runId)}_${label}`;

const outOf = (deps) => deps.out ?? ((text) => process.stdout.write(text));
const errOf = (deps) => deps.err ?? ((text) => process.stderr.write(text));
const fsOf = (deps) => deps.fs ?? nodeFs;
const nowOf = (deps) => (deps.harness?.now ?? Date.now)();
const workDirOf = (runId, deps) => path.join(deps.tmpdir ?? os.tmpdir(), `portia-acceptance-${runId}`);
const manifestFileOf = (deps) => deps.manifestFile ?? MANIFEST_FILE;
const harnessDeps = (deps) => ({ ...(deps.createClient ? { createClient: deps.createClient } : {}), ...deps.harness });
const adminOf = (target, deps) =>
  (deps.createClient ?? createClient)(target.url, target.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const liveOf = (target) => ({
  target: { projectId: target.projectId },
  url: target.url,
  publishableKey: target.publishableKey,
  adminKey: target.adminKey,
  refHash: createHash("sha256").update(target.projectId).digest("hex").slice(0, 12),
});

// DB messages may carry arbitrary text: only the step label reaches the error.
function check(error, label) {
  if (error) throw new AcceptanceError("acceptance-db-failed", [label]);
}

async function insertRows(admin, table, rows) {
  const { data, error } = await admin.from(table).insert(rows).select("id");
  check(error, `insert ${table}`);
  return (data ?? []).map((row) => row.id);
}

async function selectColumn(query, label, column) {
  const { data, error } = await query;
  check(error, label);
  return (data ?? []).map((row) => row[column]);
}

async function snapshotColumn(admin, table, column) {
  const { data, count, error } = await admin.from(table).select(column, { count: "exact" });
  check(error, `snapshot ${table}`);
  // PostgREST may cap a page at 1000 rows. Refuse to seed if the snapshot would omit any preexisting row.
  if (count === null || count !== (data?.length ?? 0)) throw new AcceptanceError("acceptance-snapshot-incomplete", [table]);
  return (data ?? []).map((row) => row[column]);
}

function readManifest(runId, deps) {
  let manifest;
  try {
    manifest = JSON.parse(fsOf(deps).readFileSync(manifestFileOf(deps), "utf8"));
  } catch {
    throw new AcceptanceError("acceptance-manifest-missing", ["19-ACCEPTANCE-RUN.json"]);
  }
  if (!["portia-acceptance-run-v1", "portia-acceptance-run-v2"].includes(manifest?.schema) || manifest.runId !== runId) {
    throw new AcceptanceError("acceptance-manifest-mismatch", ["19-ACCEPTANCE-RUN.json"]);
  }
  if (manifest.schema === MANIFEST_SCHEMA && (
    manifest.createdAtSource !== "db" ||
    !["bucketKeys", "taskBankIds", "qualificationBankIds"].every((key) =>
      Array.isArray(manifest.preexisting?.[key]) && manifest.preexisting[key].every((value) => typeof value === "string"))
  )) throw new AcceptanceError("acceptance-manifest-mismatch", ["19-ACCEPTANCE-RUN.json"]);
  return { ...manifest, legacy: manifest.schema === "portia-acceptance-run-v1" };
}

const refHashOf = (projectId) => createHash("sha256").update(projectId).digest("hex").slice(0, 12);

function portInUse() {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port: 3000 });
    socket.setTimeout(1000);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.once("timeout", () => { socket.destroy(); resolve(true); });
  });
}

function httpsLocal(url) {
  return new Promise((resolve, reject) => {
    const request = httpsGet(url, { rejectUnauthorized: false, timeout: 5000 }, (response) => {
      const parts = [];
      response.on("data", (chunk) => parts.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(parts).toString("utf8");
        resolve({ status: response.statusCode, text: async () => body, json: async () => JSON.parse(body) });
      });
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

function safeOutput(value, secrets) {
  let result = String(value);
  for (const [label, secret] of secrets) {
    if (typeof secret === "string" && secret) for (const form of new Set([secret, encodeURIComponent(secret)])) result = result.split(form).join(`[REDACTED:${label}]`);
  }
  return result;
}

function relay(stream, write, secrets) {
  let pending = "";
  stream?.on("data", (chunk) => {
    pending += String(chunk);
    const last = pending.lastIndexOf("\n");
    if (last >= 0) {
      write(safeOutput(pending.slice(0, last + 1), secrets));
      pending = pending.slice(last + 1);
    }
  });
  stream?.on("end", () => { if (pending) write(safeOutput(pending, secrets)); });
}

function childExit(child) {
  return new Promise((resolve) => {
    child.once("exit", (code) => resolve(typeof code === "number" ? code : 1));
    child.once("error", () => resolve(1));
  });
}

export async function acceptanceServe(target, runId, options = {}, deps = {}) {
  if (!runIdPattern.test(runId ?? "")) throw new AcceptanceError("usage", ["acceptance-serve <runId> [--https]"]);
  const manifest = readManifest(runId, deps);
  const refHash = refHashOf(target.projectId);
  if (manifest.refHash !== refHash) throw new AcceptanceError("acceptance-serve-ref-mismatch", ["manifest refHash"]);
  if (await (deps.portInUse ?? portInUse)(3000)) throw new AcceptanceError("port-busy", ["port 3000"]);

  const fs = fsOf(deps);
  const dir = workDirOf(runId, deps);
  const secretFile = path.join(dir, "device-secret");
  fs.mkdirSync(dir, { recursive: true });
  let deviceSecret;
  if (fs.existsSync(secretFile)) {
    deviceSecret = fs.readFileSync(secretFile, "utf8").trim();
    if (!/^[a-f0-9]{64,}$/u.test(deviceSecret)) throw new AcceptanceError("device-secret-invalid", ["device-secret"]);
  } else {
    deviceSecret = randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, deviceSecret, { mode: 0o600, flag: "wx" });
  }

  const productionRefs = (deps.env ?? process.env).PORTIA_E2E_PRODUCTION_PROJECT_IDS.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const childEnv = {
    ...(deps.env ?? process.env),
    NEXT_PUBLIC_SUPABASE_URL: target.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: target.publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: target.publishableKey,
    PORTIA_PROMOTION_STAGING_ROSTER: manifest.rosterPath,
    PORTIA_PROMOTION_DEVICE_SECRET: deviceSecret,
    PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY: "",
    PORTIA_STAGING_DB_URL: "",
    CONTEXT: "",
  };
  const args = [path.join(deps.root ?? REPO_ROOT, "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", "0.0.0.0", "--port", "3000"];
  if (options.https) args.push("--experimental-https");
  const secrets = [
    ["admin-key", target.adminKey], ["publishable-key", target.publishableKey], ["db-url", target.dbUrl],
    ["db-password", target.dbPassword], ["device-secret", deviceSecret], ["ref", target.projectId],
    ["host", `${target.projectId}.supabase.co`], ...productionRefs.map((item) => ["production-ref", item]),
  ];
  let child;
  try {
    child = (deps.spawn ?? spawnProcess)(process.execPath, args, { cwd: deps.root ?? REPO_ROOT, env: childEnv, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new AcceptanceError("server-not-ready", ["next dev"]);
  }
  relay(child.stdout, errOf(deps), secrets);
  relay(child.stderr, errOf(deps), secrets);
  const waitForChild = (deps.waitForChild ?? childExit)(child);
  const base = `${options.https ? "https" : "http"}://127.0.0.1:3000`;
  const fetchLocal = deps.fetchLocal ?? (options.https ? httpsLocal : fetch);
  const get = (suffix) => fetchLocal(`${base}${suffix}`);
  try {
    let ready = false;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      try { ready = (await get("/")).status === 200; } catch { ready = false; }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new AcceptanceError("server-not-ready", ["GET /"]);
    const probe = manifest.nicknames.probe ?? manifest.nicknames["p-cooldown"];
    if (!probe) throw new AcceptanceError("server-not-staging", ["probe nickname"]);
    const status = await get(`/api/promotion/status?nickname=${encodeURIComponent(probe)}`);
    const body = status.status === 200 ? await status.json().catch(() => null) : null;
    const absent = await get(`/api/promotion/status?nickname=${encodeURIComponent(`${runPrefix(runId)}_absent`)}`);
    if (status.status !== 200 || body?.nickname !== probe || absent.status !== 404) throw new AcceptanceError("server-not-staging", ["promotion status"]);
    const ownerPage = await get("/owner-login");
    if (ownerPage.status !== 200) throw new AcceptanceError("client-binding-unproven", ["owner-login"]);
    const html = await ownerPage.text();
    const scriptUrls = [...html.matchAll(/<script\b[^>]*\bsrc=["'](\/_next\/[^"']+)["']/giu)].map((match) => match[1]);
    const scripts = await Promise.all(scriptUrls.map(async (url) => {
      const response = await get(url);
      if (response.status !== 200) throw new AcceptanceError("client-binding-unproven", ["owner-login scripts"]);
      return response.text();
    }));
    const content = [html, ...scripts].join("\n").toLowerCase();
    if (productionRefs.some((item) => content.includes(item))) throw new AcceptanceError("production-ref-in-bundle", ["owner-login scripts"]);
    if (!content.includes(`${target.projectId}.supabase.co`)) throw new AcceptanceError("client-binding-unproven", ["owner-login scripts"]);
    const interfaces = (deps.networkInterfaces ?? os.networkInterfaces)();
    const lan = Object.values(interfaces).flat().filter((entry) => entry && entry.family === "IPv4" && !entry.internal).map((entry) => entry.address);
    const protocol = options.https ? "https" : "http";
    const urls = [`${protocol}://localhost:3000`, ...new Set(lan).values()].map((item) => item.includes("://") ? item : `${protocol}://${item}:3000`);
    outOf(deps)(`${JSON.stringify({ status: "STAGING-BOUND", refHash, serverBound: true, clientBound: true, urls })}\n`);
    return await waitForChild;
  } catch (error) {
    child.kill();
    if (error instanceof AcceptanceError) throw error;
    throw new AcceptanceError("server-not-ready", ["binding probe"]);
  }
}

const writeManifest = (manifest, deps) => {
  const fs = fsOf(deps);
  fs.mkdirSync(path.dirname(manifestFileOf(deps)), { recursive: true });
  fs.writeFileSync(manifestFileOf(deps), `${JSON.stringify(manifest, null, 2)}\n`);
};

// Enough active questions of every type for the quotas; answer keys follow the bank command in the baseline
// (single: option index, multiple: array of indexes, free-text: reference text).
function seedQuestions(bankId) {
  const options = ["Вариант A", "Вариант B", "Вариант C", "Вариант D"];
  const specs = [
    ...[1, 2, 3].map((n) => ["single", n, 0, options]),
    ...[1, 2].map((n) => ["multiple", n, [0, 2], options]),
    ...[1, 2].map((n) => ["free-text", n, "эталонный ответ", []]),
  ];
  return specs.map(([type, n, answerKey, texts], index) => ({
    row: { bank_id: bankId, question_type: type, question_text: `Приёмка: вопрос ${type} ${n}`, answer_key: answerKey, active: true, sort_order: index },
    options: texts.map((text, sortOrder) => ({
      option_text: text,
      is_correct: type === "single" ? sortOrder === answerKey : answerKey.includes(sortOrder),
      sort_order: sortOrder,
    })),
  }));
}

async function seedBanks(admin, ordinaryTargets, transitions, bankIds) {
  for (const target of ordinaryTargets) {
    const [bankId] = await insertRows(admin, TASK_BANKS, [{ target_title_id: target, required_count: 3 }]);
    bankIds.ordinary.push(bankId);
    await insertRows(admin, "portia_promo_task_items", [0, 1, 2, 3, 4].map((i) => ({
      bank_id: bankId, task_text: `Приёмка: задание ${i + 1}`, active: true, sort_order: i,
    })));
  }
  for (const transition of transitions) {
    const [bankId] = await insertRows(admin, QUALIFICATION_BANKS, [
      { transition_id: transition, single_count: 2, multiple_count: 1, free_text_count: 1 },
    ]);
    bankIds.qualification.push(bankId);
    const questions = seedQuestions(bankId);
    const ids = await insertRows(admin, "portia_promo_qualification_questions", questions.map((question) => question.row));
    const optionRows = questions.flatMap((question, index) => question.options.map((option) => ({ question_id: ids[index], ...option })));
    if (optionRows.length > 0) await insertRows(admin, "portia_promo_qualification_options", optionRows);
  }
}

async function dbNowOf(target, deps) {
  let date;
  try {
    if (deps.dbNow) date = await deps.dbNow();
    else {
      const response = await (deps.fetch ?? fetch)(`${target.url}/auth/v1/settings`, { headers: { apikey: target.publishableKey }, redirect: "error" });
      if (response.ok) date = response.headers.get("date");
    }
  } catch {
    // A network failure is the same fail-closed result as a missing Date header.
  }
  const millis = typeof date === "string" ? Date.parse(date) : NaN;
  if (!Number.isFinite(millis)) throw new AcceptanceError("acceptance-db-time-unavailable", ["isolated project Date"]);
  return new Date(millis).toISOString();
}

export async function acceptanceSeed(target, deps = {}) {
  const fs = fsOf(deps);
  const live = liveOf(target);
  const run = (deps.createRun ?? createRun)(live, harnessDeps(deps));
  const admin = run.admin;
  const qualificationSources = new Set(qualificationPromotionTransitions.map((transition) => transition.sourceTitleId));
  const ordinaryTargets = [...new Set(PARTICIPANTS.filter((p) => !qualificationSources.has(p.titleId)).map((p) => nextTitleOf(p.titleId).id))];
  const transitions = qualificationPromotionTransitions.map((transition) => transition.transitionId);

  // Date is taken from the isolated project's HTTP response before any write, so window comparisons use server time.
  const createdAt = await dbNowOf(target, deps);
  const preexisting = {
    bucketKeys: await snapshotColumn(admin, BUCKETS, "bucket_key"),
    taskBankIds: await snapshotColumn(admin, TASK_BANKS, "id"),
    qualificationBankIds: await snapshotColumn(admin, QUALIFICATION_BANKS, "id"),
  };

  // Refuse before creating anything: an existing bank belongs to someone else and must not be touched or replaced.
  for (const [table, column, values] of [[TASK_BANKS, "target_title_id", ordinaryTargets], [QUALIFICATION_BANKS, "transition_id", transitions]]) {
    const found = await selectColumn(admin.from(table).select(column).in(column, values), `select ${table}`, column);
    if (found.length > 0) throw new AcceptanceError("acceptance-preexisting-bank", [table]);
  }

  const bankIds = { ordinary: [], qualification: [] };
  const dir = workDirOf(run.runId, deps);
  try {
    await run.createIdentity("reviewer", { grantedTabs: ["promo"] });
    await run.createIdentity("editor", { grantedTabs: [] });
    await seedBanks(admin, ordinaryTargets, transitions, bankIds);

    const nicknames = Object.fromEntries(PARTICIPANTS.map((p) => [p.label, nickOf(run.runId, p.label)]));
    const rosterFile = path.join(dir, "roster.json");
    const credentialsFile = path.join(dir, "credentials.json");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(rosterFile, JSON.stringify({
      access: PARTICIPANTS.map((p) => [nicknames[p.label]]),
      promotion: [SHEET_HEADERS, ...PARTICIPANTS.map((p) => [
        nicknames[p.label], titleOf(p.titleId).label, nextTitleOf(p.titleId)?.label ?? "", "нет", isoDate(nowOf(deps) + ((titleOf(p.titleId).cooldownDays ?? 0) - p.daysAgo) * DAY),
      ])],
    }));
    // Passwords live only here, outside the repository.
    fs.writeFileSync(credentialsFile, JSON.stringify({ reviewer: run.credentials("reviewer"), editor: run.credentials("editor") }), { mode: 0o600 });

    writeManifest({
      schema: MANIFEST_SCHEMA, runId: run.runId, refHash: run.refHash, createdAt, createdAtSource: "db", preexisting, nicknames, bankIds,
      shiftedBucketKeys: [], rosterPath: rosterFile, credentialsPath: credentialsFile,
    }, deps);
    outOf(deps)(`${JSON.stringify({ runId: run.runId, nicknames, rosterPath: rosterFile, credentialsPath: credentialsFile })}\n`);
    return 0;
  } catch (error) {
    // A half-made run must not stay behind: remove what this call created, then report the original failure.
    for (const [table, ids] of [[TASK_BANKS, bankIds.ordinary], [QUALIFICATION_BANKS, bankIds.qualification]]) {
      if (ids.length > 0) await admin.from(table).delete().in("id", ids).then(() => {}, () => {});
    }
    await run.cleanup().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

function editRoster(manifest, runId, deps, label, change) {
  const fs = fsOf(deps);
  const file = path.join(workDirOf(runId, deps), "roster.json");
  const roster = JSON.parse(fs.readFileSync(file, "utf8"));
  const row = roster.promotion.find((item) => item[0] === manifest.nicknames[label]);
  if (!row) throw new AcceptanceError("acceptance-unknown-participant", ["participant label"]);
  change(row);
  fs.writeFileSync(file, JSON.stringify(roster));
}

// Requests of this run (optionally one participant) -> attempt ids. Prefix match only, never the whole table.
async function attemptIdsOf(admin, runId, manifest, label) {
  let query = admin.from(QUALIFICATION_REQUESTS).select("id");
  query = label ? query.eq("nickname_key", manifest.nicknames[label]) : query.like("nickname_key", likePrefix(runPrefix(runId)));
  const requestIds = await selectColumn(query, `select ${QUALIFICATION_REQUESTS}`, "id");
  if (requestIds.length === 0) return [];
  return selectColumn(admin.from(ATTEMPTS).select("id").in("request_id", requestIds), `select ${ATTEMPTS}`, "id");
}

export async function acceptanceShift(target, runId, kind, args = [], deps = {}) {
  const [label, value] = args;
  const titleArg = kind === "rank" ? promotionTitles.find((title) => title.id === value) : null;
  const argsOk = kind === "rank" ? labelPattern.test(label ?? "") && titleArg
    : kind === "cooldown" ? labelPattern.test(label ?? "") && value === undefined
      : kind === "penalty" || kind === "cleanup" ? args.length === 0
        : (label === undefined || labelPattern.test(label)) && value === undefined;
  if (!runIdPattern.test(runId ?? "") || !SHIFT_KINDS.includes(kind) || !argsOk) {
    errOf(deps)("[PORTIA_STAGING:usage] acceptance-shift <runId> cooldown <label> | rank <label> <titleId> | penalty | cleanup | deadline [label] | retake [label]\n");
    return 2;
  }
  const manifest = readManifest(runId, deps);
  if (label && !(label in manifest.nicknames)) {
    errOf(deps)("[PORTIA_STAGING:usage] Unknown participant label for this run.\n");
    return 2;
  }
  const past = new Date(nowOf(deps) - 60_000).toISOString();
  let updated = 0;
  if (kind === "cooldown") {
    editRoster(manifest, runId, deps, label, (row) => {
      // column E is the availability date, so ending the wait moves it to yesterday; the rule itself is untouched
      row[4] = isoDate(nowOf(deps) - DAY);
    });
    updated = 1;
  } else if (kind === "rank") {
    editRoster(manifest, runId, deps, label, (row) => {
      row[1] = titleArg.label;
      row[2] = promotionTitles.at(titleArg.level)?.label ?? "";
    });
    updated = 1;
  } else {
    const admin = adminOf(target, deps);
    if (kind === "penalty") {
      const keys = await selectColumn(admin.from(BUCKETS).select("bucket_key").gte("updated_at", manifest.createdAt).not("blocked_until", "is", null), `select ${BUCKETS}`, "bucket_key");
      const allowed = keys.filter((key) => manifest.legacy || !manifest.preexisting.bucketKeys.includes(key));
      if (allowed.length > 0) {
        const { data, error } = await admin.from(BUCKETS).update({ blocked_until: past }).in("bucket_key", allowed).select("bucket_key");
        check(error, `update ${BUCKETS}`);
        updated = data?.length ?? 0;
      }
    } else if (kind === "cleanup") {
      // portia_promo_cleanup prunes buckets older than 3 days: age the window's buckets past that and remember their keys.
      const aged = new Date(nowOf(deps) - 4 * DAY).toISOString();
      const keys = await selectColumn(admin.from(BUCKETS).select("bucket_key").gte("updated_at", manifest.createdAt), `select ${BUCKETS}`, "bucket_key");
      const allowed = keys.filter((key) => manifest.legacy || !manifest.preexisting.bucketKeys.includes(key));
      if (allowed.length > 0) {
        const { data, error } = await admin.from(BUCKETS).update({ updated_at: aged }).in("bucket_key", allowed).select("bucket_key");
        check(error, `update ${BUCKETS}`);
        const shifted = (data ?? []).map((row) => row.bucket_key);
        writeManifest({ ...manifest, shiftedBucketKeys: [...new Set([...manifest.shiftedBucketKeys, ...shifted])] }, deps);
        updated = shifted.length;
      }
    } else {
      const column = kind === "deadline" ? "deadline_at" : "retake_at";
      const attemptIds = await attemptIdsOf(admin, runId, manifest, label);
      if (attemptIds.length > 0) {
        const { data, error } = await admin.from(ATTEMPTS).update({ [column]: past }).in("id", attemptIds).not(column, "is", null).select("id");
        check(error, `update ${ATTEMPTS}`);
        updated = data?.length ?? 0;
      }
    }
  }
  outOf(deps)(`${JSON.stringify({ shifted: kind, label: label ?? null, updated })}\n`);
  return 0;
}

const union = (...lists) => new Set(lists.flat());

async function bankState(admin, manifest) {
  const result = {};
  for (const [table, ids, snapshot] of [
    [TASK_BANKS, manifest.bankIds.ordinary, manifest.preexisting?.taskBankIds ?? []],
    [QUALIFICATION_BANKS, manifest.bankIds.qualification, manifest.preexisting?.qualificationBankIds ?? []],
  ]) {
    const byId = ids.length > 0 ? await selectColumn(admin.from(table).select("id").in("id", ids), `select ${table}`, "id") : [];
    const byWindow = await selectColumn(admin.from(table).select("id").gte("created_at", manifest.createdAt), `select ${table}`, "id");
    result[table] = new Set([...union(byId, byWindow)].filter((id) => manifest.legacy || !snapshot.includes(id)));
  }
  return result;
}

async function bucketState(admin, manifest) {
  const keys = manifest.shiftedBucketKeys;
  const byWindow = await selectColumn(admin.from(BUCKETS).select("bucket_key").gte("updated_at", manifest.createdAt), `select ${BUCKETS}`, "bucket_key");
  const byShift = keys.length > 0 ? await selectColumn(admin.from(BUCKETS).select("bucket_key").in("bucket_key", keys), `select ${BUCKETS}`, "bucket_key") : [];
  return new Set([...union(byWindow, byShift)].filter((key) => manifest.legacy || !manifest.preexisting.bucketKeys.includes(key)));
}

// Read-only. Extends the harness counters with the banks, buckets and attempts that purgeRun does not count.
async function residualAll(target, runId, manifest, deps) {
  const admin = adminOf(target, deps);
  const base = await residualOf(liveOf(target), runId, harnessDeps(deps));
  const banks = await bankState(admin, manifest);
  const bucketKeys = await bucketState(admin, manifest);
  const attemptIds = await attemptIdsOf(admin, runId, manifest);
  const answers = attemptIds.length > 0
    ? await selectColumn(admin.from("portia_promo_answers").select("id").in("attempt_id", attemptIds), "select portia_promo_answers", "id")
    : [];
  return {
    ...base,
    banks: banks[TASK_BANKS].size + banks[QUALIFICATION_BANKS].size,
    buckets: bucketKeys.size,
    attempts: attemptIds.length,
    answers: answers.length,
  };
}

export async function acceptanceResidual(target, runId, deps = {}) {
  if (!runIdPattern.test(runId ?? "")) {
    errOf(deps)("[PORTIA_STAGING:usage] acceptance-residual <runId>\n");
    return 2;
  }
  const manifest = readManifest(runId, deps);
  outOf(deps)(`${JSON.stringify({ residual: await residualAll(target, runId, manifest, deps), legacyWindow: manifest.legacy })}\n`);
  return 0;
}

export async function acceptanceTeardown(target, runId, deps = {}) {
  if (!runIdPattern.test(runId ?? "")) {
    errOf(deps)("[PORTIA_STAGING:usage] acceptance-teardown <runId>\n");
    return 2;
  }
  const manifest = readManifest(runId, deps);
  const admin = adminOf(target, deps);
  const errors = [];
  const deleted = { run: null, banks: 0, buckets: 0 };
  const banks = await bankState(admin, manifest);
  const buckets = await bucketState(admin, manifest);
  const step = async (label, work) => {
    try {
      await work();
    } catch (error) {
      errors.push(error instanceof AcceptanceError ? error.message : `${label}: failed`);
    }
  };
  const remove = async (label, query) => {
    const { count, error } = await query;
    check(error, label);
    return count ?? 0;
  };

  // Attempt children, promo rows, editors, storage, content and auth users of the run (purgeRun starts with the attempt children).
  await step("run purge", async () => {
    const result = await purgeRun(liveOf(target), runId, harnessDeps(deps));
    deleted.run = result.deleted;
    errors.push(...result.errors);
  });
  // Deleting a bank cascades to its items, questions and options.
  for (const table of [TASK_BANKS, QUALIFICATION_BANKS]) {
    const ids = [...banks[table]];
    if (ids.length > 0) await step(`${table} ids`, async () => { deleted.banks += await remove(`delete ${table}`, admin.from(table).delete({ count: "exact" }).in("id", ids)); });
  }
  if (buckets.size > 0) {
    await step("buckets keys", async () => { deleted.buckets += await remove(`delete ${BUCKETS}`, admin.from(BUCKETS).delete({ count: "exact" }).in("bucket_key", [...buckets])); });
  }

  let residual = null;
  await step("residual", async () => { residual = await residualAll(target, runId, manifest, deps); });
  const clean = residual !== null && Object.values(residual).every((count) => count === 0) && errors.length === 0;
  outOf(deps)(`${JSON.stringify({ residual, deleted, errors, legacyWindow: manifest.legacy })}\n`);
  if (clean) fsOf(deps).rmSync(workDirOf(runId, deps), { recursive: true, force: true });
  return clean ? 0 : 1;
}
