import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertAppBoundToTarget } from "./target-attestation.ts";
import { MutationTargetBlockedError, type SafeMutationTarget } from "./target-guard.ts";

// Live-suite harness for the isolated Supabase project (Phase 16). Admin client = fixtures and state checks only;
// behavioral assertions must use run.client(role) (Pitfall 12). Nothing here reads env files or logs values.

const liveConfirmation = "ISOLATED_TEST_PROJECT";
const markerKey = "portia_run";
const fixturePrefixBase = "__portia_live_";
const mediaBucket = "portia-media";
const runIdPattern = /^[0-9a-z]+_[0-9a-f]{8}$/u;
const baselineUrl = new URL("../../../supabase/migrations/20261101000000_portia_baseline.sql", import.meta.url);

type Env = Readonly<Record<string, string | undefined>>;
type Admin = SupabaseClient;
type DbError = { code?: string; message: string } | null | undefined;

export type StagingLiveTarget = Readonly<{
  target: SafeMutationTarget;
  url: string;
  publishableKey: string;
  adminKey: string;
  refHash: string;
}>;
export type SuiteStatus = "PASS" | "FAIL" | "BLOCKED" | "SKIP";
export type Grants = { closedTabs?: string[]; grantedTabs?: string[] };
export type Residual = Record<"promo" | "editors" | "storage" | "content" | "authUsers", number>;
export type HarnessDeps = {
  createClient?: typeof createClient;
  now?: () => number;
  random?: (bytes: number) => Buffer;
  commit?: () => string;
};

export class OwnerFixtureForeignError extends Error {
  readonly code = "owner-fixture-foreign";
  constructor() {
    super("[owner-fixture-foreign] The canonical owner account exists without a run marker; refusing to touch it.");
    this.name = "OwnerFixtureForeignError";
  }
}

/** True only for `npm run test:staging-live*`; live test files register a skip otherwise (so `npm test` never mutates). */
export function isStagingLiveInvocation(env: Env = process.env) {
  return (env.npm_lifecycle_event ?? "").startsWith("test:staging-live");
}

// The single guard: same target judgement and app binding as Playwright and the wrapper, plus the live-suite
// confirmation and a REQUIRED live URL on the same host. Errors name variables, never values.
export function requireStagingLiveTarget(env: Env = process.env): StagingLiveTarget {
  const target = assertAppBoundToTarget(env);
  if (env.PORTIA_PROMO_LIVE_CONFIRM !== liveConfirmation) {
    throw new MutationTargetBlockedError("live-confirmation", ["PORTIA_PROMO_LIVE_CONFIRM"]);
  }
  const url = env.PORTIA_PROMO_LIVE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // falls through to the mismatch error below
  }
  if (host !== `${target.projectId}.supabase.co`) {
    throw new MutationTargetBlockedError("live-target-mismatch", ["PORTIA_PROMO_LIVE_URL", "PORTIA_E2E_SUPABASE_URL"]);
  }
  const publishableKey = env.PORTIA_PROMO_LIVE_ANON_KEY ?? "";
  const adminKey = env.PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY ?? "";
  if (!publishableKey || !adminKey) {
    throw new MutationTargetBlockedError("live-keys", ["PORTIA_PROMO_LIVE_ANON_KEY", "PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY"]);
  }
  const refHash = createHash("sha256").update(target.projectId).digest("hex").slice(0, 12);
  return Object.freeze({ target, url, publishableKey, adminKey, refHash });
}

// Owner email has one source of truth: the SQL function body in the baseline migration.
export function ownerEmailFromBaseline(sql: string = readFileSync(fileURLToPath(baselineUrl), "utf8")) {
  const definitions = [...sql.matchAll(/create\s+or\s+replace\s+function\s+public\.portia_owner_email\s*\(\s*\)[\s\S]*?\$\$([\s\S]*?)\$\$/giu)];
  if (definitions.length !== 1) throw new Error("owner-email-function-not-found");
  const literals = [...definitions[0][1].matchAll(/'([^']*)'/gu)];
  if (literals.length !== 1 || !literals[0][1].includes("@")) throw new Error("owner-email-literal-ambiguous");
  return literals[0][1].toLowerCase();
}

function check(error: DbError, label: string) {
  if (!error) return;
  if (error.code === "42501") {
    throw new Error(`admin-grant-missing: ${label} was denied (42501); admin grants are calibrated in plan 16-10 (D9)`);
  }
  throw new Error(`${label}: ${error.message}`);
}

const likePrefix = (prefix: string) => `${prefix.replace(/[\\%_]/gu, "\\$&")}%`;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

