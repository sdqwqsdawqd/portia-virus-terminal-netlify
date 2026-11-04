import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as gate from "../scripts/phase20-release-gate.mjs";

// Fixtures for the fail-closed release gate runner (20-30). Every rule that keeps a false PASS out has a case here.

const TMP = path.resolve(path.sep, "tmp-root", "temp");
const WORKTREE = path.join(TMP, "portia-release-0123456789ab-20261104T000000000Z");

type GitCall = string[];

function fakeGit(handler: (args: GitCall) => { status: number; stdout?: string; stderr?: string }) {
  const calls: GitCall[] = [];
  const git = (args: GitCall) => {
    calls.push(args);
    const result = handler(args);
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };
  return { git, calls };
}

const result = (id: string, status: string, extra: Record<string, unknown> = {}) => ({ id, status, ...extra });

// --- Task 1: status model, worktree safety, gate table --------------------------------------------------------------

test("aggregate: every gate PASS is PASS", () => {
  const verdict = gate.aggregate([result("unit", "PASS"), result("lint", "PASS")]);
  assert.equal(verdict.verdict, "PASS");
});

test("aggregate: one SKIPPED gate is FAIL, a skip is not evidence", () => {
  const verdict = gate.aggregate([result("unit", "PASS"), result("lint", "SKIPPED")]);
  assert.equal(verdict.verdict, "FAIL");
  assert.match(verdict.reasons.join("\n"), /lint: SKIPPED is not evidence/);
});

test("aggregate: BLOCKED without a FAIL is BLOCKED, a FAIL beats BLOCKED", () => {
  assert.equal(gate.aggregate([result("unit", "PASS"), result("e2e-mutation", "BLOCKED", { blockedKind: "ENV" })]).verdict, "BLOCKED");
  assert.equal(gate.aggregate([result("unit", "FAIL"), result("e2e-mutation", "BLOCKED")]).verdict, "FAIL");
});

test("aggregate: no results, an unknown status and a missing required gate are FAIL", () => {
  assert.equal(gate.aggregate([]).verdict, "FAIL");
  assert.equal(gate.aggregate([result("unit", "OK")]).verdict, "FAIL");
  assert.equal(gate.aggregate([result("unit", "PASS")], { required: ["unit", "lint"] }).verdict, "FAIL");
});

test("removeWorktree refuses a path outside the temp directory and any path without the portia-release- prefix", () => {
  const { git, calls } = fakeGit(() => ({ status: 0 }));
  const deps = { git, tmpdir: TMP, fs: { existsSync: () => false } };
  for (const bad of [
    path.resolve(path.sep, "work", "portia-site"),
    path.join(TMP, "other-dir"),
    path.join(TMP, "nested", "portia-release-0123456789ab-x"),
    path.resolve(path.sep, "elsewhere", "portia-release-0123456789ab-x"),
    path.join(TMP, "..", "portia-release-0123456789ab-x"),
    "",
  ]) {
    assert.throws(() => gate.removeWorktree(bad, deps), /worktree-remove-refused/, bad);
  }
  assert.equal(calls.length, 0, "git must not be called for a refused path");
});

test("removeWorktree runs `git worktree remove --force <path>` for its own path and proves the worktree is gone", () => {
  const { git, calls } = fakeGit((args) => ({ status: 0, stdout: args[1] === "list" ? "worktree /repo\n" : "" }));
  gate.removeWorktree(WORKTREE, { git, tmpdir: TMP, fs: { existsSync: () => false } });
  assert.deepEqual(calls[0], ["worktree", "remove", "--force", WORKTREE]);
  assert.deepEqual(calls[1], ["worktree", "list", "--porcelain"]);
});

test("removeWorktree: a non-zero git exit, a still-listed worktree and a remaining directory throw", () => {
  const failing = fakeGit(() => ({ status: 128, stderr: "fatal: not a worktree" }));
  assert.throws(() => gate.removeWorktree(WORKTREE, { git: failing.git, tmpdir: TMP, fs: { existsSync: () => false } }), /worktree-remove-failed/);
  const listed = fakeGit((args) => ({ status: 0, stdout: args[1] === "list" ? `worktree ${WORKTREE}\n` : "" }));
  assert.throws(() => gate.removeWorktree(WORKTREE, { git: listed.git, tmpdir: TMP, fs: { existsSync: () => false } }), /worktree-still-listed/);
  const remains = fakeGit(() => ({ status: 0 }));
  assert.throws(() => gate.removeWorktree(WORKTREE, { git: remains.git, tmpdir: TMP, fs: { existsSync: () => true } }), /worktree-dir-remains/);
});

