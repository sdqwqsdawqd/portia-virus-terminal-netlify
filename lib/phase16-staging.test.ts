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
  cliHelp,
  fingerprint,
  push,
  teardown,
  asSingleStatement,
  extractStep,
  upgradeLadder,
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

describe("cli-help, push and fingerprint (16-10)", () => {
  const recorder = (outputs: { status?: number; stdout?: string }[]) => {
    const argvs: string[][] = [];
    const opts: Record<string, unknown>[] = [];
    let i = 0;
    return {
      argvs,
      opts,
      spawn: (_command: string, args: string[], options: Record<string, unknown>) => {
        argvs.push(args.slice(1));
        opts.push(options);
        const next = outputs[Math.min(i++, outputs.length - 1)];
        return { status: next.status ?? 0, stdout: next.stdout ?? "", stderr: "" };
      },
    };
  };
  const quiet = { out: () => undefined, err: () => undefined };

  test("cli-help runs --help with words only, no target, no DB URL", () => {
    const r = recorder([{}]);
    const { deps } = spies();
    assert.equal(cliHelp(["db", "push"], { ...deps, spawn: r.spawn, env: { ...env, PATH: "/bin" }, ...quiet }), 0);
    assert.deepEqual(r.argvs, [["db", "push", "--help"]]);
    assert.deepEqual(Object.keys(r.opts[0].env as object), ["PATH"]);
    for (const bad of [[], ["--db-url"], ["db", "push;x"], ["Db"]]) {
      assert.equal(codeOf(() => cliHelp(bad, { ...deps, spawn: r.spawn })), "forbidden-argument");
    }
    assert.equal(r.argvs.length, 1);
  });

  test("push: db push --yes then migration list, both with the attested --db-url only", () => {
    const r = recorder([{}, {}]);
    const { deps } = spies();
    assert.equal(push(env, { ...deps, spawn: r.spawn, env, ...quiet }), 0);
    assert.deepEqual(r.argvs, [["db", "push", "--yes", "--db-url", dbUrl], ["migration", "list", "--db-url", dbUrl]]);
    for (const argv of r.argvs) for (const word of ["link", "reset", "--linked", "--project-ref"]) assert.ok(!argv.includes(word));
  });

  test("push stops after a failed db push and refuses without a target", () => {
    const r = recorder([{ status: 1 }, {}]);
    const { deps } = spies();
    assert.equal(push(env, { ...deps, spawn: r.spawn, env, ...quiet }), 1);
    assert.equal(r.argvs.length, 1);
    assert.equal(codeOf(() => push({ ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "" }, { ...deps, spawn: r.spawn })), "production-list-missing");
    assert.equal(r.argvs.length, 1);
  });

  test("fingerprint: db query -f <sql> -o json, canonical evidence file; bad output writes nothing", () => {
    const written: Record<string, string> = {};
    const { deps } = spies({ mkdirSync: () => undefined, writeFileSync: (p: string, t: string) => { written[path.basename(p)] = t; } });
    const payload = { schema: "portia-fingerprint-v1", pg_major: 17, sections: { tables: { b: 1, a: 2 } } };
    const r = recorder([{ stdout: JSON.stringify([{ fingerprint: payload }]) }]);
    assert.equal(fingerprint("fresh-1", env, { ...deps, spawn: r.spawn, env, evidenceDir: "/ev", sqlFile: "/sql/f.sql", ...quiet }), 0);
    assert.deepEqual(r.argvs[0], ["db", "query", "-f", "/sql/f.sql", "-o", "json", "--db-url", dbUrl]);
    assert.deepEqual(Object.keys(written), ["fingerprint-fresh-1.json"]);
    const text = written["fingerprint-fresh-1.json"];
    assert.ok(text.indexOf('"a"') < text.indexOf('"b"'));

    const bad = recorder([{ stdout: "" }]);
    assert.equal(codeOf(() => fingerprint("x", env, { ...deps, spawn: bad.spawn, env, ...quiet })), "fingerprint-unparseable");
    assert.deepEqual(Object.keys(written), ["fingerprint-fresh-1.json"]);
    assert.equal(codeOf(() => fingerprint("Bad_Label", env, { ...deps, spawn: bad.spawn })), "bad-label");
    assert.equal(codeOf(() => fingerprint("x", { ...env, PORTIA_STAGING_DB_URL: undefined }, { ...deps, spawn: bad.spawn })), "missing-environment");
  });
});

