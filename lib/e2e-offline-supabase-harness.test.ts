import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

// Phase 20-58 (D-68): the offline Supabase harness is an explicit test-only file preloaded into the Next server process
// (NODE_OPTIONS --require). These tests start child processes; none of them reaches the network: the invented project
// host never resolves, the stub answers one signed-read POST itself and every other lookup fails at once.

const root = fileURLToPath(new URL("..", import.meta.url));
const harness = resolve(root, "tests/e2e/harness/offline-supabase.cjs");
const projectUrl = "https://abcdefghijklmnopqrst.supabase.co";
const FLAG = "PORTIA_E2E_OFFLINE_SUPABASE";
const REFUSED = "[PORTIA_OFFLINE_HARNESS_REFUSED]";

const refusingNames = [
  "PORTIA_E2E_MUTATION_CONFIRM",
  "PORTIA_E2E_TARGET_ENVIRONMENT",
  "PORTIA_E2E_TARGET_ID",
  "PORTIA_E2E_SUPABASE_URL",
  "PORTIA_E2E_ISOLATED_PROJECT_IDS",
  "PORTIA_E2E_PRODUCTION_PROJECT_IDS",
  "PORTIA_STAGING_DB_URL",
] as const;

type Run = { status: number | null; stdout: string; stderr: string };

function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of [FLAG, "NEXT_PUBLIC_SUPABASE_URL", ...refusingNames]) delete env[name];
  return { ...env, ...extra };
}

