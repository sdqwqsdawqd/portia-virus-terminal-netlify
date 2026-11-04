import { createHash } from "node:crypto";
import * as nodeFs from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { canonicalize, extractFingerprint, inventory } from "./phase16-fingerprint-compare.mjs";
import { acceptanceResidual, acceptanceSeed, acceptanceServe, acceptanceShift, acceptanceTeardown } from "./phase19-acceptance.mjs";
import { matrixResidual, matrixRestore, matrixRun } from "./phase19-matrix-data.mjs";
import { createRun } from "../tests/e2e/fixtures/staging-harness.ts";
import { assertAppBoundToTarget } from "../tests/e2e/fixtures/target-attestation.ts";
import { requireSafeMutationTargetFromEnvironment } from "../tests/e2e/fixtures/target-guard.ts";

// Single guarded path to the isolated Supabase project (Phase 16, D2/D3).
// Values come only from the process environment: this file never reads env files and never prints values.
// Subcommands: attest, self-test-production-block, scan-evidence <dir>, cli-help, push, fingerprint (16-10),
// teardown, upgrade-ladder (16-11), acceptance-seed|shift|residual|teardown (19-03). All build on resolveStagingTarget + runCli.

const ADMIN_KEY_VAR = "PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY";
const PUBLISHABLE_KEY_VAR = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const DB_URL_VAR = "PORTIA_STAGING_DB_URL";
const LIVE_CONFIRM = "ISOLATED_TEST_PROJECT";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHILD_ENV_ALLOW = ["path", "systemroot", "temp", "tmp", "home", "userprofile", "appdata", "localappdata"];

export class StagingError extends Error {
  constructor(code, variableNames = []) {
    super(`[PORTIA_STAGING:${code}] Check: ${variableNames.join(", ") || "wrapper arguments"}.`);
    this.name = "StagingError";
    this.code = code;
  }
}

const present = (value) => typeof value === "string" && value.trim() !== "";
const productionRefs = (env) =>
  (env.PORTIA_E2E_PRODUCTION_PROJECT_IDS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);

function parseDbUrl(raw, ref) {
  const bad = () => new StagingError("db-url-target-mismatch", [DB_URL_VAR, "PORTIA_E2E_TARGET_ID"]);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw bad();
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.port !== "5432" || url.search || url.hash || raw.includes("?") || raw.includes("#") || !["", "/postgres"].includes(url.pathname)) throw bad();
  const host = url.hostname.toLowerCase();
  const user = decodeURIComponent(url.username);
  const direct = host === `db.${ref}.supabase.co` && user === "postgres";
  const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/u.test(host) && user === `postgres.${ref}`;
  if (!direct && !pooler) throw bad();
  const password = decodeURIComponent(url.password);
  return { password, dbUrl: `${url.protocol}//${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/postgres` };
}

// Runs before any spawn/fetch. The guard also fails closed on an empty production list (production-list-missing).
export function resolveStagingTarget(env, deps = {}) {
  const fs = deps.fs ?? nodeFs;
  requireSafeMutationTargetFromEnvironment(env);
  const target = assertAppBoundToTarget(env);
  const missing = [ADMIN_KEY_VAR, PUBLISHABLE_KEY_VAR, DB_URL_VAR].filter((name) => !present(env[name]));
  if (missing.length > 0) throw new StagingError("missing-environment", missing);
  if (env.PORTIA_PROMO_LIVE_CONFIRM !== LIVE_CONFIRM) throw new StagingError("live-confirm", ["PORTIA_PROMO_LIVE_CONFIRM"]);
  const { password, dbUrl } = parseDbUrl(env[DB_URL_VAR], target.projectId);
  // A linked CLI project would let a bare command reach whatever it points at.
  if (fs.existsSync(path.join(deps.root ?? REPO_ROOT, "supabase", ".temp", "project-ref"))) {
    throw new StagingError("linked-project-present", ["supabase/.temp/project-ref"]);
  }
  return Object.freeze({
    projectId: target.projectId,
    url: `https://${target.projectId}.supabase.co`,
    adminKey: env[ADMIN_KEY_VAR],
    publishableKey: env[PUBLISHABLE_KEY_VAR],
    dbUrl,
    dbPassword: password,
  });
}

