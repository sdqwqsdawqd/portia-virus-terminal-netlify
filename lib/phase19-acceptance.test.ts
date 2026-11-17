import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { after, describe, test } from "node:test";

import { main } from "../scripts/phase16-staging.mjs";
import { acceptanceShift } from "../scripts/phase19-acceptance.mjs";
import { accessRosterFromRows, promotionRosterFromRows } from "./portia-promotion-sheet.ts";
import { createRun } from "../tests/e2e/fixtures/staging-harness.ts";

const ref = "aaaaaaaaaaaaaaaaaaaa";
const prod = "bbbbbbbbbbbbbbbbbbbb";
const adminKey = "fake-admin-key-value-0001";
const publishableKey = "fake-publishable-key-0002";
const dbUrl = `postgresql://postgres.${ref}:fake-db-password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
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
  PORTIA_STAGING_DB_URL: dbUrl,
  PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY: adminKey,
};

describe("acceptance-serve staging binding", () => {
  const runId = "abc_12345678";
  const refHash = createHash("sha256").update(ref).digest("hex").slice(0, 12);
  function serveCase(overrides: Record<string, unknown> = {}) {
    const root = mkdtempSync(path.join(scratch, "serve-"));
    const manifestFile = path.join(root, "manifest.json");
    const rosterPath = path.join(root, "roster.json");
    nodeFs.writeFileSync(rosterPath, "{}");
    nodeFs.writeFileSync(manifestFile, JSON.stringify({ schema: "portia-acceptance-run-v2", runId, refHash, rosterPath, createdAtSource: "db", preexisting: { bucketKeys: [], taskBankIds: [], qualificationBankIds: [] }, nicknames: { probe: `__portia_live_${runId}_probe` } }));
    const calls = { spawn: [] as unknown[], fetch: [] as string[], killed: 0, out: [] as string[], err: [] as string[] };
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => void };
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.kill = () => { calls.killed++; child.emit("exit", 0); };
    const deps = {
      env, root, tmpdir: root, manifestFile, fs: nodeFs,
      portInUse: async () => false,
      spawn: (...args: unknown[]) => { calls.spawn.push(args); return child; },
      waitForChild: async () => 0,
      fetchLocal: async (url: string) => {
        calls.fetch.push(url);
        if (url.includes("/api/promotion/status")) {
          const nick = new URL(url).searchParams.get("nickname");
          return nick?.endsWith("_absent") ? { status: 404 } : { status: 200, json: async () => ({ nickname: nick }) };
        }
        if (url.endsWith("/owner-login")) return { status: 200, text: async () => `<script src="/_next/static/app.js"></script>` };
        if (url.endsWith("/_next/static/app.js")) return { status: 200, text: async () => `${ref}.supabase.co` };
        return { status: 200, text: async () => "ready" };
      },
      networkInterfaces: () => ({ lan: [{ address: "192.0.2.4", family: "IPv4", internal: false }] }),
      out: (value: string) => calls.out.push(value), err: (value: string) => calls.err.push(value),
      ...overrides,
    };
    return { deps, calls, child, manifestFile, rosterPath };
  }

  test("guard rejects missing or production environment before spawning", async () => {
    for (const badEnv of [{}, { ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: `${prod},${ref}`, PORTIA_E2E_ISOLATED_PROJECT_IDS: prod }]) {
      const ctx = serveCase({ env: badEnv });
      assert.equal(await main(["acceptance-serve", runId], ctx.deps), 1);
      assert.equal(ctx.calls.spawn.length, 0);
      assert.equal(ctx.calls.fetch.length, 0);
    }
  });
  test("ref mismatch and port-busy refuse before spawn", async () => {
    const mismatch = serveCase();
    nodeFs.writeFileSync(mismatch.manifestFile, JSON.stringify({ schema: "portia-acceptance-run-v2", runId, refHash: "000000000000", rosterPath: mismatch.rosterPath, createdAtSource: "db", preexisting: { bucketKeys: [], taskBankIds: [], qualificationBankIds: [] }, nicknames: { probe: "probe" } }));
    assert.equal(await main(["acceptance-serve", runId], mismatch.deps), 1);
    assert.match(mismatch.calls.err.join(""), /acceptance-serve-ref-mismatch/u);
    assert.equal(mismatch.calls.spawn.length, 0);
    const busy = serveCase({ portInUse: async () => true });
    assert.equal(await main(["acceptance-serve", runId], busy.deps), 1);
    assert.match(busy.calls.err.join(""), /port-busy/u);
    assert.equal(busy.calls.spawn.length, 0);
  });
  test("server-not-staging kills child when probe returns 404", async () => {
    const ctx = serveCase({ fetchLocal: async (url: string) => url.includes("/api/promotion/status") ? { status: 404 } : { status: 200 } });
    assert.equal(await main(["acceptance-serve", runId], ctx.deps), 1);
    assert.match(ctx.calls.err.join(""), /server-not-staging/u);
    assert.equal(ctx.calls.killed, 1);
    assert.equal(ctx.calls.out.length, 0);
  });
  test("production-ref-in-bundle and client-binding-unproven kill child", async () => {
    for (const [bundle, code] of [[`${prod}.supabase.co`, "production-ref-in-bundle"], ["no project host", "client-binding-unproven"]]) {
      const base = serveCase();
      const fetchLocal = async (url: string) => url.endsWith("/_next/static/app.js") ? { status: 200, text: async () => bundle } : base.deps.fetchLocal(url);
      const ctx = serveCase({ fetchLocal });
      assert.equal(await main(["acceptance-serve", runId], ctx.deps), 1);
      assert.match(ctx.calls.err.join(""), new RegExp(code, "u"));
      assert.equal(ctx.calls.killed, 1);
      assert.equal(ctx.calls.out.length, 0);
    }
  });
  test("client binding may be proved by desktop scripts when owner login is server rendered", async () => {
    const base = serveCase();
    const fetchLocal = async (url: string) => {
      if (url.endsWith("/owner-login")) return { status: 200, text: async () => `<script src="/_next/static/owner.js"></script>` };
      if (url.endsWith("/")) return { status: 200, text: async () => `<script src="/_next/static/desktop.js"></script>` };
      if (url.endsWith("/_next/static/owner.js")) return { status: 200, text: async () => "server-rendered login" };
      if (url.endsWith("/_next/static/desktop.js")) return { status: 200, text: async () => `${ref}.supabase.co` };
      return base.deps.fetchLocal(url);
    };
    const ctx = serveCase({ fetchLocal });
    assert.equal(await main(["acceptance-serve", runId], ctx.deps), 0);
    assert.match(ctx.calls.out.join(""), /STAGING-BOUND/u);
  });
  test("a production ref in desktop scripts blocks the bound server", async () => {
    const base = serveCase();
    const fetchLocal = async (url: string) => {
      if (url.endsWith("/")) return { status: 200, text: async () => `<script src="/_next/static/desktop.js"></script>` };
      if (url.endsWith("/_next/static/desktop.js")) return { status: 200, text: async () => `${prod}.supabase.co` };
      return base.deps.fetchLocal(url);
    };
    const ctx = serveCase({ fetchLocal });
    assert.equal(await main(["acceptance-serve", runId], ctx.deps), 1);
    assert.match(ctx.calls.err.join(""), /production-ref-in-bundle/u);
    assert.equal(ctx.calls.out.length, 0);
    assert.equal(ctx.calls.killed, 1);
  });
  test("bound server receives staging env and prints one safe STAGING-BOUND line", async () => {
    const ctx = serveCase();
    assert.equal(await main(["acceptance-serve", runId, "--https"], ctx.deps), 0);
    const [bin, args, opts] = ctx.calls.spawn[0] as [string, string[], { env: Record<string, string>; shell: boolean }];
    assert.equal(bin, process.execPath);
    assert.ok(args[0].endsWith(path.join("node_modules", "next", "dist", "bin", "next")));
    assert.deepEqual(args.slice(1), ["dev", "--hostname", "0.0.0.0", "--port", "3000", "--experimental-https"]);
    assert.equal(opts.shell, false);
    assert.equal(opts.env.NEXT_PUBLIC_SUPABASE_URL, `https://${ref}.supabase.co`);
    assert.equal(opts.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, publishableKey);
    assert.equal(opts.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, publishableKey);
    assert.equal(opts.env.PORTIA_PROMOTION_STAGING_ROSTER, ctx.rosterPath);
    assert.match(opts.env.PORTIA_PROMOTION_DEVICE_SECRET, /^[a-f0-9]{64}$/u);
    assert.equal(opts.env.PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY, "");
    assert.equal(opts.env.PORTIA_STAGING_DB_URL, "");
    const line = ctx.calls.out.join("");
    assert.deepEqual(JSON.parse(line), { status: "STAGING-BOUND", refHash, serverBound: true, clientBound: true, urls: ["https://localhost:3000", "https://192.0.2.4:3000"] });
    for (const secret of [ref, prod, adminKey, publishableKey, dbUrl, opts.env.PORTIA_PROMOTION_DEVICE_SECRET]) assert.ok(!line.includes(secret));
    assert.equal(ctx.calls.err.join(""), "");
    const second = serveCase({ tmpdir: ctx.deps.tmpdir });
    assert.equal(await main(["acceptance-serve", runId], second.deps), 0);
    const secondOpts = (second.calls.spawn[0] as [unknown, unknown, { env: Record<string, string> }])[2];
    assert.equal(secondOpts.env.PORTIA_PROMOTION_DEVICE_SECRET, opts.env.PORTIA_PROMOTION_DEVICE_SECRET);
  });
  test("v1 manifest probes its p-cooldown nickname", async () => {
    const ctx = serveCase();
    const nickname = `__portia_live_${runId}_p-cooldown`;
    nodeFs.writeFileSync(ctx.manifestFile, JSON.stringify({ schema: "portia-acceptance-run-v1", runId, refHash, rosterPath: ctx.rosterPath, nicknames: { "p-cooldown": nickname } }));
    assert.equal(await main(["acceptance-serve", runId], ctx.deps), 0);
    assert.ok(ctx.calls.fetch.some((url) => url.includes(encodeURIComponent(nickname))));
  });
  test("malformed v2 manifest cannot authorize a server", async () => {
    const ctx = serveCase();
    nodeFs.writeFileSync(ctx.manifestFile, JSON.stringify({ schema: "portia-acceptance-run-v2", runId, refHash, rosterPath: ctx.rosterPath, nicknames: { probe: "probe" } }));
    assert.equal(await main(["acceptance-serve", runId], ctx.deps), 1);
    assert.match(ctx.calls.err.join(""), /acceptance-manifest-mismatch/u);
    assert.equal(ctx.calls.spawn.length, 0);
  });
});