test("createWorktree resolves the commit, adds a detached worktree under the temp directory and throws on a non-zero exit", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const ok = fakeGit((args) => (args[0] === "rev-parse" ? { status: 0, stdout: `${sha}\n` } : { status: 0 }));
  const created = gate.createWorktree("HEAD", { git: ok.git, tmpdir: TMP, stamp: () => "20261104T000000000Z" });
  assert.equal(created.commit, sha);
  assert.equal(created.path, path.join(TMP, "portia-release-0123456789ab-20261104T000000000Z"));
  assert.deepEqual(ok.calls[1], ["worktree", "add", "--detach", created.path, sha]);

  const badCommit = fakeGit(() => ({ status: 128, stderr: "unknown revision" }));
  assert.throws(() => gate.createWorktree("nope", { git: badCommit.git, tmpdir: TMP, stamp: () => "x" }), /commit-unresolved/);
  const addFails = fakeGit((args) => (args[0] === "rev-parse" ? { status: 0, stdout: `${sha}\n` } : { status: 128, stderr: "fatal: exists" }));
  assert.throws(() => gate.createWorktree("HEAD", { git: addFails.git, tmpdir: TMP, stamp: () => "x" }), /worktree-add-failed/);
});

function gateTable(rows: string[][]): string {
  const header = "| Gate | Команда | Exit | Статус | Passed/Failed/Skipped/Flaky | Артефакты |\n|---|---|---|---|---|---|";
  return `## Гейты\n\n${header}\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n`;
}

test("verifyGateTable rejects a PASS row with a non-zero or missing exit and an unknown status or gate id", () => {
  const rows = [
    ["node-version", "`node --version`", "1", "PASS", "-", "-"],
    ["tree-clean", "`git status --porcelain`", "-", "PASS", "-", "-"],
    ["npm-ci", "`npm.cmd ci`", "0", "GREEN", "-", "-"],
    ["made-up", "`x`", "0", "PASS", "-", "-"],
  ];
  const errors = gate.verifyGateTable(gateTable(rows));
  assert.ok(errors.some((error: string) => /node-version: PASS row has exit "1"/.test(error)), errors.join("\n"));
  assert.ok(errors.some((error: string) => /tree-clean: PASS row has exit "-"/.test(error)));
  assert.ok(errors.some((error: string) => /npm-ci: unknown status/.test(error)));
  assert.ok(errors.some((error: string) => /made-up: unknown gate id/.test(error)));
});

test("verifyGateTable accepts honest rows and reports a missing or duplicated gate only when every gate is required", () => {
  const rows = [
    ["node-version", "`node --version`", "0", "PASS", "-", "node-version-1.log"],
    ["tree-clean", "`git status --porcelain`", "0", "PASS", "-", "tree-clean-1.log"],
  ];
  assert.deepEqual(gate.verifyGateTable(gateTable(rows)), []);
  const strict = gate.verifyGateTable(gateTable(rows), { requireAll: true });
  assert.ok(strict.some((error: string) => /npm-ci: gate row is missing/.test(error)));
  const duplicate = gate.verifyGateTable(gateTable([...rows, rows[0]]));
  assert.ok(duplicate.some((error: string) => /node-version: gate row appears more than once/.test(error)));
  assert.ok(gate.verifyGateTable("no table here").some((error: string) => /gate table/.test(error)));
});

test("tracer: the rendered gate table of a run verifies and carries the verdict", () => {
  const run = {
    commit: "0123456789abcdef0123456789abcdef01234567",
    node: "v22.13.1",
    startedAt: "2026-11-04T00:00:00.000Z",
    artifactsDir: "test-results/release-gate/0123456789ab-x",
    partial: true,
    only: ["node-version", "tree-clean"],
    results: [
      { id: "node-version", command: "node --version", exitCode: 0, status: "PASS", counts: null, artifacts: ["node-version-1.log"] },
      { id: "tree-clean", command: "git status --porcelain", exitCode: 0, status: "PASS", counts: null, artifacts: ["tree-clean-1.log"] },
    ],
    env: [],
    verdict: "PASS",
    reasons: [],
  };
  const markdown = gate.renderEvidence(run);
  assert.deepEqual(gate.verifyGateTable(markdown), []);
  assert.match(markdown, /^Итог: PASS$/m);
  assert.match(markdown, /^Режим: partial \(node-version, tree-clean\)$/m);
});