type Spec = { table: string; column: string; userColumn?: string };
// Promo tables in FK order. Children of qualification requests (attempts, questions, answers) are removed explicitly below.
const promoSpecs: Spec[] = [
  { table: "portia_promo_audit_events", column: "nickname_key", userColumn: "actor_id" },
  { table: "portia_promo_results", column: "nickname_key" },
  { table: "portia_promo_qualification_requests", column: "nickname_key", userColumn: "reviewer_id" },
  { table: "portia_promo_requests", column: "nickname_key", userColumn: "reviewer_id" },
  { table: "portia_promo_device_bindings", column: "nickname_key" },
  { table: "portia_promo_attempt_buckets", column: "bucket_key" },
  { table: "portia_promo_task_banks", column: "target_title_id" },
];
const contentSpecs: Spec[] = [
  { table: "portia_content", column: "id" },
  { table: "portia_employee_profiles", column: "employee_id" },
];

async function listUsers(admin: Admin) {
  const users: Array<{ id: string; email?: string; app_metadata?: Record<string, unknown> }> = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    check(error, "list users");
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

const markerOf = (user: { app_metadata?: Record<string, unknown> }) => {
  const value = user.app_metadata?.[markerKey];
  return typeof value === "string" && value ? value : undefined;
};

async function listObjects(admin: Admin, path: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(mediaBucket).list(path, { limit: 100, offset });
    check(error, "list storage");
    for (const entry of data ?? []) {
      const child = path ? `${path}/${entry.name}` : entry.name;
      if (entry.id === null) files.push(...(await listObjects(admin, child)));
      else files.push(child);
    }
    if ((data?.length ?? 0) < 100) return files;
  }
}

async function ids(admin: Admin, table: string, column: string, filterColumn: string, values: string[]) {
  if (values.length === 0) return [];
  const { data, error } = await admin.from(table).select(column).in(filterColumn, values);
  check(error, `select ${table}`);
  return (data ?? []).map((row) => String((row as unknown as Record<string, unknown>)[column]));
}

async function countWhere(admin: Admin, table: string, column: string, pattern: string) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).like(column, pattern);
  check(error, `count ${table}`);
  return count ?? 0;
}

async function countResidual(admin: Admin, runId: string): Promise<Residual> {
  const prefix = likePrefix(`${fixturePrefixBase}${runId}`);
  const sum = async (specs: Spec[]) => {
    let total = 0;
    for (const spec of specs) total += await countWhere(admin, spec.table, spec.column, prefix);
    return total;
  };
  return {
    promo: await sum(promoSpecs),
    editors: await countWhere(admin, "portia_editors", "email", likePrefix(`portia-live-${runId}-`)),
    storage: (await listObjects(admin, `${fixturePrefixBase}${runId}`)).length,
    content: await sum(contentSpecs),
    authUsers: (await listUsers(admin)).filter((user) => markerOf(user) === runId).length,
  };
}