const scratch = mkdtempSync(path.join(os.tmpdir(), "portia-acceptance-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

// Rows are free-form fake table content.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// In-memory stand-in for supabase-js: only the calls the harness and the acceptance script make.
function createWorld(clock: { ms: number }) {
  const world = {
    users: [] as Array<{ id: string; email: string; app_metadata: Row }>,
    tables: new Map<string, Row[]>(),
    log: [] as string[],
    clients: 0,
    failures: new Set<string>(),
    next: 1,
  };
  const rows = (table: string) => {
    if (!world.tables.has(table)) world.tables.set(table, []);
    return world.tables.get(table)!;
  };
  const cascades: Record<string, Array<[string, string]>> = {
    portia_promo_task_banks: [["portia_promo_task_items", "bank_id"]],
    portia_promo_qualification_banks: [["portia_promo_qualification_questions", "bank_id"]],
    portia_promo_qualification_questions: [["portia_promo_qualification_options", "question_id"]],
  };
  const like = (value: unknown, pattern: string) => {
    let source = "";
    for (let i = 0; i < pattern.length; i += 1) {
      const char = pattern[i];
      if (char === "\\") source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      else if (char === "%") source += ".*";
      else if (char === "_") source += ".";
      else source += char.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    }
    return new RegExp(`^${source}$`, "su").test(String(value ?? ""));
  };
  const removeRows = (table: string, gone: Row[]) => {
    world.tables.set(table, rows(table).filter((row) => !gone.includes(row)));
    for (const [child, column] of cascades[table] ?? []) {
      removeRows(child, rows(child).filter((row) => gone.some((parent) => parent.id === row[column])));
    }
  };
  const from = (table: string) => {
    let mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    let head = false;
    let counted = false;
    let returning = false;
    let columns = "*";
    let payload: Row | Row[] = {};
    const filters: Array<(row: Row) => boolean> = [];
    const project = (row: Row) => (columns === "*" ? row : Object.fromEntries(columns.split(",").map((c) => [c.trim(), row[c.trim()]])));
    const builder = {
      select(cols: string, options?: { count?: string; head?: boolean }) {
        if (mode === "select") {
          head = Boolean(options?.head);
          counted = Boolean(options?.count);
        } else returning = true;
        columns = cols;
        return builder;
      },
      insert(value: Row | Row[]) { mode = "insert"; payload = value; return builder; },
      update(value: Row) { mode = "update"; payload = value; return builder; },
      upsert(value: Row) { mode = "upsert"; payload = value; return builder; },
      delete(options?: { count?: string }) { mode = "delete"; counted = Boolean(options?.count); return builder; },
      like(column: string, pattern: string) { filters.push((row) => like(row[column], pattern)); return builder; },
      in(column: string, values: unknown[]) { filters.push((row) => values.includes(row[column])); return builder; },
      eq(column: string, value: unknown) { filters.push((row) => row[column] === value); return builder; },
      gte(column: string, value: string) { filters.push((row) => String(row[column]) >= value); return builder; },
      not(column: string, _op: string, value: unknown) { filters.push((row) => row[column] !== value && row[column] !== undefined); return builder; },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        world.log.push(`${mode}:${table}`);
        if (world.failures.has(`${mode}:${table}`)) return Promise.resolve({ data: null, count: null, error: { message: "boom" } }).then(resolve, reject);
        const stamp = new Date(clock.ms).toISOString();
        let result: Row;
        if (mode === "insert" || mode === "upsert") {
          const added = (Array.isArray(payload) ? payload : [payload]).map((row) => ({
            id: row.id ?? `${table}-${world.next++}`, created_at: stamp, updated_at: stamp, ...row,
          }));
          rows(table).push(...added);
          result = { data: returning ? added.map(project) : null, error: null };
        } else {
          const matched = rows(table).filter((row) => filters.every((filter) => filter(row)));
          if (mode === "update") for (const row of matched) Object.assign(row, payload);
          if (mode === "delete") removeRows(table, matched);
          result = {
            data: (mode === "select" && !head) || (mode === "update" && returning) ? matched.map(project) : null,
            count: counted ? matched.length : null,
            error: null,
          };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  };
  const makeClient = () => ({
    from,
    storage: { from: () => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ error: null }) }) },
    auth: {
      signInWithPassword: async () => ({ error: null }),
      admin: {
        async createUser(args: Row) {
          const user = { id: `user-${world.next++}`, email: String(args.email), app_metadata: args.app_metadata ?? {} };
          world.users.push(user);
          return { data: { user }, error: null };
        },
        async listUsers() { return { data: { users: world.users.map((user) => ({ ...user })) }, error: null }; },
        async deleteUser(id: string) { world.users = world.users.filter((user) => user.id !== id); return { error: null }; },
      },
    },
  });
  return { world, rows, createClient: (() => { world.clients += 1; return makeClient(); }) as never };
}

