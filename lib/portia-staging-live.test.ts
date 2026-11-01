import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReceipt,
  createRun,
  isStagingLiveInvocation,
  requireStagingLiveTarget,
  writeReceipt,
  type Grants,
  type Run,
  type StagingLiveTarget,
  type SuiteStatus,
} from "../tests/e2e/fixtures/staging-harness.ts";

// Live role/RLS/RPC/Storage matrix (plan 16-08). Expectations come only from tests/e2e/fixtures/data/expected-authz.json, which is
// derived from the baseline SQL. Every behavioural call uses the client of the role under test; the admin client only seeds fixtures,
// revokes access and reads final state (Pitfall 12). Outside `npm run test:staging-live*` this file registers a skip and mutates nothing.
// The live run itself belongs to plan 16-12; until then this suite is BLOCKED, not passed.

type ErrorLike = { code?: string; message?: string; status?: number; statusCode?: string | number } | null | undefined;
type Observed = { error?: ErrorLike; rows?: number; data?: unknown };

/** Maps a supabase-js result to the outcome vocabulary of expected-authz.json. */
function classify(observed: Observed): string {
  const { error } = observed;
  if (error) {
    const http = Number(error.statusCode ?? error.status);
    if (Number.isInteger(http) && http >= 100) {
      return http === 403 || /row-level security/iu.test(error.message ?? "") ? "rls-deny" : `http-${http}`;
    }
    if (error.code === "42501") return /row-level security/iu.test(error.message ?? "") ? "rls-deny" : "42501";
    if (error.code === "P0001") {
      if (/\bowner-required\b/u.test(error.message ?? "")) return "owner-required";
      if (/\bforbidden\b/u.test(error.message ?? "")) return "forbidden";
      return "P0001";
    }
    return error.code ?? "unknown";
  }
  return observed.rows === 0 ? "rls-empty" : "allow";
}

