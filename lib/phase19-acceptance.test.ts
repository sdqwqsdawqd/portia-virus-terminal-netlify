import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
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
    assert.equal(manifest.schema, "portia-acceptance-run-v1");
    assert.equal(manifest.runId, run.runId);
    assert.equal(Object.keys(manifest.nicknames).length, 6);
    for (const nick of Object.values<string>(manifest.nicknames)) assert.ok(nick.startsWith(`${run.prefix}_p-`) && nick.length <= 64);

    const roster = JSON.parse(readFileSync(manifest.rosterPath, "utf8"));
    assert.equal(accessRosterFromRows(roster.access).length, 6);
    const entries = promotionRosterFromRows(roster.promotion);
    assert.deepEqual(entries.map((entry) => entry.titleId), ["academic", "trainee", "researcher", "scientist", "trainee", "academic"]);

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
});

describe("acceptance-shift", () => {
  test("cooldown moves the roster date past the cooldown of the row's title and rank changes the title", async () => {
    const ctx = await seeded();
    const nick = ctx.manifest.nicknames["p-cooldown"];
    const entry = () => promotionRosterFromRows(ctx.roster().promotion).find((item) => item.nickname === nick)!;
    assert.ok(Date.parse(entry().promotedAt) > ctx.clock.ms - 2 * 86_400_000);
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "cooldown", "p-cooldown"], ctx.deps), 0, ctx.lines.err.join(""));
    assert.ok(ctx.clock.ms - Date.parse(entry().promotedAt) > 7 * 86_400_000, "academic cooldown is 7 days");
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "rank", "p-ordinary", "trainee"], ctx.deps), 0);
    const ordinary = promotionRosterFromRows(ctx.roster().promotion).find((item) => item.nickname === ctx.manifest.nicknames["p-ordinary"])!;
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
    const prefix = ctx.manifest.nicknames["p-retake"];
    const future = "2027-01-01T00:00:00.000Z";
    ctx.fake.rows("portia_promo_qualification_requests").push(
      { id: "mine", nickname_key: prefix }, { id: "theirs", nickname_key: "__portia_live_zz9_deadbeef_p1" },
    );
    ctx.fake.rows("portia_promo_attempts").push(
      { id: "a-mine", request_id: "mine", deadline_at: future, retake_at: future },
      { id: "a-theirs", request_id: "theirs", deadline_at: future, retake_at: future },
    );
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "deadline"], ctx.deps), 0);
    assert.equal(await main(["acceptance-shift", ctx.manifest.runId, "retake", "p-retake"], ctx.deps), 0);
    const [mine, theirs] = ctx.fake.rows("portia_promo_attempts");
    assert.ok(mine.deadline_at < future && mine.retake_at < future);
    assert.deepEqual([theirs.deadline_at, theirs.retake_at], [future, future]);
  });

  test("an unknown kind, a malformed run id or a bad argument give exit 2 without touching the database", async () => {
    const ctx = await seeded();
    const id = ctx.manifest.runId;
    for (const argv of [
      ["acceptance-shift", id, "explode"], ["acceptance-shift", "not-a-run-id", "penalty"], ["acceptance-shift", id, "rank", "p-ordinary", "king"],
      ["acceptance-shift", id, "cooldown"], ["acceptance-shift", id, "penalty", "x"], ["acceptance-shift", id, "deadline", "Bad Label"],
      ["acceptance-shift", id, "cooldown", "p-nobody"],
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
    const mine = ctx.manifest.nicknames["p-retake"];
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

  test("a manifest of another run is refused", async () => {
    const ctx = await populated();
    assert.equal(await main(["acceptance-teardown", "abc_00000000"], ctx.deps), 1);
    assert.ok(ctx.lines.err.join("").includes("acceptance-manifest-mismatch"));
    assert.ok(ctx.fake.world.log.length === 0);
  });
});