const old = "2026-01-01T00:00:00.000Z";

function setup() {
  const clock = { ms: Date.UTC(2026, 10, 2, 12, 0, 0) };
  const fake = createWorld(clock);
  let counter = 0;
  let run: ReturnType<typeof createRun> | undefined;
  const lines: { out: string[]; err: string[] } = { out: [], err: [] };
  const root = mkdtempSync(path.join(scratch, "case-"));
  const deps = {
    env,
    root,
    fs: nodeFs,
    tmpdir: root,
    manifestFile: path.join(root, "manifest.json"),
    createClient: fake.createClient,
    dbNow: async () => new Date(clock.ms).toUTCString(),
    harness: { now: () => clock.ms, random: (n: number) => Buffer.alloc(n, ++counter) },
    createRun: (live: Parameters<typeof createRun>[0], harness: Parameters<typeof createRun>[1]) => (run = createRun(live, harness)),
    out: (text: string) => lines.out.push(text),
    err: (text: string) => lines.err.push(text),
  };
  const manifest = () => JSON.parse(readFileSync(deps.manifestFile, "utf8"));
  return { clock, fake, deps, lines, root, manifest, run: () => run! };
}

async function seeded() {
  const ctx = setup();
  const code = await main(["acceptance-seed"], ctx.deps);
  assert.equal(code, 0, ctx.lines.err.join(""));
  const manifest = ctx.manifest();
  const roster = () => JSON.parse(readFileSync(manifest.rosterPath, "utf8"));
  ctx.fake.world.log.length = 0;
  ctx.lines.out.length = 0;
  return { ...ctx, manifest, roster };
}

