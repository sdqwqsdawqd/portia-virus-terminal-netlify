import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { redact, resolveStagingTarget } from "./phase16-staging.mjs";
import { legacyClassificationNames } from "../lib/portia-content.ts";

// Phase 20 (20-21, D-36b): proves the class-rename migration on the isolated staging project with a throwaway fixture row.
// Subcommands: seed <runId> | verify <runId> | cleanup <runId>. The target comes only from resolveStagingTarget (it refuses production,
// a linked CLI project and a missing live-confirm). Values come only from process.env; no env file is read.
// Every subcommand prints one JSON receipt line with counters and revisions only: never a payload, a key or a URL.

export const FIXTURE_PREFIX = "phase20-class-fixture-";
const RUN_ID = /^[a-z0-9-]{4,40}$/u;
const RENAMED_AXES = ["mind", "behavior", "appearance"];
const ARRAYS = ["viruses", "recycledViruses"];

export const fixtureIdOf = (runId) => `${FIXTURE_PREFIX}${runId}`;

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const plain = (value) => JSON.parse(JSON.stringify(value));

// Minimal stored content: all nine old names on the three renamed axes, plus values the migration must leave alone:
// an old name on a NON-renamed axis (danger), an old name inside free text, a non-object array element, a classification that is not an object.
export function legacyFixturePayload(runId) {
  const virus = (n, mind, behavior, appearance) => ({
    id: `fixture-${runId}-${n}`,
    code: `FX-${n}`,
    name: `Fixture ${n}`,
    status: "Fixture",
    classification: { danger: "Рубедо", spread: "S", transmission: "T", escapeRisk: "E", mind, behavior, appearance },
    note: `Рубедо stays in free text ${n}`,
  });
  return {
    viruses: [
      virus(1, "Рубедо", "Фобус", "Нюктея"),
      virus(2, "Альбедо", "Ареус", "Морфея"),
      "not-an-object",
      { id: `fixture-${runId}-3`, classification: "Нигредо" },
      virus(4, "Люцидиум", "Стабилар", "Изоморф"),
    ],
    recycledViruses: [virus(5, "Нигредо", "Селенус", "Дедалея")],
    infoSections: [{ id: "fixture", body: "Рубедо Альбедо Нигредо in text" }],
    marker: `${FIXTURE_PREFIX}${runId}`,
  };
}

// The expected result of the migration on `before`: the nine names, on the three axes, inside the two arrays, nothing else.
function renamed(before) {
  const next = plain(before);
  for (const key of ARRAYS) {
    if (!Array.isArray(next[key])) continue;
    for (const element of next[key]) {
      if (!isPlainObject(element) || !isPlainObject(element.classification)) continue;
      for (const axis of RENAMED_AXES) {
        const value = element.classification[axis];
        if (typeof value === "string" && Object.hasOwn(legacyClassificationNames, value)) element.classification[axis] = legacyClassificationNames[value];
      }
    }
  }
  return next;
}

function diffPaths(expected, actual, at, problems) {
  if (isDeepStrictEqual(expected, actual)) return;
  if (isPlainObject(expected) && isPlainObject(actual)) {
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) diffPaths(expected[key], actual[key], `${at}.${key}`, problems);
  } else if (Array.isArray(expected) && Array.isArray(actual) && expected.length === actual.length) {
    expected.forEach((item, index) => diffPaths(item, actual[index], `${at}[${index}]`, problems));
  } else {
    problems.push(`unexpected value at ${at}`);
  }
}

// Paths only in the messages (never values), so a problem list is safe to print.
export function checkRewritten(before, after) {
  const problems = [];
  diffPaths(renamed(before), after, "payload", problems);
  return { ok: problems.length === 0, problems };
}

