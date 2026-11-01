import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  StagingError,
  attest,
  main,
  redact,
  resolveStagingTarget,
  runCli,
  scanEvidence,
  selfTestProductionBlock,
} from "../scripts/phase16-staging.mjs";

const ref = "aaaaaaaaaaaaaaaaaaaa";
const prod = "bbbbbbbbbbbbbbbbbbbb";
const adminKey = "fake-admin-key-value-0001";
const publishableKey = "fake-publishable-key-0002";
const password = "p@ss/w0rd-fake";
const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
const adminVar = "PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY";

const env: Record<string, string | undefined> = {
  PORTIA_E2E_MUTATION_CONFIRM: "ISOLATED_TEST_PROJECT",
  PORTIA_E2E_TARGET_ENVIRONMENT: "isolated-test",
  PORTIA_E2E_TARGET_ID: ref,
  PORTIA_E2E_SUPABASE_URL: `https://${ref}.supabase.co`,
  PORTIA_E2E_PRODUCTION_PROJECT_IDS: prod,
  PORTIA_E2E_ISOLATED_PROJECT_IDS: ref,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  PORTIA_PROMO_LIVE_URL: `https://${ref}.supabase.co`,
  PORTIA_PROMO_LIVE_CONFIRM: "ISOLATED_TEST_PROJECT",
  PORTIA_PROMOTION_DEVICE_SECRET: "fake-device-secret-for-tests-0000000001",
  PORTIA_STAGING_DB_URL: dbUrl,
  [adminVar]: adminKey,
};

function spies(fsOverrides: Record<string, unknown> = {}) {
  const calls = { spawn: 0, fetch: 0, fsPaths: [] as string[] };
  return {
    calls,
    deps: {
      root: "/repo",
      spawn: () => {
        calls.spawn += 1;
        return { status: 0, stdout: "", stderr: "" };
      },
      fetch: async () => {
        calls.fetch += 1;
        return { ok: true, status: 200 };
      },
      fs: {
        existsSync: (p: string) => {
          calls.fsPaths.push(p);
          return false;
        },
        readFileSync: (p: string) => {
          calls.fsPaths.push(p);
          return JSON.stringify({ bin: { supabase: "bin/supabase.js" } });
        },
        ...fsOverrides,
      },
    },
  };
}

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return "none";
};

describe("resolveStagingTarget fails closed before any spawn or fetch", () => {
  const cases: [string, Record<string, string | undefined>, string][] = [
    ["target guard", { ...env, PORTIA_E2E_MUTATION_CONFIRM: undefined }, "confirmation"],
    ["production list empty", { ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "" }, "production-list-missing"],
    ["production list blanks", { ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "  ,  " }, "production-list-missing"],
    ["production list absent", { ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: undefined }, "production-list-missing"],
    ["production target", { ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: `${prod},${ref}`, PORTIA_E2E_ISOLATED_PROJECT_IDS: "cccccccccccccccccccc" }, "production-project"],
    ["app binding", { ...env, NEXT_PUBLIC_SUPABASE_URL: `https://${prod}.supabase.co` }, "app-target-mismatch"],
    ["external base url", { ...env, PORTIA_E2E_BASE_URL: "https://x.test" }, "external-base-url"],
    ["no admin key", { ...env, [adminVar]: undefined }, "missing-environment"],
    ["no publishable key", { ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }, "missing-environment"],
    ["no db url", { ...env, PORTIA_STAGING_DB_URL: undefined }, "missing-environment"],
    ["live confirm", { ...env, PORTIA_PROMO_LIVE_CONFIRM: "READ_ONLY_PREFLIGHT" }, "live-confirm"],
    ["db url other ref", { ...env, PORTIA_STAGING_DB_URL: dbUrl.replace(`postgres.${ref}`, `postgres.${prod}`) }, "db-url-target-mismatch"],
    ["db url wrong port", { ...env, PORTIA_STAGING_DB_URL: dbUrl.replace(":5432", ":6543") }, "db-url-target-mismatch"],
    ["db url wrong host", { ...env, PORTIA_STAGING_DB_URL: dbUrl.replace("pooler.supabase.com", "example.com") }, "db-url-target-mismatch"],
    ["db url direct wrong user", { ...env, PORTIA_STAGING_DB_URL: `postgresql://postgres.${ref}:x@db.${ref}.supabase.co:5432/postgres` }, "db-url-target-mismatch"],
    ["db url protocol", { ...env, PORTIA_STAGING_DB_URL: dbUrl.replace("postgresql:", "mysql:") }, "db-url-target-mismatch"],
    ["db url garbage", { ...env, PORTIA_STAGING_DB_URL: "not a url" }, "db-url-target-mismatch"],
  ];
  for (const [name, input, code] of cases) {
    test(name, () => {
      const { calls, deps } = spies();
      assert.equal(codeOf(() => resolveStagingTarget(input, deps)), code);
      assert.deepEqual([calls.spawn, calls.fetch], [0, 0]);
    });
  }

  test("a linked CLI project is refused", () => {
    const { calls, deps } = spies({ existsSync: () => true });
    assert.equal(codeOf(() => resolveStagingTarget(env, deps)), "linked-project-present");
    assert.deepEqual([calls.spawn, calls.fetch], [0, 0]);
  });

  test("accepts pooler and direct DB URLs of the attested ref", () => {
    const { deps } = spies();
    assert.equal(resolveStagingTarget(env, deps).projectId, ref);
    const direct = { ...env, PORTIA_STAGING_DB_URL: `postgresql://postgres:x@db.${ref}.supabase.co:5432/postgres` };
    assert.equal(resolveStagingTarget(direct, deps).url, `https://${ref}.supabase.co`);
  });

  test("error messages never contain values", () => {
    const { deps } = spies();
    for (const [, input] of cases) {
      try {
        resolveStagingTarget(input, deps);
      } catch (error) {
        const message = (error as Error).message;
        for (const value of [ref, prod, adminKey, publishableKey, password, "supabase.co"]) {
          assert.ok(!message.includes(value), message);
        }
      }
    }
  });
});