describe("acceptance-seed", () => {
  test("creates the identities, participants, banks, manifest and temp files without leaking secrets", async () => {
    const ctx = setup();
    assert.equal(await main(["acceptance-seed"], ctx.deps), 0, ctx.lines.err.join(""));
    const { world, rows } = ctx.fake;
    const run = ctx.run();
    assert.deepEqual(world.users.map((user) => user.email.split("-").pop()), ["reviewer@example.invalid", "editor@example.invalid"]);
    assert.ok(world.users.every((user) => user.app_metadata.portia_run === run.runId));
    const editors = rows("portia_editors");
    assert.deepEqual(editors.map((row) => row.granted_tabs), [["promo"], []]);

    const manifest = ctx.manifest();
    assert.equal(manifest.schema, "portia-acceptance-run-v2");
    assert.equal(manifest.runId, run.runId);
    assert.equal(manifest.createdAtSource, "db");
    assert.deepEqual(manifest.preexisting, { bucketKeys: [], taskBankIds: [], qualificationBankIds: [] });
    assert.equal(Object.keys(manifest.nicknames).length, 13);
    for (const nick of Object.values<string>(manifest.nicknames)) assert.ok(nick.startsWith(`${run.prefix}_`) && nick.length <= 64);

    const roster = JSON.parse(readFileSync(manifest.rosterPath, "utf8"));
    assert.equal(accessRosterFromRows(roster.access).length, 13);
    const entries = promotionRosterFromRows(roster.promotion);
    assert.deepEqual(entries.map((entry) => entry.titleId), ["academic", "trainee", "researcher", "scientist", "trainee", "academic", "academic", "trainee", "researcher", "scientist", "trainee", "academic", "academic"]);
    assert.ok(["pc-ordinary", "ph-ordinary", "probe"].every((label) => manifest.nicknames[label]));
    assert.notEqual(manifest.nicknames["pc-ordinary"], manifest.nicknames["ph-ordinary"]);

    assert.deepEqual(rows("portia_promo_task_banks").map((row) => row.target_title_id), ["trainee"]);
    assert.deepEqual(rows("portia_promo_qualification_banks").map((row) => row.transition_id), ["laboratory-assistant", "assistant", "virologist-specialist"]);
    for (const bank of rows("portia_promo_qualification_banks")) {
      const questions = rows("portia_promo_qualification_questions").filter((q) => q.bank_id === bank.id && q.active);
      for (const [type, quota] of [["single", bank.single_count], ["multiple", bank.multiple_count], ["free-text", bank.free_text_count]] as const) {
        assert.ok(questions.filter((q) => q.question_type === type).length >= quota, `${type} quota`);
      }
    }
    assert.deepEqual(manifest.bankIds.ordinary.length + manifest.bankIds.qualification.length, 4);

    // Passwords only in the temp credentials file; stdout and the manifest carry no run secret.
    const credentials = JSON.parse(readFileSync(manifest.credentialsPath, "utf8"));
    assert.ok(credentials.reviewer.password && credentials.editor.email);
    const stdout = ctx.lines.out.join("");
    const manifestText = readFileSync(ctx.deps.manifestFile, "utf8");
    for (const secret of [...run.secrets(), adminKey, publishableKey, dbUrl, "fake-db-password"]) {
      assert.ok(!stdout.includes(secret), "stdout leaks a secret");
      assert.ok(!manifestText.includes(secret), "manifest leaks a secret");
    }
    const printed = JSON.parse(stdout);
    assert.deepEqual([printed.runId, printed.rosterPath, printed.credentialsPath], [run.runId, manifest.rosterPath, manifest.credentialsPath]);
  });

  test("an existing bank for a seeded title stops the seed before anything is created", async () => {
    const ctx = setup();
    ctx.fake.rows("portia_promo_qualification_banks").push({ id: "foreign", transition_id: "assistant", created_at: old, updated_at: old });
    assert.equal(await main(["acceptance-seed"], ctx.deps), 1);
    assert.ok(ctx.lines.err.join("").includes("[PORTIA_STAGING:acceptance-preexisting-bank]"));
    assert.ok(!ctx.fake.world.log.some((entry) => entry.startsWith("insert:") || entry.startsWith("upsert:")), ctx.fake.world.log.join());
    assert.equal(ctx.fake.world.users.length, 0);
    assert.deepEqual(ctx.fake.rows("portia_promo_qualification_banks").map((row) => row.id), ["foreign"]);
  });

  test("a failure while seeding removes what was already created", async () => {
    const ctx = setup();
    ctx.fake.world.failures.add("insert:portia_promo_qualification_banks");
    assert.equal(await main(["acceptance-seed"], ctx.deps), 1);
    assert.equal(ctx.fake.world.users.length, 0);
    assert.equal(ctx.fake.rows("portia_promo_task_banks").length, 0);
    assert.equal(existsSync(ctx.deps.manifestFile), false);
  });

  test("a production target is refused before any client exists", async () => {
    const ctx = setup();
    const code = await main(["acceptance-seed"], { ...ctx.deps, env: { ...env, PORTIA_E2E_PRODUCTION_PROJECT_IDS: `${prod},${ref}`, PORTIA_E2E_ISOLATED_PROJECT_IDS: "cccccccccccccccccccc" } });
    assert.equal(code, 1);
    assert.equal(ctx.fake.world.clients, 0);
  });

  test("missing DB Date refuses seed before any creation", async () => {
    const ctx = setup();
    assert.equal(await main(["acceptance-seed"], { ...ctx.deps, dbNow: async () => null }), 1);
    assert.match(ctx.lines.err.join(""), /acceptance-db-time-unavailable/u);
    assert.equal(ctx.fake.world.users.length, 0);
    assert.equal(ctx.fake.rows("portia_promo_task_banks").length, 0);
  });
});