describe("outcome classifier", () => {
  test("splits permission errors from row-level security and from raised exceptions", () => {
    assert.equal(classify({ error: { code: "42501", message: 'permission denied for table "portia_editors"' } }), "42501");
    assert.equal(classify({ error: { code: "42501", message: 'new row violates row-level security policy for table "portia_content"' } }), "rls-deny");
    assert.equal(classify({ error: { code: "P0001", message: "forbidden" } }), "forbidden");
    assert.equal(classify({ error: { code: "P0001", message: "owner-required" } }), "owner-required");
    assert.equal(classify({ error: { code: "P0001", message: "invalid-bank-command" } }), "P0001");
    assert.equal(classify({ error: { code: "23505", message: "duplicate key" } }), "23505");
    assert.equal(classify({ error: { message: "no code" } }), "unknown");
  });

  test("an empty result without an error is rls-empty only when a row count was observed", () => {
    assert.equal(classify({ rows: 0 }), "rls-empty");
    assert.equal(classify({ rows: 1 }), "allow");
    assert.equal(classify({ data: false }), "allow");
    assert.equal(classify({}), "allow");
  });

  test("exactly one live subtest carries the filter word, besides the blocked-guard failure that the filter must not hide", () => {
    const source = readFileSync(new URL(import.meta.url), "utf8");
    const named = [...source.matchAll(/\b(check|test)\(\s*"([^"]*tracer[^"]*)"/gu)].map((match) => `${match[1]}:${match[2]}`);
    assert.deepEqual(named, ["test:tracer guard: isolated staging target is required", "check:tracer: anon portia_content select"]);
  });

  test("Storage statuses become rls-deny or http-NNN", () => {
    assert.equal(classify({ error: { message: "new row violates row-level security policy", status: 400, statusCode: "403" } }), "rls-deny");
    assert.equal(classify({ error: { message: "Unauthorized", status: 403 } }), "rls-deny");
    assert.equal(classify({ error: { message: "The object exceeded the maximum allowed size", status: 413, statusCode: "413" } }), "http-413");
    assert.equal(classify({ error: { message: "mime type text/plain is not supported", statusCode: "415" } }), "http-415");
  });
});

// ---- matrix model ----

type Cell = { outcome: string; source: string; returns?: boolean; message?: string; verify_live?: boolean };
type FunctionSpec = {
  key: string;
  name: string;
  args: Record<string, unknown>;
  creates_rows: boolean;
  cells: Record<string, Cell>;
  variants?: Array<{ label: string; args: Record<string, unknown>; cells: Record<string, Cell> }>;
};
type TableSpec = {
  name: string;
  pk: string;
  pk_kind?: string;
  target?: string;
  seed?: Record<string, unknown>;
  probes?: Record<string, Record<string, unknown>>;
  ops: Record<string, Record<string, Cell>>;
};
type Matrix = {
  roles: Record<string, { grants?: Grants; owner_fixture?: boolean }>;
  placeholders: string[];
  functions: FunctionSpec[];
  tables: TableSpec[];
  storage: { bucket: string; ops: Record<string, Record<string, Cell>> };
};

const matrix = JSON.parse(readFileSync(new URL("../tests/e2e/fixtures/data/expected-authz.json", import.meta.url), "utf8")) as Matrix;
const roles = Object.keys(matrix.roles);
const tableOps = ["select", "insert", "update", "delete", "update-other-column"];
const storageOps = ["read", "insert", "insert-oversize", "insert-bad-mime", "update", "delete"];
const inertUuid = "00000000-0000-4000-8000-000000000000";
const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const suiteName = process.env.npm_lifecycle_event === "test:staging-live:tracer" ? "roles-tracer" : "roles";

function diffSets(actual: readonly string[], expected: readonly string[]) {
  const have = new Set(actual);
  const want = new Set(expected);
  return { missing: expected.filter((item) => !have.has(item)), extra: actual.filter((item) => !want.has(item)) };
}

if (!isStagingLiveInvocation()) {
  test("staging live role matrix (skipped: run npm run test:staging-live)", { skip: "mutating live suite; not run by npm test" }, () => {});
} else {
  let target: StagingLiveTarget | undefined;
  let blocked = "";
  try {
    target = requireStagingLiveTarget();
  } catch (error) {
    blocked = error instanceof Error ? error.message : "unknown guard failure";
  }
  // Named "tracer" so the tracer filter of test:staging-live:tracer can never hide a blocked guard (never a silent pass).
  if (!target) test("tracer guard: isolated staging target is required", () => assert.fail(`staging-live blocked: ${blocked}`));
  else registerLiveSuite(target);
}

function registerLiveSuite(live: StagingLiveTarget) {
  describe("staging live role matrix", () => {
    type Ctx = { run: Run; manualIds: Set<string>; inserted: Map<string, string> };
    let ctx: Ctx | undefined;
    const stats = { passed: 0, failed: 0 };
    const env = () => {
      if (!ctx) throw new Error("before hook did not finish");
      return ctx;
    };

    const vars = (role: string): Record<string, string> => {
      const { run } = env();
      return {
        prefix: run.prefix,
        runId: run.runId,
        role,
        n: String(roles.indexOf(role)),
        digits: String(Number.parseInt(run.runId.split("_")[1], 16)),
        token: createHash("sha256").update(`${run.prefix}:${role}`).digest("hex"),
        inertUuid,
      };
    };
    // Substitutes {placeholder} inside string values; an unknown placeholder is a matrix bug, not something to ignore.
    const fill = <T>(value: T, role: string): T => {
      const known = vars(role);
      return JSON.parse(
        JSON.stringify(value ?? null).replace(/\{(\w+)\}/gu, (_match, name: string) => {
          if (!matrix.placeholders.includes(name) || !(name in known)) throw new Error(`unsupported-placeholder:${name}`);
          return known[name];
        }),
      ) as T;
    };

    const check = (name: string, work: () => Promise<void>) =>
      test(name, async () => {
        try {
          await work();
          stats.passed += 1;
        } catch (error) {
          stats.failed += 1;
          throw error;
        }
      });

    function expectCell(observed: Observed, cell: Cell, label: string) {
      const actual = classify(observed);
      const expected = cell.outcome.startsWith("accepted:") ? "allow" : cell.outcome;
      const detail = `${observed.error?.code ?? observed.error?.statusCode ?? ""} ${observed.error?.message ?? ""}`.trim();
      const tag = cell.verify_live ? " [verify_live cell: confirm or classify the divergence in 16-12]" : "";
      assert.equal(actual, expected, `${label}: expected ${cell.outcome}, observed ${actual}${detail ? ` (${detail})` : ""}${tag}`);
      if (cell.message) assert.ok(observed.error?.message?.includes(cell.message), `${label}: expected message ${cell.message}, got ${observed.error?.message}`);
      if (cell.returns !== undefined) assert.equal(observed.data, cell.returns, `${label}: expected return value ${cell.returns}`);
    }

    const clientOf = (role: string) => env().run.client(role);

    async function rpcOp(role: string, name: string, args: Record<string, unknown>): Promise<Observed> {
      const result = await clientOf(role).rpc(name, fill(args, role));
      return { error: result.error, data: result.data };
    }

    const inertKey = (table: TableSpec) => (table.pk_kind === "bigint" ? 0 : table.pk_kind === "uuid" ? inertUuid : `${env().run.prefix}-inert`);
    function keyOf(table: TableSpec, role: string): string | number {
      if (table.name.startsWith("portia_promo_")) return inertKey(table);
      if (table.target) return env().run.emailOf(table.target);
      return String(fill(table.seed, role)?.[table.pk]);
    }

    async function tableOp(role: string, table: TableSpec, op: string): Promise<Observed> {
      const e = env();
      const client = clientOf(role);
      const probes = fill(table.probes ?? {}, role);
      const key = keyOf(table, role);
      const slot = `${table.name}|${role}`;
      if (op === "select") {
        const result = await client.from(table.name).select("*").eq(table.pk, key);
        return { error: result.error, rows: result.data?.length };
      }
      if (op === "insert") {
        const row = probes.insert ?? {};
        const result = await client.from(table.name).insert(row);
        if (!result.error && row[table.pk] !== undefined) {
          e.inserted.set(slot, String(row[table.pk]));
          if (table.name === "portia_manual_employees") e.manualIds.add(String(row[table.pk]));
        }
        return { error: result.error };
      }
      if (op === "delete") {
        const own = e.inserted.get(slot);
        const result = await client.from(table.name).delete().eq(table.pk, own ?? key).select();
        if (own && (result.data?.length ?? 0) > 0) e.inserted.delete(slot);
        return { error: result.error, rows: result.data?.length };
      }
      const result = await client.from(table.name).update(probes[op]?.set as Record<string, unknown>).eq(table.pk, key).select();
      return { error: result.error, rows: op === "update" ? result.data?.length : undefined };
    }

    async function storageOp(role: string, op: string): Promise<Observed> {
      const { run } = env();
      const bucket = clientOf(role).storage.from(matrix.storage.bucket);
      const seed = `${run.prefix}/seed.png`;
      const own = (file: string) => `${run.prefix}/${role}/${file}`;
      if (op === "read") {
        const result = await bucket.download(seed);
        return { error: result.error };
      }
      if (op === "insert") return { error: (await bucket.upload(own("ok.png"), pngBytes, { contentType: "image/png" })).error };
      if (op === "insert-oversize") {
        const big = Buffer.alloc(4 * 1024 * 1024 + 1);
        return { error: (await bucket.upload(own("big.png"), big, { contentType: "image/png" })).error };
      }
      if (op === "insert-bad-mime") return { error: (await bucket.upload(own("bad.txt"), Buffer.from("x"), { contentType: "text/plain" })).error };
      if (op === "update") return { error: (await bucket.upload(seed, pngBytes, { contentType: "image/png", upsert: true })).error };
      const roleMay = matrix.storage.ops.insert[role].outcome === "allow";
      const result = await bucket.remove([roleMay ? own("ok.png") : seed]);
      return { error: result.error, rows: result.data?.length };
    }

    before(async () => {
      const run = createRun(live);
      ctx = { run, manualIds: new Set(), inserted: new Map() };
      for (const [role, spec] of Object.entries(matrix.roles)) {
        if (role === "anon") continue;
        if (spec.owner_fixture) await run.createOwnerFixture();
        else await run.createIdentity(role, spec.grants);
      }
      for (const table of matrix.tables) {
        if (!table.seed) continue;
        const seed = fill(table.seed, "owner");
        const result = await run.admin.from(table.name).upsert(seed);
        if (result.error) throw new Error(`seed ${table.name}: ${result.error.message}`);
        if (table.name === "portia_manual_employees") ctx.manualIds.add(String(seed[table.pk]));
      }
      const stored = await run.admin.storage.from(matrix.storage.bucket).upload(`${run.prefix}/seed.png`, pngBytes, { contentType: "image/png", upsert: true });
      if (stored.error) throw new Error(`seed storage: ${stored.error.message}`);
    });

    after(async () => {
      const e = ctx;
      if (!e) return;
      const problems: string[] = [];
      // portia_manual_employees ids cannot carry the run prefix, so the suite removes its own rows.
      const ids = [...e.manualIds];
      if (ids.length > 0) {
        const removed = await e.run.admin.from("portia_manual_employees").delete().in("employee_id", ids);
        if (removed.error) problems.push(`manual employees: ${removed.error.message}`);
        const left = await e.run.admin.from("portia_manual_employees").select("employee_id").in("employee_id", ids);
        if (left.error || (left.data?.length ?? 0) > 0) problems.push("manual employees: residual rows");
      }
      try {
        await e.run.cleanup();
      } catch (error) {
        problems.push(error instanceof Error ? error.message : "cleanup failed");
      }
      const status: SuiteStatus = stats.failed > 0 ? "FAIL" : stats.passed > 0 ? "PASS" : "BLOCKED";
      const receipt = await buildReceipt(e.run, { [suiteName]: status });
      const path = writeReceipt(receipt, e.run.secrets(), suiteName);
      console.log(`staging-live ${suiteName}: receipt status ${receipt.status} (${path})`);
      assert.deepEqual(problems, [], `cleanup problems: ${problems.join("; ")}`);
      assert.ok(Object.values(receipt.residual).every((count) => count === 0), `residual after cleanup: ${JSON.stringify(receipt.residual)}`);
    });

    check("catalog: golden fingerprint function set equals the matrix", async () => {
      const golden = new URL("../supabase/fingerprint/expected/portia.fingerprint.json", import.meta.url);
      if (!existsSync(golden)) assert.fail("golden fingerprint is missing: plan 16-10 writes supabase/fingerprint/expected/portia.fingerprint.json");
      const fingerprint = JSON.parse(readFileSync(golden, "utf8")) as { schema?: string; pg_major?: number; sections?: { functions?: Record<string, unknown> } };
      assert.equal(fingerprint.schema, "portia-fingerprint-v1");
      assert.ok(Number.isInteger(fingerprint.pg_major), "golden fingerprint has no pg_major");
      const goldenKeys = Object.keys(fingerprint.sections?.functions ?? {});
      // public.rls_auto_enable() is the Supabase platform event trigger (not in any repo SQL, returns event_trigger): pinned by name so a new foreign function still fails.
      assert.deepEqual(goldenKeys.filter((key) => !key.startsWith("public.portia_")), ["public.rls_auto_enable()"]);
      const diff = diffSets(goldenKeys.filter((key) => key.startsWith("public.portia_")), matrix.functions.map((fn) => fn.key));
      assert.deepEqual(diff, { missing: [], extra: [] }, `matrix rows without a live function: ${diff.missing.join("; ")}; live functions without a matrix row: ${diff.extra.join("; ")}`);
    });

    // Tracer slice: the cheapest end-to-end proof (anon client -> PostgREST -> RLS -> matrix). The only test with this word in its name.
    const tracerCell = matrix.tables.find((table) => table.name === "portia_content")!.ops.select.anon;
    check("tracer: anon portia_content select", async () => {
      const table = matrix.tables.find((item) => item.name === "portia_content")!;
      expectCell(await tableOp("anon", table, "select"), tracerCell, "anon portia_content select");
    });

    for (const fn of matrix.functions) {
      for (const role of roles) {
        check(`${role} function ${fn.name}`, async () => expectCell(await rpcOp(role, fn.name, fn.args), fn.cells[role], `${role} ${fn.key}`));
      }
      for (const variant of fn.variants ?? []) {
        for (const role of roles) {
          check(`${role} function ${fn.name} [${variant.label}]`, async () => expectCell(await rpcOp(role, fn.name, variant.args), variant.cells[role], `${role} ${fn.key} [${variant.label}]`));
        }
      }
    }

    for (const table of matrix.tables) {
      for (const op of tableOps.filter((item) => table.ops[item])) {
        for (const role of roles) {
          if (table.name === "portia_content" && op === "select" && role === "anon") continue; // covered by the tracer test
          check(`${role} table ${table.name} ${op}`, async () => expectCell(await tableOp(role, table, op), table.ops[op][role], `${role} ${table.name} ${op}`));
        }
      }
    }

    for (const op of storageOps) {
      for (const role of roles) {
        check(`${role} storage ${op}`, async () => expectCell(await storageOp(role, op), matrix.storage.ops[op][role], `${role} storage ${op}`));
      }
    }

    // Revoke on sessions that were issued before the revoke; none of these tests signs in again.
    const bucketOf = (client: SupabaseClient) => client.storage.from(matrix.storage.bucket);
    const allow: Cell = { outcome: "allow", source: "" };

    check("revoke: deleting the portia_editors row stops table, RPC and Storage access of the same session", async () => {
      const { run } = env();
      const client = await run.createIdentity("rev-editor", {});
      const email = run.emailOf("rev-editor");
      const row = `${run.prefix}-rev1`;
      expectCell({ error: (await client.from("portia_content").insert({ id: row, payload: {} })).error }, allow, "before revoke: content insert");
      expectCell({ error: (await bucketOf(client).upload(`${run.prefix}/rev1/before.png`, pngBytes, { contentType: "image/png" })).error }, allow, "before revoke: upload");
      expectCell({ data: (await client.rpc("portia_can_edit")).data }, { ...allow, returns: true }, "before revoke: portia_can_edit");

      const revoked = await run.admin.from("portia_editors").delete({ count: "exact" }).eq("email", email);
      assert.equal(revoked.error, null);
      assert.equal(revoked.count, 1, "the editor row was not there to revoke");

      const deny: Cell = { outcome: "rls-deny", source: "" };
      expectCell({ error: (await client.from("portia_content").insert({ id: `${row}-after`, payload: {} })).error }, deny, "after revoke: content insert");
      const updated = await client.from("portia_content").update({ payload: { revoked: true } }).eq("id", row).select();
      expectCell({ error: updated.error, rows: updated.data?.length }, { outcome: "rls-empty", source: "" }, "after revoke: content update");
      expectCell({ error: (await bucketOf(client).upload(`${run.prefix}/rev1/after.png`, pngBytes, { contentType: "image/png" })).error }, deny, "after revoke: upload");
      expectCell({ data: (await client.rpc("portia_can_edit")).data }, { ...allow, returns: false }, "after revoke: portia_can_edit");
    });

    check("revoke: removing promo from granted_tabs makes the same session forbidden", async () => {
      const { run } = env();
      const client = await run.createIdentity("rev-promo", { grantedTabs: ["promo"] });
      expectCell({ error: (await client.rpc("portia_promo_reviewer_state")).error }, allow, "before revoke: reviewer_state");
      const revoked = await run.admin.from("portia_editors").update({ granted_tabs: [] }, { count: "exact" }).eq("email", run.emailOf("rev-promo"));
      assert.equal(revoked.error, null);
      assert.equal(revoked.count, 1, "the editor row was not there to update");
      expectCell({ error: (await client.rpc("portia_promo_reviewer_state")).error }, { outcome: "forbidden", source: "" }, "after revoke: reviewer_state");
      expectCell({ data: (await client.rpc("portia_has_tab_grant", { tab_id: "promo" })).data }, { ...allow, returns: false }, "after revoke: portia_has_tab_grant");
    });

    check("revoke: deleting the auth user stops access of a JWT that has not expired yet", async () => {
      const { run } = env();
      const client = await run.createIdentity("rev-deleted", {});
      expectCell({ error: (await client.from("portia_content").insert({ id: `${run.prefix}-rev3`, payload: {} })).error }, allow, "before delete: content insert");
      const { data } = await client.auth.getUser();
      assert.ok(data.user?.id, "no user id for the issued session");
      const deleted = await run.admin.auth.admin.deleteUser(data.user.id);
      assert.equal(deleted.error, null);

      const deny: Cell = { outcome: "rls-deny", source: "" };
      expectCell({ data: (await client.rpc("portia_email_confirmed")).data }, { ...allow, returns: false }, "after delete: portia_email_confirmed");
      expectCell({ data: (await client.rpc("portia_can_edit")).data }, { ...allow, returns: false }, "after delete: portia_can_edit");
      expectCell({ error: (await client.from("portia_content").insert({ id: `${run.prefix}-rev3-after`, payload: {} })).error }, deny, "after delete: content insert");
      expectCell({ error: (await bucketOf(client).upload(`${run.prefix}/rev3/after.png`, pngBytes, { contentType: "image/png" })).error }, deny, "after delete: upload");
    });
  });
}