describe("teardown, extractStep and upgrade-ladder (16-11)", () => {
  const quiet = { out: () => undefined, err: () => undefined };
  const phase12 = readFileSync(new URL("../supabase/phase12_apply.sql", import.meta.url), "utf8");
  const teardownSql = readFileSync(new URL("../supabase/teardown/portia_teardown.sql", import.meta.url), "utf8");
  const payload = JSON.stringify([{ fingerprint: { schema: "portia-fingerprint-v1", pg_major: 17, sections: {} } }]);

  // Fake fs: package manifest for the CLI, real SQL for the three source files, in-memory scratch/evidence.
  function harness(overrides: { spawn?: (args: string[]) => { status: number; stdout?: string } } = {}) {
    const log: string[] = [];
    const written: Record<string, string> = {};
    const argvs: string[][] = [];
    const deps = {
      root: "/repo",
      ...quiet,
      env,
      tmpdir: "/scratch",
      fs: {
        existsSync: () => false,
        readFileSync: (p: string) => {
          if (p.endsWith("package.json")) return JSON.stringify({ bin: { supabase: "bin/supabase.js" } });
          if (p.endsWith("phase12_apply.sql")) return phase12;
          if (p.endsWith("portia_teardown.sql")) return teardownSql;
          return `-- contents of ${path.basename(p)}\n`;
        },
        mkdtempSync: (prefix: string) => {
          log.push("mkdtemp");
          return `${prefix}x`;
        },
        writeFileSync: (p: string, text: string) => {
          written[path.basename(p)] = text;
        },
        mkdirSync: () => undefined,
        rmSync: () => log.push("rm-scratch"),
      },
      spawn: (_command: string, args: string[]) => {
        argvs.push(args.slice(1));
        log.push(`cli:${args[1]}${args[1] === "db" ? ` ${args[2]}` : ""}`);
        return overrides.spawn?.(args.slice(1)) ?? { status: 0, stdout: args.includes("-o") ? payload : "", stderr: "" };
      },
    };
    return { deps, log, written, argvs };
  }

  const bucketClient = (log: string[], errors: Record<string, { status?: number; message: string } | null> = {}) => ({
    storage: {
      emptyBucket: async (name: string) => {
        log.push(`bucket-empty:${name}`);
        return { error: errors.empty ?? null };
      },
      deleteBucket: async (name: string) => {
        log.push(`bucket-delete:${name}`);
        return { error: errors.delete ?? null };
      },
    },
  });

  test("teardown empties and deletes the bucket first, then runs only the teardown SQL with the session switch", async () => {
    const h = harness();
    assert.equal(await teardown(env, { ...h.deps, createClient: () => bucketClient(h.log) }), 0);
    assert.deepEqual(h.log, ["bucket-empty:portia-media", "bucket-delete:portia-media", "mkdtemp", "cli:db query", "rm-scratch"]);
    assert.equal(h.argvs.length, 1);
    assert.deepEqual(h.argvs[0].slice(0, 3), ["db", "query", "-f"]);
    assert.ok(h.argvs[0][3].includes("scratch"), h.argvs[0][3]);
    assert.deepEqual(h.argvs[0].slice(4), ["--db-url", dbUrl]);
    const sql = h.written["teardown.sql"];
    assert.equal(sql, asSingleStatement(teardownSql, "select set_config('portia.teardown_ok', 'yes', false);\n"));
    assert.ok(sql.startsWith("do $portia_do$ begin execute $portia_sql$\nselect set_config('portia.teardown_ok', 'yes', false);\n"));
  });

  test("asSingleStatement drops only top-level begin/commit lines of the real scripts and refuses tag collisions", () => {
    const files = ["phase12_apply.sql", "phase14_apply.sql", "teardown/portia_teardown.sql", "upgrade-fixtures/L0_pre_phase12_portia_setup.sql"];
    for (const file of files) {
      const text = readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8");
      const topLevel = text.split(/\r?\n/u).filter((line) => /^(begin|commit);\s*$/iu.test(line)).length;
      const wrapped = asSingleStatement(text);
      assert.equal(wrapped.split(/\r?\n/u).filter((line) => /^(begin|commit);\s*$/iu.test(line)).length, 0, file);
      assert.equal(wrapped.split(/\r?\n/u).length, text.split(/\r?\n/u).length + 3, `${file} lost lines beyond begin/commit (${topLevel})`);
      assert.ok(wrapped.endsWith("\n$portia_sql$; end $portia_do$;\n"));
    }
    assert.equal(codeOf(() => asSingleStatement("select $portia_sql$;")), "sql-tag-collision");
  });

  test("a missing bucket is not an error; any other Storage failure stops before SQL", async () => {
    const absent = harness();
    const gone = { status: 404, message: "Bucket not found" };
    assert.equal(await teardown(env, { ...absent.deps, createClient: () => bucketClient(absent.log, { empty: gone, delete: gone }) }), 0);
    assert.equal(absent.argvs.length, 1);

    const broken = harness();
    await assert.rejects(
      teardown(env, { ...broken.deps, createClient: () => bucketClient(broken.log, { delete: { status: 500, message: "boom" } }) }),
      (e: StagingError) => e.code === "bucket-delete-failed",
    );
    assert.equal(broken.argvs.length, 0);
  });

  test("teardown refuses without a target or with a production ref before any client or spawn", async () => {
    for (const bad of [{ ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "" }, { ...env, PORTIA_E2E_TARGET_ID: prod, PORTIA_E2E_SUPABASE_URL: `https://${prod}.supabase.co`, NEXT_PUBLIC_SUPABASE_URL: `https://${prod}.supabase.co` }, {}]) {
      const h = harness();
      let clients = 0;
      await assert.rejects(teardown(bad, { ...h.deps, createClient: () => { clients += 1; return bucketClient(h.log); } }));
      assert.deepEqual([clients, h.argvs.length], [0, 0]);
    }
  });

  test("extractStep returns STEP 2 and STEP 2b of the real phase12 file and nothing of STEP 0/1/3/4", () => {
    const two = extractStep(phase12, "2");
    const twoB = extractStep(phase12, "2b");
    assert.match(two, /^-- STEP 2 APPLY/u);
    assert.match(two, /\nbegin;/u);
    assert.match(two, /\ncommit;/u);
    assert.match(twoB, /^-- STEP 2b/u);
    assert.match(twoB, /validate constraint portia_employee_profiles_photo_url_local/u);
    for (const block of [two, twoB]) {
      assert.equal(block.split("\n").filter((line: string) => line.startsWith("-- STEP ")).length, 1);
      assert.ok(!block.includes("STEP 4 ROLLBACK"));
    }
    assert.equal(codeOf(() => extractStep(phase12, "9")), "step-missing");
  });

  const fakeRun = (log: string[], residual = 0) => ({
    createOwnerFixture: async () => { log.push("owner-create"); },
    cleanup: async () => { log.push("owner-cleanup"); },
    residual: async () => ({ authUsers: residual }),
  });

  test("ladder runs owner fixture, L0, STEP 2, STEP 2b, phase14, U0, push, U in order and removes the fixture", async () => {
    const h = harness();
    assert.equal(await upgradeLadder(env, { ...h.deps, createRun: () => fakeRun(h.log) }), 0);
    assert.deepEqual(h.log.filter((x) => x.startsWith("owner")), ["owner-create", "owner-cleanup"]);
    assert.equal(h.log[0], "owner-create");
    const files = h.argvs.map((a) => (a[0] === "db" && a[1] === "query" ? path.basename(a[3]) : a.slice(0, 2).join(" ")));
    assert.deepEqual(files, [
      "L0.sql",
      "step2.sql",
      "step2b.sql",
      "phase14.sql",
      "portia_schema_fingerprint.sql",
      "db push",
      "migration list",
      "portia_schema_fingerprint.sql",
    ]);
    assert.equal(h.written["step2.sql"], asSingleStatement(extractStep(phase12, "2")));
    assert.equal(h.written["step2b.sql"], asSingleStatement(extractStep(phase12, "2b")));
    assert.equal(h.log.filter((x) => x === "rm-scratch").length, 4);
    assert.equal(h.log.at(-1), "owner-cleanup");
    for (const argv of h.argvs) assert.ok(!argv.includes("--linked") && !argv.includes("reset"));
  });

  test("a failing stage is named, later stages do not run and the owner fixture is still removed", async () => {
    const h = harness({ spawn: (args) => ({ status: args.some((a) => a.endsWith("step2.sql")) ? 1 : 0, stdout: "" }) });
    await assert.rejects(upgradeLadder(env, { ...h.deps, createRun: () => fakeRun(h.log) }), (e: StagingError) => e.code === "ladder-phase12-step-2-exit-1");
    assert.equal(h.argvs.length, 2);
    assert.ok(h.log.includes("owner-cleanup"));
  });

  test("an owner fixture that survives cleanup fails a successful ladder", async () => {
    const h = harness();
    await assert.rejects(upgradeLadder(env, { ...h.deps, createRun: () => fakeRun(h.log, 1) }), (e: StagingError) => e.code === "owner-fixture-residual");
  });

  test("ladder and teardown dispatch through main; unknown arguments exit 2", async () => {
    for (const argv of [["teardown", "x"], ["upgrade-ladder", "x"]]) assert.equal(await main(argv, { env, ...quiet }), 2);
    assert.equal(await main(["teardown"], { env: {}, ...quiet }), 1);
    assert.equal(await main(["upgrade-ladder"], { env: {}, ...quiet }), 1);
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
    for (const argv of [[], ["link"], ["db", "reset"], ["push", "x"], ["fingerprint"], ["scan-evidence"]]) {
      assert.equal(await main(argv, { env, ...io }), 2, argv.join(" "));
    }
    const source = readFileSync(new URL("../scripts/phase16-staging.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(source, /command === ["'](link|reset)["']/u);
  });
});