describe("acceptance-shift", () => {
  test("cooldown moves the roster date past the cooldown of the row's title and rank changes the title", async () => {
    const ctx = await seeded();
    const nick = ctx.manifest.nicknames["pc-cooldown"];
    const entry = () => promotionRosterFromRows(ctx.roster().promotion).find((item) => item.nickname === nick)!;
    assert.ok(Date.parse(entry().availableFrom) > ctx.clock.ms + 5 * 86_400_000, "promoted yesterday as academic: available in 6 days");
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "cooldown", "pc-cooldown"], ctx.deps), 0, ctx.lines.err.join(""));
    assert.ok(Date.parse(entry().availableFrom) < ctx.clock.ms, "the wait is over after the shift");
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "rank", "pc-ordinary", "trainee"], ctx.deps), 0);
    const ordinary = promotionRosterFromRows(ctx.roster().promotion).find((item) => item.nickname === ctx.manifest.nicknames["pc-ordinary"])!;
    assert.deepEqual([ordinary.titleId, ordinary.nextTitleId], ["trainee", "laboratory-assistant"]);
    assert.equal(ctx.fake.world.log.length, 0, "roster shifts do not touch the database");
  });

  test("penalty and cleanup touch only buckets of the run window", async () => {
    const ctx = await seeded();
    const future = "2027-01-01T00:00:00.000Z";
    ctx.clock.ms += 3_600_000;
    const inside = new Date(ctx.clock.ms).toISOString();
    ctx.fake.rows("portia_promo_attempt_buckets").push(
      { bucket_key: "inside", blocked_until: future, updated_at: inside },
      { bucket_key: "foreign", blocked_until: future, updated_at: old },
    );
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "penalty"], ctx.deps), 0);
    const [insideRow, foreignRow] = ctx.fake.rows("portia_promo_attempt_buckets");
    assert.ok(insideRow.blocked_until < inside);
    assert.equal(foreignRow.blocked_until, future);

    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "cleanup"], ctx.deps), 0);
    assert.ok(Date.parse(insideRow.updated_at) < ctx.clock.ms - 3 * 86_400_000, "older than the 3-day prune rule");
    assert.equal(foreignRow.updated_at, old);
    assert.deepEqual(JSON.parse(readFileSync(ctx.deps.manifestFile, "utf8")).shiftedBucketKeys, ["inside"]);
  });

  test("deadline and retake move only attempts of this run", async () => {
    const ctx = await seeded();
    const prefix = ctx.manifest.nicknames["pc-retake"];
    const future = "2027-01-01T00:00:00.000Z";
    ctx.fake.rows("portia_promo_qualification_requests").push(
      { id: "mine", nickname_key: prefix }, { id: "theirs", nickname_key: "__portia_live_zz9_deadbeef_p1" },
    );
    ctx.fake.rows("portia_promo_attempts").push(
      { id: "a-mine", request_id: "mine", deadline_at: future, retake_at: future },
      { id: "a-theirs", request_id: "theirs", deadline_at: future, retake_at: future },
    );
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "deadline"], ctx.deps), 0);
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "retake", "pc-retake"], ctx.deps), 0);
    const [mine, theirs] = ctx.fake.rows("portia_promo_attempts");
    assert.ok(mine.deadline_at < future && mine.retake_at < future);
    assert.deepEqual([theirs.deadline_at, theirs.retake_at], [future, future]);
  });

  test("IN-02: an inherited object key is an unknown participant label, not a late failure", async () => {
    const ctx = await seeded();
    const id = ctx.manifest.runId;
    for (const argv of [
      ["acceptance-shift", id, "cooldown", "constructor"], ["acceptance-shift", id, "deadline", "constructor"], ["acceptance-shift", id, "retake", "constructor"],
      ["acceptance-shift", id, "rank", "constructor", "trainee"],
    ]) {
      ctx.lines.err.length = 0;
      assert.equal(await main(argv, ctx.deps), 2, argv.join(" "));
      assert.match(ctx.lines.err.join(""), /Unknown participant label for this run/, argv.join(" "));
    }
    assert.equal(ctx.fake.world.log.length, 0);
  });

  test("an unknown kind, a malformed run id or a bad argument give exit 2 without touching the database", async () => {
    const ctx = await seeded();
    const id = ctx.manifest.runId;
    for (const argv of [
      ["acceptance-shift", id, "explode"], ["acceptance-shift", "not-a-run-id", "penalty"], ["acceptance-shift", id, "rank", "pc-ordinary", "king"],
      ["acceptance-shift", id, "cooldown"], ["acceptance-shift", id, "penalty", "x"], ["acceptance-shift", id, "deadline", "Bad Label"],
      ["acceptance-shift", id, "cooldown", "pc-nobody"],
    ]) {
      assert.equal(await main(argv, ctx.deps), 2, argv.join(" "));
    }
    assert.equal(ctx.fake.world.log.length, 0);
    assert.equal(await acceptanceShift({} as never, "x", "penalty", [], ctx.deps), 2);
  });
});