function runPreloaded(script: string, extra: Record<string, string>): Run {
  const result = spawnSync(process.execPath, ["--require", harness, "-e", script], {
    env: cleanEnv(extra),
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const enabled = { [FLAG]: "1", NEXT_PUBLIC_SUPABASE_URL: projectUrl };

describe("offline Supabase harness (20-58, D-68)", () => {
  test("the harness file exists and names its enabling flag", () => {
    assert.ok(existsSync(harness), "tests/e2e/harness/offline-supabase.cjs is missing");
    assert.match(readFileSync(harness, "utf8"), /PORTIA_E2E_OFFLINE_SUPABASE/);
  });

  test("without the flag nothing is replaced and OFFLINE_ENV is exported", () => {
    const run = runPreloaded(
      `const dns = require("node:dns"); const before = [dns.lookup, globalThis.fetch];
       delete require.cache[require.resolve(${JSON.stringify(harness)})];
       const mod = require(${JSON.stringify(harness)});
       console.log(JSON.stringify({ env: mod.OFFLINE_ENV, same: dns.lookup === before[0] && globalThis.fetch === before[1] }));`,
      { NEXT_PUBLIC_SUPABASE_URL: "https://realproject.supabase.co" },
    );
    assert.equal(run.status, 0, run.stderr);
    const out = JSON.parse(run.stdout.trim()) as { env: Record<string, string>; same: boolean };
    assert.equal(out.same, true, "dns.lookup or fetch was replaced without the flag");
    assert.deepEqual(out.env, {
      NEXT_PUBLIC_SUPABASE_URL: projectUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_dummy0123456789abcdefghijklmnop",
      PORTIA_PROMOTION_DEVICE_SECRET: "dummy-device-secret-0123456789-abcdefghijklmnop",
    });
  });

  test("with the flag any *.supabase.co lookup fails at once with ENOTFOUND", () => {
    const run = runPreloaded(
      `const dns = require("node:dns");
       const started = performance.now();
       dns.lookup("anything-else.supabase.co", (error) => {
         console.log(JSON.stringify({ code: error && error.code, ms: performance.now() - started }));
       });`,
      enabled,
    );
    assert.equal(run.status, 0, run.stderr);
    const out = JSON.parse(run.stdout.trim()) as { code: string; ms: number };
    assert.equal(out.code, "ENOTFOUND");
    assert.ok(out.ms < 200, `lookup took ${out.ms} ms`);
  });

  test("with the flag other names go to the original dns.lookup", () => {
    const run = runPreloaded(
      `require("node:dns").lookup("localhost", (error, address) => console.log(JSON.stringify({ error: error && error.code, address: typeof address })));`,
      enabled,
    );
    assert.equal(run.status, 0, run.stderr);
    const out = JSON.parse(run.stdout.trim()) as { error: string | null; address: string };
    assert.equal(out.error ?? null, null);
    assert.equal(out.address, "string");
  });

  test("with the flag only POST /rest/v1/rpc/portia_content_read of the invented project answers 200 with an empty row", () => {
    const rpcUrl = `${projectUrl}/rest/v1/rpc/portia_content_read`;
    const run = runPreloaded(
      `(async () => {
         const ok = await fetch(${JSON.stringify(rpcUrl)}, { method: "POST", body: "{}" });
         const result = { status: ok.status, body: await ok.text(), type: ok.headers.get("content-type"), others: {} };
         const attempts = {
           getTable: () => fetch(${JSON.stringify(`${projectUrl}/rest/v1/portia_content`)}),
           getRpc: () => fetch(${JSON.stringify(rpcUrl)}),
           patch: () => fetch(${JSON.stringify(rpcUrl)}, { method: "PATCH", body: "{}" }),
           otherRpc: () => fetch(${JSON.stringify(`${projectUrl}/rest/v1/rpc/portia_employees_read`)}, { method: "POST", body: "{}" }),
           otherPath: () => fetch(${JSON.stringify(`${projectUrl}/rest/v1/something_else`)}),
           otherHost: () => fetch("https://otherproject.supabase.co/rest/v1/rpc/portia_content_read", { method: "POST", body: "{}" }),
         };
         for (const [name, run] of Object.entries(attempts)) {
           try { await run(); result.others[name] = "answered"; }
           catch (error) { result.others[name] = (error.cause && error.cause.code) || error.name; }
         }
         console.log(JSON.stringify(result));
       })();`,
      enabled,
    );
    assert.equal(run.status, 0, run.stderr);
    const out = JSON.parse(run.stdout.trim()) as {
      status: number;
      body: string;
      type: string;
      others: Record<string, string>;
    };
    assert.equal(out.status, 200);
    assert.equal(out.body, '{"code":"ok","row":null}');
    assert.match(out.type, /^application\/json/);
    // The anonymous table read is forbidden by the Phase 25 contract, so it is no longer stubbed: it fails like any offline request.
    assert.deepEqual(out.others, {
      getTable: "ENOTFOUND",
      getRpc: "ENOTFOUND",
      patch: "ENOTFOUND",
      otherRpc: "ENOTFOUND",
      otherPath: "ENOTFOUND",
      otherHost: "ENOTFOUND",
    });
  });

  test(`${REFUSED}: another project address is refused and nothing is replaced`, () => {
    const run = runPreloaded(`console.log("loaded")`, { [FLAG]: "1", NEXT_PUBLIC_SUPABASE_URL: "https://realproject.supabase.co" });
    assert.notEqual(run.status, 0);
    assert.ok(run.stderr.includes(REFUSED), run.stderr);
    assert.ok(!run.stdout.includes("loaded"));
  });

  test(`${REFUSED}: a missing project address is refused`, () => {
    const run = runPreloaded(`console.log("loaded")`, { [FLAG]: "1" });
    assert.notEqual(run.status, 0);
    assert.ok(run.stderr.includes(REFUSED), run.stderr);
  });

  for (const name of refusingNames) {
    test(`${REFUSED}: ${name} (staging or mutation setup) is refused`, () => {
      const run = runPreloaded(`console.log("loaded")`, { ...enabled, [name]: "present" });
      assert.notEqual(run.status, 0);
      assert.ok(run.stderr.includes(REFUSED), run.stderr);
      assert.ok(run.stderr.includes(name), `the refusal does not name ${name}`);
    });
  }

  test("only a flag value of exactly 1 enables the harness", () => {
    const run = runPreloaded(
      `const dns = require("node:dns"); console.log(dns.lookup.name);`,
      { [FLAG]: "true", NEXT_PUBLIC_SUPABASE_URL: "https://realproject.supabase.co" },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "lookup", "dns.lookup was replaced although the flag is not exactly 1");
  });

  test("product code and package scripts never reference the harness", () => {
    const sources = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sources(path);
        if (![".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(extname(path)) || /\.test\.[cm]?[jt]sx?$/.test(path)) return [];
        return [path];
      });
    const files = [
      ...["app", "components", "lib"].flatMap((name) => sources(resolve(root, name))),
      resolve(root, "next.config.ts"),
      resolve(root, "package.json"),
    ];
    const offenders = files.filter((path) => /offline-supabase|PORTIA_E2E_OFFLINE_SUPABASE|e2e[\\/]harness/.test(readFileSync(path, "utf8")));
    assert.deepEqual(offenders, [], `product code references the test harness: ${offenders.join(", ")}`);
  });
});