// Old-name values on the three renamed axes inside the two arrays (counter only; the payload is never printed).
export function countOldValues(payload) {
  let count = 0;
  if (!isPlainObject(payload)) return count;
  for (const key of ARRAYS) {
    if (!Array.isArray(payload[key])) continue;
    for (const element of payload[key]) {
      if (!isPlainObject(element) || !isPlainObject(element.classification)) continue;
      for (const axis of RENAMED_AXES) {
        const value = element.classification[axis];
        if (typeof value === "string" && Object.hasOwn(legacyClassificationNames, value)) count += 1;
      }
    }
  }
  return count;
}

const secretsOf = (env, target) => ({
  "admin-key": target?.adminKey ?? env.PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY,
  "publishable-key": target?.publishableKey ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  "db-url": target?.dbUrl ?? env.PORTIA_STAGING_DB_URL,
  "db-password": target?.dbPassword,
  ref: target?.projectId ?? env.PORTIA_E2E_TARGET_ID,
  host: target?.projectId ? `${target.projectId}.supabase.co` : undefined,
});

class StepError extends Error {}

async function mainRow(admin) {
  const { data, error } = await admin.from("portia_content").select("payload, revision").eq("id", "main").maybeSingle();
  if (error) throw new StepError("read-main-failed");
  return data ? { revision: data.revision, oldValues: countOldValues(data.payload) } : { revision: null, oldValues: 0 };
}

async function fixtureRow(admin, runId) {
  const { data, error } = await admin.from("portia_content").select("payload, revision").eq("id", fixtureIdOf(runId)).maybeSingle();
  if (error) throw new StepError("read-fixture-failed");
  return data;
}

async function fixtureResidual(admin) {
  const { data, error } = await admin.from("portia_content").select("id").like("id", `${FIXTURE_PREFIX}%`);
  if (error) throw new StepError("residual-count-failed");
  return data.length;
}

export async function runStep(step, runId, admin) {
  if (step === "seed") {
    if (await fixtureRow(admin, runId)) throw new StepError("fixture-already-present");
    const { error } = await admin.from("portia_content").insert({ id: fixtureIdOf(runId), payload: legacyFixturePayload(runId), revision: 1 });
    if (error) throw new StepError("seed-insert-failed");
    const main = await mainRow(admin);
    return { runId, step, fixtureRevision: 1, mainRevision: main.revision, mainOldValues: main.oldValues, ok: true, residual: null };
  }
  if (step === "verify") {
    const row = await fixtureRow(admin, runId);
    if (!row) throw new StepError("fixture-missing");
    const check = checkRewritten(legacyFixturePayload(runId), row.payload);
    const main = await mainRow(admin);
    const ok = check.ok && row.revision === 2 && main.oldValues === 0;
    return {
      runId, step, fixtureRevision: row.revision, mainRevision: main.revision, mainOldValues: main.oldValues,
      problems: check.problems, ok, residual: null,
    };
  }
  if (step === "cleanup") {
    const { error } = await admin.from("portia_content").delete().eq("id", fixtureIdOf(runId));
    if (error) throw new StepError("cleanup-delete-failed");
    const residual = await fixtureResidual(admin);
    return { runId, step, ok: residual === 0, residual };
  }
  throw new StepError("usage");
}

export async function main(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const out = deps.out ?? ((text) => process.stdout.write(text));
  const err = deps.err ?? ((text) => process.stderr.write(text));
  const [step, runId, ...extra] = argv;
  let target;
  try {
    if (!["seed", "verify", "cleanup"].includes(step) || extra.length > 0 || !RUN_ID.test(runId ?? "")) throw new StepError("usage: seed|verify|cleanup <runId matching [a-z0-9-]{4,40}>");
    target = resolveStagingTarget(env, deps);
    const admin = (deps.createClient ?? createClient)(target.url, target.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const receipt = await runStep(step, runId, admin);
    out(`${JSON.stringify(receipt)}\n`);
    return receipt.ok ? 0 : 1;
  } catch (error) {
    err(`${redact(error instanceof Error ? error.message : "internal", secretsOf(env, target))}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