describe("acceptance-residual and acceptance-teardown", () => {
  async function populated() {
    const ctx = await seeded();
    const { rows, world } = ctx.fake;
    const mine = ctx.manifest.nicknames["pc-retake"];
    ctx.clock.ms += 3_600_000;
    const inside = new Date(ctx.clock.ms).toISOString();
    rows("portia_promo_qualification_requests").push({ id: "rq-mine", nickname_key: mine }, { id: "rq-theirs", nickname_key: "__portia_live_zz9_deadbeef_p1" });
    rows("portia_promo_attempts").push({ id: "a-mine", request_id: "rq-mine" }, { id: "a-theirs", request_id: "rq-theirs" });
    rows("portia_promo_answers").push({ id: "ans-mine", attempt_id: "a-mine" }, { id: "ans-theirs", attempt_id: "a-theirs" });
    rows("portia_promo_requests").push({ id: "pr-mine", nickname_key: mine }, { id: "pr-theirs", nickname_key: "__portia_live_zz9_deadbeef_p2" });
    rows("portia_promo_task_banks").push({ id: "old-bank", target_title_id: "scientist", created_at: old, updated_at: old }, { id: "window-bank", target_title_id: "virologist-specialist", created_at: inside, updated_at: inside });
    rows("portia_promo_attempt_buckets").push({ bucket_key: "in-window", updated_at: inside }, { bucket_key: "before", updated_at: old });
    rows("portia_content").push({ id: "keep-1" }, { id: `${ctx.run().prefix}_content` });
    world.users.push({ id: "foreign-user", email: "x@example.invalid", app_metadata: { portia_run: "zz9_deadbeef" } }, { id: "plain-user", email: "y@example.invalid", app_metadata: {} });
    world.log.length = 0;
    ctx.lines.out.length = 0;
    return ctx;
  }
  const lastJson = (ctx: { lines: { out: string[] } }) => JSON.parse(ctx.lines.out.at(-1)!);

  test("residual only reads and counts run rows, banks, window buckets and attempts", async () => {
    const ctx = await populated();
    assert.equal(await main(["acceptance-residual", ctx.manifest.runId], ctx.deps), 0, ctx.lines.err.join(""));
    assert.ok(ctx.fake.world.log.every((entry) => entry.startsWith("select:")), ctx.fake.world.log.join());
    const { residual } = lastJson(ctx);
    assert.deepEqual(
      [residual.promo, residual.authUsers, residual.content, residual.banks, residual.buckets, residual.attempts, residual.answers],
      [2, 2, 1, 5, 1, 1, 1],
    );
  });

  test("teardown removes only the run and its window, leaves чужие записи in place and proves zero residual", async () => {
    const ctx = await populated();
    assert.equal(await main(["acceptance-teardown", ctx.manifest.runId], ctx.deps), 0, ctx.lines.err.join(""));
    const { residual, errors } = lastJson(ctx);
    assert.deepEqual(errors, []);
    assert.ok(Object.values<number>(residual).every((count) => count === 0), JSON.stringify(residual));

    const { rows, world } = ctx.fake;
    assert.deepEqual(world.users.map((user) => user.id), ["foreign-user", "plain-user"]);
    assert.deepEqual(rows("portia_promo_requests").map((row) => row.id), ["pr-theirs"]);
    assert.deepEqual(rows("portia_promo_qualification_requests").map((row) => row.id), ["rq-theirs"]);
    assert.deepEqual(rows("portia_promo_attempts").map((row) => row.id), ["a-theirs"]);
    assert.deepEqual(rows("portia_promo_answers").map((row) => row.id), ["ans-theirs"]);
    assert.deepEqual(rows("portia_promo_task_banks").map((row) => row.id), ["old-bank"]);
    assert.deepEqual(rows("portia_promo_attempt_buckets").map((row) => row.bucket_key), ["before"]);
    assert.deepEqual(rows("portia_content").map((row) => row.id), ["keep-1"]);
    for (const child of ["portia_promo_task_items", "portia_promo_qualification_banks", "portia_promo_qualification_questions", "portia_promo_qualification_options"]) {
      assert.equal(rows(child).length, 0, child);
    }
    assert.equal(existsSync(ctx.manifest.rosterPath), false, "temp roster and credentials are removed");
  });

  test("a bank that survives the deletion gives exit 1 and a non-zero banks counter", async () => {
    const ctx = await populated();
    ctx.fake.world.failures.add("delete:portia_promo_task_banks");
    assert.equal(await main(["acceptance-teardown", ctx.manifest.runId], ctx.deps), 1);
    const { residual, errors } = lastJson(ctx);
    assert.ok(residual.banks > 0);
    assert.ok(errors.length > 0);
    assert.deepEqual(ctx.fake.rows("portia_promo_qualification_banks"), [], "later steps still ran");
    assert.equal(existsSync(ctx.manifest.rosterPath), true, "temp files stay while anything is left");
  });

  test("IN-04: a dirty teardown prints the work directory path and no secrets, a clean one does not", async () => {
    const dirty = await populated();
    dirty.fake.world.failures.add("delete:portia_promo_task_banks");
    assert.equal(await main(["acceptance-teardown", dirty.manifest.runId], dirty.deps), 1);
    const stderr = dirty.lines.err.join("");
    assert.match(stderr, /\[PORTIA_STAGING:residual\] рабочий каталог не удалён: /);
    assert.ok(stderr.includes(path.dirname(dirty.manifest.rosterPath)), stderr);
    assert.ok(!stderr.includes(adminKey) && !stderr.includes("fake-db-password"));
    assert.equal(existsSync(dirty.manifest.rosterPath), true);

    const clean = await populated();
    assert.equal(await main(["acceptance-teardown", clean.manifest.runId], clean.deps), 0, clean.lines.err.join(""));
    assert.doesNotMatch(clean.lines.err.join(""), /рабочий каталог не удалён/);
  });

  test("preexisting bucket in the window is neither shifted nor deleted", async () => {
    const ctx = setup();
    const future = "2027-01-01T00:00:00.000Z";
    ctx.fake.rows("portia_promo_attempt_buckets").push({ bucket_key: "foreign", blocked_until: future, updated_at: old });
    ctx.fake.rows("portia_promo_task_banks").push({ id: "foreign-bank", target_title_id: "scientist", created_at: old, updated_at: old });
    assert.equal(await main(["acceptance-seed"], ctx.deps), 0, ctx.lines.err.join(""));
    const manifest = ctx.manifest();
    assert.deepEqual(manifest.preexisting, { bucketKeys: ["foreign"], taskBankIds: ["foreign-bank"], qualificationBankIds: [] });
    const inWindow = new Date(ctx.clock.ms + 60_000).toISOString();
    ctx.fake.rows("portia_promo_attempt_buckets")[0].updated_at = inWindow;
    ctx.fake.rows("portia_promo_task_banks")[0].created_at = inWindow;
    ctx.fake.rows("portia_promo_attempt_buckets").push({ bucket_key: "mine", blocked_until: future, updated_at: inWindow });
    ctx.fake.rows("portia_promo_task_banks").push({ id: "window-bank", target_title_id: "scientist", created_at: inWindow, updated_at: inWindow });
    assert.equal(await main(["acceptance-shift", manifest.runId, "penalty"], ctx.deps), 0);
    assert.equal(await main(["acceptance-shift", manifest.runId, "cleanup"], ctx.deps), 0);
    assert.equal(ctx.fake.rows("portia_promo_attempt_buckets")[0].blocked_until, future);
    assert.equal(ctx.fake.rows("portia_promo_attempt_buckets")[0].updated_at, inWindow);
    assert.notEqual(ctx.fake.rows("portia_promo_attempt_buckets")[1].blocked_until, future);
    assert.equal(await main(["acceptance-residual", manifest.runId], ctx.deps), 0);
    const before = lastJson(ctx).residual;
    assert.equal(before.buckets, 1);
    assert.equal(before.banks, 5);
    assert.equal(await main(["acceptance-teardown", manifest.runId], ctx.deps), 0);
    assert.deepEqual(ctx.fake.rows("portia_promo_attempt_buckets").map((row) => row.bucket_key), ["foreign"]);
    assert.deepEqual(ctx.fake.rows("portia_promo_task_banks").map((row) => row.id), ["foreign-bank"]);
    assert.equal(lastJson(ctx).residual.buckets, 0);
    assert.equal(lastJson(ctx).residual.banks, 0);
  });

  test("v1 manifest keeps legacy window behavior and reports legacyWindow", async () => {
    const ctx = await populated();
    nodeFs.writeFileSync(ctx.deps.manifestFile, JSON.stringify({ ...ctx.manifest, schema: "portia-acceptance-run-v1", preexisting: undefined }));
    assert.equal(await main(["acceptance-residual", ctx.manifest.runId], ctx.deps), 0);
    assert.equal(lastJson(ctx).legacyWindow, true);
  });

  test("a manifest of another run is refused", async () => {
    const ctx = await populated();
    assert.equal(await main(["acceptance-teardown", "abc_00000000"], ctx.deps), 1);
    assert.ok(ctx.lines.err.join("").includes("acceptance-manifest-mismatch"));
    assert.ok(ctx.fake.world.log.length === 0);
  });
});