// Everything that must never reach stdout/stderr/evidence, keyed by a safe label.
function secretTable(env) {
  const table = {
    "admin-key": env[ADMIN_KEY_VAR],
    "publishable-key": env[PUBLISHABLE_KEY_VAR],
    "anon-key": env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "live-anon-key": env.PORTIA_PROMO_LIVE_ANON_KEY,
    "device-secret": env.PORTIA_PROMOTION_DEVICE_SECRET,
    "db-url": env[DB_URL_VAR],
    ref: env.PORTIA_E2E_TARGET_ID,
  };
  try {
    table["db-password"] = decodeURIComponent(new URL(env[DB_URL_VAR]).password);
    table["db-host"] = new URL(env[DB_URL_VAR]).hostname;
  } catch {
    // no parseable DB URL: nothing more to redact
  }
  if (present(env.PORTIA_E2E_TARGET_ID)) table.host = `${env.PORTIA_E2E_TARGET_ID}.supabase.co`;
  return Object.fromEntries(Object.entries(table).filter(([, value]) => present(value)));
}

export function redact(text, secrets) {
  const entries = Object.entries(secrets).filter(([, value]) => typeof value === "string" && value !== "");
  entries.sort((a, b) => b[1].length - a[1].length);
  let out = String(text);
  for (const [name, value] of entries) {
    for (const form of new Set([value, encodeURIComponent(value)])) out = out.split(form).join(`[REDACTED:${name}]`);
  }
  return out;
}

function childEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([name, value]) => CHILD_ENV_ALLOW.includes(name.toLowerCase()) && value !== undefined));
}

const FORBIDDEN_ARGS = new Set(["link", "reset", "--linked", "--project-ref"]);

function cliEntry(deps) {
  const fs = deps.fs ?? nodeFs;
  const packageDir = path.join(deps.root ?? REPO_ROOT, "node_modules", "supabase");
  let bin;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
    bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.supabase;
  } catch {
    bin = undefined;
  }
  if (!bin) throw new StagingError("cli-missing", ["node_modules/supabase"]);
  return path.join(packageDir, bin);
}

// Help text of the repo-pinned CLI: no target, no DB URL, empty child env. Words only, so no flag can slip in.
export function cliHelp(words, deps = {}) {
  if (words.length === 0 || !words.every((word) => /^[a-z][a-z-]*$/u.test(word))) throw new StagingError("forbidden-argument", ["wrapper arguments"]);
  const result = (deps.spawn ?? spawnSync)(process.execPath, [cliEntry(deps), ...words, "--help"], {
    shell: false, encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024, env: childEnv(deps.env ?? process.env),
  });
  (deps.out ?? ((text) => process.stdout.write(text)))(result.stdout ?? "");
  (deps.err ?? ((text) => process.stderr.write(text)))(result.stderr ?? "");
  return typeof result.status === "number" ? result.status : 1;
}

// Common core for 16-10/16-11: runs the repo-pinned supabase CLI against the attested DB URL only.
export function runCli(args, target, deps = {}) {
  for (const arg of args) {
    const bare = arg.split("=")[0];
    if (
      FORBIDDEN_ARGS.has(arg) ||
      bare === "--linked" ||
      bare === "--db-url" ||
      arg === "--remote" ||
      (bare === "--remote" && arg.slice("--remote=".length) !== target.dbUrl)
    ) {
      throw new StagingError("forbidden-argument", ["wrapper arguments"]);
    }
  }
  const entry = cliEntry(deps);
  // Node cannot run .cmd shims without a shell, and a shell would open argument injection: run the JS entry directly.
  const result = (deps.spawn ?? spawnSync)(
    process.execPath,
    [entry, ...args, "--db-url", target.dbUrl],
    { shell: false, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, env: childEnv(deps.env ?? process.env) },
  );
  const secrets = { "admin-key": target.adminKey, "publishable-key": target.publishableKey, "db-url": target.dbUrl, "db-password": target.dbPassword, ref: target.projectId, host: `${target.projectId}.supabase.co` };
  (deps.out ?? ((text) => process.stdout.write(text)))(redact(result.stdout ?? "", secrets));
  (deps.err ?? ((text) => process.stderr.write(text)))(redact(result.stderr ?? "", secrets));
  return typeof result.status === "number" ? result.status : 1;
}

