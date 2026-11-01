// Phase 16 / 16-07: boundary of the owner-narrowed .claude/hooks/guard.mjs.
// Calls the real check() and the real hook process. Synthetic refs only; real production refs
// (if present in the test env) are used as targets but never printed (assert messages carry an index).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { check } from "../.claude/hooks/guard.mjs";

const ISO = "aaaaaaaaaaaaaaaaaaaa";
const PROD = "bbbbbbbbbbbbbbbbbbbb";
type Env = Record<string, string>;
const keyed: Env = {
  PORTIA_STAGING_DB_URL: "synthetic",
  PORTIA_E2E_PRODUCTION_PROJECT_IDS: PROD,
  PORTIA_E2E_ISOLATED_PROJECT_IDS: ISO,
  PORTIA_E2E_TARGET_ID: ISO,
};

const run = (command: string, env: Env = keyed, tool = "Bash") =>
  check({ tool_name: tool, tool_input: { command } }, env as NodeJS.ProcessEnv);
const blocked = (command: string, env?: Env, tool?: string) =>
  assert.ok(run(command, env, tool), `expected block (${tool ?? "Bash"}): ${command}`);
const allowed = (command: string, env?: Env) =>
  assert.equal(run(command, env), null, `expected allow: ${command}`);

const WRAPPER = "node --experimental-strip-types scripts/phase16-staging.mjs";

test("property 1: privileged-role text stays blocked, with and without keys", () => {
  const words = ["service" + "_role", "service" + "-role"];
  for (const w of words) for (const env of [keyed, {}]) blocked(`echo ${w}`, env);
  blocked("export SUPABASE_" + "SERVICE_ROLE" + "_KEY=x", {});
});

test("property 2: only exact wrapper / npm staging forms pass while keys are present", () => {
  allowed(`${WRAPPER} attest`);
  allowed(`${WRAPPER} self-test-production-block`);
  allowed(`${WRAPPER} scan-evidence .planning/phases/x/evidence`);
  allowed("npm run test:staging-live");
  allowed("npm run test:staging-live:tracer");
  allowed("npm run test:e2e:mutation -- --project=chromium-desktop");
  allowed("npm run test:e2e");
  for (const tail of [" && ls", " ; ls", " || ls", " | cat", " > out.txt", " `id`", " $(id)"]) {
    blocked(`${WRAPPER} attest${tail}`);
    blocked(`npm run test:staging-live${tail}`);
    blocked(`npm run test:e2e:mutation${tail}`);
  }
  blocked("node --experimental-strip-types --import ./x.mjs scripts/phase16-staging.mjs attest; ls");
  // ordinary commands keep working
  for (const c of ["git status --short", "npm test", "npm exec tsc -- --noEmit", "npm run lint", "cat package.json"]) allowed(c);
});

test("property 3: no direct CLI, env printing, secret names or raw HTTP while keys are present", () => {
  for (const c of [
    "supabase status", "npx supabase db push", "node_modules/.bin/supabase db push",
    "env", "printenv", "echo $HOME", "node -e \"console.log(process.env)\"", "node -p \"process.env\"",
    "grep sb_secret_ -r .", "echo PORTIA_STAGING_DB_URL", "curl https://x.supabase.co/rest/v1/",
  ]) blocked(c);
  for (const c of ["Get-ChildItem env:", "$env:PORTIA_E2E_TARGET_ID", "iwr https://x.supabase.co"]) blocked(c, keyed, "PowerShell");
  // without keys the pre-existing behaviour is unchanged
  allowed("env", {});
  allowed("npm run test:staging-live", {});
});

test("property 4: production ref in text or as target is blocked", () => {
  blocked(`git log --grep ${PROD}`);
  blocked(`git log --grep ${PROD.toUpperCase()}`);
  blocked("npm run test:staging-live", { ...keyed, PORTIA_E2E_TARGET_ID: PROD });
  blocked("npm run test:staging-live", { ...keyed, PORTIA_E2E_TARGET_ID: PROD, PORTIA_E2E_ISOLATED_PROJECT_IDS: `${ISO},${PROD}` });
  blocked("npm run test:staging-live", { ...keyed, PORTIA_E2E_ISOLATED_PROJECT_IDS: "" });
  blocked("npm run test:staging-live", { ...keyed, PORTIA_E2E_TARGET_ID: "" });
  blocked("npm run test:staging-live", { ...keyed, PORTIA_E2E_TARGET_ID: "cccccccccccccccccccc" });
});

// Real hook process: stdin JSON, exit 2 on block, exit 0 on allow.
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !/^(PORTIA_|NEXT_PUBLIC_SUPABASE)/.test(k)),
) as Env;
const hook = (command: string, env: Env) =>
  spawnSync(process.execPath, [".claude/hooks/guard.mjs"], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    env: { ...baseEnv, ...env } as NodeJS.ProcessEnv,
    encoding: "utf8",
  });

test("hook process: exit codes match check() for the four properties", () => {
  assert.equal(hook(`${WRAPPER} attest`, keyed).status, 0);
  assert.equal(hook("npm run test:staging-live", keyed).status, 0);
  assert.equal(hook(`${WRAPPER} attest && ls`, keyed).status, 2);
  assert.equal(hook("supabase status", keyed).status, 2);
  assert.equal(hook("env", keyed).status, 2);
  assert.equal(hook(`echo ${PROD}`, keyed).status, 2);
  assert.equal(hook("npm run test:staging-live", { ...keyed, PORTIA_E2E_TARGET_ID: PROD }).status, 2);
  const r = hook("echo " + "service" + "_role", keyed);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Blocked by project guard/);
});

test("real production list (if present in env): every ref is blocked as target and in text", () => {
  const real = String(process.env.PORTIA_E2E_PRODUCTION_PROJECT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  real.forEach((ref, i) => {
    const env = { ...keyed, PORTIA_E2E_PRODUCTION_PROJECT_IDS: real.join(","), PORTIA_E2E_ISOLATED_PROJECT_IDS: ref, PORTIA_E2E_TARGET_ID: ref };
    assert.equal(hook("npm run test:staging-live", env).status, 2, `production ref #${i} must block as target`);
    assert.equal(hook(`${WRAPPER} attest`, env).status, 2, `production ref #${i} must block wrapper as target`);
    assert.equal(hook(`git log --grep ${ref}`, env).status, 2, `production ref #${i} must block in command text`);
  });
});
