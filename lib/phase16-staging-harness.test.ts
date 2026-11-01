import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  assertRedacted,
  buildReceipt,
  createRun,
  isStagingLiveInvocation,
  ownerEmailFromBaseline,
  OwnerFixtureForeignError,
  requireStagingLiveTarget,
  sweep,
  writeReceipt,
  type StagingLiveTarget,
} from "../tests/e2e/fixtures/staging-harness.ts";

const projectId = "abcdefghijklmnopqrst";
const adminKey = "fake-admin-key-000";
const publishableKey = "fake-publishable-key-000";
const safeEnvironment = {
  PORTIA_E2E_MUTATION_CONFIRM: "ISOLATED_TEST_PROJECT",
  PORTIA_E2E_TARGET_ENVIRONMENT: "isolated-test",
  PORTIA_E2E_TARGET_ID: projectId,
  PORTIA_E2E_SUPABASE_URL: `https://${projectId}.supabase.co/`,
  PORTIA_E2E_PRODUCTION_PROJECT_IDS: "productionproject000",
  PORTIA_E2E_ISOLATED_PROJECT_IDS: projectId,
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectId}.supabase.co`,
  PORTIA_PROMO_LIVE_CONFIRM: "ISOLATED_TEST_PROJECT",
  PORTIA_PROMO_LIVE_URL: `https://${projectId}.supabase.co`,
  PORTIA_PROMO_LIVE_ANON_KEY: publishableKey,
  PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY: adminKey,
};

type Row = Record<string, unknown>;
type Fail = { error: { message: string; code?: string } };

