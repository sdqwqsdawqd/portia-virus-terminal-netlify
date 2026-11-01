import { createHash } from "node:crypto";
import * as nodeFs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertAppBoundToTarget } from "../tests/e2e/fixtures/target-attestation.ts";
import { requireSafeMutationTargetFromEnvironment } from "../tests/e2e/fixtures/target-guard.ts";

// Single guarded path to the isolated Supabase project (Phase 16, D2/D3).
// Values come only from the process environment: this file never reads env files and never prints values.
// Subcommands: attest, self-test-production-block, scan-evidence <dir>. push/fingerprint (16-10) and
// teardown/upgrade-ladder (16-11) build on resolveStagingTarget + runCli.

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
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.port !== "5432") throw bad();
  const host = url.hostname.toLowerCase();
  const user = decodeURIComponent(url.username);
  const direct = host === `db.${ref}.supabase.co` && user === "postgres";
  const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/u.test(host) && user === `postgres.${ref}`;
  if (!direct && !pooler) throw bad();
  return { password: decodeURIComponent(url.password) };
}

// Runs before any spawn/fetch. The guard also fails closed on an empty production list (production-list-missing).
export function resolveStagingTarget(env, deps = {}) {
  const fs = deps.fs ?? nodeFs;
  requireSafeMutationTargetFromEnvironment(env);
  const target = assertAppBoundToTarget(env);
  const missing = [ADMIN_KEY_VAR, PUBLISHABLE_KEY_VAR, DB_URL_VAR].filter((name) => !present(env[name]));
  if (missing.length > 0) throw new StagingError("missing-environment", missing);
  if (env.PORTIA_PROMO_LIVE_CONFIRM !== LIVE_CONFIRM) throw new StagingError("live-confirm", ["PORTIA_PROMO_LIVE_CONFIRM"]);
  const { password } = parseDbUrl(env[DB_URL_VAR], target.projectId);
  // A linked CLI project would let a bare command reach whatever it points at.
  if (fs.existsSync(path.join(deps.root ?? REPO_ROOT, "supabase", ".temp", "project-ref"))) {
    throw new StagingError("linked-project-present", ["supabase/.temp/project-ref"]);
  }
  return Object.freeze({
    projectId: target.projectId,
    url: `https://${target.projectId}.supabase.co`,
    adminKey: env[ADMIN_KEY_VAR],
    publishableKey: env[PUBLISHABLE_KEY_VAR],
    dbUrl: env[DB_URL_VAR],
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

// Common core for 16-10/16-11: runs the repo-pinned supabase CLI against the attested DB URL only.
export function runCli(args, target, deps = {}) {
  const fs = deps.fs ?? nodeFs;
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
  const root = deps.root ?? REPO_ROOT;
  const packageDir = path.join(root, "node_modules", "supabase");
  let bin;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
    bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.supabase;
  } catch {
    bin = undefined;
  }
  if (!bin) throw new StagingError("cli-missing", ["node_modules/supabase"]);
  // Node cannot run .cmd shims without a shell, and a shell would open argument injection: run the JS entry directly.
  const result = (deps.spawn ?? spawnSync)(
    process.execPath,
    [path.join(packageDir, bin), ...args, "--db-url", target.dbUrl],
    { shell: false, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, env: childEnv(deps.env ?? process.env) },
  );
  const secrets = { "admin-key": target.adminKey, "publishable-key": target.publishableKey, "db-url": target.dbUrl, "db-password": target.dbPassword, ref: target.projectId, host: `${target.projectId}.supabase.co` };
  (deps.out ?? ((text) => process.stdout.write(text)))(redact(result.stdout ?? "", secrets));
  (deps.err ?? ((text) => process.stderr.write(text)))(redact(result.stderr ?? "", secrets));
  return typeof result.status === "number" ? result.status : 1;
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
  err("[PORTIA_STAGING:usage] Subcommands: attest | self-test-production-block | scan-evidence <dir>\n");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