test("the runner script contains no git clean, reset --hard or stash", () => {
  const source = readFileSync(new URL("../scripts/phase20-release-gate.mjs", import.meta.url), "utf8");
  const code = source.split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n");
  assert.doesNotMatch(code, /["'`]clean["'`]/);
  assert.doesNotMatch(code, /--hard/);
  assert.doesNotMatch(code, /["'`]stash["'`]/);
  assert.ok(existsSync(new URL("../scripts/phase20-release-gate.mjs", import.meta.url)));
});

// --- Task 2: catalogue, Playwright classification, waivers, environment, running gates -----------------------------------

const waiverRegistry = readFileSync(new URL("../.planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-PLAYWRIGHT-WAIVERS.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function pwTest(status: string, extra: Record<string, unknown> = {}) {
  const passed = status === "expected" ? "passed" : status === "skipped" ? "skipped" : "failed";
  return { projectName: "chromium-desktop", status, annotations: [], results: [{ status: passed, retry: 0 }], ...extra };
}

function pwReport(specs: { title: string; file?: string; tests: unknown[] }[], extra: Record<string, unknown> = {}) {
  return {
    suites: [{ title: "x.spec.ts", file: "x.spec.ts", suites: [{ title: "group", specs: specs.map((spec, index) => ({ title: spec.title, file: spec.file ?? "x.spec.ts", line: index + 1, tests: spec.tests })) }] }],
    errors: [],
    stats: {},
    ...extra,
  };
}

test("GATES: the sixteen ids of 20-13 in order, each with a command", () => {
  assert.deepEqual(
    gate.GATES.map((entry: { id: string }) => entry.id),
    ["node-version", "tree-clean", "npm-ci", "unit", "typecheck", "build", "lint", "audit-prod", "audit-evidence", "visual-manifest", "e2e-full", "visual-approved", "visual-phase20", "mutation-attest", "e2e-mutation", "staging-live"],
  );
  for (const entry of gate.GATES) assert.ok(entry.command.length > 0, entry.id);
});

test("GATES: commands follow 20-13 (npm.cmd ci, no bare --verify of the visual manifest, retries 0 on every Playwright step)", () => {
  const byId = (id: string) => gate.GATES.find((entry: { id: string }) => entry.id === id);
  assert.equal(byId("npm-ci").command, "npm.cmd ci");
  assert.equal(byId("unit").command, "npm.cmd test");
  assert.equal(byId("typecheck").command, "npm.cmd exec tsc -- --noEmit");
  assert.equal(byId("audit-prod").command, "npm.cmd audit --omit=dev");
  assert.equal(byId("audit-evidence").command, "node scripts/phase20-audit-check.mjs --verify");
  const manifest = byId("visual-manifest");
  assert.match(manifest.command, /scripts\/phase15-visual-manifest\.mjs --verify-promotion/);
  for (const step of manifest.steps) {
    if (step.args[0] === "scripts/phase15-visual-manifest.mjs") assert.ok(!step.args.includes("--verify"), "the signed-evidence rewriting mode --verify is forbidden");
  }
  const source = readFileSync(new URL("../scripts/phase20-release-gate.mjs", import.meta.url), "utf8");
  assert.ok((source.match(/verify-promotion/g) ?? []).length >= 1);
  for (const entry of gate.GATES.filter((item: { kind: string }) => item.kind === "playwright")) {
    for (const step of entry.steps) {
      for (const flag of ["--retries=0", "--fail-on-flaky-tests", "--trace=retain-on-first-failure"]) assert.ok(step.args.includes(flag), `${entry.id} lacks ${flag}`);
    }
  }
  assert.match(byId("e2e-full").command, /--grep-invert @phase20/);
  assert.match(byId("visual-phase20").command, /tests\/e2e\/visual\/phase20\.spec\.ts/);
  assert.match(byId("e2e-mutation").command, /editor-layout\.spec\.ts tests\/e2e\/specs\/editor-notes\.spec\.ts/);
  assert.equal(byId("staging-live").command, "npm.cmd run test:staging-live");
});

test("classifyPlaywright: expected is PASS with counts", () => {
  const classified = gate.classifyPlaywright(pwReport([{ title: "a", tests: [pwTest("expected")] }, { title: "b", tests: [pwTest("expected")] }]));
  assert.equal(classified.status, "PASS");
  assert.deepEqual(classified.counts, { passed: 2, failed: 0, flaky: 0, skipped: 0, blocked: 0 });
});

test("classifyPlaywright: a flaky test and a retry-pass are FAIL, never PASS", () => {
  const flaky = gate.classifyPlaywright(pwReport([{ title: "flaky one", tests: [pwTest("flaky")] }]));
  assert.equal(flaky.status, "FAIL");
  assert.equal(flaky.counts.flaky, 1);
  assert.match(flaky.failures[0].id, /flaky one/);
  const retried = gate.classifyPlaywright(pwReport([{ title: "retried", tests: [pwTest("expected", { results: [{ status: "failed", retry: 0 }, { status: "passed", retry: 1 }] })] }]));
  assert.equal(retried.status, "FAIL", "a retry that passed is still a failure");
  assert.equal(retried.failures[0].kind, "flaky");
});

test("classifyPlaywright: unexpected, an unknown status and a global error are FAIL", () => {
  assert.equal(gate.classifyPlaywright(pwReport([{ title: "boom", tests: [pwTest("unexpected")] }])).status, "FAIL");
  assert.equal(gate.classifyPlaywright(pwReport([{ title: "odd", tests: [pwTest("interrupted")] }])).status, "FAIL");
  assert.equal(gate.classifyPlaywright(pwReport([{ title: "ok", tests: [pwTest("expected")] }], { errors: [{ message: "worker crashed" }] })).status, "FAIL");
  assert.equal(gate.classifyPlaywright(pwReport([{ title: "ok", tests: [pwTest("expected")] }], { stats: { unexpected: 2 } })).status, "FAIL");
});

test("classifyPlaywright: a skip annotated BLOCKED is BLOCKED, any other skip is SKIPPED, neither is PASS", () => {
  const blocked = gate.classifyPlaywright(pwReport([
    { title: "ok", tests: [pwTest("expected")] },
    { title: "data", tests: [pwTest("skipped", { annotations: [{ type: "skip", description: "BLOCKED (DATA): no portrait on the target" }] })] },
    { title: "env", tests: [pwTest("skipped", { annotations: [{ type: "skip", description: "BLOCKED (ENV): safe target unavailable" }] })] },
  ]));
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.counts.blocked, 2);
  assert.deepEqual(blocked.blockedKinds, ["DATA", "ENV"]);
  const skipped = gate.classifyPlaywright(pwReport([{ title: "quiet skip", tests: [pwTest("skipped", { annotations: [{ type: "skip", description: "not today" }] })] }, { title: "ok", tests: [pwTest("expected")] }]));
  assert.equal(skipped.status, "SKIPPED");
  const failPlusBlocked = gate.classifyPlaywright(pwReport([{ title: "boom", tests: [pwTest("unexpected")] }, { title: "data", tests: [pwTest("skipped", { annotations: [{ type: "skip", description: "BLOCKED (DATA): x" }] })] }]));
  assert.equal(failPlusBlocked.status, "FAIL");
});

test("classifyPlaywright: an empty or missing report is FAIL", () => {
  assert.equal(gate.classifyPlaywright(pwReport([])).status, "FAIL");
  assert.equal(gate.classifyPlaywright(null).status, "FAIL");
  assert.equal(gate.classifyPlaywright({}).status, "FAIL");
});

test("readWaivers reads the real registry: PW-07 accepted by the owner, PW-10 still awaiting", () => {
  const rows: { id: string; klass: string; accepted: boolean }[] = gate.readWaivers(waiverRegistry);
  assert.equal(rows.length, 10);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pw07 = byId.get("PW-07")!;
  const pw10 = byId.get("PW-10")!;
  assert.equal(pw07.klass, "waiver");
  assert.equal(pw07.accepted, true);
  assert.equal(pw10.klass, "waiver");
  assert.equal(pw10.accepted, false);
  assert.equal(byId.get("PW-01")!.klass, "fixed");
  assert.equal(byId.get("PW-02")!.klass, "expected-fault");
  assert.deepEqual(rows.filter((row) => row.klass === "waiver" && !row.accepted).map((row) => row.id), ["PW-10"]);
});

function registry(verdict: string, date: string, klass = "waiver") {
  return [
    "## Реестр",
    "",
    "| ID | Спек и тест | Проект | Наблюдение | Причина | Класс | Изменение | Команда и итог | Вердикт владельца | Дата |",
    "|----|----|----|----|----|----|----|----|----|----|",
    `| PW-99 | \`x.spec.ts\` «flaky one» | chromium-desktop | n | n | ${klass} | - | - | ${verdict} | ${date} |`,
    "",
  ].join("\n");
}

test("readWaivers: «принято» needs a date; «не принято» and a bare «ОЖИДАЕТ ВЛАДЕЛЬЦА» are not accepted", () => {
  const accepted = (verdict: string, date: string, klass?: string) => gate.readWaivers(registry(verdict, date, klass))[0].accepted;
  assert.equal(accepted("принято (владелец, 2026-11-04)", "2026-11-04"), true);
  assert.equal(accepted("принято", "2026-11-04"), true, "the date column may carry the date");
  assert.equal(accepted("принято", "-"), false, "no date");
  assert.equal(accepted("не принято (владелец, 2026-11-04)", "2026-11-04"), false);
  assert.equal(accepted("ОЖИДАЕТ ВЛАДЕЛЬЦА", "-"), false);
  assert.equal(accepted("принято (владелец, 2026-11-04)", "2026-11-04", "fixed"), false, "only the waiver class can be accepted");
});

test("classifyPlaywright + waivers: a failure under a waiver without the owner's verdict is FAIL, not waived", () => {
  const pw10Title = "[STAB-A11Y-01] home desktop and the opened desktop surfaces have no critical or serious axe violations";
  const classified = gate.classifyPlaywright(
    pwReport([{ title: pw10Title, file: "specs/accessibility.spec.ts", tests: [pwTest("unexpected")] }]),
    gate.readWaivers(waiverRegistry),
  );
  assert.equal(classified.status, "FAIL");
  assert.equal(classified.waived, false);
  assert.equal(classified.failures[0].waiver, "PW-10");
  assert.equal(classified.failures[0].waived, false);
});

test("classifyPlaywright + waivers: with the owner's «принято» and a date the gate stays FAIL but is marked waived", () => {
  const pw07Title = "[STAB-MEDIA-03] a portrait that never answers gives up after 15s";
  const classified = gate.classifyPlaywright(
    pwReport([{ title: pw07Title, file: "specs/media-states.spec.ts", tests: [pwTest("unexpected", { projectName: "firefox-desktop" })] }]),
    gate.readWaivers(waiverRegistry),
  );
  assert.equal(classified.status, "FAIL");
  assert.equal(classified.waived, true);
  assert.equal(classified.failures[0].waiver, "PW-07");
  const otherProject = gate.classifyPlaywright(
    pwReport([{ title: pw07Title, file: "specs/media-states.spec.ts", tests: [pwTest("unexpected", { projectName: "chromium-desktop" })] }]),
    gate.readWaivers(waiverRegistry),
  );
  assert.equal(otherProject.waived, false, "PW-07 covers firefox-desktop only");
});

test("classifyPlaywright + waivers: an expected-fault or fixed row never excuses a failing test", () => {
  const classified = gate.classifyPlaywright(
    pwReport([{ title: "[STAB-APP-03] Сотрудники: a first load that fails and then recovers", file: "specs/app-states.spec.ts", tests: [pwTest("unexpected")] }]),
    gate.readWaivers(waiverRegistry),
  );
  assert.equal(classified.status, "FAIL");
  assert.equal(classified.waived, false);
  assert.equal(classified.failures[0].waiver, null);
});

test("aggregate: a waived FAIL gives PASS-WITH-OWNER-WAIVERS, an unwaived one FAIL", () => {
  assert.equal(gate.aggregate([result("unit", "PASS"), result("e2e-full", "FAIL", { waived: true })]).verdict, "PASS-WITH-OWNER-WAIVERS");
  assert.equal(gate.aggregate([result("unit", "PASS"), result("e2e-full", "FAIL", { waived: false })]).verdict, "FAIL");
  assert.equal(gate.aggregate([result("e2e-full", "FAIL", { waived: true }), result("e2e-mutation", "BLOCKED")]).verdict, "BLOCKED");
});

test("aggregate: the registry itself is judged when Playwright gates ran (PW-10 pending is FAIL, PW-07 accepted is a waiver verdict)", () => {
  const waivers = gate.readWaivers(waiverRegistry);
  const allPass = [result("e2e-full", "PASS"), result("unit", "PASS")];
  const pending = gate.aggregate(allPass, { playwright: true, waivers });
  assert.equal(pending.verdict, "FAIL");
  assert.match(pending.reasons.join("\n"), /PW-10: waiver has no owner verdict/);
  const acceptedOnly = gate.aggregate(allPass, { playwright: true, waivers: waivers.filter((row: { id: string }) => row.id !== "PW-10") });
  assert.equal(acceptedOnly.verdict, "PASS-WITH-OWNER-WAIVERS");
  assert.equal(gate.aggregate(allPass, { playwright: false, waivers }).verdict, "PASS", "no Playwright gate ran: the registry is not judged");
  assert.equal(gate.aggregate(allPass, { playwright: true, waivers: null }).verdict, "FAIL", "a missing registry is FAIL");
});

test("envPresence returns names and presence only; a secret value is never rendered", () => {
  const presence = gate.envPresence(["PORTIA_E2E_TARGET_ENVIRONMENT", "FAKE_SECRET"], { FAKE_SECRET: "s3cr3t-value" });
  assert.deepEqual(presence, [{ name: "PORTIA_E2E_TARGET_ENVIRONMENT", present: false }, { name: "FAKE_SECRET", present: true }]);
  assert.doesNotMatch(JSON.stringify(presence), /s3cr3t-value/);
  const markdown = gate.renderEvidence({
    commit: "0123456789abcdef0123456789abcdef01234567",
    node: "v22.13.1",
    startedAt: "t",
    artifactsDir: "a",
    results: [{ id: "node-version", command: "node --version", exitCode: 0, status: "PASS", counts: null, artifacts: [] }],
    env: presence,
    verdict: "PASS",
    reasons: [],
  });
  assert.match(markdown, /FAKE_SECRET \| да/);
  assert.doesNotMatch(markdown, /s3cr3t-value/, "secret value never rendered");
});

// A scratch worktree and artifact directory for runGate; `exec` is faked, the filesystem is real.
function harness(env: Record<string, string>, execImpl: (file: string, args: string[], worktree: string) => { status: number; stdout?: string; stderr?: string }) {
  const base = mkdtempSync(path.join(os.tmpdir(), "phase20-gate-test-"));
  const worktree = path.join(base, "wt");
  const artifactsDir = path.join(base, "artifacts");
  mkdirSync(worktree);
  mkdirSync(artifactsDir);
  const calls: { file: string; args: string[] }[] = [];
  const deps = {
    fs: nodeFs,
    env,
    exec: (file: string, args: string[]) => {
      calls.push({ file, args });
      const outcome = execImpl(file, args, worktree);
      return { status: outcome.status, stdout: outcome.stdout ?? "", stderr: outcome.stderr ?? "", error: null };
    },
  };
  type GateOutcome = { id: string; status: string; detail?: string; reason?: string; [key: string]: unknown };
  const results: GateOutcome[] = [];
  const run = (id: string, waivers: unknown = []) => {
    const entry = gate.GATES.find((item: { id: string }) => item.id === id);
    const outcome = gate.runGate(entry, { deps, worktree, artifactsDir, results, waivers });
    results.push(outcome);
    return outcome;
  };
  return { run, calls, worktree, artifactsDir, results, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

const writeReport = (worktree: string, report: unknown) => {
  mkdirSync(path.join(worktree, "test-results", "playwright"), { recursive: true });
  writeFileSync(path.join(worktree, "test-results", "playwright", "results.json"), JSON.stringify(report));
};
const PUBLIC_ENV = { NEXT_PUBLIC_SUPABASE_URL: "x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "y", PORTIA_PROMOTION_DEVICE_SECRET: "z" };
const MUTATION_ENV = Object.fromEntries(gate.MUTATION_ENV.map((name: string) => [name, "v"]));
const nodeTestOutput = (pass: number, fail: number, skipped: number) => `# tests ${pass + fail + skipped}\n# pass ${pass}\n# fail ${fail}\n# cancelled 0\n# skipped ${skipped}\n`;

test("runGate node-version: PASS for v22.13.x, FAIL with the actual version otherwise", () => {
  const good = harness({}, () => ({ status: 0, stdout: "v22.13.1\n" }));
  assert.equal(good.run("node-version").status, "PASS");
  assert.equal(good.results[0].detail, "v22.13.1");
  good.cleanup();
  const bad = harness({}, () => ({ status: 0, stdout: "v24.1.0\n" }));
  const outcome = bad.run("node-version");
  assert.equal(outcome.status, "FAIL");
  assert.match(outcome.reason, /v24\.1\.0/);
  bad.cleanup();
});

test("runGate tree-clean: a dirty `git status --porcelain` is FAIL", () => {
  const dirty = harness({}, () => ({ status: 0, stdout: " M package.json\n" }));
  const outcome = dirty.run("tree-clean");
  assert.equal(outcome.status, "FAIL");
  assert.match(outcome.reason, /package\.json/);
  dirty.cleanup();
});

test("runGate unit: counts come from the test summary; `# pass 0`, failures and a missing summary are FAIL", () => {
  const green = harness({}, () => ({ status: 0, stdout: nodeTestOutput(1250, 0, 3) }));
  green.results.push({ id: "npm-ci", status: "PASS" });
  const outcome = green.run("unit");
  assert.equal(outcome.status, "PASS", "skipped unit tests are recorded, not a verdict");
  assert.deepEqual(outcome.counts, { passed: 1250, failed: 0, flaky: 0, skipped: 3, blocked: 0 });
  green.cleanup();
  for (const [stdout, status] of [[nodeTestOutput(0, 0, 0), 0], [nodeTestOutput(5, 1, 0), 1], ["nothing useful\n", 0]] as [string, number][]) {
    const bad = harness({}, () => ({ status, stdout }));
    bad.results.push({ id: "npm-ci", status: "PASS" });
    assert.equal(bad.run("unit").status, "FAIL", stdout);
    bad.cleanup();
  }
});

test("runGate: a gate that needs npm ci is BLOCKED when npm-ci is not PASS and is not executed", () => {
  const failing = harness({}, () => ({ status: 1, stdout: "npm error code E401\n" }));
  assert.equal(failing.run("npm-ci").status, "FAIL");
  const unit = failing.run("unit");
  assert.equal(unit.status, "BLOCKED");
  assert.match(unit.reason, /npm-ci is FAIL/);
  assert.equal(failing.calls.length, 1, "unit was not executed");
  failing.cleanup();
});

test("runGate npm-ci and audit-prod: a network failure is BLOCKED (ENV), never PASS", () => {
  const offline = harness({}, () => ({ status: 1, stderr: "npm error code ENOTFOUND\nnpm error network request failed" }));
  const install = offline.run("npm-ci");
  assert.equal(install.status, "BLOCKED");
  assert.equal(install.blockedKind, "ENV");
  const audit = offline.run("audit-prod");
  assert.equal(audit.status, "BLOCKED");
  offline.cleanup();
});

test("runGate audit-prod: PASS only with exit 0 and `found 0 vulnerabilities`", () => {
  const clean = harness({}, () => ({ status: 0, stdout: "found 0 vulnerabilities\n" }));
  assert.equal(clean.run("audit-prod").status, "PASS");
  clean.cleanup();
  const silent = harness({}, () => ({ status: 0, stdout: "" }));
  assert.equal(silent.run("audit-prod").status, "FAIL");
  silent.cleanup();
  const vulnerable = harness({}, () => ({ status: 1, stdout: "2 vulnerabilities (1 moderate, 1 high)\n" }));
  assert.equal(vulnerable.run("audit-prod").status, "FAIL");
  vulnerable.cleanup();
});

test("runGate visual-manifest: both steps run; a failing --verify-promotion is FAIL", () => {
  const broken = harness({}, (_file, args) => (args[0] === "scripts/phase15-visual-manifest.mjs" ? { status: 1, stderr: "PORTIA_PROMOTION_DRIFT" } : { status: 0, stdout: nodeTestOutput(37, 0, 0) }));
  broken.results.push({ id: "npm-ci", status: "PASS" });
  const outcome = broken.run("visual-manifest");
  assert.equal(outcome.status, "FAIL");
  assert.equal(broken.calls.length, 2);
  assert.ok(broken.calls[1].args.includes("--verify-promotion") && !broken.calls[1].args.includes("--verify"));
  broken.cleanup();
});

test("runGate staging-live: a skipped live test is SKIPPED, not PASS", () => {
  const skipped = harness({}, () => ({ status: 0, stdout: nodeTestOutput(10, 0, 4) }));
  skipped.results.push({ id: "mutation-attest", status: "PASS" });
  assert.equal(skipped.run("staging-live").status, "SKIPPED");
  skipped.cleanup();
  const live = harness({}, () => ({ status: 0, stdout: nodeTestOutput(10, 0, 0) }));
  live.results.push({ id: "mutation-attest", status: "PASS" });
  assert.equal(live.run("staging-live").status, "PASS");
  live.cleanup();
});

test("runGate mutation: a failed attestation makes e2e-mutation and staging-live BLOCKED (ENV) without running them", () => {
  const env = { ...PUBLIC_ENV, ...MUTATION_ENV };
  const attest = harness(env, () => ({ status: 1, stderr: "[PORTIA_E2E_PREFLIGHT:target-attestation]" }));
  attest.results.push({ id: "npm-ci", status: "PASS" });
  assert.equal(attest.run("mutation-attest").status, "FAIL");
  const before = attest.calls.length;
  const mutation = attest.run("e2e-mutation");
  const live = attest.run("staging-live");
  for (const outcome of [mutation, live]) {
    assert.equal(outcome.status, "BLOCKED");
    assert.equal(outcome.blockedKind, "ENV");
    assert.match(outcome.reason, /mutation-attest is FAIL/);
  }
  assert.equal(attest.calls.length, before, "neither gate was executed");
  assert.equal(gate.aggregate(attest.results).verdict, "FAIL");
  attest.cleanup();
});

test("runGate: missing environment variables are BLOCKED (ENV), reported by name only", () => {
  const blocked = harness({ PORTIA_E2E_MUTATION_CONFIRM: "s3cr3t-value" }, () => ({ status: 0 }));
  blocked.results.push({ id: "npm-ci", status: "PASS" });
  const outcome = blocked.run("mutation-attest");
  assert.equal(outcome.status, "BLOCKED");
  assert.equal(outcome.blockedKind, "ENV");
  assert.match(outcome.reason, /PORTIA_E2E_TARGET_ID/);
  assert.doesNotMatch(outcome.reason, /s3cr3t-value/);
  assert.equal(blocked.calls.length, 0);
  const e2e = blocked.run("e2e-full");
  assert.equal(e2e.status, "BLOCKED");
  assert.match(e2e.reason, /NEXT_PUBLIC_SUPABASE_URL/);
  blocked.cleanup();
});

test("runGate visual-phase20: without tests/e2e/visual/phase20.spec.ts the gate is BLOCKED (OWNER)", () => {
  const absent = harness(PUBLIC_ENV, () => ({ status: 0 }));
  absent.results.push({ id: "npm-ci", status: "PASS" });
  const outcome = absent.run("visual-phase20");
  assert.equal(outcome.status, "BLOCKED");
  assert.equal(outcome.blockedKind, "OWNER");
  assert.match(outcome.reason, /нет одобренных эталонов 20-12/);
  assert.equal(absent.calls.length, 0);
  absent.cleanup();
  const present = harness(PUBLIC_ENV, (_file, _args, worktree) => {
    writeReport(worktree, pwReport([{ title: "frame", tests: [pwTest("expected")] }]));
    return { status: 0 };
  });
  mkdirSync(path.join(present.worktree, "tests", "e2e", "visual"), { recursive: true });
  writeFileSync(path.join(present.worktree, "tests", "e2e", "visual", "phase20.spec.ts"), "// spec\n");
  present.results.push({ id: "npm-ci", status: "PASS" });
  assert.equal(present.run("visual-phase20").status, "PASS");
  present.cleanup();
});

test("runGate Playwright: flaky or retried is FAIL even with exit 0; BLOCKED skips are BLOCKED; clean is PASS; the report is copied", () => {
  const cases: [string, unknown, number, string][] = [
    ["flaky", pwReport([{ title: "t", tests: [pwTest("flaky")] }]), 0, "FAIL"],
    ["retry", pwReport([{ title: "t", tests: [pwTest("expected", { results: [{ status: "failed", retry: 0 }, { status: "passed", retry: 1 }] })] }]), 0, "FAIL"],
    ["blocked", pwReport([{ title: "t", tests: [pwTest("skipped", { annotations: [{ type: "skip", description: "BLOCKED (DATA): none" }] })] }]), 0, "BLOCKED"],
    ["quiet skip", pwReport([{ title: "t", tests: [pwTest("skipped")] }]), 0, "SKIPPED"],
    ["clean", pwReport([{ title: "t", tests: [pwTest("expected")] }]), 0, "PASS"],
    ["clean report but exit 1", pwReport([{ title: "t", tests: [pwTest("expected")] }]), 1, "FAIL"],
    ["blocked report but exit 1", pwReport([{ title: "t", tests: [pwTest("skipped", { annotations: [{ type: "skip", description: "BLOCKED (ENV): x" }] })] }]), 1, "FAIL"],
  ];
  for (const [name, report, status, expected] of cases) {
    const lane = harness(PUBLIC_ENV, (_file, _args, worktree) => {
      writeReport(worktree, report);
      return { status };
    });
    lane.results.push({ id: "npm-ci", status: "PASS" });
    const outcome = lane.run("e2e-full");
    assert.equal(outcome.status, expected, name);
    assert.ok(nodeFs.existsSync(path.join(lane.artifactsDir, "e2e-full-1-results.json")), `${name}: results.json copied to the run directory`);
    assert.ok(lane.calls[0].args.includes("--output"), "the output directory is set per run");
    lane.cleanup();
  }
});

test("runGate Playwright: no results.json is FAIL; a stale report from a previous step is removed before the step", () => {
  const lane = harness(PUBLIC_ENV, () => ({ status: 0 }));
  lane.results.push({ id: "npm-ci", status: "PASS" });
  writeReport(lane.worktree, pwReport([{ title: "stale", tests: [pwTest("expected")] }]));
  const outcome = lane.run("e2e-full");
  assert.equal(outcome.status, "FAIL");
  assert.match(outcome.reason, /no results\.json/);
  lane.cleanup();
});

test("runGate Playwright: the e2e gate with a waiver registry marks only an owner-accepted failure as waived", () => {
  const waivers = gate.readWaivers(waiverRegistry);
  const failing = (title: string, file: string, project: string) => (_file: string, _args: string[], worktree: string) => {
    writeReport(worktree, pwReport([{ title, file, tests: [pwTest("unexpected", { projectName: project })] }]));
    return { status: 1 };
  };
  const accepted = harness(PUBLIC_ENV, failing("[STAB-MEDIA-03] a portrait that never answers gives up after 15s", "specs/media-states.spec.ts", "firefox-desktop"));
  accepted.results.push({ id: "npm-ci", status: "PASS" });
  const waived = accepted.run("e2e-full", waivers);
  assert.equal(waived.status, "FAIL");
  assert.equal(waived.waived, true);
  assert.deepEqual(waived.waivedBy, ["PW-07"]);
  assert.equal(gate.renderStatus(waived), "FAIL (waived: PW-07)");
  accepted.cleanup();
  const pending = harness(PUBLIC_ENV, failing("[STAB-A11Y-01] home desktop and the opened desktop surfaces have no critical or serious axe violations", "specs/accessibility.spec.ts", "chromium-desktop"));
  pending.results.push({ id: "npm-ci", status: "PASS" });
  const unwaived = pending.run("e2e-full", waivers);
  assert.equal(unwaived.status, "FAIL");
  assert.equal(unwaived.waived, false);
  pending.cleanup();
});

test("main --plan prints all sixteen gate ids and runs nothing", () => {
  let out = "";
  let executed = 0;
  const code = gate.main(["--plan"], { out: (text: string) => { out += text; }, exec: () => { executed += 1; return { status: 0 }; }, git: () => { executed += 1; return { status: 0 }; } });
  assert.equal(code, 0);
  assert.equal(executed, 0);
  for (const entry of gate.GATES) assert.ok(out.includes(entry.id), entry.id);
  assert.match(out, /^16 gates/);
});

test("main --run refuses PORTIA_E2E_TARGET_ENVIRONMENT=production before touching git", () => {
  let gitCalls = 0;
  let err = "";
  const code = gate.main(["--run", "--commit", "HEAD"], {
    env: { PORTIA_E2E_TARGET_ENVIRONMENT: "production" },
    git: () => { gitCalls += 1; return { status: 0, stdout: "", stderr: "" }; },
    err: (text: string) => { err += text; },
  });
  assert.notEqual(code, 0);
  assert.equal(gitCalls, 0);
  assert.match(err, /production-target/);
});

test("main --run rejects an unknown gate id and a missing --commit", () => {
  let err = "";
  const deps = { env: {}, git: () => ({ status: 0, stdout: "", stderr: "" }), err: (text: string) => { err += text; } };
  assert.equal(gate.main(["--run"], deps), 2);
  assert.notEqual(gate.main(["--run", "--commit", "HEAD", "--only", "no-such-gate"], deps), 0);
  assert.match(err, /unknown-gate/);
});