// In-memory stand-in for supabase-js: just the calls the harness makes.
function createWorld() {
  const world = {
    users: [] as Array<{ id: string; email: string; password: string; app_metadata: Record<string, unknown> }>,
    tables: new Map<string, Row[]>(),
    objects: new Set<string>(),
    log: [] as string[],
    signIns: 0,
    createUserArgs: [] as Row[],
    clientsMade: 0,
    failures: new Map<string, Fail>(),
    nextId: 1,
  };
  const rows = (table: string) => {
    if (!world.tables.has(table)) world.tables.set(table, []);
    return world.tables.get(table)!;
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
  const from = (table: string) => {
    let mode: "select" | "delete" | "upsert" = "select";
    let head = false;
    let counted = false;
    let payload: Row | undefined;
    let selected = "*";
    const filters: Array<(row: Row) => boolean> = [];
    const builder = {
      select(columns: string, options?: { count?: string; head?: boolean }) {
        selected = columns;
        head = Boolean(options?.head);
        counted = Boolean(options?.count);
        return builder;
      },
      delete(options?: { count?: string }) {
        mode = "delete";
        counted = Boolean(options?.count);
        return builder;
      },
      upsert(row: Row) {
        mode = "upsert";
        payload = row;
        return builder;
      },
      like(column: string, pattern: string) {
        filters.push((row) => like(row[column], pattern));
        return builder;
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        world.log.push(`${mode}:${table}`);
        const failure = world.failures.get(`${mode}:${table}`);
        if (failure) return Promise.resolve({ data: null, count: null, ...failure }).then(resolve, reject);
        const table_ = rows(table);
        let result: Row;
        if (mode === "upsert") {
          table_.push(payload!);
          result = { data: null, error: null };
        } else {
          const matched = table_.filter((row) => filters.every((filter) => filter(row)));
          if (mode === "delete") world.tables.set(table, table_.filter((row) => !matched.includes(row)));
          result = {
            data: mode === "select" && !head ? matched.map((row) => (selected === "*" ? row : { [selected]: row[selected] })) : null,
            count: counted ? matched.length : null,
            error: null,
          };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  };
  const auth = {
    admin: {
      async createUser(args: Row) {
        world.log.push("createUser");
        world.createUserArgs.push(args);
        const failure = world.failures.get("createUser");
        if (failure) return { data: null, ...failure };
        const user = { id: `u${world.nextId++}`, email: String(args.email), password: String(args.password), app_metadata: (args.app_metadata ?? {}) as Row };
        world.users.push(user);
        return { data: { user }, error: null };
      },
      async listUsers() {
        return { data: { users: world.users.map((user) => ({ ...user })) }, error: null };
      },
      async deleteUser(id: string) {
        world.log.push("deleteUser");
        const failure = world.failures.get("deleteUser");
        if (failure) return failure;
        world.users = world.users.filter((user) => user.id !== id);
        return { error: null };
      },
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      world.signIns += 1;
      const ok = world.users.some((user) => user.email === email && user.password === password);
      return ok ? { data: {}, error: null } : { data: null, error: { message: "bad login" } };
    },
  };
  const storage = {
    from: () => ({
      async list(path: string, options: { limit: number; offset: number }) {
        world.log.push("list:storage");
        const base = path ? `${path}/` : "";
        const seen = new Map<string, boolean>();
        for (const object of world.objects) {
          if (!object.startsWith(base)) continue;
          const rest = object.slice(base.length).split("/");
          seen.set(rest[0], rest.length > 1);
        }
        const entries = [...seen].map(([name, folder]) => ({ name, id: folder ? null : "x" }));
        return { data: entries.slice(options.offset, options.offset + options.limit), error: null };
      },
      async remove(paths: string[]) {
        world.log.push("remove:storage");
        for (const path of paths) world.objects.delete(path);
        return { data: [], error: null };
      },
    }),
  };
  const factory = () => {
    world.clientsMade += 1;
    return { auth, from, storage } as never;
  };
  return { world, factory, rows };
}

const live = (): StagingLiveTarget => requireStagingLiveTarget(safeEnvironment);
const fixedDeps = (factory: () => never, now = Date.UTC(2026, 10, 1)) => ({
  createClient: factory,
  now: () => now,
  random: (bytes: number) => Buffer.alloc(bytes, 0xab),
  commit: () => "c".repeat(40),
});
const newRun = () => {
  const fake = createWorld();
  return { ...fake, run: createRun(live(), fixedDeps(fake.factory)) };
};

describe("requireStagingLiveTarget", () => {
  test("refuses without a safe environment", () => {
    assert.throws(() => requireStagingLiveTarget({}), /PORTIA_E2E_TARGET_BLOCKED/);
  });
  test("refuses a missing live confirmation, a foreign live host and missing keys, naming variables only", () => {
    const refuse = (patch: Record<string, string | undefined>, code: string) => {
      assert.throws(
        () => requireStagingLiveTarget({ ...safeEnvironment, ...patch }),
        (error: Error) => error.message.includes(code) && !error.message.includes(adminKey) && !error.message.includes(publishableKey),
      );
    };
    refuse({ PORTIA_PROMO_LIVE_CONFIRM: undefined }, "live-confirmation");
    refuse({ PORTIA_PROMO_LIVE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }, "live-target-mismatch");
    refuse({ PORTIA_PROMO_LIVE_URL: undefined }, "live-target-mismatch");
    refuse({ PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY: undefined }, "live-keys");
    refuse({ PORTIA_PROMO_LIVE_ANON_KEY: "" }, "live-keys");
  });
  test("refuses a production-listed project and an external base URL", () => {
    assert.throws(() => requireStagingLiveTarget({ ...safeEnvironment, PORTIA_E2E_PRODUCTION_PROJECT_IDS: projectId }), /production-project|list-overlap/);
    assert.throws(() => requireStagingLiveTarget({ ...safeEnvironment, PORTIA_E2E_BASE_URL: "https://example.test" }), /external-base-url/);
  });
  test("returns target, keys and a 12-hex ref hash", () => {
    const result = live();
    assert.equal(result.target.projectId, projectId);
    assert.match(result.refHash, /^[0-9a-f]{12}$/);
    assert.equal(result.adminKey, adminKey);
  });
  test("npm lifecycle gate accepts only test:staging-live scripts", () => {
    assert.equal(isStagingLiveInvocation({ npm_lifecycle_event: "test:staging-live:tracer" }), true);
    assert.equal(isStagingLiveInvocation({ npm_lifecycle_event: "test" }), false);
    assert.equal(isStagingLiveInvocation({}), false);
  });
});

describe("tracer: guard -> identity -> sign-in -> role call -> cleanup -> receipt", () => {
  test("run id and names", () => {
    const { run } = newRun();
    assert.match(run.runId, /^[0-9a-z]+_[0-9a-f]{8}$/);
    assert.equal(run.runId.endsWith("abababab"), true);
    assert.equal(run.prefix, `__portia_live_${run.runId}`);
    assert.ok(run.prefix.length <= 48);
    assert.equal(run.emailOf("editor-full"), `portia-live-${run.runId}-editor-full@example.invalid`);
  });

  test("identity is admin-created, marked, signed in once and the session is reused", async () => {
    const { run, world } = newRun();
    await run.createIdentity("editor-full", { closedTabs: [], grantedTabs: [] });
    assert.equal(world.createUserArgs[0].email_confirm, true);
    assert.deepEqual(world.createUserArgs[0].app_metadata, { portia_run: run.runId });
    assert.equal(world.signIns, 1);
    const first = run.client("editor-full");
    assert.equal(run.client("editor-full"), first);
    assert.equal(world.signIns, 1);
    assert.equal(run.client("anon"), run.client("anon"));
    assert.throws(() => run.client("nobody"), /unknown-identity-label/);
    assert.deepEqual(run.created, { authUsers: 1, editors: 1 });
  });

  test("cleanup removes the identity, residual is 0 and the receipt passes", async () => {
    const { run, world } = newRun();
    await run.createIdentity("editor-full", { grantedTabs: ["promo"] });
    const deleted = await run.cleanup();
    assert.equal(deleted.authUsers, 1);
    assert.equal(deleted.editors, 1);
    assert.equal(world.users.length, 0);
    assert.deepEqual(await run.residual(), { promo: 0, editors: 0, storage: 0, content: 0, authUsers: 0 });
    const receipt = await buildReceipt(run, { roles: "PASS" });
    assert.equal(receipt.status, "PASS");
    assert.equal(receipt.commit, "c".repeat(40));
  });

  test("a failing admin step throws, later steps still run, residual shows it and the receipt fails", async () => {
    const { run, world } = newRun();
    await run.createIdentity("editor-full", { grantedTabs: ["promo"] });
    world.failures.set("delete:portia_editors", { error: { message: "boom" } });
    await assert.rejects(() => run.cleanup(), /cleanup-failed/);
    assert.equal(world.users.length, 0, "auth user step still ran");
    assert.equal((await run.residual()).editors, 1, "the failed delete left the row and residual reports it");
    const receipt = await buildReceipt(run, { roles: "PASS" });
    assert.equal(receipt.status, "FAIL");
  });

  test("a denied admin grant is reported as admin-grant-missing", async () => {
    const { run, world } = newRun();
    world.failures.set("upsert:portia_editors", { error: { message: "denied", code: "42501" } });
    await assert.rejects(() => run.createIdentity("editor-full", { grantedTabs: ["promo"] }), /admin-grant-missing/);
  });
});

describe("owner fixture (D4)", () => {
  const owner = ownerEmailFromBaseline();

  test("the canonical email is read from the baseline function body", () => {
    assert.match(owner, /^[^@\s]+@[^@\s]+$/);
    assert.equal(owner, owner.toLowerCase());
  });
  test("rejects a missing function and an ambiguous body", () => {
    assert.throws(() => ownerEmailFromBaseline("select 1;"), /owner-email-function-not-found/);
    const body = (inner: string) => `create or replace function public.portia_owner_email() returns text language sql as $$ ${inner} $$;`;
    assert.throws(() => ownerEmailFromBaseline(body("select 'a@b.c' || 'd@e.f';")), /ambiguous/);
    assert.throws(() => ownerEmailFromBaseline(body("select 'no-at-sign'::text;")), /ambiguous/);
    assert.equal(ownerEmailFromBaseline(body("select 'A@B.C'::text;")), "a@b.c");
  });
  test("creates the fixture with the run marker when absent", async () => {
    const { run, world } = newRun();
    await run.createOwnerFixture();
    assert.equal(world.users[0].email, owner);
    assert.deepEqual(world.users[0].app_metadata, { portia_run: run.runId });
    await run.cleanup();
    assert.equal(world.users.length, 0);
  });
  test("replaces a fixture left by an older run", async () => {
    const { run, world } = newRun();
    world.users.push({ id: "old", email: owner, password: "x", app_metadata: { portia_run: "aaaa_00000000" } });
    await run.createOwnerFixture();
    assert.equal(world.users.length, 1);
    assert.equal(world.users[0].app_metadata.portia_run, run.runId);
  });
  test("refuses an unmarked owner account and changes nothing", async () => {
    const { run, world } = newRun();
    world.users.push({ id: "real", email: owner.toUpperCase(), password: "x", app_metadata: {} });
    await assert.rejects(() => run.createOwnerFixture(), (error: unknown) => error instanceof OwnerFixtureForeignError);
    assert.equal(world.users.length, 1);
    assert.equal(world.log.includes("deleteUser"), false);
    assert.equal(world.log.includes("createUser"), false);
  });
});

describe("cleanup order, residual and sweep", () => {
  test("deletes in dependency order and counts deleted rows per category", async () => {
    const { run, world, rows } = newRun();
    await run.createIdentity("reviewer", { grantedTabs: ["promo"] });
    const nick = `${run.prefix}_a`;
    rows("portia_promo_audit_events").push({ nickname_key: nick });
    rows("portia_promo_results").push({ nickname_key: nick });
    rows("portia_promo_qualification_requests").push({ id: "q1", nickname_key: nick });
    rows("portia_promo_attempts").push({ id: "at1", request_id: "q1" });
    rows("portia_promo_attempt_questions").push({ attempt_id: "at1" });
    rows("portia_promo_answers").push({ attempt_id: "at1" });
    rows("portia_promo_requests").push({ nickname_key: nick });
    rows("portia_promo_device_bindings").push({ nickname_key: nick });
    rows("portia_promo_attempt_buckets").push({ bucket_key: `${run.prefix}:bucket:a` });
    rows("portia_promo_task_banks").push({ target_title_id: `${run.prefix}_title` });
    rows("portia_content").push({ id: `${run.prefix}_c` });
    rows("portia_employee_profiles").push({ employee_id: `${run.prefix}_e` });
    world.objects.add(`${run.prefix}/nested/a.png`);
    world.objects.add(`${run.prefix}/b.png`);
    const before = await run.residual();
    assert.equal(before.promo, 7);
    assert.equal(before.storage, 2);
    assert.equal(before.content, 2);
    assert.equal(before.authUsers, 1);
    world.log.length = 0;
    const deleted = await run.cleanup();
    const order = ["delete:portia_promo_answers", "delete:portia_promo_attempt_questions", "delete:portia_promo_attempts", "delete:portia_promo_audit_events", "delete:portia_promo_results",
      "delete:portia_promo_qualification_requests", "delete:portia_promo_requests", "delete:portia_promo_device_bindings",
      "delete:portia_promo_attempt_buckets", "delete:portia_promo_task_banks", "delete:portia_editors", "remove:storage", "delete:portia_content",
      "delete:portia_employee_profiles", "deleteUser"];
    const at = order.map((entry) => world.log.indexOf(entry));
    assert.ok(at.every((index) => index >= 0), `missing step in ${JSON.stringify(at)}`);
    assert.deepEqual(at, [...at].sort((a, b) => a - b));
    assert.deepEqual(deleted, { promo: 7 + 3, editors: 1, storage: 2, content: 2, authUsers: 1 });
    assert.deepEqual(await run.residual(), { promo: 0, editors: 0, storage: 0, content: 0, authUsers: 0 });
  });

  test("any residual fails the receipt; SKIP and BLOCKED never pass; cleanup is required", async () => {
    const { run, rows } = newRun();
    await run.cleanup();
    assert.equal((await buildReceipt(run, { a: "PASS", b: "SKIP" })).status, "SKIP");
    assert.equal((await buildReceipt(run, { a: "PASS", b: "BLOCKED" })).status, "BLOCKED");
    assert.equal((await buildReceipt(run, { a: "PASS", b: "FAIL", c: "BLOCKED" })).status, "FAIL");
    assert.equal((await buildReceipt(run, {})).status, "BLOCKED");
    rows("portia_content").push({ id: `${run.prefix}_left` });
    assert.equal((await buildReceipt(run, { a: "PASS" })).status, "FAIL");
    const fresh = newRun();
    assert.equal((await buildReceipt(fresh.run, { a: "PASS" })).status, "FAIL", "cleanup never ran");
  });

  test("LIKE wildcards in the prefix do not match unrelated rows", async () => {
    const { run, rows } = newRun();
    rows("portia_content").push({ id: run.prefix.replace("__", "xx") }, { id: `${run.prefix}_mine` });
    await run.cleanup();
    assert.deepEqual(rows("portia_content"), [{ id: run.prefix.replace("__", "xx") }]);
  });

  test("sweep removes only stale run resources and never an unmarked user", async () => {
    const { world, rows, factory } = newRun();
    const now = Date.UTC(2026, 10, 1);
    const oldId = `${(now - 7_200_000).toString(36)}_0000000a`;
    const freshId = `${(now - 60_000).toString(36)}_0000000b`;
    world.users.push(
      { id: "old", email: "x@example.invalid", password: "x", app_metadata: { portia_run: oldId } },
      { id: "fresh", email: "y@example.invalid", password: "x", app_metadata: { portia_run: freshId } },
      { id: "plain", email: "z@example.invalid", password: "x", app_metadata: {} },
    );
    rows("portia_promo_device_bindings").push({ nickname_key: `__portia_live_${oldId}_a` }, { nickname_key: `__portia_live_${freshId}_a` }, { nickname_key: "real-person" });
    rows("portia_editors").push({ email: `portia-live-${oldId}-x@example.invalid` });
    world.objects.add(`__portia_live_${oldId}/f.png`);
    world.objects.add("unrelated/f.png");
    const result = await sweep(live(), 3_600_000, fixedDeps(factory, now));
    assert.deepEqual(result.swept, [oldId]);
    assert.deepEqual(world.users.map((user) => user.id).sort(), ["fresh", "plain"]);
    assert.deepEqual(rows("portia_promo_device_bindings").map((row) => row.nickname_key), [`__portia_live_${freshId}_a`, "real-person"]);
    assert.equal(rows("portia_editors").length, 0);
    assert.deepEqual([...world.objects].sort(), ["unrelated/f.png"]);
  });
});

describe("receipt redaction", () => {
  test("receipt shape, hash and written file", async () => {
    const { run } = newRun();
    await run.cleanup();
    const receipt = await buildReceipt(run, { roles: "PASS" });
    assert.equal(receipt.schema, "portia-staging-receipt-v1");
    assert.match(receipt.refHash, /^[0-9a-f]{12}$/);
    assert.match(receipt.sha256, /^[0-9a-f]{64}$/);
    const root = mkdtempSync(join(tmpdir(), "portia-receipt-"));
    const path = writeReceipt(receipt, run.secrets(), "roles", root);
    assert.ok(path.endsWith(join("test-results", "staging", `receipt-roles-${run.runId}.json`)));
    const saved = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(saved.sha256, receipt.sha256);
    assert.throws(() => writeReceipt(receipt, [], "../roles", root), /invalid-receipt-name/);
  });

  test("assertRedacted rejects secrets, ref, host, emails, tokens and connection URLs", async () => {
    const { run } = newRun();
    const secrets = [...run.secrets(), "hunter2-password"];
    const base = { runId: run.runId, note: "" };
    assertRedacted(base, secrets);
    const bad = [adminKey, publishableKey, projectId, `${projectId}.supabase.co`, "hunter2-password", "someone@example.invalid", "eyJhbGciOi", "sb_secret_x",
      "sb_publishable_x", "postgres://u:p@h/db", "postgresql://h/db"];
    for (const value of bad) {
      assert.throws(() => assertRedacted({ ...base, note: `x ${value} y` }, secrets), /receipt-not-redacted/, value);
    }
  });
});