const EVIDENCE_DIR = path.join(REPO_ROOT, ".planning", "phases", "PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina", "evidence");
const FINGERPRINT_SQL = path.join(REPO_ROOT, "supabase", "fingerprint", "portia_schema_fingerprint.sql");

// D1: the isolated project is built only from supabase/migrations through `db push`, then the journal is listed.
export function push(env, deps = {}) {
  const target = resolveStagingTarget(env, deps);
  // Non-interactive confirmation flag confirmed via `cli-help db push`: global --yes.
  const code = runCli(["db", "push", "--yes"], target, deps);
  return code === 0 ? runCli(["migration", "list"], target, deps) : code;
}

// Runs the read-only fingerprint file, canonicalizes the one-cell result and writes evidence/fingerprint-<label>.json.
// The CLI has no read-only switch for `db query`: read-only is proven statically (lib/phase16-fingerprint.test.ts).
export function fingerprint(label, env, deps = {}) {
  if (!/^[a-z0-9-]+$/u.test(label ?? "")) throw new StagingError("bad-label", ["fingerprint label"]);
  const target = resolveStagingTarget(env, deps);
  const fs = deps.fs ?? nodeFs;
  let captured = "";
  const code = runCli(["db", "query", "-f", deps.sqlFile ?? FINGERPRINT_SQL, "-o", "json"], target, { ...deps, out: (text) => { captured += text; } });
  if (code !== 0) return code;
  let result;
  try {
    result = canonicalize(extractFingerprint(captured));
  } catch {
    throw new StagingError("fingerprint-unparseable", ["db query output"]);
  }
  const dir = deps.evidenceDir ?? EVIDENCE_DIR;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `fingerprint-${label}.json`), `${JSON.stringify(result, null, 2)}\n`);
  (deps.out ?? ((text) => process.stdout.write(text)))(`${JSON.stringify({ label, pg_major: result.pg_major, inventory: inventory(result) })}\n`);
  return 0;
}

const MEDIA_BUCKET = "portia-media";
const TEARDOWN_SQL = path.join(REPO_ROOT, "supabase", "teardown", "portia_teardown.sql");
const L0_SQL = path.join(REPO_ROOT, "supabase", "upgrade-fixtures", "L0_pre_phase12_portia_setup.sql");
const PHASE12_SQL = path.join(REPO_ROOT, "supabase", "phase12_apply.sql");
const PHASE14_SQL = path.join(REPO_ROOT, "supabase", "phase14_apply.sql");