describe("wrapper never reads env files", () => {
  test("fake fs sees no env path and the source has no env loader import", () => {
    const { calls, deps } = spies();
    resolveStagingTarget(env, deps);
    runCli(["migration", "list"], resolveStagingTarget(env, deps), { ...deps, env: {} });
    assert.ok(calls.fsPaths.length > 0);
    assert.ok(calls.fsPaths.every((p) => !/\.env/u.test(p)), calls.fsPaths.join(","));
    const source = readFileSync(new URL("../scripts/phase16-staging.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s*["'`]@next\/env["'`]|import\(\s*["'`]@next\/env["'`]|require\(\s*["'`]@next\/env["'`]/u);
  });
});

describe("redact", () => {
  test("replaces raw and url-encoded values, ignores empty ones", () => {
    const text = `key=${adminKey} url=${dbUrl} pw=${encodeURIComponent(password)} host=${ref}.supabase.co`;
    const out = redact(text, { "admin-key": adminKey, "db-password": password, ref, host: `${ref}.supabase.co`, empty: "", none: undefined as unknown as string });
    for (const value of [adminKey, password, encodeURIComponent(password), ref]) assert.ok(!out.includes(value), out);
    assert.match(out, /\[REDACTED:admin-key\]/u);
    assert.match(out, /\[REDACTED:host\]/u);
  });
});

describe("runCli", () => {
  const target = () => resolveStagingTarget(env, spies().deps);

  test("runs the pinned entry with node, no shell, a minimal env and redacted output", () => {
    const seen: { command?: string; args?: string[]; options?: Record<string, unknown> } = {};
    const out: string[] = [];
    const { deps } = spies();
    const code = runCli(["migration", "list"], target(), {
      ...deps,
      env: { ...env, PATH: "/bin", SystemRoot: "C:\\Windows", TEMP: "/tmp" },
      spawn: (command: string, args: string[], options: Record<string, unknown>) => {
        Object.assign(seen, { command, args, options });
        return { status: 3, stdout: `connected ${ref} with ${adminKey}`, stderr: `pw ${password}` };
      },
      out: (t: string) => out.push(t),
      err: (t: string) => out.push(t),
    });
    assert.equal(code, 3);
    assert.equal(seen.command, process.execPath);
    assert.equal(seen.options?.shell, false);
    assert.deepEqual(seen.args?.slice(1), ["migration", "list", "--db-url", dbUrl]);
    assert.deepEqual(Object.keys(seen.options?.env as object).sort(), ["PATH", "SystemRoot", "TEMP"]);
    const childValues = Object.values(seen.options?.env as object).join("|");
    for (const value of [adminKey, publishableKey, password, ref]) assert.ok(!childValues.includes(value));
    const printed = out.join("");
    for (const value of [adminKey, password, ref]) assert.ok(!printed.includes(value), printed);
  });

  test("rejects link, reset, --linked, bare --remote, foreign --remote and caller --db-url", () => {
    const { calls, deps } = spies();
    for (const args of [["link"], ["db", "reset"], ["db", "push", "--linked"], ["db", "query", "--remote"], ["db", "query", "--remote=other"], ["db", "push", "--db-url", "x"], ["db", "push", "--db-url=x"]]) {
      assert.equal(codeOf(() => runCli(args, target(), deps)), "forbidden-argument", args.join(" "));
    }
    assert.equal(calls.spawn, 0);
  });

  test("fails when the pinned CLI is not installed", () => {
    const { deps } = spies({ readFileSync: () => { throw new Error("ENOENT"); } });
    assert.equal(codeOf(() => runCli(["migration", "list"], target(), deps)), "cli-missing");
  });
});

describe("selfTestProductionBlock", () => {
  test("blocks every production ref and reports only counters", () => {
    const refs = [prod, "dddddddddddddddddddd", "eeeeeeeeeeeeeeeeeeee"];
    const { calls, deps } = spies();
    const result = selfTestProductionBlock({ ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: refs.join(",") }, deps);
    assert.deepEqual(result, { checked: 3, blocked: 3 });
    assert.deepEqual([calls.spawn, calls.fetch], [0, 0]);
  });

  test("empty list or an incomplete environment is not a pass (exit 1)", async () => {
    assert.deepEqual(selfTestProductionBlock({ ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "" }, spies().deps), { checked: 0, blocked: 0 });
    const lines: string[] = [];
    const base = { out: (t: string) => lines.push(t), err: (t: string) => lines.push(t), ...spies().deps };
    assert.equal(await main(["self-test-production-block"], { ...base, env: { ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "" } }), 1);
    assert.equal(await main(["self-test-production-block"], { ...base, env: { ...env, PORTIA_E2E_MUTATION_CONFIRM: undefined } }), 1);
    assert.equal(await main(["self-test-production-block"], { ...base, env }), 0);
    assert.ok(lines.every((line) => !line.includes(prod) && !line.includes(ref)), lines.join(""));
  });
});

describe("attest", () => {
  test("two requests to the target host only, prints a ref hash", async () => {
    const urls: string[] = [];
    const { deps } = spies();
    const result = await attest(env, {
      ...deps,
      fetch: async (url: string) => {
        urls.push(url);
        return { ok: true, status: 200 };
      },
    });
    assert.equal(urls.length, 2);
    assert.ok(urls.every((u) => u.startsWith(`https://${ref}.supabase.co/`)));
    assert.match(urls[1], /per_page=1/u);
    assert.equal(result.status, "ATTESTED");
    assert.match(result.refHash, /^[0-9a-f]{12}$/u);
    assert.ok(!JSON.stringify(result).includes(ref));
  });

  test("a rejected key or an unreachable (paused) project fails without values", async () => {
    const { deps } = spies();
    await assert.rejects(attest(env, { ...deps, fetch: async () => ({ ok: false, status: 401 }) }), (e: StagingError) => e.code === "rejected-publishable-401");
    await assert.rejects(attest(env, { ...deps, fetch: async () => { throw new Error(`ENOTFOUND ${ref}`); } }), (e: StagingError) => {
      assert.equal(e.code, "unreachable-publishable");
      assert.match(e.message, /paused/u);
      assert.ok(!e.message.includes(ref));
      return true;
    });
  });

  test("main exits 1 with a block code and no fetch when the environment is empty", async () => {
    const { calls, deps } = spies();
    const lines: string[] = [];
    const code = await main(["attest"], { ...deps, env: {}, out: (t: string) => lines.push(t), err: (t: string) => lines.push(t) });
    assert.equal(code, 1);
    assert.match(lines.join(""), /PORTIA_E2E_TARGET_BLOCKED:confirmation/u);
    assert.equal(calls.fetch, 0);
  });
});

describe("scan-evidence and main", () => {
  test("reports file and class only, exit 1 on findings, 0 when clean", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "portia-scan-"));
    try {
      mkdirSync(path.join(dir, "sub"));
      writeFileSync(path.join(dir, "clean.md"), "no secrets here\n");
      writeFileSync(path.join(dir, "sub", "leak.md"), `token ${adminKey}\nsb_secret_abc\npostgresql://x\n${ref}\n`);
      const kinds = scanEvidence(dir, env).map((f) => `${f.file.replaceAll("\\", "/")}:${f.kind}`).sort();
      assert.deepEqual(kinds, [
        "sub/leak.md:pattern:postgres-url",
        "sub/leak.md:pattern:sb_secret",
        "sub/leak.md:value:admin-key",
        "sub/leak.md:value:ref",
      ].sort());
      const lines: string[] = [];
      const io = { out: (t: string) => lines.push(t), err: (t: string) => lines.push(t) };
      assert.equal(await main(["scan-evidence", dir], { env, ...io }), 1);
      const printed = lines.join("");
      for (const value of [adminKey, ref, "sb_secret_abc"]) assert.ok(!printed.includes(value), printed);
      rmSync(path.join(dir, "sub"), { recursive: true });
      assert.equal(await main(["scan-evidence", dir], { env, ...io }), 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("unknown subcommands exit 2; no link/reset subcommand or flag exists", async () => {
    const io = { out: () => undefined, err: () => undefined };
    for (const argv of [[], ["link"], ["db", "reset"], ["push"], ["scan-evidence"]]) {
      assert.equal(await main(argv, { env, ...io }), 2, argv.join(" "));
    }
    const source = readFileSync(new URL("../scripts/phase16-staging.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(source, /command === ["'](link|reset)["']/u);
  });
});