// Removes everything one run created, in dependency order. Every step is attempted even if an earlier one failed.
async function purge(admin: Admin, runId: string, errors: string[]): Promise<Residual> {
  const deleted: Residual = { promo: 0, editors: 0, storage: 0, content: 0, authUsers: 0 };
  const prefix = `${fixturePrefixBase}${runId}`;
  const pattern = likePrefix(prefix);
  const step = async (label: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${label}: failed`);
    }
  };
  const remove = async (category: "promo" | "content", spec: Spec, userIds: string[]) => {
    const byPrefix = await admin.from(spec.table).delete({ count: "exact" }).like(spec.column, pattern);
    check(byPrefix.error, `delete ${spec.table}`);
    deleted[category] += byPrefix.count ?? 0;
    if (spec.userColumn && userIds.length) {
      const byUser = await admin.from(spec.table).delete({ count: "exact" }).in(spec.userColumn, userIds);
      check(byUser.error, `delete ${spec.table} by user`);
      deleted[category] += byUser.count ?? 0;
    }
  };

  let userIds: string[] = [];
  await step("list users", async () => {
    userIds = (await listUsers(admin)).filter((user) => markerOf(user) === runId).map((user) => user.id);
  });

  await step("promo attempt children", async () => {
    const requests = await admin.from("portia_promo_qualification_requests").select("id").like("nickname_key", pattern);
    check(requests.error, "select portia_promo_qualification_requests");
    const requestIds = (requests.data ?? []).map((row) => String((row as { id: string }).id));
    const attemptIds = await ids(admin, "portia_promo_attempts", "id", "request_id", requestIds);
    for (const [table, column] of [
      ["portia_promo_answers", "attempt_id"],
      ["portia_promo_attempt_questions", "attempt_id"],
      ["portia_promo_attempts", "id"],
    ] as const) {
      if (attemptIds.length === 0) break;
      const result = await admin.from(table).delete({ count: "exact" }).in(column, attemptIds);
      check(result.error, `delete ${table}`);
      deleted.promo += result.count ?? 0;
    }
  });
  for (const spec of promoSpecs) await step(spec.table, () => remove("promo", spec, userIds));

  await step("portia_editors", async () => {
    const result = await admin.from("portia_editors").delete({ count: "exact" }).like("email", likePrefix(`portia-live-${runId}-`));
    check(result.error, "delete portia_editors");
    deleted.editors += result.count ?? 0;
  });
  await step("storage", async () => {
    const objects = await listObjects(admin, prefix);
    if (objects.length === 0) return;
    const result = await admin.storage.from(mediaBucket).remove(objects);
    check(result.error, "remove storage objects");
    deleted.storage += objects.length;
  });
  for (const spec of contentSpecs) await step(spec.table, () => remove("content", spec, userIds));

  for (const id of userIds) {
    await step("auth user", async () => {
      const result = await admin.auth.admin.deleteUser(id);
      check(result.error, "delete auth user");
      deleted.authUsers += 1;
    });
  }
  return deleted;
}

export function createRun(live: StagingLiveTarget, deps: HarnessDeps = {}) {
  const make = deps.createClient ?? createClient;
  const random = deps.random ?? randomBytes;
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  const runId = `${(deps.now ?? Date.now)().toString(36)}_${random(4).toString("hex")}`;
  const prefix = `${fixturePrefixBase}${runId}`;
  if (!prefix.startsWith(fixturePrefixBase) || prefix.length > 48 || !runIdPattern.test(runId)) {
    throw new Error("unsafe-live-fixture-prefix");
  }
  const admin = make(live.url, live.adminKey, options);
  const clients = new Map<string, SupabaseClient>();
  const credentials = new Map<string, { email: string; password: string }>();
  const secrets = new Set<string>([live.url, live.publishableKey, live.adminKey, live.target.projectId, `${live.target.projectId}.supabase.co`]);
  const created = { authUsers: 0, editors: 0 };
  let deleted: Residual = { promo: 0, editors: 0, storage: 0, content: 0, authUsers: 0 };
  const state = { cleaned: false, errors: [] as string[] };
  const emailOf = (label: string) => `portia-live-${runId}-${label}@example.invalid`;

  async function provision(label: string, email: string, grants?: Grants) {
    if (!/^[a-z0-9-]{1,24}$/u.test(label) || clients.has(label)) throw new Error("invalid-or-duplicate-identity-label");
    const password = `Live-${random(18).toString("base64url")}!9`;
    secrets.add(password);
    secrets.add(email);
    const user = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { [markerKey]: runId } });
    check(user.error, "create user");
    created.authUsers += 1;
    if (grants) {
      const editor = await admin.from("portia_editors").upsert({ email, closed_tabs: grants.closedTabs ?? [], granted_tabs: grants.grantedTabs ?? [] });
      check(editor.error, "grant editor");
      created.editors += 1;
    }
    const client = make(live.url, live.publishableKey, options);
    const session = await client.auth.signInWithPassword({ email, password }); // one sign-in per identity (Auth rate limits)
    check(session.error, "sign in");
    clients.set(label, client);
    credentials.set(label, { email, password });
    return client;
  }

  return {
    runId,
    prefix,
    emailOf,
    state,
    created,
    get deleted() {
      return deleted;
    },
    commit: deps.commit ?? (() => execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()),
    refHash: live.refHash,
    secrets: () => [...secrets],
    admin,
    createIdentity: (label: string, grants?: Grants) => provision(label, emailOf(label), grants),
    // D4: the canonical owner email, only on the isolated target, only with the run marker.
    async createOwnerFixture() {
      const email = ownerEmailFromBaseline();
      const existing = (await listUsers(admin)).find((user) => user.email?.toLowerCase() === email);
      if (existing) {
        if (!markerOf(existing)) throw new OwnerFixtureForeignError();
        check((await admin.auth.admin.deleteUser(existing.id)).error, "delete stale owner fixture");
      }
      return provision("owner", email);
    },
    // For the real /owner-login form only; both values are already in secrets() and never reach a receipt.
    credentials(label: string) {
      const value = credentials.get(label);
      if (!value) throw new Error("unknown-identity-label");
      return value;
    },
    client(label: string) {
      if (label === "anon") {
        if (!clients.has("anon")) clients.set("anon", make(live.url, live.publishableKey, options));
        return clients.get("anon")!;
      }
      const client = clients.get(label);
      if (!client) throw new Error("unknown-identity-label");
      return client;
    },
    async cleanup() {
      const errors: string[] = [];
      deleted = await purge(admin, runId, errors);
      state.cleaned = true;
      state.errors = errors;
      if (errors.length) throw new Error(`cleanup-failed: ${errors.join("; ")}`);
      return deleted;
    },
    residual: () => countResidual(admin, runId),
  };
}
export type Run = ReturnType<typeof createRun>;

// Removes leftovers of crashed runs. Only resources named `__portia_live_<runId>` / `portia-live-<runId>-` or users carrying
// the portia_run marker are discovered; a user without the marker is never touched.
export async function sweep(live: StagingLiveTarget, olderThanMs: number, deps: HarnessDeps = {}) {
  const admin = (deps.createClient ?? createClient)(live.url, live.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const found = new Set<string>();
  const note = (value: string | undefined, pattern: RegExp) => {
    const match = value?.match(pattern);
    if (match && runIdPattern.test(match[1])) found.add(match[1]);
  };
  for (const user of await listUsers(admin)) {
    const marker = markerOf(user);
    if (marker && runIdPattern.test(marker)) found.add(marker);
  }
  for (const spec of [...promoSpecs, ...contentSpecs]) {
    const { data, error } = await admin.from(spec.table).select(spec.column).like(spec.column, likePrefix(fixturePrefixBase));
    check(error, `sweep ${spec.table}`);
    for (const row of data ?? []) note(String((row as unknown as Record<string, unknown>)[spec.column]), /^__portia_live_([0-9a-z]+_[0-9a-f]{8})/u);
  }
  const editors = await admin.from("portia_editors").select("email").like("email", likePrefix("portia-live-"));
  check(editors.error, "sweep portia_editors");
  for (const row of editors.data ?? []) note((row as { email: string }).email, /^portia-live-([0-9a-z]+_[0-9a-f]{8})-/u);
  for (const name of await listRootNames(admin)) note(name, /^__portia_live_([0-9a-z]+_[0-9a-f]{8})/u);

  const now = (deps.now ?? Date.now)();
  const stale = [...found].filter((id) => now - Number.parseInt(id.split("_")[0], 36) > olderThanMs);
  const errors: string[] = [];
  for (const runId of stale) await purge(admin, runId, errors);
  if (errors.length) throw new Error(`sweep-failed: ${errors.join("; ")}`);
  return { swept: stale };
}

async function listRootNames(admin: Admin) {
  const names: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(mediaBucket).list("", { limit: 100, offset });
    check(error, "list storage root");
    names.push(...(data ?? []).map((entry) => entry.name));
    if ((data?.length ?? 0) < 100) return names;
  }
}

// ---- receipt ----

export const receiptSchema = "portia-staging-receipt-v1";
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : item);

export async function buildReceipt(run: Run, suites: Record<string, SuiteStatus>) {
  const residual = await run.residual();
  const values = Object.values(suites);
  const clean = run.state.cleaned && run.state.errors.length === 0 && Object.values(residual).every((count) => count === 0);
  const status: SuiteStatus =
    values.includes("FAIL") || !clean ? "FAIL"
    : values.length === 0 || values.includes("BLOCKED") ? "BLOCKED"
    : values.includes("SKIP") ? "SKIP"
    : "PASS";
  const body = {
    schema: receiptSchema,
    runId: run.runId,
    commit: run.commit(),
    refHash: run.refHash,
    suites,
    created: { ...run.created },
    deleted: { ...run.deleted },
    residual,
    status,
  };
  return { ...body, sha256: sha(canonical(body)) };
}
export type Receipt = Awaited<ReturnType<typeof buildReceipt>>;

const forbiddenFragments = ["@", "eyJ", "sb_secret_", "sb_publishable_", "postgres://", "postgresql://"];

export function assertRedacted(receipt: unknown, secrets: readonly string[]) {
  const text = canonical(receipt);
  for (const secret of secrets) {
    if (secret && text.includes(secret)) throw new Error("receipt-not-redacted: contains a run secret");
  }
  for (const fragment of forbiddenFragments) {
    if (text.includes(fragment)) throw new Error(`receipt-not-redacted: contains ${fragment}`);
  }
}

export function writeReceipt(receipt: Receipt, secrets: readonly string[], suite: string, root: string = process.cwd()) {
  if (!/^[a-z0-9-]{1,40}$/u.test(suite) || !runIdPattern.test(receipt.runId)) throw new Error("invalid-receipt-name");
  assertRedacted(receipt, secrets);
  const directory = join(root, "test-results", "staging");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `receipt-${suite}-${receipt.runId}.json`);
  writeFileSync(path, `${canonical(receipt)}\n`);
  return path;
}