const adminClient = (target, deps) =>
  (deps.createClient ?? createClient)(target.url, target.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Scratch files live outside the repo and are always removed.
async function withScratch(deps, work) {
  const fs = deps.fs ?? nodeFs;
  const dir = fs.mkdtempSync(path.join(deps.tmpdir ?? os.tmpdir(), "portia-staging-"));
  try {
    return await work(dir, (name, text) => {
      const file = path.join(dir, name);
      fs.writeFileSync(file, text);
      return file;
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Same block rule as step() in lib/portia-sql.test.ts: from `-- STEP <id>` up to the next `-- STEP ` line (`2` never matches `2b`).
export function extractStep(text, id) {
  const lines = text.split(/\r?\n/u);
  const start = lines.findIndex((line) => new RegExp(`^-- STEP ${id}\\b`, "u").test(line));
  if (start < 0) throw new StagingError("step-missing", [`STEP ${id}`]);
  const next = lines.slice(start + 1).findIndex((line) => line.startsWith("-- STEP "));
  return lines.slice(start, next < 0 ? undefined : start + 1 + next).join("\n");
}

// `db query` sends one prepared statement ("cannot insert multiple commands"), and DO cannot run begin/commit.
// So a multi-statement script becomes one DO block that EXECUTEs it (one transaction; top-level begin;/commit; lines dropped).
// shortcut: assumes no top-level begin;/commit; line sits inside a function body and the file lacks the $portia_* tags; the unit test checks the real files.
export function asSingleStatement(sql, preamble = "") {
  if (/\$portia_(?:do|sql)\$/u.test(sql)) throw new StagingError("sql-tag-collision", ["sql file"]);
  const body = sql.replace(/^(?:begin|commit);[ \t]*$/gimu, "");
  return `do $portia_do$ begin execute $portia_sql$\n${preamble}${body}\n$portia_sql$; end $portia_do$;\n`;
}

// Runs one SQL text through the attested --db-url as a single statement. Not read-only: only teardown/ladder call it, with files from this repo.
function runSql(name, sql, target, deps, preamble) {
  return withScratch(deps, (_dir, write) => runCli(["db", "query", "-f", write(`${name}.sql`, asSingleStatement(sql, preamble))], target, deps));
}

const notFound = (error) => error && (String(error.status ?? error.statusCode) === "404" || /not.?found/iu.test(String(error.message)));

// Teardown: the bucket goes through the Storage API (SQL cannot delete it), then PORTIA objects through the guarded SQL file.
// The SQL file refuses to run unless this session sets portia.teardown_ok, which only this wrapper does.
export async function teardown(env, deps = {}) {
  const target = resolveStagingTarget(env, deps);
  const fs = deps.fs ?? nodeFs;
  const { storage } = adminClient(target, deps);
  for (const [label, call] of [["empty", () => storage.emptyBucket(MEDIA_BUCKET)], ["delete", () => storage.deleteBucket(MEDIA_BUCKET)]]) {
    const { error } = await call();
    if (error && !notFound(error)) throw new StagingError(`bucket-${label}-failed`, ["Storage API"]);
  }
  const sql = fs.readFileSync(deps.teardownSql ?? TEARDOWN_SQL, "utf8");
  return runSql("teardown", sql, target, deps, "select set_config('portia.teardown_ok', 'yes', false);\n");
}

// D4 ladder on one database: owner fixture -> L0 -> phase12 STEP 2 -> STEP 2b -> phase14 -> U0 -> push -> U.
// Reports the failing stage by name; the owner fixture is removed in every case.
export async function upgradeLadder(env, deps = {}) {
  const target = resolveStagingTarget(env, deps);
  const fs = deps.fs ?? nodeFs;
  const live = {
    target: { projectId: target.projectId },
    url: target.url,
    publishableKey: target.publishableKey,
    adminKey: target.adminKey,
    refHash: createHash("sha256").update(target.projectId).digest("hex").slice(0, 12),
  };
  const run = (deps.createRun ?? createRun)(live, deps.harness);
  const read = (file) => fs.readFileSync(file, "utf8");
  const phase12 = () => read(deps.phase12Sql ?? PHASE12_SQL);
  const stages = [
    ["L0", () => runSql("L0", read(deps.l0Sql ?? L0_SQL), target, deps)],
    ["phase12-step-2", () => runSql("step2", extractStep(phase12(), "2"), target, deps)],
    ["phase12-step-2b", () => runSql("step2b", extractStep(phase12(), "2b"), target, deps)],
    ["phase14", () => runSql("phase14", read(deps.phase14Sql ?? PHASE14_SQL), target, deps)],
    ["fingerprint-upgrade-legacy", () => fingerprint("upgrade-legacy", env, deps)],
    ["push", () => push(env, deps)],
    ["fingerprint-upgrade", () => fingerprint("upgrade", env, deps)],
  ];
  let failed;
  try {
    failed = "owner-fixture";
    await run.createOwnerFixture();
    for (const [name, work] of stages) {
      failed = name;
      const code = await work();
      if (code !== 0) throw new StagingError(`ladder-${name}-exit-${code}`, ["wrapper arguments"]);
    }
    failed = undefined;
  } catch (error) {
    throw error instanceof StagingError ? error : new StagingError(`ladder-${failed}-failed`, ["wrapper arguments"]);
  } finally {
    let leftover = -1;
    try {
      await run.cleanup();
    } catch {
      // purge attempts every step; the residual check below decides
    }
    try {
      leftover = (await run.residual()).authUsers;
    } catch {
      // table missing because the ladder stopped early: leftover stays -1 and is reported
    }
    (deps.out ?? ((text) => process.stdout.write(text)))(`${JSON.stringify({ ladder: failed ? `FAIL:${failed}` : "done", ownerFixtureResidual: leftover })}\n`);
    if (leftover !== 0 && !failed) throw new StagingError("owner-fixture-residual", ["auth users"]);
  }
  return 0;
}

export async function attest(env, deps = {}) {
  const target = resolveStagingTarget(env, deps);
  const doFetch = deps.fetch ?? fetch;
  const call = async (label, endpoint, headers) => {
    let response;
    try {
      response = await doFetch(`${target.url}${endpoint}`, { headers, redirect: "error" });
    } catch {
      throw new StagingError(`unreachable-${label}`, ["is the Free project paused?"]);
    }
    if (!response.ok) throw new StagingError(`rejected-${label}-${response.status}`, [label === "admin" ? ADMIN_KEY_VAR : PUBLISHABLE_KEY_VAR]);
  };
  await call("publishable", "/auth/v1/settings", { apikey: target.publishableKey });
  await call("admin", "/auth/v1/admin/users?page=1&per_page=1", {
    apikey: target.adminKey,
    authorization: `Bearer ${target.adminKey}`,
  });
  return { status: "ATTESTED", refHash: createHash("sha256").update(target.projectId).digest("hex").slice(0, 12) };
}

const productionBlockCodes = new Set(["production-project", "list-overlap"]);

// Substitutes every listed production ref as the target and proves resolveStagingTarget refuses it before spawn/fetch.
export function selfTestProductionBlock(env, deps = {}) {
  const refs = productionRefs(env);
  let blocked = 0;
  for (const ref of refs) {
    const clone = {
      ...env,
      PORTIA_E2E_TARGET_ID: ref,
      PORTIA_E2E_SUPABASE_URL: `https://${ref}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
      PORTIA_PROMO_LIVE_URL: `https://${ref}.supabase.co`,
      [DB_URL_VAR]: `postgresql://postgres:placeholder@db.${ref}.supabase.co:5432/postgres`,
    };
    try {
      resolveStagingTarget(clone, deps);
    } catch (error) {
      if (productionBlockCodes.has(error?.code)) blocked += 1;
    }
  }
  return { checked: refs.length, blocked };
}

const PATTERNS = [
  ["jwt", /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./u],
  ["sb_secret", /sb_secret_/u],
  ["sb_publishable", /sb_publishable_/u],
  ["postgres-url", /postgres(?:ql)?:\/\//u],
];

function* walk(fs, dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fs, full);
    else if (entry.isFile()) yield full;
  }
}

// Reports file + matched class only, never the matched text.
export function scanEvidence(dir, env, deps = {}) {
  const fs = deps.fs ?? nodeFs;
  const secrets = Object.entries(secretTable(env));
  const findings = [];
  for (const file of walk(fs, dir)) {
    const text = fs.readFileSync(file, "utf8");
    const classes = [
      ...secrets.filter(([, value]) => text.includes(value)).map(([name]) => `value:${name}`),
      ...PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => `pattern:${name}`),
    ];
    for (const kind of classes) findings.push({ file: path.relative(dir, file), kind });
  }
  return findings;
}

export async function main(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const out = deps.out ?? ((text) => process.stdout.write(text));
  const err = deps.err ?? ((text) => process.stderr.write(text));
  const secrets = secretTable(env);
  const [command, ...rest] = argv;
  try {
    if (command === "cli-help") return cliHelp(rest, deps);
    if (command === "push" && rest.length === 0) return push(env, deps);
    if (command === "fingerprint" && rest.length === 1) return fingerprint(rest[0], env, deps);
    if (command === "teardown" && rest.length === 0) return await teardown(env, deps);
    if (command === "upgrade-ladder" && rest.length === 0) return await upgradeLadder(env, deps);
    // Phase 19 acceptance data: the target is resolved (every guard runs) before any client exists; stdout and stderr are redacted too.
    const acceptance = {
      "acceptance-seed": [(t, d) => acceptanceSeed(t, d), rest.length === 0],
      "acceptance-shift": [(t, d) => acceptanceShift(t, rest[0], rest[1], rest.slice(2), d), rest.length >= 2 && rest.length <= 4],
      "acceptance-residual": [(t, d) => acceptanceResidual(t, rest[0], d), rest.length === 1],
      "acceptance-teardown": [(t, d) => acceptanceTeardown(t, rest[0], d), rest.length === 1],
      "acceptance-serve": [(t, d) => acceptanceServe(t, rest[0], { https: rest[1] === "--https" }, d), rest.length === 1 || (rest.length === 2 && rest[1] === "--https")],
    }[command];
    if (acceptance?.[1]) {
      const target = resolveStagingTarget(env, deps);
      return await acceptance[0](target, { ...deps, out: (text) => out(redact(text, secrets)), err: (text) => err(redact(text, secrets)) });
    }
    const matrix = {
      "matrix-run": [(t, d) => matrixRun(t, rest[0], { stagingEmployees: rest[1] === "--staging-employees" }, d),
        (rest.length === 1 || (rest.length === 2 && rest[1] === "--staging-employees")) && ["empty", "populated"].includes(rest[0])],
      "matrix-restore": [(t, d) => matrixRestore(t, d), rest.length === 0],
      "matrix-residual": [(t, d) => matrixResidual(t, d), rest.length === 0],
    }[command];
    if (matrix?.[1]) {
      const target = resolveStagingTarget(env, deps);
      return await matrix[0](target, { ...deps, out: (text) => out(redact(text, secrets)), err: (text) => err(redact(text, secrets)) });
    }
    if (command === "attest") {
      out(`${JSON.stringify(await attest(env, deps))}\n`);
      return 0;
    }
    if (command === "self-test-production-block") {
      const result = selfTestProductionBlock(env, deps);
      out(`${JSON.stringify(result)}\n`);
      return result.checked > 0 && result.checked === result.blocked ? 0 : 1;
    }
    if (command === "scan-evidence" && rest.length === 1) {
      const findings = scanEvidence(rest[0], env, deps);
      for (const { file, kind } of findings) out(`${redact(file, secrets)}: ${kind}\n`);
      out(`${JSON.stringify({ files_with_findings: new Set(findings.map((f) => f.file)).size, findings: findings.length })}\n`);
      return findings.length === 0 ? 0 : 1;
    }
  } catch (error) {
    // StagingError/MutationTargetBlockedError messages name variables, never values; redact is a second layer.
    err(`${redact(error instanceof Error ? error.message : "[PORTIA_STAGING:internal]", secrets)}\n`);
    return 1;
  }
  err("[PORTIA_STAGING:usage] Subcommands: attest | self-test-production-block | scan-evidence <dir> | cli-help <words...> | push | fingerprint <label> | teardown | upgrade-ladder | acceptance-seed | acceptance-shift <runId> <kind> [label] [value] | acceptance-residual <runId> | acceptance-teardown <runId> | acceptance-serve <runId> [--https] | matrix-run <empty|populated> [--staging-employees] | matrix-restore | matrix-residual\n");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
