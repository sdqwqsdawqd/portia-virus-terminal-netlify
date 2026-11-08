import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
// The owner accepted PW-10 on 2026-11-04. The pending-waiver rules are proven on a copy of the real
// registry with PW-10 put back to «ОЖИДАЕТ ВЛАДЕЛЬЦА», so they keep testing real rows, not only fixtures.
const pendingPw10Registry = (() => {
  const pending = waiverRegistry.replace(/^(\| PW-10 \|.*)\| принято[^|]*\| [^|]*\|$/m, "$1| ОЖИДАЕТ ВЛАДЕЛЬЦА | - |");
  assert.notEqual(pending, waiverRegistry, "the PW-10 row must be found to build the pending copy");
  return pending;
})();

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

test("GATES: the seventeen ids of 20-13 (D-68 adds ui-contract-offline) in order, each with a command", () => {
  assert.deepEqual(
    gate.GATES.map((entry: { id: string }) => entry.id),
    ["node-version", "tree-clean", "npm-ci", "unit", "typecheck", "build", "lint", "audit-prod", "audit-evidence", "visual-manifest", "e2e-full", "ui-contract-offline", "visual-approved", "visual-phase20", "mutation-attest", "e2e-mutation", "staging-live"],
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
  assert.match(byId("e2e-mutation").command, /editor-layout\.spec\.ts/);
  assert.equal(byId("staging-live").command, "npm.cmd run test:staging-live");
});

const OFFLINE_GATES = ["ui-contract-offline", "visual-approved", "visual-phase20"];
const CLI = "node node_modules/@playwright/test/cli.js test";

test("GATES (D-68): the three offline gates call the Playwright CLI directly, never npm run, and carry the offline data mode", () => {
  const byId = (id: string) => gate.GATES.find((entry: { id: string }) => entry.id === id);
  for (const id of OFFLINE_GATES) {
    const entry = byId(id);
    assert.equal(entry.offline, true, id);
    assert.ok(!entry.command.includes("npm"), `${id} must not go through npm`);
    for (const step of entry.steps) {
      assert.equal(step.file, "node", id);
      assert.deepEqual(step.args.slice(0, 2), ["node_modules/@playwright/test/cli.js", "test"], id);
      for (const flag of ["--retries=0", "--fail-on-flaky-tests"]) assert.ok(step.args.includes(flag), `${id} lacks ${flag}`);
      if (id !== "ui-contract-offline") assert.ok(step.args.includes("--update-snapshots=none"), `${id} lacks --update-snapshots=none`);
    }
    assert.ok(entry.requires.files.some((file: { path: string }) => file.path === "tests/e2e/harness/offline-supabase.cjs"), `${id} needs the harness file`);
    assert.equal(entry.requires.env, undefined, `${id} supplies its own public values`);
  }
  for (const id of ["e2e-full", "mutation-attest", "e2e-mutation", "staging-live", "unit"]) assert.ok(!byId(id).offline, id);
  assert.equal(gate.dataModeOf("visual-phase20"), "offline D-68");
  assert.equal(gate.dataModeOf("e2e-full"), "цель");
  assert.equal(gate.dataModeOf("e2e-mutation"), "staging");
  assert.equal(gate.dataModeOf("unit"), "-");
});

test("GATES (D-68): ui-contract-offline repeats the four functional checks of 20-58 with their projects", () => {
  const entry = gate.GATES.find((item: { id: string }) => item.id === "ui-contract-offline");
  assert.equal(entry.steps.length, 4);
  const line = (index: number) => entry.steps[index].args.join(" ");
  assert.match(line(0), /--project=chromium-desktop --project=chromium-phone/);
  assert.match(line(0), /tests\/e2e\/specs\/template-builder\.spec\.ts/);
  assert.match(line(0), /tests\/e2e\/specs\/accessibility\.spec\.ts/);
  assert.ok(entry.steps[0].args.includes("STAB-TMPL-01|template builder"));
  for (const project of ["chromium-desktop", "chromium-dpr125", "firefox-desktop", "chromium-phone", "webkit-phone"]) assert.match(line(1), new RegExp(`--project=${project}`));
  assert.ok(entry.steps[1].args.includes("D-61|D-65"));
  assert.match(line(2), /editor-ui-contract\.spec\.ts/);
  assert.match(line(2), /image-framing\.spec\.ts/);
  assert.match(line(2), /--project=chromium-desktop --project=chromium-phone/);
  assert.match(line(3), /--project=firefox-desktop --project=webkit-phone/);
  assert.ok(entry.steps[3].args.includes("D-66 touch|D-66 dialog|D-67 «Справочник» section photo"));
  assert.ok(entry.command.includes(CLI), "the command is the direct Playwright CLI call");
});

test("GATES (D-68): the old visual frames run on two steps, the @phase20 frames on chromium-desktop and chromium-phone", () => {
  const approved = gate.GATES.find((item: { id: string }) => item.id === "visual-approved");
  assert.equal(approved.steps.length, 2);
  const first = approved.steps[0].args.join(" ");
  assert.match(first, /tests\/e2e\/visual/);
  assert.match(first, /--project=chromium-desktop --project=chromium-dpr125/);
  assert.match(first, /--grep-invert @phase20/);
  const second = approved.steps[1].args.join(" ");
  for (const project of ["chromium-phone", "webkit-phone", "firefox-desktop"]) assert.match(second, new RegExp(`--project=${project}`));
  assert.match(second, /--grep-invert @phase20/);
  const phase20 = gate.GATES.find((item: { id: string }) => item.id === "visual-phase20");
  assert.match(phase20.steps[0].args.join(" "), /tests\/e2e\/visual\/phase20\.spec\.ts/);
  assert.match(phase20.steps[0].args.join(" "), /--project=chromium-desktop --project=chromium-phone/);
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

test("readWaivers reads the real registry: PW-07 and PW-10 accepted by the owner, no waiver pending", () => {
  const rows: { id: string; klass: string; accepted: boolean }[] = gate.readWaivers(waiverRegistry);
  assert.equal(rows.length, 10);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pw07 = byId.get("PW-07")!;
  const pw10 = byId.get("PW-10")!;
  assert.equal(pw07.klass, "waiver");
  assert.equal(pw07.accepted, true);
  assert.equal(pw10.klass, "waiver");
  assert.equal(pw10.accepted, true);
  assert.equal(byId.get("PW-01")!.klass, "fixed");
  assert.equal(byId.get("PW-02")!.klass, "expected-fault");
  assert.deepEqual(rows.filter((row) => row.klass === "waiver" && !row.accepted).map((row) => row.id), []);
  assert.equal(gate.readWaivers(pendingPw10Registry).find((row: { id: string }) => row.id === "PW-10")?.accepted, false);
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
    gate.readWaivers(pendingPw10Registry),
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
  const waivers = gate.readWaivers(pendingPw10Registry);
  assert.equal(
    gate.aggregate([result("e2e-full", "PASS"), result("unit", "PASS")], { playwright: true, waivers: gate.readWaivers(waiverRegistry) }).verdict,
    "PASS-WITH-OWNER-WAIVERS",
    "real registry: every waiver is accepted by the owner",
  );
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
const OFFLINE_VALUES = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_dummy0123456789abcdefghijklmnop",
  PORTIA_PROMOTION_DEVICE_SECRET: "dummy-device-secret-0123456789-abcdefghijklmnop",
};
// Names that must never reach an offline gate. Built from parts so this file never spells the privileged key name.
const PRIVILEGED = ["SERVICE", "ROLE"].join("_");
const PRIVILEGED_KEY = ["PORTIA_PROMO_LIVE", PRIVILEGED, "KEY"].join("_");
type ServerStart = { worktree: string; env: Record<string, string>; buildEnv?: Record<string, string> };

function harness(
  env: Record<string, string>,
  execImpl: (file: string, args: string[], worktree: string, runEnv: Record<string, string>) => { status: number; stdout?: string; stderr?: string },
  server: { ok?: boolean; reason?: string; stopped?: boolean } = {},
) {
  const base = mkdtempSync(path.join(os.tmpdir(), "phase20-gate-test-"));
  const worktree = path.join(base, "wt");
  const artifactsDir = path.join(base, "artifacts");
  mkdirSync(worktree);
  mkdirSync(artifactsDir);
  const calls: { file: string; args: string[]; env: Record<string, string> }[] = [];
  const serverEvents: string[] = [];
  const serverStarts: ServerStart[] = [];
  const deps = {
    fs: nodeFs,
    env,
    exec: (file: string, args: string[], options: { env: Record<string, string> }) => {
      calls.push({ file, args, env: options.env });
      const outcome = execImpl(file, args, worktree, options.env);
      return { status: outcome.status, stdout: outcome.stdout ?? "", stderr: outcome.stderr ?? "", error: null };
    },
    loadOfflineEnv: () => OFFLINE_VALUES,
    startServer: (options: ServerStart) => {
      serverEvents.push("start");
      serverStarts.push(options);
      return server.ok === false ? { ok: false, reason: server.reason ?? "no answer" } : { ok: true, pid: 4242 };
    },
    stopServer: () => {
      serverEvents.push("stop");
      return { stopped: server.stopped !== false, pid: 4242 };
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
  const addHarnessFile = () => {
    mkdirSync(path.join(worktree, "tests", "e2e", "harness"), { recursive: true });
    writeFileSync(path.join(worktree, "tests", "e2e", "harness", "offline-supabase.cjs"), "// harness\n");
  };
  return { run, calls, worktree, artifactsDir, results, serverEvents, serverStarts, addHarnessFile, cleanup: () => rmSync(base, { recursive: true, force: true }) };
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

test("runGate visual-phase20: without tests/e2e/visual/phase20.spec.ts the gate is BLOCKED (OWNER) and nothing runs", () => {
  const absent = harness({}, () => ({ status: 0 }));
  absent.addHarnessFile();
  absent.results.push({ id: "npm-ci", status: "PASS" });
  const outcome = absent.run("visual-phase20");
  assert.equal(outcome.status, "BLOCKED");
  assert.equal(outcome.blockedKind, "OWNER");
  assert.match(outcome.reason, /нет одобренных эталонов 20-12/);
  assert.equal(absent.calls.length, 0);
  assert.deepEqual(absent.serverEvents, [], "no server for a gate that cannot run");
  absent.cleanup();
  const present = harness({}, (_file, _args, worktree) => {
    writeReport(worktree, pwReport([{ title: "frame", tests: [pwTest("expected")] }]));
    return { status: 0 };
  });
  present.addHarnessFile();
  mkdirSync(path.join(present.worktree, "tests", "e2e", "visual"), { recursive: true });
  writeFileSync(path.join(present.worktree, "tests", "e2e", "visual", "phase20.spec.ts"), "// spec\n");
  present.results.push({ id: "npm-ci", status: "PASS" });
  const passed = present.run("visual-phase20");
  assert.equal(passed.status, "PASS");
  assert.equal(passed.dataMode, "offline D-68");
  present.cleanup();
});

function offlineLane(env: Record<string, string>, report: unknown, exitCode = 0, server: { ok?: boolean; reason?: string; stopped?: boolean } = {}) {
  const lane = harness(
    env,
    (_file, _args, worktree) => {
      writeReport(worktree, report);
      return { status: exitCode };
    },
    server,
  );
  lane.addHarnessFile();
  lane.results.push({ id: "npm-ci", status: "PASS" });
  return lane;
}

test("runGate offline (D-68): without the harness file in the checkout the gate is BLOCKED (ENV) and does not start", () => {
  const lane = harness({}, () => ({ status: 0 }));
  lane.results.push({ id: "npm-ci", status: "PASS" });
  const outcome = lane.run("ui-contract-offline");
  assert.equal(outcome.status, "BLOCKED");
  assert.equal(outcome.blockedKind, "ENV");
  assert.match(outcome.reason, /offline-supabase\.cjs/);
  assert.equal(lane.calls.length, 0);
  assert.deepEqual(lane.serverEvents, []);
  lane.cleanup();
});

test("runGate offline (D-68): a server that does not answer is BLOCKED (ENV) and no Playwright step runs", () => {
  const lane = offlineLane({}, pwReport([{ title: "t", tests: [pwTest("expected")] }]), 0, { ok: false, reason: "no answer on 127.0.0.1:3100 in 120 s" });
  const outcome = lane.run("visual-approved");
  assert.equal(outcome.status, "BLOCKED");
  assert.equal(outcome.blockedKind, "ENV");
  assert.match(outcome.reason, /127\.0\.0\.1:3100/);
  assert.equal(lane.calls.length, 0);
  assert.equal(outcome.dataMode, "offline D-68");
  lane.cleanup();
});

test("runGate offline (D-68): the Playwright process gets the offline values only, the server gets the harness, both without real values", () => {
  const real: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "https://real-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "real-anon-value",
    PORTIA_PROMOTION_DEVICE_SECRET: "real-device-secret",
    PORTIA_E2E_TARGET_ID: "staging-1",
    PORTIA_E2E_MUTATION_CONFIRM: "yes",
    [PRIVILEGED_KEY]: "do-not-leak",
    PORTIA_STAGING_DB_URL: "postgres://x",
    NODE_OPTIONS: "--max-old-space-size=4096",
    KEEP_ME: "kept",
  };
  const lane = offlineLane(real, pwReport([{ title: "t", tests: [pwTest("expected")] }]));
  const outcome = lane.run("ui-contract-offline");
  assert.equal(outcome.status, "PASS");
  const stepEnv = lane.calls[0].env;
  assert.equal(stepEnv.NEXT_PUBLIC_SUPABASE_URL, OFFLINE_VALUES.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(stepEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, OFFLINE_VALUES.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  assert.equal(stepEnv.PORTIA_PROMOTION_DEVICE_SECRET, OFFLINE_VALUES.PORTIA_PROMOTION_DEVICE_SECRET);
  assert.equal(stepEnv.PORTIA_E2E_ALLOW_HTTP, "1");
  assert.equal(stepEnv.PORTIA_E2E_BASE_URL, "http://127.0.0.1:3100");
  assert.equal(stepEnv.KEEP_ME, "kept");
  for (const name of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "PORTIA_E2E_TARGET_ID", "PORTIA_E2E_MUTATION_CONFIRM", PRIVILEGED_KEY, "PORTIA_STAGING_DB_URL", "NODE_OPTIONS", "PORTIA_E2E_OFFLINE_SUPABASE"]) {
    assert.equal(stepEnv[name], undefined, `${name} must not reach the Playwright process`);
  }
  assert.doesNotMatch(JSON.stringify(stepEnv), /real-project|real-anon|real-device|do-not-leak/);
  const server = lane.serverStarts[0];
  assert.equal(server.env.PORTIA_E2E_OFFLINE_SUPABASE, "1");
  assert.match(server.env.NODE_OPTIONS, /--require=.*tests[\\/]e2e[\\/]harness[\\/]offline-supabase\.cjs/);
  assert.equal(server.env.NEXT_PUBLIC_SUPABASE_URL, OFFLINE_VALUES.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(server.env.PORTIA_E2E_TARGET_ID, undefined);
  assert.doesNotMatch(JSON.stringify(server.env), /real-project|real-anon|real-device|do-not-leak/);
  lane.cleanup();
});

test("runGate offline (D-68): the server is started once and stopped after the gate, also when a step throws or fails", () => {
  const ok = offlineLane({}, pwReport([{ title: "t", tests: [pwTest("expected")] }]));
  ok.run("ui-contract-offline");
  assert.deepEqual(ok.serverEvents, ["start", "stop"]);
  assert.equal(ok.calls.length, 4, "four steps share one server");
  ok.cleanup();
  const failing = offlineLane({}, pwReport([{ title: "t", tests: [pwTest("unexpected")] }]), 1);
  assert.equal(failing.run("visual-approved").status, "FAIL");
  assert.deepEqual(failing.serverEvents, ["start", "stop"]);
  failing.cleanup();
  const throwing = harness({}, () => {
    throw new Error("spawn exploded");
  });
  throwing.addHarnessFile();
  throwing.results.push({ id: "npm-ci", status: "PASS" });
  assert.throws(() => throwing.run("ui-contract-offline"), /spawn exploded/);
  assert.deepEqual(throwing.serverEvents, ["start", "stop"], "stopped even when the step threw");
  throwing.cleanup();
});

test("runGate offline (D-68): a server that cannot be stopped makes an otherwise green gate FAIL", () => {
  const lane = offlineLane({}, pwReport([{ title: "t", tests: [pwTest("expected")] }]), 0, { stopped: false });
  const outcome = lane.run("ui-contract-offline");
  assert.equal(outcome.status, "FAIL");
  assert.match(outcome.reason, /could not be stopped/);
  lane.cleanup();
});

test("runGate offline (D-68): offline gates need npm ci first and are BLOCKED (DEP) without it", () => {
  const lane = harness({}, () => ({ status: 0 }));
  lane.addHarnessFile();
  const outcome = lane.run("ui-contract-offline");
  assert.equal(outcome.status, "BLOCKED");
  assert.equal(outcome.blockedKind, "DEP");
  assert.deepEqual(lane.serverEvents, []);
  lane.cleanup();
});

test("offline environment helpers: names stripped by pattern, base URL fixed, harness only in the server env", () => {
  const privilegedName = `SOME_${PRIVILEGED}_THING`;
  const child = gate.offlineChildEnv({ PATH: "p", [privilegedName]: "x", PORTIA_STAGING_X: "y", NODE_OPTIONS: "n", NEXT_PUBLIC_SUPABASE_URL: "real" }, OFFLINE_VALUES);
  assert.equal(child.PATH, "p");
  assert.equal(child[privilegedName], undefined);
  assert.equal(child.PORTIA_STAGING_X, undefined);
  assert.equal(child.NODE_OPTIONS, undefined);
  assert.equal(child.NEXT_PUBLIC_SUPABASE_URL, OFFLINE_VALUES.NEXT_PUBLIC_SUPABASE_URL);
  const server = gate.offlineServerEnv(child, "/wt/tests/e2e/harness/offline-supabase.cjs");
  assert.equal(server.NODE_OPTIONS, "--require=/wt/tests/e2e/harness/offline-supabase.cjs");
  assert.equal(server.PORTIA_E2E_OFFLINE_SUPABASE, "1");
  assert.equal(child.PORTIA_E2E_OFFLINE_SUPABASE, undefined);
});

test("classifyPlaywright (D-68, extended by D-69): a skip by project condition is accepted only with the source proof and a pass on another project", () => {
  const reason = "The two-column PC layout";
  const proven = { projectSkips: true, skipProofs: new Map([["x.spec.ts", [reason]]]) };
  const report = pwReport([
    { title: "two columns", tests: [pwTest("expected", { projectName: "chromium-desktop" }), pwTest("skipped", { projectName: "chromium-phone", annotations: [{ type: "skip", description: reason }] })] },
  ]);
  assert.equal(gate.classifyPlaywright(report).status, "SKIPPED", "by default every skip is SKIPPED");
  assert.equal(gate.classifyPlaywright(report, [], { projectSkips: true }).status, "SKIPPED", "the rule without a proof from the source explains nothing");
  const lenient = gate.classifyPlaywright(report, [], proven);
  assert.equal(lenient.status, "PASS");
  assert.equal(lenient.projectSkipped, 1);
  assert.equal(lenient.counts.skipped, 1, "the skip is still counted");
  const onlySkipped = gate.classifyPlaywright(
    pwReport([
      { title: "never ran", tests: [pwTest("skipped", { annotations: [{ type: "skip", description: reason }] })] },
      { title: "other", tests: [pwTest("expected")] },
    ]),
    [],
    proven,
  );
  assert.equal(onlySkipped.status, "SKIPPED", "a test skipped everywhere is not covered");
  const blocked = gate.classifyPlaywright(
    pwReport([{ title: "data", tests: [pwTest("expected", { projectName: "chromium-desktop" }), pwTest("skipped", { projectName: "chromium-phone", annotations: [{ type: "skip", description: "BLOCKED (DATA): none" }] })] }]),
    [],
    { projectSkips: true, skipProofs: new Map([["x.spec.ts", ["BLOCKED (DATA): none"]]]) },
  );
  assert.equal(blocked.status, "BLOCKED", "a BLOCKED skip is never excused as a project condition");
});

test("runGate offline (D-68): ui-contract-offline accepts project-condition skips proven by the source, a gate without the rule does not", () => {
  const source = ['test.beforeEach(({}, testInfo) => {', '  test.skip(testInfo.project.name.endsWith("-phone"), "PC layout");', "});"].join("\n");
  const report = pwReport([
    { title: "two columns", tests: [pwTest("expected", { projectName: "chromium-desktop" }), pwTest("skipped", { projectName: "chromium-phone", annotations: [{ type: "skip", description: "PC layout" }] })] },
  ]);
  const ui = offlineLane({}, report);
  mkdirSync(path.join(ui.worktree, "tests", "e2e"), { recursive: true });
  writeFileSync(path.join(ui.worktree, "tests", "e2e", "x.spec.ts"), source);
  const uiOutcome = ui.run("ui-contract-offline");
  assert.equal(uiOutcome.status, "PASS");
  assert.match(uiOutcome.reason, /project condition/);
  ui.cleanup();
  const noSource = offlineLane({}, report);
  assert.equal(noSource.run("ui-contract-offline").status, "SKIPPED", "without the spec source the condition is not proven");
  noSource.cleanup();
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
  const waivers = gate.readWaivers(pendingPw10Registry);
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

test("main --plan prints all seventeen gate ids and runs nothing", () => {
  let out = "";
  let executed = 0;
  const code = gate.main(["--plan"], { out: (text: string) => { out += text; }, exec: () => { executed += 1; return { status: 0 }; }, git: () => { executed += 1; return { status: 0 }; } });
  assert.equal(code, 0);
  assert.equal(executed, 0);
  for (const entry of gate.GATES) assert.ok(out.includes(entry.id), entry.id);
  assert.match(out, /^17 gates/);
  assert.match(out, /ui-contract-offline/);
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

// --- Task 3: --verify-evidence ---------------------------------------------------------------------------------------------

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const CLEAN_MATRIX = "## Блокеры релиза (D-12)\n\nТекст.\n\n| ID | Severity | Блокирует релиз |\n|---|---|---|\n| нет | нет | нет |\n\n## Не доказано\n";
const BLOCKER_MATRIX = "## Блокеры релиза (D-12)\n\n| ID | Severity | Блокирует релиз |\n|---|---|---|\n| SEC20-99 | high | да |\n\n## Не доказано\n";

type Row = { id: string; status: string; evidence?: string };

const D33_FIXTURE: Row[] = ["WR-03", "WR-05", "IN-01", "IN-02", "IN-03", "IN-04", "IN-05"].map((id) => ({ id, status: id === "IN-05" ? "disposition" : "fixed" }));
const DECISION_FIXTURE: Row[] = [
  { id: "D-36(б) staging", status: "BLOCKED (OWNER)" },
  { id: "D-36(б) production", status: "ОЖИДАЕТ ВЛАДЕЛЬЦА" },
  { id: "D-47 staging", status: "BLOCKED (OWNER)" },
  { id: "D-47 production", status: "ОЖИДАЕТ ВЛАДЕЛЬЦА" },
  { id: "T-20-31", status: "PASS" },
  { id: "D-43/D-44/D-37", status: "PASS" },
  { id: "D-40..D-42", status: "BLOCKED (ENV)" },
  { id: "D-39/D-45", status: "BLOCKED (OWNER)" },
];

const NPM_SOURCE = "--npm-cli C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js";

function fullRun(overrides: Record<string, unknown> = {}, gateStatus: (id: string) => Record<string, unknown> = () => ({})) {
  const results = gate.GATES.map((entry: { id: string; command: string; counts?: string }) => ({
    id: entry.id,
    command: entry.command,
    exitCode: 0,
    status: "PASS",
    counts: entry.counts ? { passed: 10, failed: 0, skipped: 0, flaky: 0, blocked: 0 } : null,
    artifacts: [`${entry.id}-1.log`],
    ...gateStatus(entry.id),
  }));
  return {
    commit: COMMIT,
    node: "v22.13.1",
    startedAt: "2026-11-04T00:00:00.000Z",
    artifactsDir: "test-results/release-gate/x",
    partial: false,
    only: [],
    results,
    env: gate.envPresence(["NEXT_PUBLIC_SUPABASE_URL"], {}),
    d33: D33_FIXTURE,
    decisions: DECISION_FIXTURE,
    visual: VISUAL_FIXTURE,
    npm: { version: "11.19.0", source: NPM_SOURCE },
    verdict: "PASS",
    reasons: [],
    ...overrides,
  };
}

const OWNER_COMMIT = "0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1";
const OWNER_SUMMARY = (verdict = "accepted", date = "2026-11-08") =>
  `---\nphase: PORTIA-20\nplan: 58\nstatus: complete\nowner_verdict: ${verdict}\nowner_verdict_date: ${date}\nowner_verdict_commit: ${OWNER_COMMIT}\n---\n\n# Summary\n\n## Вердикт владельца (D-68)\n\n> а) да. принято\n`;
const VISUAL_FIXTURE: Row[] = [
  { id: "Общий вердикт", status: "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08", evidence: `owner_verdict: accepted; коммит ${OWNER_COMMIT}; цитата: «а) да. принято»` },
  { id: "Эталоны 20-12", status: "56 строк реестра; BLOCKED: reviewer, motion", evidence: `phase20-baselines.json, коммит вердикта реестра: ${OWNER_COMMIT}` },
  { id: "Код продукта", status: "НЕ ИЗМЕНЁН", evidence: `git diff --name-only ${OWNER_COMMIT} ${COMMIT} -- app components public lib: пусто` },
];
const depsOk = { commitExists: () => true, matrix: CLEAN_MATRIX, ownerSummary: OWNER_SUMMARY(), baselinesCommit: OWNER_COMMIT, productChanges: (): string[] => [] };
const verify = (markdown: string, deps: Record<string, unknown> = depsOk): string[] => gate.verifyEvidence(markdown, deps);
const goodEvidence = () => gate.renderEvidence(fullRun());
const removeLine = (markdown: string, needle: string) => markdown.split("\n").filter((line) => !line.includes(needle)).join("\n");
const mentions = (errors: string[], pattern: RegExp) => assert.ok(errors.some((error) => pattern.test(error)), `no error matching ${pattern}:\n${errors.join("\n")}`);

test("verifyEvidence: a complete, honest protocol has no errors", () => {
  assert.deepEqual(verify(goodEvidence()), []);
});

test("verifyEvidence: a protocol without the «Решения D-35..D-45» table is rejected", () => {
  const without = gate.renderEvidence(fullRun({ decisions: undefined }));
  mentions(verify(without), /«Решения D-35\.\.D-45» is missing/);
});

test("verifyEvidence: every required decision row is required (compared by the first column, spaces ignored)", () => {
  for (const id of gate.DECISION_ROWS) {
    const errors = verify(removeLine(goodEvidence(), `| ${id} |`));
    mentions(errors, new RegExp(`${id.replace(/[()./]/g, "\\$&")}: decision row is missing`));
  }
  const spaced = goodEvidence().replace("| D-47 staging |", "|   D-47staging   |");
  assert.deepEqual(verify(spaced), [], "spacing in the first column does not matter");
});

test("verifyEvidence: PASS in D-36(б) production or D-47 production is rejected as an owner action", () => {
  for (const id of ["D-36(б) production", "D-47 production"]) {
    const rows = DECISION_FIXTURE.map((row) => (row.id === id ? { ...row, status: "PASS" } : row));
    const errors = verify(gate.renderEvidence(fullRun({ decisions: rows })));
    mentions(errors, new RegExp(`${id.replace(/[()]/g, "\\$&")}: production row is an owner action`));
  }
  const applied = DECISION_FIXTURE.map((row) => (row.id === "D-47 production" ? { ...row, status: "ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ 2026-11-05" } : row));
  assert.deepEqual(verify(gate.renderEvidence(fullRun({ decisions: applied }))), []);
  const badDate = DECISION_FIXTURE.map((row) => (row.id === "D-47 production" ? { ...row, status: "ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ вчера" } : row));
  mentions(verify(gate.renderEvidence(fullRun({ decisions: badDate }))), /D-47 production: production row is an owner action/);
  const sneaky = DECISION_FIXTURE.map((row) => (row.id === "D-36(б) production" ? { ...row, status: "ОЖИДАЕТ ВЛАДЕЛЬЦА", evidence: "PASS агента" } : row));
  mentions(verify(gate.renderEvidence(fullRun({ decisions: sneaky }))), /must not contain PASS/);
});

test("verifyEvidence: an empty or open decision status is rejected", () => {
  const rows = DECISION_FIXTURE.map((row) => (row.id === "T-20-31" ? { ...row, status: "open" } : row));
  mentions(verify(gate.renderEvidence(fullRun({ decisions: rows }))), /T-20-31: decision status is empty or open/);
});

test("verifyEvidence: the D-33 table needs WR-03, WR-05 and IN-01..IN-05 with fixed or disposition", () => {
  mentions(verify(gate.renderEvidence(fullRun({ d33: undefined }))), /D-33\)» is missing/);
  for (const id of gate.D33_ROWS) mentions(verify(removeLine(goodEvidence(), `| ${id} |`)), new RegExp(`${id}: D-33 row is missing`));
  const open = D33_FIXTURE.map((row) => (row.id === "IN-03" ? { ...row, status: "open" } : row));
  mentions(verify(gate.renderEvidence(fullRun({ d33: open }))), /IN-03: D-33 status "open"/);
  const empty = D33_FIXTURE.map((row) => (row.id === "WR-03" ? { ...row, status: "" } : row));
  mentions(verify(gate.renderEvidence(fullRun({ d33: empty }))), /WR-03: D-33 status "\(empty\)"/);
});

test("verifyEvidence: a retry-pass or a skip counted as PASS in a Playwright row is rejected", () => {
  const retry = gate.renderEvidence(fullRun({}, (id: string) => (id === "e2e-full" ? { counts: { passed: 10, failed: 0, skipped: 0, flaky: 1, blocked: 0 } } : {})));
  mentions(verify(retry), /e2e-full: PASS row has 1 flaky\/retried/);
  const skipped = gate.renderEvidence(fullRun({}, (id: string) => (id === "e2e-full" ? { counts: { passed: 10, failed: 0, skipped: 3, flaky: 0, blocked: 0 } } : {})));
  mentions(verify(skipped), /e2e-full: PASS row has 3 skipped/);
  const live = gate.renderEvidence(fullRun({}, (id: string) => (id === "staging-live" ? { counts: { passed: 4, failed: 0, skipped: 2, flaky: 0, blocked: 0 } } : {})));
  mentions(verify(live), /staging-live: PASS row has 2 skipped/);
  const none = gate.renderEvidence(fullRun({}, (id: string) => (id === "e2e-full" ? { counts: { passed: 0, failed: 0, skipped: 0, flaky: 0, blocked: 0 } } : {})));
  mentions(verify(none), /e2e-full: PASS row has 0 passed/);
  const failed = gate.renderEvidence(fullRun({}, (id: string) => (id === "unit" ? { exitCode: 1 } : {})));
  mentions(verify(failed), /unit: PASS row has exit "1"/);
});

test("verifyEvidence: SKIPPED or BLOCKED gates cannot sit under a PASS verdict", () => {
  const skipped = gate.renderEvidence(fullRun({}, (id: string) => (id === "lint" ? { status: "SKIPPED", exitCode: null } : {})));
  mentions(verify(skipped), /verdict PASS with a SKIPPED mandatory gate/);
  mentions(verify(skipped), /verdict PASS is stronger than the gate table allows \(FAIL\)/);
  const blocked = gate.renderEvidence(fullRun({}, (id: string) => (id === "e2e-mutation" ? { status: "BLOCKED", blockedKind: "ENV", exitCode: null, counts: null } : {})));
  mentions(verify(blocked), /stronger than the gate table allows \(BLOCKED\)/);
  const honest = gate.renderEvidence(fullRun({ verdict: "BLOCKED" }, (id: string) => (id === "e2e-mutation" ? { status: "BLOCKED", blockedKind: "ENV", exitCode: null, counts: null } : {})));
  assert.deepEqual(verify(honest), []);
  const failing = gate.renderEvidence(fullRun({ verdict: "BLOCKED" }, (id: string) => (id === "unit" ? { status: "FAIL", exitCode: 1 } : {})));
  mentions(verify(failing), /verdict BLOCKED is stronger than the gate table allows \(FAIL\)/);
});

test("verifyEvidence: a waived FAIL allows only PASS-WITH-OWNER-WAIVERS", () => {
  const waived = (id: string) => (id === "e2e-full" ? { status: "FAIL", waived: true, waivedBy: ["PW-07"], exitCode: 1 } : {});
  assert.deepEqual(verify(gate.renderEvidence(fullRun({ verdict: "PASS-WITH-OWNER-WAIVERS" }, waived))), []);
  mentions(verify(gate.renderEvidence(fullRun({ verdict: "PASS" }, waived))), /verdict PASS is stronger than the gate table allows \(PASS-WITH-OWNER-WAIVERS\)/);
  const unwaived = (id: string) => (id === "e2e-full" ? { status: "FAIL", waived: false, exitCode: 1 } : {});
  mentions(verify(gate.renderEvidence(fullRun({ verdict: "PASS-WITH-OWNER-WAIVERS" }, unwaived))), /stronger than the gate table allows \(FAIL\)/);
});

test("verifyEvidence: verdict PASS is refused while the matrix lists a high blocker", () => {
  const errors = verify(goodEvidence(), { ...depsOk, matrix: BLOCKER_MATRIX });
  mentions(errors, /unresolved high blocker\(s\) in the security matrix \(SEC20-99\)/);
  const waivers = gate.renderEvidence(fullRun({ verdict: "PASS-WITH-OWNER-WAIVERS" }, (id: string) => (id === "e2e-full" ? { status: "FAIL", waived: true, exitCode: 1 } : {})));
  mentions(verify(waivers, { ...depsOk, matrix: BLOCKER_MATRIX }), /unresolved high blocker/);
  const failVerdict = gate.renderEvidence(fullRun({ verdict: "FAIL" }, (id: string) => (id === "unit" ? { status: "FAIL", exitCode: 1 } : {})));
  assert.deepEqual(verify(failVerdict, { ...depsOk, matrix: BLOCKER_MATRIX }), [], "a FAIL verdict is consistent with a blocker");
  mentions(verify(goodEvidence(), { ...depsOk, matrix: null }), /«Блокеры релиза \(D-12\)» is unreadable/);
  assert.deepEqual(gate.matrixBlockers(CLEAN_MATRIX), []);
  assert.deepEqual(gate.matrixBlockers(BLOCKER_MATRIX), ["SEC20-99"]);
  assert.equal(gate.matrixBlockers("# no section"), null);
});

test("verifyEvidence: the commit must be a full 40-hex sha that exists", () => {
  mentions(verify(goodEvidence().replace(COMMIT, "0123456")), /commit is missing or not a full 40-hex sha/);
  mentions(verify(goodEvidence().replace(/^Commit:.*$/m, "")), /commit is missing/);
  mentions(verify(goodEvidence(), { ...depsOk, commitExists: () => false }), /does not exist in this repository/);
});

test("verifyEvidence: a partial run, a missing gate row, a wrong Node and a missing verdict are rejected", () => {
  mentions(verify(gate.renderEvidence(fullRun({ partial: true, only: ["unit"] }))), /run mode is "partial"/);
  mentions(verify(removeLine(goodEvidence(), "| lint |")), /lint: gate row is missing/);
  mentions(verify(goodEvidence().replace("Node: v22.13.1", "Node: v24.1.0")), /Node line is missing or is not 22\.13\.x/);
  mentions(verify(goodEvidence().replace(/^Итог: .*$/m, "")), /verdict line «Итог:» is missing/);
  mentions(verify(goodEvidence().replace(/^Итог: .*$/m, "Итог: DONE")), /unknown \("DONE"\)/);
  assert.deepEqual(verify(""), ["evidence is empty"]);
});

function writeOwnerFiles(base: string, summary = OWNER_SUMMARY()) {
  writeFileSync(path.join(base, gate.PHASE_DIR, "20-58-SUMMARY.md"), summary);
  mkdirSync(path.join(base, "tests", "e2e", "visual"), { recursive: true });
  writeFileSync(path.join(base, gate.BASELINES_JSON), JSON.stringify({ schema: "portia-phase20-baselines-v1", ownerVerdict: { commit: OWNER_COMMIT }, rows: [{}, {}] }));
}

test("main --verify-evidence: a missing protocol exits non-zero with «20-RELEASE-EVIDENCE.md not found»", () => {
  const base = mkdtempSync(path.join(os.tmpdir(), "phase20-evidence-test-"));
  let err = "";
  const code = gate.main(["--verify-evidence"], { root: base, err: (text: string) => { err += text; }, out: () => {} });
  assert.notEqual(code, 0);
  assert.match(err, /20-RELEASE-EVIDENCE\.md not found/);
  rmSync(base, { recursive: true, force: true });
});

test("main --verify-evidence: reads the protocol and the matrix, exits 0 for a verified protocol and 1 for a broken one", () => {
  const base = mkdtempSync(path.join(os.tmpdir(), "phase20-evidence-test-"));
  mkdirSync(path.join(base, gate.PHASE_DIR), { recursive: true });
  writeFileSync(path.join(base, gate.MATRIX_MD), CLEAN_MATRIX);
  writeFileSync(path.join(base, gate.EVIDENCE_MD), goodEvidence());
  writeOwnerFiles(base);
  let out = "";
  let err = "";
  const deps = { root: base, git: () => ({ status: 0, stdout: "", stderr: "" }), out: (text: string) => { out += text; }, err: (text: string) => { err += text; } };
  assert.equal(gate.main(["--verify-evidence"], deps), 0, err);
  assert.match(out, /release evidence verified/);
  writeFileSync(path.join(base, gate.MATRIX_MD), BLOCKER_MATRIX);
  assert.equal(gate.main(["--verify-evidence"], deps), 1);
  assert.match(err, /unresolved high blocker/);
  const explicit = path.join(base, "other.md");
  writeFileSync(explicit, removeLine(goodEvidence(), "| D-47 production |"));
  writeFileSync(path.join(base, gate.MATRIX_MD), CLEAN_MATRIX);
  err = "";
  assert.equal(gate.main(["--verify-evidence", "--evidence", explicit], deps), 1);
  assert.match(err, /D-47 production: decision row is missing/);
  rmSync(base, { recursive: true, force: true });
});

test("main --verify-evidence: extra verifiers (20-15 lineage, docs, reconciliation) attach without touching the base checks", () => {
  const base = mkdtempSync(path.join(os.tmpdir(), "phase20-evidence-test-"));
  mkdirSync(path.join(base, gate.PHASE_DIR), { recursive: true });
  writeFileSync(path.join(base, gate.MATRIX_MD), CLEAN_MATRIX);
  writeFileSync(path.join(base, gate.EVIDENCE_MD), goodEvidence());
  writeOwnerFiles(base);
  let err = "";
  const code = gate.main(["--verify-evidence"], {
    root: base,
    git: () => ({ status: 0, stdout: "", stderr: "" }),
    out: () => {},
    err: (text: string) => { err += text; },
    extraEvidenceVerifiers: [() => ["lineage: example problem"]],
  });
  assert.equal(code, 1);
  assert.match(err, /lineage: example problem/);
  rmSync(base, { recursive: true, force: true });
});

// --- D-68: data mode column and «Визуальная приёмка владельца (D-68)» -------------------------------------------------------

const withVisual = (rows: Row[]) => gate.renderEvidence(fullRun({ visual: rows }));
const visualRow = (id: string, patch: Partial<Row>): Row[] => VISUAL_FIXTURE.map((row) => (row.id === id ? { ...row, ...patch } : row));

test("renderEvidence (D-68): the gate table has the «Данные» column; the three offline gates read «offline D-68»", () => {
  const markdown = goodEvidence();
  assert.match(markdown, /\| Gate \| Команда \| Exit \| Статус \| Passed\/Failed\/Skipped\/Flaky \| Артефакты \| Данные \|/);
  for (const id of OFFLINE_GATES) assert.match(markdown, new RegExp(`^\\| ${id} \\|.*\\| offline D-68 \\|$`, "m"), id);
  assert.match(markdown, /^\| e2e-mutation \|.*\| staging \|$/m);
  assert.match(markdown, /^\| unit \|.*\| - \|$/m);
  assert.match(markdown, /^## Визуальная приёмка владельца \(D-68\)$/m);
});

test("verifyEvidence (D-68): an offline gate row without «offline D-68» is rejected", () => {
  for (const id of OFFLINE_GATES) {
    const lines = goodEvidence().split("\n").map((line) => (line.startsWith(`| ${id} |`) ? line.replace(/\| offline D-68 \|$/, "| цель |") : line));
    mentions(verify(lines.join("\n")), new RegExp(`${id}: offline gate row must carry the data mode «offline D-68»`));
  }
  const noColumn = goodEvidence().split("\n").map((line) => (line.startsWith("| visual-phase20 |") ? line.replace(/ \| offline D-68 \|$/, " |") : line));
  mentions(verify(noColumn.join("\n")), /visual-phase20: offline gate row must carry the data mode/);
});

test("verifyEvidence (D-68): a protocol without the visual acceptance section, or without one of its rows, is rejected", () => {
  mentions(verify(gate.renderEvidence(fullRun({ visual: undefined }))), /«Визуальная приёмка владельца \(D-68\)» is missing/);
  for (const row of VISUAL_FIXTURE) {
    mentions(verify(removeLine(goodEvidence(), `| ${row.id} |`)), new RegExp(`${row.id}: visual acceptance row is missing`));
  }
});

test("verifyEvidence (D-68): PASS in the «Общий вердикт» row is an agent verdict and is rejected", () => {
  mentions(verify(withVisual(visualRow("Общий вердикт", { status: "PASS" }))), /Общий вердикт: .*must not contain PASS/);
  mentions(verify(withVisual(visualRow("Общий вердикт", { evidence: "принято, PASS агента" }))), /Общий вердикт: .*must not contain PASS/);
  mentions(verify(withVisual(visualRow("Общий вердикт", { status: "принято" }))), /Общий вердикт: status must be/);
});

test("verifyEvidence (D-68): «ПРИНЯТО ВЛАДЕЛЬЦЕМ» needs owner_verdict: accepted and the same date in 20-58-SUMMARY.md", () => {
  mentions(verify(goodEvidence(), { ...depsOk, ownerSummary: OWNER_SUMMARY("fixes-requested") }), /ПРИНЯТО ВЛАДЕЛЬЦЕМ, but 20-58-SUMMARY\.md has owner_verdict "fixes-requested"/);
  mentions(verify(goodEvidence(), { ...depsOk, ownerSummary: OWNER_SUMMARY("accepted", "2026-11-09") }), /date 2026-11-08 differs from owner_verdict_date 2026-11-09/);
  mentions(verify(goodEvidence(), { ...depsOk, ownerSummary: null }), /20-58-SUMMARY\.md is unreadable/);
  mentions(verify(goodEvidence(), { ...depsOk, ownerSummary: "no frontmatter at all" }), /ПРИНЯТО ВЛАДЕЛЬЦЕМ, but 20-58-SUMMARY\.md has owner_verdict ""/);
});

test("verifyEvidence (D-68): the honest non-accepted verdicts are allowed and cap the run verdict below PASS", () => {
  const waiting = visualRow("Общий вердикт", { status: "ОЖИДАЕТ ВЛАДЕЛЬЦА", evidence: "owner_verdict отсутствует" });
  const blockedRun = (verdict: string) => gate.renderEvidence(fullRun({ verdict, visual: waiting }));
  assert.deepEqual(verify(blockedRun("BLOCKED")), []);
  mentions(verify(blockedRun("PASS")), /verdict PASS needs «Общий вердикт» = «ПРИНЯТО ВЛАДЕЛЬЦЕМ/);
  const fix = visualRow("Общий вердикт", { status: "ИСПРАВИТЬ (владелец) 2026-11-08", evidence: "fixes-requested" });
  assert.deepEqual(verify(gate.renderEvidence(fullRun({ verdict: "FAIL", visual: fix })), depsOk), []);
  mentions(verify(gate.renderEvidence(fullRun({ verdict: "PASS", visual: fix }))), /verdict PASS needs «Общий вердикт»/);
  mentions(verify(gate.renderEvidence(fullRun({ verdict: "PASS-WITH-OWNER-WAIVERS", visual: waiting }))), /needs «Общий вердикт»/);
});

test("verifyEvidence (D-68): «Эталоны 20-12» must name the verdict commit of 20-58-SUMMARY.md and of the register", () => {
  const other = "1111111111111111111111111111111111111111";
  mentions(verify(withVisual(visualRow("Эталоны 20-12", { evidence: `коммит вердикта реестра: ${other}` }))), /Эталоны 20-12: commit .* differs from owner_verdict_commit/);
  mentions(verify(withVisual(visualRow("Эталоны 20-12", { evidence: "без коммита" }))), /Эталоны 20-12: no verdict commit/);
  mentions(verify(goodEvidence(), { ...depsOk, baselinesCommit: other }), /register .*phase20-baselines\.json has ownerVerdict\.commit/);
});

test("verifyEvidence (D-68): «Код продукта» is НЕ ИЗМЕНЁН, ИЗМЕНЁН ПОСЛЕ ВЕРДИКТА: <файлы> or BLOCKED; the runner recomputes it", () => {
  mentions(verify(withVisual(visualRow("Код продукта", { status: "всё хорошо" }))), /Код продукта: status must be/);
  mentions(verify(goodEvidence(), { ...depsOk, productChanges: () => ["components/portia-desktop.tsx"] }), /Код продукта: claims НЕ ИЗМЕНЁН but .*components\/portia-desktop\.tsx/);
  mentions(verify(goodEvidence(), { ...depsOk, productChanges: () => null }), /Код продукта: .* cannot be recomputed/);
  const changed = visualRow("Код продукта", { status: "ИЗМЕНЁН ПОСЛЕ ВЕРДИКТА: components/portia-desktop.tsx" });
  assert.deepEqual(verify(gate.renderEvidence(fullRun({ verdict: "FAIL", visual: changed })), { ...depsOk, productChanges: () => ["components/portia-desktop.tsx"] }), []);
  mentions(verify(gate.renderEvidence(fullRun({ verdict: "PASS", visual: changed })), { ...depsOk, productChanges: () => ["components/portia-desktop.tsx"] }), /verdict PASS needs «Код продукта» = «НЕ ИЗМЕНЁН»/);
  const blocked = visualRow("Код продукта", { status: "BLOCKED (ENV): git diff не выполнен" });
  mentions(verify(gate.renderEvidence(fullRun({ verdict: "PASS", visual: blocked }))), /verdict PASS needs «Код продукта»/);
});

test("verifyEvidence (D-68): a PASS-class verdict needs ui-contract-offline, visual-approved, visual-phase20 and visual-manifest to be PASS, not a waived FAIL", () => {
  for (const id of ["ui-contract-offline", "visual-approved", "visual-phase20", "visual-manifest"]) {
    const waived = gate.renderEvidence(fullRun({ verdict: "PASS-WITH-OWNER-WAIVERS" }, (gateId: string) => (gateId === id ? { status: "FAIL", waived: true, exitCode: 1 } : {})));
    mentions(verify(waived), new RegExp(`verdict PASS-WITH-OWNER-WAIVERS needs ${id} = PASS`));
  }
  const honest = gate.renderEvidence(fullRun({ verdict: "FAIL" }, (id: string) => (id === "visual-approved" ? { status: "FAIL", exitCode: 1 } : {})));
  assert.deepEqual(verify(honest), [], "a red visual gate under a FAIL verdict is the honest record");
});

test("readOwnerVerdict and ownerStatusText map the frontmatter of 20-58-SUMMARY.md, never inventing an acceptance", () => {
  const owner = gate.readOwnerVerdict(OWNER_SUMMARY());
  assert.deepEqual(owner, { verdict: "accepted", date: "2026-11-08", commit: OWNER_COMMIT });
  assert.equal(gate.ownerStatusText(owner), "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08");
  assert.equal(gate.ownerStatusText(gate.readOwnerVerdict(OWNER_SUMMARY("fixes-requested"))), "ИСПРАВИТЬ (владелец) 2026-11-08");
  assert.equal(gate.ownerStatusText(gate.readOwnerVerdict(OWNER_SUMMARY("ambiguous"))), "ОЖИДАЕТ ВЛАДЕЛЬЦА");
  assert.equal(gate.ownerStatusText(gate.readOwnerVerdict("---\nplan: 58\n---\n")), "ОЖИДАЕТ ВЛАДЕЛЬЦА");
  assert.equal(gate.ownerStatusText(gate.readOwnerVerdict(OWNER_SUMMARY("accepted", "")) ), "ОЖИДАЕТ ВЛАДЕЛЬЦА", "accepted without a date is not recorded as accepted");
  assert.equal(gate.ownerStatusText(null), "ОЖИДАЕТ ВЛАДЕЛЬЦА");
  assert.equal(gate.readOwnerVerdict("no frontmatter"), null);
  assert.doesNotMatch(readFileSync(new URL("../scripts/phase20-release-gate.mjs", import.meta.url), "utf8"), /["'`]ПРИНЯТО ВЛАДЕЛЬЦЕМ["'`]\s*;/, "the status text is only built from a read verdict");
});

test("productCodeChanges lists non-test product files between the verdict commit and the release commit; a git error is null", () => {
  const calls: string[][] = [];
  const git = (args: string[]) => {
    calls.push(args);
    return { status: 0, stdout: "lib/x.test.ts\ncomponents/portia-desktop.tsx\nlib/y.ts\n", stderr: "" };
  };
  assert.deepEqual(gate.productCodeChanges({ git }, OWNER_COMMIT, COMMIT), ["components/portia-desktop.tsx", "lib/y.ts"]);
  assert.deepEqual(calls[0], ["diff", "--name-only", OWNER_COMMIT, COMMIT, "--", "app", "components", "public", "lib"]);
  assert.deepEqual(gate.productCodeChanges({ git: () => ({ status: 0, stdout: "lib/only.test.ts\n", stderr: "" }) }, OWNER_COMMIT, COMMIT), []);
  assert.equal(gate.productCodeChanges({ git: () => ({ status: 128, stdout: "", stderr: "bad object" }) }, OWNER_COMMIT, COMMIT), null);
  assert.equal(gate.productCodeChanges({ git }, "", COMMIT), null, "no verdict commit: nothing to compare");
});

test("visualAcceptanceRows and applyVisualAcceptance: a missing verdict, changed code or an unreadable diff keep the run below PASS", () => {
  const accepted = gate.visualAcceptanceRows({ owner: gate.readOwnerVerdict(OWNER_SUMMARY()), baselines: { commit: OWNER_COMMIT, rows: 56 }, changed: [], releaseCommit: COMMIT });
  assert.deepEqual(accepted.map((row: Row) => row.id), ["Общий вердикт", "Эталоны 20-12", "Код продукта"]);
  assert.equal(accepted[0].status, "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08");
  assert.match(accepted[1].status, /^56 строк реестра/);
  assert.equal(accepted[2].status, "НЕ ИЗМЕНЁН");
  assert.deepEqual(gate.applyVisualAcceptance("PASS", accepted), { verdict: "PASS", reasons: [] });
  const waiting = gate.visualAcceptanceRows({ owner: null, baselines: null, changed: null, releaseCommit: COMMIT });
  assert.equal(waiting[0].status, "ОЖИДАЕТ ВЛАДЕЛЬЦА");
  assert.match(waiting[1].status, /^BLOCKED/);
  assert.match(waiting[2].status, /^BLOCKED/);
  assert.equal(gate.applyVisualAcceptance("PASS", waiting).verdict, "BLOCKED");
  assert.equal(gate.applyVisualAcceptance("PASS-WITH-OWNER-WAIVERS", waiting).verdict, "BLOCKED");
  const changed = gate.visualAcceptanceRows({ owner: gate.readOwnerVerdict(OWNER_SUMMARY()), baselines: { commit: OWNER_COMMIT, rows: 56 }, changed: ["lib/y.ts"], releaseCommit: COMMIT });
  assert.equal(changed[2].status, "ИЗМЕНЁН ПОСЛЕ ВЕРДИКТА: lib/y.ts");
  assert.equal(gate.applyVisualAcceptance("PASS", changed).verdict, "FAIL");
  const fix = gate.visualAcceptanceRows({ owner: gate.readOwnerVerdict(OWNER_SUMMARY("fixes-requested")), baselines: { commit: OWNER_COMMIT, rows: 56 }, changed: [], releaseCommit: COMMIT });
  assert.equal(gate.applyVisualAcceptance("PASS", fix).verdict, "FAIL");
  assert.equal(gate.applyVisualAcceptance("FAIL", waiting).verdict, "FAIL", "a worse verdict stays");
  assert.equal(gate.applyVisualAcceptance("BLOCKED", fix).verdict, "FAIL", "a fix request beats BLOCKED");
});

test("the runner never reads 20-VISUAL-APPROVAL.md and carries the harness, the section and the offline gate by name", () => {
  const source = readFileSync(new URL("../scripts/phase20-release-gate.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /VISUAL-APPROVAL/);
  assert.match(source, /offline-supabase/);
  assert.match(source, /Визуальная приёмка владельца \(D-68\)/);
  assert.match(source, /ui-contract-offline/);
  assert.doesNotMatch(source, new RegExp(["service", "role"].join("_"), "i"), "the privileged key name is never spelled in the runner");
});

test("main --verify-evidence (D-68): an accepted verdict with changed product code is rejected through git", () => {
  const base = mkdtempSync(path.join(os.tmpdir(), "phase20-evidence-test-"));
  mkdirSync(path.join(base, gate.PHASE_DIR), { recursive: true });
  writeFileSync(path.join(base, gate.MATRIX_MD), CLEAN_MATRIX);
  writeFileSync(path.join(base, gate.EVIDENCE_MD), goodEvidence());
  writeOwnerFiles(base);
  let err = "";
  const git = (args: string[]) => (args[0] === "diff" ? { status: 0, stdout: "components/portia-desktop.tsx\n", stderr: "" } : { status: 0, stdout: "", stderr: "" });
  const code = gate.main(["--verify-evidence"], { root: base, git, out: () => {}, err: (text: string) => { err += text; } });
  assert.equal(code, 1);
  assert.match(err, /Код продукта: claims НЕ ИЗМЕНЁН/);
  rmSync(base, { recursive: true, force: true });
});

// --- 20-63 Task 1 (D-68, D-69): the effective owner verdict = the last valid link of the owner_verdict_renews chain ---------------------

const COMMIT_B = "b".repeat(40);
const COMMIT_C = "c".repeat(40);
const COMMIT_FOREIGN = "f".repeat(40);

type LinkOptions = { plan: number; verdict?: string; date?: string; commit?: string; renews?: string | null };

function linkSummary({ plan, verdict = "accepted", date = "2026-11-09", commit = COMMIT_B, renews = OWNER_COMMIT }: LinkOptions) {
  const lines = ["---", "phase: PORTIA-20", `plan: ${plan}`, "status: complete"];
  if (verdict !== null) lines.push(`owner_verdict: ${verdict}`);
  if (date !== null) lines.push(`owner_verdict_date: ${date}`);
  if (commit !== null) lines.push(`owner_verdict_commit: ${commit}`);
  if (renews !== null) lines.push(`owner_verdict_renews: ${renews}`);
  lines.push("---", "", "# Summary", "");
  return lines.join("\n");
}

/** Virtual phase directory plus a fake git: `known` commits exist, `ancestors` lists "older>newer" pairs. */
function chainDeps(files: Record<string, string>, { known = [OWNER_COMMIT, COMMIT_B, COMMIT_C], ancestors = [`${OWNER_COMMIT}>${COMMIT_B}`, `${OWNER_COMMIT}>${COMMIT_C}`, `${COMMIT_B}>${COMMIT_C}`] }: { known?: string[]; ancestors?: string[] } = {}) {
  const dir = path.join("virtual-root", gate.PHASE_DIR);
  const all: Record<string, string> = { "20-58-SUMMARY.md": OWNER_SUMMARY(), ...files };
  const calls: string[][] = [];
  const fs = {
    existsSync: (target: string) => path.basename(target) in all || target === dir,
    readFileSync: (target: string) => {
      const text = all[path.basename(target)];
      if (text === undefined) throw new Error(`ENOENT ${target}`);
      return text;
    },
    readdirSync: () => Object.keys(all).sort().reverse(),
  };
  const git = (args: string[]) => {
    calls.push(args);
    if (args[0] === "cat-file") return { status: known.some((sha) => args[2]?.startsWith(sha)) ? 0 : 128, stdout: "", stderr: "" };
    if (args[0] === "merge-base" && args[1] === "--is-ancestor") return { status: ancestors.includes(`${args[2]}>${args[3]}`) ? 0 : 1, stdout: "", stderr: "" };
    return { status: 0, stdout: "", stderr: "" };
  };
  return { deps: { root: "virtual-root", fs, git }, calls };
}

/** The effective verdict of the chain, asserted to be readable (null only when 20-58-SUMMARY.md is missing). */
function effectiveOf(deps: unknown) {
  const effective = gate.readEffectiveOwnerVerdict(deps);
  assert.ok(effective, "20-58-SUMMARY.md must be readable");
  return effective;
}

test("readEffectiveOwnerVerdict: without links the result is the 20-58 verdict, unchanged (the chain has nothing to add)", () => {
  assert.equal(typeof gate.readEffectiveOwnerVerdict, "function");
  const { deps } = chainDeps({});
  const effective = effectiveOf(deps);
  assert.deepEqual({ verdict: effective.verdict, date: effective.date, commit: effective.commit }, gate.readOwnerVerdict(OWNER_SUMMARY()));
  assert.equal(effective.source, "20-58-SUMMARY.md");
  assert.equal(effective.chainError, "");
  assert.equal(gate.ownerStatusText(effective), "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08");
  const noBase = chainDeps({});
  noBase.deps.fs.existsSync = () => false;
  assert.equal(gate.readEffectiveOwnerVerdict(noBase.deps), null, "no 20-58 summary: nothing to read, never an invented verdict");
});

test("readEffectiveOwnerVerdict: a summary of plan 12 or 13 with owner_verdict fields is not a link; only plans after 58 are", () => {
  const { deps } = chainDeps({ "20-12-SUMMARY.md": linkSummary({ plan: 12, renews: null, commit: OWNER_COMMIT, date: "2026-11-08" }), "20-60-SUMMARY.md": "---\nplan: 60\n---\n\nТекст про owner_verdict_renews в теле.\n" });
  const effective = effectiveOf(deps);
  assert.equal(effective.source, "20-58-SUMMARY.md");
  assert.equal(effective.chainError, "");
});

test("readEffectiveOwnerVerdict: one valid link (renews = 20-58 commit, descendant, date not earlier) becomes the effective verdict", () => {
  const { deps, calls } = chainDeps({ "20-64-SUMMARY.md": linkSummary({ plan: 64 }) });
  const effective = effectiveOf(deps);
  assert.equal(effective.verdict, "accepted");
  assert.equal(effective.date, "2026-11-09");
  assert.equal(effective.commit, COMMIT_B);
  assert.equal(effective.source, "20-64-SUMMARY.md");
  assert.equal(effective.chainError, "");
  assert.equal(effective.baseCommit, OWNER_COMMIT, "the authority of the baselines stays with 20-58");
  assert.equal(gate.ownerStatusText(effective), "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-09");
  assert.ok(calls.some((args) => args[0] === "merge-base" && args[1] === "--is-ancestor" && args[2] === OWNER_COMMIT && args[3] === COMMIT_B), "ancestry is checked through git merge-base --is-ancestor");
  const rows = gate.visualAcceptanceRows({ owner: effective, baselines: { commit: OWNER_COMMIT, rows: 56 }, changed: [], releaseCommit: COMMIT });
  assert.equal(rows[0].status, "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-09");
  assert.match(rows[0].evidence, /20-64-SUMMARY\.md/);
  assert.match(rows[2].evidence, new RegExp(`git diff --name-only ${COMMIT_B.slice(0, 12)} `), "the product code is compared from the commit of the link");
  assert.deepEqual(gate.applyVisualAcceptance("PASS", rows), { verdict: "PASS", reasons: [] });
});

test("readEffectiveOwnerVerdict: links are ordered by plan number, not by file listing; the last valid link wins", () => {
  const { deps } = chainDeps({
    "20-65-SUMMARY.md": linkSummary({ plan: 65, commit: COMMIT_C, renews: COMMIT_B, date: "2026-11-10", verdict: "accepted" }),
    "20-64-SUMMARY.md": linkSummary({ plan: 64 }),
  });
  const effective = effectiveOf(deps);
  assert.equal(effective.source, "20-65-SUMMARY.md");
  assert.equal(effective.commit, COMMIT_C);
  assert.equal(effective.date, "2026-11-10");
  assert.equal(effective.chainError, "");
});

test("readEffectiveOwnerVerdict: a link that renews a foreign commit breaks the chain: ОЖИДАЕТ ВЛАДЕЛЬЦА, the run is never above BLOCKED", () => {
  const { deps } = chainDeps({ "20-64-SUMMARY.md": linkSummary({ plan: 64, renews: COMMIT_FOREIGN }) }, { known: [OWNER_COMMIT, COMMIT_B, COMMIT_FOREIGN] });
  const effective = effectiveOf(deps);
  assert.match(effective.chainError, /^цепочка вердиктов нарушена: 20-64-SUMMARY\.md/);
  assert.equal(effective.verdict, "");
  assert.equal(gate.ownerStatusText(effective), "ОЖИДАЕТ ВЛАДЕЛЬЦА");
  const rows = gate.visualAcceptanceRows({ owner: effective, baselines: { commit: OWNER_COMMIT, rows: 56 }, changed: [], releaseCommit: COMMIT });
  assert.equal(rows[0].status, "ОЖИДАЕТ ВЛАДЕЛЬЦА");
  assert.match(rows[0].evidence, /цепочка вердиктов нарушена: 20-64-SUMMARY\.md/);
  assert.equal(gate.applyVisualAcceptance("PASS", rows).verdict, "BLOCKED");
});

test("readEffectiveOwnerVerdict: every other broken link is rejected the same way (no renews, not a descendant, no date, commit absent from the repository, earlier date, same commit)", () => {
  const broken: [string, Record<string, string>, { known?: string[]; ancestors?: string[] }?][] = [
    ["no owner_verdict_renews", { "20-64-SUMMARY.md": linkSummary({ plan: 64, renews: null }) }],
    ["a commit that is not a descendant", { "20-64-SUMMARY.md": linkSummary({ plan: 64 }) }, { ancestors: [] }],
    ["no date", { "20-64-SUMMARY.md": linkSummary({ plan: 64, date: "" }) }],
    ["a malformed date", { "20-64-SUMMARY.md": linkSummary({ plan: 64, date: "9 ноября" }) }],
    ["a commit that is not in the repository", { "20-64-SUMMARY.md": linkSummary({ plan: 64 }) }, { known: [OWNER_COMMIT] }],
    ["a short commit", { "20-64-SUMMARY.md": linkSummary({ plan: 64, commit: "bbbbbbb" }) }],
    ["a date earlier than the previous link", { "20-64-SUMMARY.md": linkSummary({ plan: 64, date: "2026-11-07" }) }],
    ["the same commit as the previous link", { "20-64-SUMMARY.md": linkSummary({ plan: 64, commit: OWNER_COMMIT }) }],
    ["an empty verdict", { "20-64-SUMMARY.md": linkSummary({ plan: 64, verdict: "" }) }],
  ];
  for (const [name, files, options] of broken) {
    const { deps } = chainDeps(files, options);
    const effective = effectiveOf(deps);
    assert.match(effective.chainError, /^цепочка вердиктов нарушена: 20-64-SUMMARY\.md/, name);
    assert.equal(gate.ownerStatusText(effective), "ОЖИДАЕТ ВЛАДЕЛЬЦА", name);
  }
});

test("readEffectiveOwnerVerdict: a valid link behind a broken one is not used; the chain stops at the first break", () => {
  const { deps } = chainDeps({
    "20-64-SUMMARY.md": linkSummary({ plan: 64, renews: COMMIT_FOREIGN }),
    "20-65-SUMMARY.md": linkSummary({ plan: 65, commit: COMMIT_C, renews: OWNER_COMMIT, date: "2026-11-10" }),
  });
  const effective = effectiveOf(deps);
  assert.match(effective.chainError, /20-64-SUMMARY\.md/);
  assert.equal(gate.ownerStatusText(effective), "ОЖИДАЕТ ВЛАДЕЛЬЦА");
});

test("readEffectiveOwnerVerdict: a link with fixes-requested is «ИСПРАВИТЬ (владелец)» and the run is FAIL", () => {
  const { deps } = chainDeps({ "20-64-SUMMARY.md": linkSummary({ plan: 64, verdict: "fixes-requested" }) });
  const effective = effectiveOf(deps);
  assert.equal(effective.chainError, "");
  assert.equal(gate.ownerStatusText(effective), "ИСПРАВИТЬ (владелец) 2026-11-09");
  const rows = gate.visualAcceptanceRows({ owner: effective, baselines: { commit: OWNER_COMMIT, rows: 56 }, changed: [], releaseCommit: COMMIT });
  assert.equal(gate.applyVisualAcceptance("PASS", rows).verdict, "FAIL");
});

test("readEffectiveOwnerVerdict on a real git repository: descendant is accepted, a sibling branch commit is not", () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), "phase20-chain-test-"));
  const run = (args: string[]) => {
    const out = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    assert.equal(out.status, 0, `${args.join(" ")}: ${out.stderr}`);
    return out.stdout.trim();
  };
  const git = (args: string[]) => {
    const out = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    return { status: out.status, stdout: out.stdout ?? "", stderr: out.stderr ?? "" };
  };
  try {
    run(["init", "-q", "-b", "trunk"]);
    run(["config", "user.email", "chain@example.test"]);
    run(["config", "user.name", "chain"]);
    run(["config", "commit.gpgsign", "false"]);
    writeFileSync(path.join(repo, "a.txt"), "a");
    run(["add", "a.txt"]);
    run(["commit", "-q", "-m", "a"]);
    const baseSha = run(["rev-parse", "HEAD"]);
    writeFileSync(path.join(repo, "b.txt"), "b");
    run(["add", "b.txt"]);
    run(["commit", "-q", "-m", "b"]);
    const childSha = run(["rev-parse", "HEAD"]);
    run(["checkout", "-q", "-b", "side", baseSha]);
    writeFileSync(path.join(repo, "c.txt"), "c");
    run(["add", "c.txt"]);
    run(["commit", "-q", "-m", "c"]);
    const sideSha = run(["rev-parse", "HEAD"]);
    const phase = path.join(repo, gate.PHASE_DIR);
    mkdirSync(phase, { recursive: true });
    const base = OWNER_SUMMARY().replace(OWNER_COMMIT, baseSha);
    writeFileSync(path.join(phase, "20-58-SUMMARY.md"), base);
    writeFileSync(path.join(phase, "20-64-SUMMARY.md"), linkSummary({ plan: 64, commit: childSha, renews: baseSha }));
    const good = effectiveOf({ root: repo, fs: nodeFs, git });
    assert.equal(good.chainError, "");
    assert.equal(good.commit, childSha);
    writeFileSync(path.join(phase, "20-64-SUMMARY.md"), linkSummary({ plan: 64, commit: sideSha, renews: childSha }));
    assert.match(effectiveOf({ root: repo, fs: nodeFs, git }).chainError, /цепочка вердиктов нарушена: 20-64-SUMMARY\.md/);
    writeFileSync(path.join(phase, "20-64-SUMMARY.md"), linkSummary({ plan: 64, commit: sideSha, renews: baseSha }));
    assert.equal(effectiveOf({ root: repo, fs: nodeFs, git }).chainError, "", "a sibling commit that descends from the previous link commit is valid");
    writeFileSync(path.join(phase, "20-64-SUMMARY.md"), linkSummary({ plan: 64, commit: baseSha, renews: childSha }));
    assert.match(effectiveOf({ root: repo, fs: nodeFs, git }).chainError, /цепочка вердиктов нарушена/, "an ancestor of the previous commit is not a descendant");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

function evidenceRoot(summaries: Record<string, string>, evidence = goodEvidence()) {
  const base = mkdtempSync(path.join(os.tmpdir(), "phase20-evidence-test-"));
  mkdirSync(path.join(base, gate.PHASE_DIR), { recursive: true });
  writeFileSync(path.join(base, gate.MATRIX_MD), CLEAN_MATRIX);
  writeFileSync(path.join(base, gate.EVIDENCE_MD), evidence);
  writeOwnerFiles(base);
  for (const [name, text] of Object.entries(summaries)) writeFileSync(path.join(base, gate.PHASE_DIR, name), text);
  return base;
}

test("main --verify-evidence (D-69): the verdict row is checked against the effective link and «НЕ ИЗМЕНЁН» is recomputed from the link commit", () => {
  const evidence = gate.renderEvidence(fullRun({
    visual: [
      { id: "Общий вердикт", status: "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-09", evidence: `owner_verdict: accepted; owner_verdict_date: 2026-11-09; owner_verdict_commit: ${COMMIT_B}; источник: 20-64-SUMMARY.md` },
      { id: "Эталоны 20-12", status: "56 строк реестра", evidence: `phase20-baselines.json; коммит вердикта реестра: ${OWNER_COMMIT}` },
      { id: "Код продукта", status: "НЕ ИЗМЕНЁН", evidence: `git diff --name-only ${COMMIT_B.slice(0, 12)} ${COMMIT.slice(0, 12)} -- app components public lib (без *.test.*)` },
    ],
  }));
  const base = evidenceRoot({ "20-64-SUMMARY.md": linkSummary({ plan: 64 }) }, evidence);
  const diffs: string[][] = [];
  let err = "";
  const git = (args: string[]) => {
    if (args[0] === "diff") diffs.push(args);
    return { status: 0, stdout: "", stderr: "" };
  };
  try {
    const code = gate.main(["--verify-evidence"], { root: base, git, out: () => {}, err: (text: string) => { err += text; } });
    assert.equal(code, 0, err);
    assert.deepEqual(diffs[0]?.slice(0, 4), ["diff", "--name-only", COMMIT_B, COMMIT]);
    // The same protocol without the link: 20-58 says 2026-11-08, so the date 2026-11-09 is rejected.
    rmSync(path.join(base, gate.PHASE_DIR, "20-64-SUMMARY.md"));
    err = "";
    assert.equal(gate.main(["--verify-evidence"], { root: base, git, out: () => {}, err: (text: string) => { err += text; } }), 1);
    assert.match(err, /date 2026-11-09 differs from owner_verdict_date 2026-11-08/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("main --verify-evidence (D-69): a broken chain does not let the protocol claim «ПРИНЯТО ВЛАДЕЛЬЦЕМ»", () => {
  const base = evidenceRoot({ "20-64-SUMMARY.md": linkSummary({ plan: 64, renews: COMMIT_FOREIGN }) });
  let err = "";
  const git = (args: string[]) => ({ status: 0, stdout: "", stderr: args[0] === "diff" ? "" : "" });
  try {
    const code = gate.main(["--verify-evidence"], { root: base, git, out: () => {}, err: (text: string) => { err += text; } });
    assert.equal(code, 1);
    assert.match(err, /цепочка вердиктов нарушена: 20-64-SUMMARY\.md/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("the runner carries the chain by name and the agent never writes a link (D-68: only the owner's word; D-69: a new word for new product code)", () => {
  const source = readFileSync(new URL("../scripts/phase20-release-gate.mjs", import.meta.url), "utf8");
  assert.match(source, /export function readEffectiveOwnerVerdict/);
  assert.match(source, /owner_verdict_renews/);
  assert.match(source, /D-69: a change of the product code after the verdict needs a new word of the owner/);
  assert.doesNotMatch(source, /writeFileSync\([^)]*SUMMARY/, "the runner reads summaries, it never writes them");
});

// --- 20-59 Task 1 (D-69, G5): the npm of a release run is explicit and recorded -----------------------------------------------------

const RELEASE_SHA = "0123456789abcdef0123456789abcdef01234567";
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type NpmRunOptions = { argv: string[]; npmVersionStatus?: number; npmVersionOut?: string };

/** `main --run` over faked git and exec on a scratch root: the npm-related calls and the written artifacts are returned. */
function npmRun({ argv, npmVersionStatus = 0, npmVersionOut = "11.19.0\n" }: NpmRunOptions) {
  const root = mkdtempSync(path.join(os.tmpdir(), "phase20-npm-test-"));
  const calls: { file: string; args: string[] }[] = [];
  const gitCalls: string[][] = [];
  let out = "";
  let err = "";
  const deps = {
    root,
    fs: nodeFs,
    env: {},
    tmpdir: os.tmpdir(),
    stamp: () => "20261108T000000000Z",
    now: () => "2026-11-08T00:00:00.000Z",
    git: (args: string[]) => {
      gitCalls.push(args);
      return { status: 0, stdout: args[0] === "rev-parse" ? `${RELEASE_SHA}\n` : "", stderr: "" };
    },
    exec: (file: string, args: string[]) => {
      calls.push({ file, args });
      const viaCli = file !== "npm.cmd" && file !== "node" && file !== "git";
      const npmArgs = file === "npm.cmd" ? args : viaCli ? args.slice(1) : null;
      if (file === "node" && args[0] === "--version") return { status: 0, stdout: "v22.13.1\n", stderr: "", error: null };
      if (npmArgs && npmArgs[0] === "--version") return { status: npmVersionStatus, stdout: npmVersionStatus === 0 ? npmVersionOut : "", stderr: npmVersionStatus === 0 ? "" : "boom", error: null };
      if (npmArgs && npmArgs[0] === "test") return { status: 0, stdout: nodeTestOutput(10, 0, 0), stderr: "", error: null };
      return { status: 0, stdout: "", stderr: "", error: null };
    },
    out: (text: string) => { out += text; },
    err: (text: string) => { err += text; },
  };
  const code = gate.main(["--run", "--commit", "HEAD", "--only", "node-version,npm-ci,unit", ...argv], deps);
  const artifacts = path.join(root, "test-results", "release-gate", "0123456789ab-20261108T000000000Z");
  const read = (name: string) => (existsSync(path.join(artifacts, name)) ? readFileSync(path.join(artifacts, name), "utf8") : "");
  return { code, calls, gitCalls, out: () => out, err: () => err, receipt: () => (read("receipt.json") ? JSON.parse(read("receipt.json")) : null), gatesMd: () => read("gates.md"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function fakeNpmCli(name = "npm-cli.js") {
  const dir = mkdtempSync(path.join(os.tmpdir(), "phase20-npm-cli-"));
  const file = path.join(dir, name);
  writeFileSync(file, "// fake npm-cli\n");
  return { file, normalized: path.resolve(file).replace(/\\/g, "/"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("--npm-cli (D-69 G5): every npm step runs as `<node of the runner> <npm-cli.js> <args>`, node and git steps stay untouched", () => {
  const cli = fakeNpmCli();
  const run = npmRun({ argv: ["--npm-cli", cli.file] });
  assert.equal(run.code, 0, run.err());
  const npmCalls = run.calls.filter((call) => call.file !== "node" && call.file !== "git");
  assert.deepEqual(npmCalls.map((call) => call.args.slice(1).join(" ")), ["--version", "ci", "test"]);
  for (const call of npmCalls) {
    assert.equal(call.file, process.execPath, "the Node of the runner, no npm.cmd and no shell");
    assert.equal(path.resolve(call.args[0]), path.resolve(cli.file));
  }
  assert.ok(run.calls.some((call) => call.file === "node" && call.args[0] === "--version"));
  assert.ok(!run.calls.some((call) => call.file === "npm.cmd"));
  run.cleanup();
  cli.cleanup();
});

test("--npm-cli (D-69 G5): the receipt and the protocol carry `npm: <x.y.z> (--npm-cli <path>)` and the real invocation in the command column", () => {
  const cli = fakeNpmCli();
  const run = npmRun({ argv: ["--npm-cli", cli.file] });
  assert.deepEqual(run.receipt().npm, { version: "11.19.0", source: `--npm-cli ${cli.normalized}` });
  const markdown = run.gatesMd();
  assert.match(markdown, new RegExp(`^Node: v22\\.13\\.1\\nnpm: 11\\.19\\.0 \\(--npm-cli ${escapeRegExp(cli.normalized)}\\)$`, "m"));
  assert.match(markdown, new RegExp(`^\\| npm-ci \\| \`node ${escapeRegExp(cli.normalized)} ci\``, "m"));
  assert.doesNotMatch(markdown, /npm\.cmd/);
  run.cleanup();
  cli.cleanup();
});

test("--npm-cli (D-69 G5): a missing path or a file that is not npm-cli.js is refused before any worktree exists", () => {
  const other = fakeNpmCli("other.js");
  for (const bad of [path.join(os.tmpdir(), "no-such-dir-20-59", "npm-cli.js"), other.file, os.tmpdir()]) {
    const run = npmRun({ argv: ["--npm-cli", bad] });
    assert.equal(run.code, 1, bad);
    assert.match(run.err(), /npm-cli-invalid/, bad);
    assert.equal(run.gitCalls.length, 0, `no git call, so no worktree: ${bad}`);
    assert.equal(run.calls.length, 0);
    run.cleanup();
  }
  const noValue = npmRun({ argv: ["--npm-cli"] });
  assert.equal(noValue.code, 1);
  assert.match(noValue.err(), /npm-cli-invalid/);
  assert.equal(noValue.gitCalls.length, 0);
  noValue.cleanup();
  other.cleanup();
});

test("without --npm-cli the behaviour is as before: npm.cmd from PATH, and the protocol says so", () => {
  const run = npmRun({ argv: [] });
  assert.equal(run.code, 0, run.err());
  assert.deepEqual(run.calls.filter((call) => call.file === "npm.cmd").map((call) => call.args.join(" ")), ["--version", "ci", "test"]);
  assert.deepEqual(run.receipt().npm, { version: "11.19.0", source: "PATH npm.cmd" });
  assert.match(run.gatesMd(), /^npm: 11\.19\.0 \(PATH npm\.cmd\)$/m);
  assert.match(run.gatesMd(), /^\| npm-ci \| `npm\.cmd ci`/m);
  run.cleanup();
});

test("npm version is measured once before the first npm gate; an unmeasurable npm is recorded as unknown and the npm gates still run", () => {
  const run = npmRun({ argv: [], npmVersionStatus: 1 });
  const npmCalls = run.calls.filter((call) => call.file === "npm.cmd").map((call) => call.args.join(" "));
  assert.deepEqual(npmCalls, ["--version", "ci", "test"], "one probe, then the gates");
  const npm = run.receipt().npm;
  assert.equal(npm.version, null);
  assert.equal(npm.source, "PATH npm.cmd");
  assert.match(npm.error, /boom|exit 1/);
  assert.match(run.gatesMd(), /^npm: неизвестно \(PATH npm\.cmd\): /m);
  run.cleanup();
});

test("renderEvidence writes the npm line right after Node; without run.npm no line is written", () => {
  const lines = gate.renderEvidence(fullRun()).split("\n");
  const nodeIndex = lines.findIndex((line) => line.startsWith("Node: "));
  assert.equal(lines[nodeIndex + 1], `npm: 11.19.0 (${NPM_SOURCE})`);
  assert.equal(gate.renderEvidence(fullRun({ npm: { version: null, source: "PATH npm.cmd", error: "exit 1" } })).split("\n")[nodeIndex + 1], "npm: неизвестно (PATH npm.cmd): exit 1");
  assert.doesNotMatch(gate.renderEvidence(fullRun({ npm: undefined })), /^npm:/m);
});

test("verifyEvidence (D-69 G5): the npm line is required; `неизвестно` is refused under a PASS-class verdict; a version with its source passes", () => {
  mentions(verify(removeLine(goodEvidence(), "npm: ")), /npm line is missing/);
  const unknown = gate.renderEvidence(fullRun({ npm: { version: null, source: "PATH npm.cmd", error: "exit 1" } }));
  mentions(verify(unknown), /npm line says the version is unknown/);
  const waivers = gate.renderEvidence(fullRun({ verdict: "PASS-WITH-OWNER-WAIVERS", npm: { version: null, source: "PATH npm.cmd", error: "exit 1" } }, (id: string) => (id === "e2e-full" ? { status: "FAIL", waived: true, exitCode: 1 } : {})));
  mentions(verify(waivers), /npm line says the version is unknown/);
  const honest = gate.renderEvidence(fullRun({ verdict: "BLOCKED", npm: { version: null, source: "PATH npm.cmd", error: "exit 1" } }, (id: string) => (id === "e2e-mutation" ? { status: "BLOCKED", blockedKind: "ENV", exitCode: null, counts: null } : {})));
  assert.deepEqual(verify(honest), [], "an unknown npm does not forge a verdict above BLOCKED");
  assert.deepEqual(verify(goodEvidence().replace(/^npm: .*$/m, "npm: 10.9.2 (PATH npm.cmd)")), []);
  mentions(verify(goodEvidence().replace(/^npm: .*$/m, "npm: whatever")), /npm line is malformed/);
  mentions(verify(goodEvidence().replace(/^npm: .*$/m, "npm: 11.19.0 ()")), /npm line is malformed/);
});

test("main usage line names --npm-cli", () => {
  let err = "";
  assert.equal(gate.main(["--run"], { env: {}, git: () => ({ status: 0, stdout: "", stderr: "" }), err: (text: string) => { err += text; } }), 2);
  assert.match(err, /--npm-cli <path>/);
});

// --- 20-59 Task 2 (D-69, G4): one gate-level rule for skips by a project condition -------------------------------------------------------------

const PROJECT_SKIP_SOURCE = [
  'import { test } from "@playwright/test";',
  'const lanes = new Set(["chromium-desktop", "chromium-phone"]);',
  'const declared = ["chromium-dpr125", "webkit-phone"] as const;',
  'const isPhone = () => test.info().project.name.endsWith("-phone");',
  "// test.skip(true, \"a comment is not a call\");",
  "test.beforeEach(({}, testInfo) => {",
  '  test.skip(testInfo.project.name !== "chromium-desktop", "Pixel authority is pinned to chromium-desktop.");',
  "});",
  "test.beforeEach(({}, testInfo) => {",
  '  test.skip(!lanes.has(testInfo.project.name), "Baselines are taken on two lanes.");',
  "});",
  'test("a", async ({ page }, testInfo) => {',
  "  test.skip(isPhone(), `${testInfo.project.name}: the phone grid has no drag, so there is nothing to replace.`);",
  '  test.skip(!declared.includes(testInfo.project.name), "No row is declared for this device.");',
  '  test.skip(testInfo.project.name.startsWith("firefox") || (isPhone() && !testInfo.project.name.includes("webkit")), "Mixed project tags.");',
  '  const text = "test.skip(true, \\"a string is not a call\\")";',
  "});",
  'test("b", async ({ page, isMobile }) => {',
  '  test.skip(!isMobile, "The phone layout; the PC is the previous test.");',
  '  test.skip(test.info().project.name === "webkit-phone", "webkit-phone has no hover.");',
  "});",
].join("\n");

const PROJECT_SKIP_REASONS = [
  "Pixel authority is pinned to chromium-desktop.",
  "Baselines are taken on two lanes.",
  "${testInfo.project.name}: the phone grid has no drag, so there is nothing to replace.",
  "No row is declared for this device.",
  "Mixed project tags.",
  "The phone layout; the PC is the previous test.",
  "webkit-phone has no hover.",
];

test("projectConditionSkips (D-69 G4): the closed list of project-only conditions yields the reasons of those calls", () => {
  assert.deepEqual(gate.projectConditionSkips(PROJECT_SKIP_SOURCE), PROJECT_SKIP_REASONS);
});

test("projectConditionSkips (D-69 G4): a condition with data, an unconditional skip, an unknown name or a shadowed fixture proves nothing", () => {
  const reasons = (...lines: string[]) => gate.projectConditionSkips(lines.join("\n"));
  assert.deepEqual(reasons("test.skip(!before, `no height was measured on the project ${testInfo.project.name}`);"), [], "the text names the project, the condition is data");
  assert.deepEqual(reasons('test.skip(true, "BLOCKED (ENV): nothing to run");'), []);
  assert.deepEqual(reasons('test.skip(count === 0, "BLOCKED (DATA): no records");'), []);
  assert.deepEqual(reasons('test.skip(testInfo.project.name !== "a" && data, "mixed with data");'), []);
  assert.deepEqual(reasons('test.skip(isPhone() || count === 0, "phone or data");', 'const isPhone = () => test.info().project.name.endsWith("-phone");'), []);
  assert.deepEqual(reasons('test.skip(unknownFn(), "no definition in this file");'), []);
  assert.deepEqual(reasons('const isPhone = () => window.innerWidth < 500;', 'test.skip(isPhone(), "width, not a project");'), []);
  assert.deepEqual(reasons('const isPhone = () => test.info().project.name.endsWith(suffix);', 'test.skip(isPhone(), "suffix is a variable");'), []);
  assert.deepEqual(reasons('const isMobile = await page.evaluate(() => matchMedia("(max-width: 600px)").matches);', 'test.skip(isMobile, "measured, not a fixture");'), []);
  assert.deepEqual(reasons("const lanes = new Set(items);", 'test.skip(!lanes.has(testInfo.project.name), "items are not literals");'), []);
  assert.deepEqual(reasons('const lanes = new Set(["a", `${x}`]);', 'test.skip(!lanes.has(testInfo.project.name), "one item is computed");'), []);
  assert.deepEqual(reasons('test.skip(testInfo.project.name.endsWith(suffix), "variable argument");'), []);
  assert.deepEqual(reasons('test.skip(testInfo.project.name !== other, "variable operand");'), []);
  assert.deepEqual(reasons('test.skip(testInfo.project.name !== "a" ? true : data, "ternary");'), []);
  assert.deepEqual(reasons('test.skip(testInfo.project.name !== "a");'), [], "a skip without a reason has no text to compare");
  assert.deepEqual(reasons('test.skip(testInfo.project.name !== "a", reasonText);'), [], "the reason must be a literal");
});

const reasonOf = (project: string, description: string, extra: Record<string, unknown> = {}) =>
  pwTest("skipped", { projectName: project, annotations: [{ type: "skip", description }], ...extra });
const spec = "visual/x.spec.ts";
const proofs = (...reasons: string[]) => new Map([[spec, reasons]]);

test("classifyPlaywright (D-69 G4): a skip is by project only with the reason proven by the source and a clean pass on another project", () => {
  const pass = pwTest("expected", { projectName: "chromium-desktop" });
  const report = pwReport([{ title: "frame", file: spec, tests: [pass, reasonOf("chromium-phone", "Pixel authority is pinned to chromium-desktop.")] }]);
  const accepted = gate.classifyPlaywright(report, [], { projectSkips: true, skipProofs: proofs("Pixel authority is pinned to chromium-desktop.") });
  assert.equal(accepted.status, "PASS");
  assert.equal(accepted.projectSkipped, 1);
  assert.equal(accepted.counts.skipped, 1, "the skip is still counted");
  const noProofs = gate.classifyPlaywright(report, [], { projectSkips: true });
  assert.equal(noProofs.status, "SKIPPED", "without a proof from the source nothing is explained");
  const otherText = gate.classifyPlaywright(report, [], { projectSkips: true, skipProofs: proofs("Another reason.") });
  assert.equal(otherText.status, "SKIPPED", "the annotation text must equal a proven reason");
  const otherFile = gate.classifyPlaywright(report, [], { projectSkips: true, skipProofs: new Map([["visual/y.spec.ts", ["Pixel authority is pinned to chromium-desktop."]]]) });
  assert.equal(otherFile.status, "SKIPPED");
  const off = gate.classifyPlaywright(report, [], { skipProofs: proofs("Pixel authority is pinned to chromium-desktop.") });
  assert.equal(off.status, "SKIPPED", "a gate without projectSkips counts every skip as SKIPPED");
});

test("classifyPlaywright (D-69 G4): a template reason matches its substituted text; a bare substitution proves nothing", () => {
  const report = pwReport([{ title: "frame", file: spec, tests: [pwTest("expected", { projectName: "chromium-desktop" }), reasonOf("chromium-phone", "chromium-phone: the phone grid has no drag.")] }]);
  assert.equal(gate.classifyPlaywright(report, [], { projectSkips: true, skipProofs: proofs("${testInfo.project.name}: the phone grid has no drag.") }).status, "PASS");
  assert.equal(gate.classifyPlaywright(report, [], { projectSkips: true, skipProofs: proofs("${anything}") }).status, "SKIPPED");
});

test("classifyPlaywright (D-69 G4): пропуск по данным не засчитывается, even when the same test passed on another project and the text names the project", () => {
  const dataSource = "test.skip(!before, `no height of the block was measured on the project ${testInfo.project.name}`);";
  const proven = gate.projectConditionSkips(dataSource);
  assert.deepEqual(proven, []);
  const report = pwReport([
    {
      title: "the closed block is compact",
      file: spec,
      tests: [pwTest("expected", { projectName: "chromium-desktop" }), reasonOf("firefox-desktop", "no height of the block was measured on the project firefox-desktop")],
    },
  ]);
  const classified = gate.classifyPlaywright(report, [], { projectSkips: true, skipProofs: new Map([[spec, proven]]) });
  assert.equal(classified.status, "SKIPPED");
  assert.equal(classified.projectSkipped, 0);
});

test("classifyPlaywright (D-69 G4): a test skipped everywhere, a pass on the same project only, a BLOCKED skip and a retry-pass explain nothing", () => {
  const options = { projectSkips: true, skipProofs: proofs("Not here.") };
  const everywhere = pwReport([{ title: "never ran", file: spec, tests: [reasonOf("chromium-phone", "Not here."), reasonOf("webkit-phone", "Not here.")] }, { title: "other", file: spec, tests: [pwTest("expected")] }]);
  assert.equal(gate.classifyPlaywright(everywhere, [], options).status, "SKIPPED");
  const sameProject = pwReport([{ title: "t", file: spec, tests: [pwTest("expected", { projectName: "chromium-phone" }), reasonOf("chromium-phone", "Not here.")] }]);
  assert.equal(gate.classifyPlaywright(sameProject, [], options).status, "SKIPPED", "a pass on the project that skipped is not another project");
  const blocked = pwReport([{ title: "t", file: spec, tests: [pwTest("expected", { projectName: "chromium-desktop" }), reasonOf("chromium-phone", "BLOCKED (DATA): none")] }]);
  assert.equal(gate.classifyPlaywright(blocked, [], { projectSkips: true, skipProofs: proofs("BLOCKED (DATA): none") }).status, "BLOCKED");
  const retried = pwReport([
    {
      title: "t",
      file: spec,
      tests: [pwTest("expected", { projectName: "chromium-desktop", results: [{ status: "failed", retry: 0 }, { status: "passed", retry: 1 }] }), reasonOf("chromium-phone", "Not here.")],
    },
  ]);
  const retriedResult = gate.classifyPlaywright(retried, [], options);
  assert.equal(retriedResult.status, "FAIL", "the retry itself is a failure");
  assert.equal(retriedResult.projectSkipped, 0, "and it is no ground for the skip");
  const flaky = pwReport([{ title: "t", file: spec, tests: [pwTest("flaky", { projectName: "chromium-desktop" }), reasonOf("chromium-phone", "Not here.")] }]);
  assert.equal(gate.classifyPlaywright(flaky, [], options).projectSkipped, 0);
});

test("classifyPlaywright (D-69 G4): passes of the whole gate run come in from outside, so a second step can rely on the first", () => {
  const first = pwReport([{ title: "frame", file: spec, tests: [pwTest("expected", { projectName: "chromium-desktop" })] }]);
  const second = pwReport([{ title: "frame", file: spec, tests: [reasonOf("chromium-phone", "Pixel authority.")] }]);
  const alone = gate.classifyPlaywright(second, [], { projectSkips: true, skipProofs: proofs("Pixel authority.") });
  assert.equal(alone.status, "SKIPPED", "inside one report the test has no pass");
  const passed = gate.passedTests(first);
  assert.ok(passed instanceof Map);
  const together = gate.classifyPlaywright(second, [], { projectSkips: true, skipProofs: proofs("Pixel authority."), passed });
  assert.equal(together.status, "PASS");
  assert.equal(together.projectSkipped, 1);
});

const MOTION_SOURCE = [
  'import { test } from "@playwright/test";',
  "test.beforeEach(({}, testInfo) => {",
  '  test.skip(testInfo.project.name !== "chromium-desktop", "Phase 15 pixel authority is pinned to chromium-desktop.");',
  "});",
].join("\n");
const MOTION_REASON = "Phase 15 pixel authority is pinned to chromium-desktop.";
const motionFile = "visual/motion.spec.ts";
const stepOne = () =>
  pwReport([
    { title: "[STAB-BASE-03] motion frame", file: motionFile, tests: [pwTest("expected", { projectName: "chromium-desktop" }), reasonOf("chromium-dpr125", MOTION_REASON)] },
    { title: "[STAB-BASE-03] shell", file: "visual/desktop.spec.ts", tests: [pwTest("expected", { projectName: "chromium-desktop" }), pwTest("expected", { projectName: "chromium-dpr125" })] },
  ]);
const stepTwo = () =>
  pwReport([
    { title: "[STAB-BASE-03] motion frame", file: motionFile, tests: ["chromium-phone", "webkit-phone", "firefox-desktop"].map((project) => reasonOf(project, MOTION_REASON)) },
    { title: "[STAB-BASE-03] shell", file: "visual/desktop.spec.ts", tests: ["chromium-phone", "webkit-phone", "firefox-desktop"].map((project) => pwTest("expected", { projectName: project })) },
  ]);

/** A lane whose k-th Playwright step writes reports[k]; `sources` are written under tests/e2e of the throwaway checkout. */
function stepLane(env: Record<string, string>, reports: unknown[], sources: Record<string, string> = {}) {
  let call = 0;
  const lane = harness(env, (_file, _args, worktree) => {
    writeReport(worktree, reports[Math.min(call, reports.length - 1)]);
    call += 1;
    return { status: 0 };
  });
  lane.addHarnessFile();
  lane.results.push({ id: "npm-ci", status: "PASS" });
  for (const [file, text] of Object.entries(sources)) {
    const full = path.join(lane.worktree, "tests", "e2e", file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return lane;
}

test("runGate (D-69 G4): visual-approved over two steps — the three skips of step 2 are explained by the pass of step 1 and the source", () => {
  const lane = stepLane({}, [stepOne(), stepTwo()], { [motionFile]: MOTION_SOURCE });
  const outcome = lane.run("visual-approved");
  assert.equal(outcome.status, "PASS", String(outcome.reason));
  assert.equal(outcome.projectSkipped, 4, "one skip of step 1 (dpr125) and three of step 2");
  assert.deepEqual(outcome.counts, { passed: 6, failed: 0, flaky: 0, skipped: 4, blocked: 0 });
  assert.match(outcome.reason, /3 skip\(s\) by project condition; each such test passed on another project in this gate run/);
  lane.cleanup();
});

test("runGate (D-69 G4): visual-approved stays SKIPPED when the source does not prove the condition, the file is absent, or the test never passed", () => {
  const data = stepLane({}, [stepOne(), stepTwo()], { [motionFile]: `test.skip(!before, "${MOTION_REASON}");` });
  assert.equal(data.run("visual-approved").status, "SKIPPED", "a skip by data with an equal text");
  data.cleanup();
  const absent = stepLane({}, [stepOne(), stepTwo()]);
  assert.equal(absent.run("visual-approved").status, "SKIPPED", "no spec source in the checkout");
  absent.cleanup();
  const onlySkips = stepLane({}, [stepTwo(), stepTwo()], { [motionFile]: MOTION_SOURCE });
  const outcome = onlySkips.run("visual-approved");
  assert.equal(outcome.status, "SKIPPED", "skipped in every step and passed nowhere");
  onlySkips.cleanup();
});

test("runGate (D-69 G4): a retry-pass on the other project is FAIL and the skip stays unexplained", () => {
  const retried = pwReport([
    {
      title: "[STAB-BASE-03] motion frame",
      file: motionFile,
      tests: [pwTest("expected", { projectName: "chromium-desktop", results: [{ status: "failed", retry: 0 }, { status: "passed", retry: 1 }] }), reasonOf("chromium-dpr125", MOTION_REASON)],
    },
  ]);
  const lane = stepLane({}, [retried, stepTwo()], { [motionFile]: MOTION_SOURCE });
  const outcome = lane.run("visual-approved");
  assert.equal(outcome.status, "FAIL");
  assert.equal(outcome.projectSkipped, 0);
  lane.cleanup();
});

test("runGate (D-69 G4): a pass in the report of ANOTHER gate does not explain a skip", () => {
  const lane = stepLane({}, [stepOne(), stepTwo()], { [motionFile]: MOTION_SOURCE });
  lane.run("ui-contract-offline");
  const reportOnlySkips = pwReport([{ title: "[STAB-BASE-03] motion frame", file: motionFile, tests: [reasonOf("chromium-phone", MOTION_REASON), pwTest("expected", { projectName: "chromium-phone", title: "x" })] }]);
  lane.cleanup();
  const isolated = stepLane({}, [reportOnlySkips], { [motionFile]: MOTION_SOURCE });
  isolated.results.push({ id: "ui-contract-offline", status: "PASS", projectSkipped: 0 });
  const outcome = isolated.run("visual-approved");
  assert.equal(outcome.status, "SKIPPED");
  isolated.cleanup();
});

test("runGate (D-69 G4): the rule applies to visual-phase20 and e2e-full, not to the live lanes e2e-mutation and staging-live", () => {
  const byId = (id: string) => gate.GATES.find((entry: { id: string }) => entry.id === id);
  assert.deepEqual(
    gate.GATES.filter((entry: { projectSkips?: boolean }) => entry.projectSkips).map((entry: { id: string }) => entry.id),
    ["e2e-full", "ui-contract-offline", "visual-approved", "visual-phase20"],
  );
  assert.ok(byId("visual-approved").strictSkips && byId("visual-phase20").strictSkips && byId("e2e-full").strictSkips, "strict stays");
  assert.ok(!byId("e2e-mutation").projectSkips && !byId("staging-live").projectSkips);

  const phase20Source = ['const lanes = new Set(["chromium-desktop", "chromium-phone"]);', "test.beforeEach(({}, testInfo) => {", '  test.skip(!lanes.has(testInfo.project.name), "Phase 20 baselines are taken on two lanes.");', "});"].join("\n");
  const phase20Report = pwReport([
    { title: "frame @phase20", file: "visual/phase20.spec.ts", tests: [pwTest("expected", { projectName: "chromium-desktop" }), pwTest("expected", { projectName: "chromium-phone" }), reasonOf("firefox-desktop", "Phase 20 baselines are taken on two lanes.")] },
  ]);
  const phase20 = stepLane({}, [phase20Report], { "visual/phase20.spec.ts": phase20Source });
  const phase20Outcome = phase20.run("visual-phase20");
  assert.equal(phase20Outcome.status, "PASS", String(phase20Outcome.reason));
  assert.equal(phase20Outcome.projectSkipped, 1);
  phase20.cleanup();

  const e2eSource = ["test.beforeEach(({}, testInfo) => {", '  test.skip(testInfo.project.name.endsWith("-phone"), "Phone projects have no cascading windows.");', "});"].join("\n");
  const e2eReport = pwReport([
    { title: "windows", file: "specs/window-reopen.spec.ts", tests: [pwTest("expected", { projectName: "chromium-desktop" }), reasonOf("chromium-phone", "Phone projects have no cascading windows.")] },
  ]);
  const full = stepLane(PUBLIC_ENV, [e2eReport], { "specs/window-reopen.spec.ts": e2eSource });
  const fullOutcome = full.run("e2e-full");
  assert.equal(fullOutcome.status, "PASS", String(fullOutcome.reason));
  assert.equal(fullOutcome.projectSkipped, 1);
  full.cleanup();

  const live = stepLane({ ...PUBLIC_ENV, ...MUTATION_ENV }, [e2eReport], { "specs/window-reopen.spec.ts": e2eSource });
  live.results.push({ id: "mutation-attest", status: "PASS" });
  const liveOutcome = live.run("e2e-mutation");
  assert.equal(liveOutcome.status, "SKIPPED", "a skipped live test is evidence only with an attested staging run");
  assert.equal(liveOutcome.projectSkipped ?? 0, 0);
  live.cleanup();
});

test("runGate (D-69 G4): ui-contract-offline explains the skip of step 4 by the pass of step 3", () => {
  const source = ["test.beforeEach(({}, testInfo) => {", '  test.skip(testInfo.project.name === "webkit-phone", "No hover on webkit-phone.");', "});"].join("\n");
  const file = "specs/editor-ui-contract.spec.ts";
  const passing = pwReport([{ title: "D-66 touch", file, tests: [pwTest("expected", { projectName: "chromium-phone" })] }]);
  const skipping = pwReport([{ title: "D-66 touch", file, tests: [reasonOf("webkit-phone", "No hover on webkit-phone.")] }]);
  const lane = stepLane({}, [passing, passing, passing, skipping], { [file]: source });
  const outcome = lane.run("ui-contract-offline");
  assert.equal(outcome.status, "PASS", String(outcome.reason));
  assert.equal(outcome.projectSkipped, 1);
  lane.cleanup();
});

test("the real spec files: the pixel-authority skips are proven, the data skip of editor-ui-contract is not, desktop.spec skips by project name", () => {
  const read = (relative: string) => readFileSync(new URL(`../tests/e2e/${relative}`, import.meta.url), "utf8");
  for (const file of ["visual/motion.spec.ts", "visual/promotion.spec.ts", "visual/apps.spec.ts", "visual/editor.spec.ts"]) {
    assert.deepEqual(gate.projectConditionSkips(read(file)), ["Phase 15 pixel authority is pinned to chromium-desktop."], file);
  }
  assert.deepEqual(gate.projectConditionSkips(read("visual/phase20.spec.ts")), ["Phase 20 baselines are taken on chromium-desktop and chromium-phone."]);
  const desktop = read("visual/desktop.spec.ts");
  assert.match(desktop, /includes\(testInfo\.project\.name\)/);
  assert.deepEqual(gate.projectConditionSkips(desktop), ["No device-specific approved row is declared for ${testInfo.project.name}."]);
  const editor = gate.projectConditionSkips(read("specs/editor-ui-contract.spec.ts"));
  assert.ok(!editor.some((reason: string) => /no height of the block/.test(reason)), "the data skip at editor-ui-contract is not a project skip");
  assert.ok(editor.includes("a finger exists on the phone projects only; the mouse is checked on chromium-desktop"));
  assert.ok(gate.projectConditionSkips(read("specs/template-builder.spec.ts")).includes("The phone layout; the PC is the previous test."));
  assert.ok(gate.projectConditionSkips(read("specs/accessibility.spec.ts")).some((reason: string) => reason.startsWith("${testInfo.project.name}: PC trap")));
});

test("counts cell (D-69 G4): `(по проекту N)` is written, read back, and checked by --verify-evidence", () => {
  const withSkips = (id: string, projectSkipped: number, skipped = projectSkipped) => (entry: string) =>
    entry === id ? { counts: { passed: 10, failed: 0, skipped, flaky: 0, blocked: 0 }, projectSkipped } : {};
  const good = gate.renderEvidence(fullRun({}, withSkips("visual-approved", 3)));
  assert.match(good, /^\| visual-approved \|.*\| 10\/0\/3\/0 \(по проекту 3\) \|/m);
  assert.deepEqual(verify(good), [], "all skips of a strict gate explained by the number");
  assert.doesNotMatch(gate.renderEvidence(fullRun({}, withSkips("visual-approved", 0, 0))), /по проекту/);
  const partly = gate.renderEvidence(fullRun({}, withSkips("visual-approved", 3, 4)));
  mentions(verify(partly), /visual-approved: PASS row has 1 skipped test\(s\), a skip is not a pass/);
  const live = gate.renderEvidence(fullRun({}, withSkips("e2e-mutation", 2)));
  mentions(verify(live), /e2e-mutation: .*по проекту.*no project-skip rule/);
  const over = gate.renderEvidence(fullRun({}, withSkips("e2e-full", 3, 2)));
  mentions(verify(over), /e2e-full: .*по проекту 3.* larger than the skipped count 2/);
  const e2e = gate.renderEvidence(fullRun({}, withSkips("e2e-full", 2)));
  assert.deepEqual(verify(e2e), []);
});

// --- 20-15 Task 1 (D-70, D-68, D-12): lineage RC -> FRC, release verdict and phase closure ------------------------------------------

const D70_COMMIT = "03e890a0135ff20f02b4ab68fe39642fff84c39f";
const RC_COMMIT = "f49aa00f2b9833f962fa3fa890117e98a4abf362";
const FRC_COMMIT = "9".repeat(40);
const D70_WORDS = "Можно ли сразу перейти к след фазе? ведь меня все устраивает";
const D70_LEDGER_VERDICT = "ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)";
const D70_CONTEXT = `# 20-CONTEXT\n\n- **D-70:** Физическая приёмка 20-14 заменяется принятием риска владельцем. Дословно (2026-11-08): «${D70_WORDS}». Оркестратор предложил три варианта; владелец ответил «2».\n`;

type UatOptions = { pc?: string; phone?: string; step?: string; stepCommit?: string; section?: boolean; words?: string; rc?: string; record?: string; answer?: string };

function uatText(o: UatOptions = {}) {
  const { pc = D70_LEDGER_VERDICT, phone = D70_LEDGER_VERDICT, step = "НЕ ПРОВЕРЕНО (D-70)", stepCommit = "-", section = true, words = D70_WORDS, rc = RC_COMMIT, record = D70_COMMIT, answer = "2" } = o;
  const head = "| ID | Шаг | Ожидаемый результат | Требования | Зависит от | Статус | Устройство | Commit | Дата | Заметка | Скриншот |\n|----|----|----|----|----|----|----|----|----|----|----|";
  const lines = [
    "---", "phase: PORTIA-20", "artifact: uat-ledger", "status: accepted-risk-d70", `release_candidate_commit: ${rc}`, "---", "",
    "# 20-UAT", "", "## Prerequisites", "",
    "| ID | Что | Источник | Статус | Дата | Примечание |", "|----|----|----|----|----|----|",
    "| P19-GAP-20 | gap | 19-20-SUMMARY.md | PASS | 2026-11-04 | prerequisite, не приёмка |", "",
    "## Чек-лист PC", "", head, `| INFO-PC-01 | шаг | ожидание | STAB-APP-04 | - | ${step} | - | ${stepCommit} | - | n | - |`, "",
    "## Чек-лист phone", "", head, `| INFO-PHONE-01 | шаг | ожидание | STAB-APP-04 | - | ${step} | - | ${stepCommit} | - | n | - |`, "",
    "## Вердикты", "", `Вердикт PC: ${pc}`, `Вердикт phone: ${phone}`, "",
  ];
  if (section) {
    lines.push("## D-70: принятие риска владельцем без UAT", "", "- Дата: 2026-11-08", `- Слова владельца (дословно): «${words}»`, `- Ответ владельца на варианты (дословно): «${answer}»`,
      `- Запись решения: 20-CONTEXT.md D-70, commit ${record}`, `- Release commit: ${rc} (20-63-SUMMARY.md, 20-RELEASE-EVIDENCE.md)`, "");
  }
  return lines.join("\n");
}

const BLOCKED_LANE = (lanes: string[]) => (id: string) => (lanes.includes(id) ? { status: "BLOCKED", blockedKind: "ENV", exitCode: null, counts: null, reason: "no target" } : {});
const LINEAGE_VISUAL: Row[] = [
  { id: "Общий вердикт", status: "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08", evidence: `owner_verdict: accepted; owner_verdict_date: 2026-11-08; owner_verdict_commit: ${OWNER_COMMIT}; источник: 20-58-SUMMARY.md` },
  { id: "Эталоны 20-12", status: "60 строк реестра", evidence: `phase20-baselines.json; коммит вердикта реестра: ${OWNER_COMMIT}` },
  { id: "Код продукта", status: "НЕ ИЗМЕНЁН", evidence: `git diff --name-only ${OWNER_COMMIT.slice(0, 12)} ${FRC_COMMIT.slice(0, 12)}` },
];
const lineageEvidence = (verdict = "PASS", lanes: string[] = [], commit = FRC_COMMIT) =>
  gate.renderEvidence(fullRun({ commit, verdict, visual: LINEAGE_VISUAL }, BLOCKED_LANE(lanes)));
const reconciliationText = (o: { runner?: string | null; release?: string | null; closure?: string | null; frc?: string; rc?: string } = {}) => {
  const { runner = "PASS", release = "PASS-WITH-OWNER-WAIVERS", closure = "С ПРИНЯТЫМИ ДОЛГАМИ (D-70)", frc = FRC_COMMIT, rc = RC_COMMIT } = o;
  return ["---", "phase: PORTIA-20", `final_release_commit: ${frc}`, `release_candidate_commit: ${rc}`, `plan_base: ${"1".repeat(40)}`, "---", "", "# 20-RECONCILIATION", "",
    ...(runner === null ? [] : [`Итог раннера на FRC: ${runner}`]), ...(release === null ? [] : [`Итог релиза: ${release}`]), ...(closure === null ? [] : [`Закрытие фазы: ${closure}`]), ""].join("\n");
};

type LineageOptions = {
  files?: Record<string, string | null>;
  changes?: Record<string, string[] | null>;
  unknown?: string[];
  notAncestors?: string[];
};

function lineageRepo(o: LineageOptions = {}) {
  const dir = gate.PHASE_DIR;
  const files: Record<string, string | null> = {
    [`${dir}/20-UAT.md`]: uatText(),
    [`${dir}/20-CONTEXT.md`]: D70_CONTEXT,
    [`${dir}/20-63-SUMMARY.md`]: `---\nplan: 63\nrelease_commit: ${RC_COMMIT}\nverdict: BLOCKED\n---\n`,
    [`${dir}/20-58-SUMMARY.md`]: OWNER_SUMMARY(),
    [`${dir}/20-SECURITY-MATRIX.md`]: CLEAN_MATRIX,
    [`${dir}/20-RELEASE-EVIDENCE.md`]: lineageEvidence(),
    [`${dir}/20-RECONCILIATION.md`]: reconciliationText(),
    [gate.BASELINES_JSON]: JSON.stringify({ ownerVerdict: { commit: OWNER_COMMIT }, rows: [{}, {}] }),
    ...(o.files ?? {}),
  };
  const rel = (target: string) => path.relative("virtual-root", target).split(path.sep).join("/");
  const live = () => Object.entries(files).filter(([, text]) => text !== null);
  const fs = {
    existsSync: (target: string) => files[rel(target)] != null || rel(target) === dir,
    readFileSync: (target: string) => {
      const text = files[rel(target)];
      if (text == null) throw new Error(`ENOENT ${target}`);
      return text;
    },
    readdirSync: (target: string) => live().filter(([name]) => path.posix.dirname(name) === rel(target)).map(([name]) => path.posix.basename(name)),
  };
  const known = [OWNER_COMMIT, RC_COMMIT, FRC_COMMIT, D70_COMMIT].filter((sha) => !(o.unknown ?? []).includes(sha));
  const git = (args: string[]) => {
    if (args[0] === "cat-file") return { status: known.some((sha) => args[2]?.startsWith(sha)) ? 0 : 128, stdout: "", stderr: "" };
    if (args[0] === "merge-base") return { status: (o.notAncestors ?? []).includes(`${args[2]}>${args[3]}`) ? 1 : 0, stdout: "", stderr: "" };
    if (args[0] === "diff") {
      const changed = (o.changes ?? {})[`${args[2]}>${args[3]}`];
      if (changed === null) return { status: 128, stdout: "", stderr: "fatal: bad revision" };
      return { status: 0, stdout: (changed ?? []).join("\n"), stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  return { deps: { root: "virtual-root", fs, git } };
}

const lineageErrors = (o: LineageOptions = {}): string[] => gate.verifyLineage(lineageRepo(o).deps);
const D = gate.PHASE_DIR;

test("D-70 constants: the owner verdict word and the closed list of environment lanes that may stay BLOCKED", () => {
  assert.equal(gate.D70_VERDICT, D70_LEDGER_VERDICT);
  assert.deepEqual([...gate.D70_DEBT_LANES].sort(), ["e2e-full", "e2e-mutation", "mutation-attest", "staging-live", "visual-phase20"]);
});

test("releaseVerdict (D-70): the worst of the runner verdict and PASS-WITH-OWNER-WAIVERS; PASS is impossible, an unknown verdict is FAIL", () => {
  assert.equal(gate.releaseVerdict("PASS", "D-70"), "PASS-WITH-OWNER-WAIVERS");
  assert.equal(gate.releaseVerdict("PASS-WITH-OWNER-WAIVERS", "D-70"), "PASS-WITH-OWNER-WAIVERS");
  assert.equal(gate.releaseVerdict("BLOCKED", "D-70"), "BLOCKED");
  assert.equal(gate.releaseVerdict("FAIL", "D-70"), "FAIL");
  assert.equal(gate.releaseVerdict("GREEN", "D-70"), "FAIL");
  assert.equal(gate.releaseVerdict(undefined, "D-70"), "FAIL");
  assert.equal(gate.releaseVerdict("PASS", D70_LEDGER_VERDICT), "PASS-WITH-OWNER-WAIVERS");
  assert.equal(gate.releaseVerdict("PASS", null), "PASS", "without the D-70 acceptance the runner verdict stands");
  assert.equal(gate.releaseVerdict("nonsense", null), "FAIL");
});

const closureInput = (patch: Record<string, unknown> = {}) => ({
  results: gate.GATES.map((entry: { id: string }) => ({ id: entry.id, status: "PASS" })),
  verdict: "PASS-WITH-OWNER-WAIVERS",
  high: [] as string[],
  owner: { verdict: "accepted", date: "2026-11-08", chainError: "" },
  ledgerErrors: [] as string[],
  ...patch,
});
const withBlocked = (ids: string[], status = "BLOCKED") => gate.GATES.map((entry: { id: string }) => ({ id: entry.id, status: ids.includes(entry.id) ? status : "PASS" }));

test("phaseClosure (D-70): closes with accepted debts only when every BLOCKED gate is an environment lane of D-70", () => {
  assert.equal(gate.phaseClosure(closureInput()), "С ПРИНЯТЫМИ ДОЛГАМИ (D-70)");
  const lanes = ["e2e-full", "mutation-attest", "e2e-mutation", "staging-live", "visual-phase20"];
  assert.equal(gate.phaseClosure(closureInput({ results: withBlocked(lanes), verdict: "BLOCKED" })), "С ПРИНЯТЫМИ ДОЛГАМИ (D-70)");
});

test("phaseClosure (D-70): a BLOCKED gate outside the lanes, a FAIL, a high, a refused verdict or a broken ledger is ЗАБЛОКИРОВАНО with the reasons", () => {
  const blockedAudit = gate.phaseClosure(closureInput({ results: withBlocked(["audit-prod"]), verdict: "BLOCKED" }));
  assert.match(blockedAudit, /^ЗАБЛОКИРОВАНО/);
  assert.match(blockedAudit, /audit-prod/);
  assert.match(gate.phaseClosure(closureInput({ results: withBlocked(["unit"], "FAIL"), verdict: "FAIL" })), /^ЗАБЛОКИРОВАНО.*unit/);
  assert.match(gate.phaseClosure(closureInput({ high: ["SEC20-99"] })), /^ЗАБЛОКИРОВАНО.*SEC20-99/);
  assert.match(gate.phaseClosure(closureInput({ owner: { verdict: "fixes-requested", date: "2026-11-09", chainError: "" } })), /^ЗАБЛОКИРОВАНО.*вердикт/);
  assert.match(gate.phaseClosure(closureInput({ owner: null })), /^ЗАБЛОКИРОВАНО/);
  assert.match(gate.phaseClosure(closureInput({ owner: { verdict: "", date: "", chainError: "цепочка вердиктов нарушена" } })), /^ЗАБЛОКИРОВАНО/);
  assert.match(gate.phaseClosure(closureInput({ ledgerErrors: ["D-70: нет раздела"] })), /^ЗАБЛОКИРОВАНО.*журнал/);
  assert.match(gate.phaseClosure(closureInput({ verdict: "PASS" })), /^ЗАБЛОКИРОВАНО/, "the release verdict PASS is impossible under D-70");
  assert.match(gate.phaseClosure(closureInput({ verdict: "FAIL" })), /^ЗАБЛОКИРОВАНО/);
  const waived = gate.GATES.map((entry: { id: string }) => ({ id: entry.id, status: entry.id === "e2e-full" ? "FAIL" : "PASS", waived: entry.id === "e2e-full" }));
  assert.equal(gate.phaseClosure(closureInput({ results: waived })), "С ПРИНЯТЫМИ ДОЛГАМИ (D-70)", "a FAIL with an accepted owner waiver does not block");
});

test("verifyLineage (D-70): a consistent ledger, registry, protocol and unchanged product code pass, with PASS and with BLOCKED lanes", () => {
  assert.deepEqual(lineageErrors(), []);
  const lanes = ["e2e-full", "mutation-attest", "e2e-mutation", "staging-live", "visual-phase20"];
  const blocked = lineageErrors({ files: {
    [`${D}/20-RELEASE-EVIDENCE.md`]: lineageEvidence("BLOCKED", lanes),
    [`${D}/20-RECONCILIATION.md`]: reconciliationText({ runner: "BLOCKED", release: "BLOCKED" }),
  } });
  assert.deepEqual(blocked, []);
});

test("verifyLineage: no protocol, a protocol of another commit or an unreadable reconciliation is rejected", () => {
  mentions(lineageErrors({ files: { [`${D}/20-RELEASE-EVIDENCE.md`]: null } }), /20-RELEASE-EVIDENCE\.md/);
  mentions(lineageErrors({ files: { [`${D}/20-RELEASE-EVIDENCE.md`]: lineageEvidence("PASS", [], RC_COMMIT) } }), /Commit .* не равен final_release_commit/);
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: null } }), /20-RECONCILIATION\.md/);
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ frc: "nothex" }) } }), /final_release_commit/);
});

test("verifyLineage: product code changed after the D-70 record, or after the effective verdict, is rejected; a git error is an error, not «unchanged»", () => {
  mentions(lineageErrors({ changes: { [`${D70_COMMIT}>${FRC_COMMIT}`]: ["components/portia-desktop.tsx"] } }), /после записи D-70.*portia-desktop/);
  mentions(lineageErrors({ changes: { [`${OWNER_COMMIT}>${FRC_COMMIT}`]: ["lib/portia-content.ts"] } }), /после действующего вердикта.*portia-content/);
  mentions(lineageErrors({ changes: { [`${D70_COMMIT}>${FRC_COMMIT}`]: null } }), /git diff не выполнен/);
  mentions(lineageErrors({ changes: { [`${OWNER_COMMIT}>${FRC_COMMIT}`]: null } }), /git diff не выполнен/);
  assert.deepEqual(lineageErrors({ changes: { [`${D70_COMMIT}>${FRC_COMMIT}`]: [] } }), []);
});

test("verifyLineage: the D-70 ledger must hold the owner's words, no PASS step, no device verdict with a commit (D-15 does not apply)", () => {
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ section: false }) } }), /нет раздела «D-70/);
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ words: "Можно сразу к следующей фазе, меня всё устраивает" }) } }), /слова владельца.*20-CONTEXT\.md/);
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ step: "PASS" }) } }), /шаг INFO-PC-01.*PASS/);
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ pc: `PASS (commit ${FRC_COMMIT.slice(0, 12)})` }) } }), /вердикт PC/);
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ phone: `FAIL (commit ${FRC_COMMIT.slice(0, 12)})` }) } }), /вердикт phone/);
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ stepCommit: FRC_COMMIT.slice(0, 12) }) } }), /commit/);
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ answer: "1" }) } }), /ответ владельца/);
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ record: "nothex" }) } }), /запись решения/);
});

test("verifyLineage: release_candidate_commit equals the release commit of 20-63 and is an ancestor of the FRC", () => {
  mentions(lineageErrors({ files: { [`${D}/20-UAT.md`]: uatText({ rc: FRC_COMMIT }) } }), /release_candidate_commit.*20-63-SUMMARY\.md/);
  mentions(lineageErrors({ notAncestors: [`${RC_COMMIT}>${FRC_COMMIT}`] }), /release_candidate_commit.*не предок/);
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ rc: OWNER_COMMIT }) } }), /release_candidate_commit/);
});

test("verifyLineage: the effective owner verdict must be accepted with an intact chain; the register must stand on the 20-58 commit", () => {
  mentions(lineageErrors({ files: { [`${D}/20-58-SUMMARY.md`]: OWNER_SUMMARY("fixes-requested") } }), /вердикт владельца.*fixes-requested/);
  mentions(lineageErrors({ files: { [`${D}/20-60-SUMMARY.md`]: linkSummary({ plan: 60, renews: COMMIT_FOREIGN }) } }), /цепочка вердиктов нарушена/);
  mentions(lineageErrors({ files: { [gate.BASELINES_JSON]: JSON.stringify({ ownerVerdict: { commit: COMMIT_B }, rows: [{}] }) } }), /реестр.*ownerVerdict\.commit/);
  mentions(lineageErrors({ files: { [gate.BASELINES_JSON]: null } }), /реестр/);
});

test("verifyLineage: one valid link moves the product-code check to the link commit; the check stays commit-bound", () => {
  const link = { [`${D}/20-60-SUMMARY.md`]: linkSummary({ plan: 60, commit: COMMIT_B, renews: OWNER_COMMIT }) };
  const visual = LINEAGE_VISUAL.map((row) => {
    if (row.id === "Общий вердикт") return { ...row, status: "ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-09", evidence: `owner_verdict: accepted; owner_verdict_date: 2026-11-09; owner_verdict_commit: ${COMMIT_B}; источник: 20-60-SUMMARY.md` };
    if (row.id === "Код продукта") return { ...row, evidence: `git diff ${COMMIT_B.slice(0, 12)}` };
    return row;
  });
  const evidence = gate.renderEvidence(fullRun({ commit: FRC_COMMIT, visual }));
  const files = { ...link, [`${D}/20-RELEASE-EVIDENCE.md`]: evidence };
  const withB = (o: LineageOptions) => {
    const deps = lineageRepo({ files, ...o }).deps;
    return { ...deps, git: (args: string[]) => (args[0] === "cat-file" && args[2]?.startsWith(COMMIT_B) ? { status: 0, stdout: "", stderr: "" } : deps.git(args)) };
  };
  assert.deepEqual(gate.verifyLineage(withB({})), []);
  mentions(gate.verifyLineage(withB({ changes: { [`${COMMIT_B}>${FRC_COMMIT}`]: ["app/page.tsx"] } })), /после действующего вердикта.*app\/page\.tsx/);
});

test("verifyLineage: a high blocker of the matrix, a protocol verdict above its gate table and the base protocol errors are rejected", () => {
  mentions(lineageErrors({ files: { [`${D}/20-SECURITY-MATRIX.md`]: BLOCKER_MATRIX } }), /неразрешённый high.*SEC20-99/);
  const stronger = lineageEvidence("PASS", []).replace(/(\| e2e-full \|[^\n]*?\| 0 \| )PASS( \|)/, "$1BLOCKED$2");
  mentions(lineageErrors({ files: { [`${D}/20-RELEASE-EVIDENCE.md`]: stronger } }), /протокол:.*stronger than the gate table/);
  mentions(lineageErrors({ files: { [`${D}/20-RELEASE-EVIDENCE.md`]: removeLine(lineageEvidence(), "| lint |") } }), /протокол:.*lint/);
});

test("verifyLineage (T-20-153): «Итог релиза» is required, equals releaseVerdict and is never PASS; «Итог раннера» equals the protocol", () => {
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ release: "PASS" }) } }), /Итог релиза: PASS/);
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ release: null }) } }), /Итог релиза/);
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ release: "BLOCKED" }) } }), /Итог релиза: BLOCKED.*PASS-WITH-OWNER-WAIVERS/);
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ runner: "BLOCKED" }) } }), /Итог раннера/);
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ runner: null }) } }), /Итог раннера/);
});

test("verifyLineage (T-20-155): «Закрытие фазы» is required and equals phaseClosure", () => {
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ closure: null }) } }), /Закрытие фазы/);
  mentions(lineageErrors({ files: { [`${D}/20-RECONCILIATION.md`]: reconciliationText({ closure: "ЗАКРЫТА" }) } }), /Закрытие фазы/);
  const blockedAudit = lineageEvidence("BLOCKED", ["audit-prod"]);
  mentions(lineageErrors({ files: {
    [`${D}/20-RELEASE-EVIDENCE.md`]: blockedAudit,
    [`${D}/20-RECONCILIATION.md`]: reconciliationText({ runner: "BLOCKED", release: "BLOCKED" }),
  } }), /Закрытие фазы: С ПРИНЯТЫМИ ДОЛГАМИ.*ЗАБЛОКИРОВАНО/);
  assert.deepEqual(lineageErrors({ files: {
    [`${D}/20-RELEASE-EVIDENCE.md`]: blockedAudit,
    [`${D}/20-RECONCILIATION.md`]: reconciliationText({ runner: "BLOCKED", release: "BLOCKED", closure: "ЗАБЛОКИРОВАНО: BLOCKED-гейт вне полос D-70: audit-prod" }),
  } }), [], "the honest closing line is accepted when it equals the computed one");
});

test("main --verify-lineage: exits 0 for the consistent repository and 1 with the reasons otherwise; the usage line names the mode", () => {
  let out = "";
  let err = "";
  const io = { out: (text: string) => { out += text; }, err: (text: string) => { err += text; } };
  assert.equal(gate.main(["--verify-lineage"], { ...lineageRepo().deps, ...io }), 0, err);
  assert.match(out, /lineage verified/);
  err = "";
  assert.equal(gate.main(["--verify-lineage"], { ...lineageRepo({ changes: { [`${D70_COMMIT}>${FRC_COMMIT}`]: ["lib/x.ts"] } }).deps, ...io }), 1);
  assert.match(err, /PORTIA_RELEASE_GATE:verify-failed.*после записи D-70/);
  err = "";
  gate.main(["--bogus"], { ...lineageRepo().deps, ...io });
  assert.match(err, /--verify-lineage/);
});

test("the runner states in a comment that D-70 is an accepted risk, not an acceptance", () => {
  const source = readFileSync(path.resolve("scripts", "phase20-release-gate.mjs"), "utf8");
  assert.match(source, /D-70 is an accepted risk of the owner, not an acceptance/);
});

// --- 20-15 Task 2 (D-70 (3)-(5), D-34, D-68): --verify-docs, the register of accepted debts, release notes and requirement statuses --------------

const DEBT20 = ["STAB-REL-05", "STAB-REL-06", "STAB-REL-07", "STAB-REL-08", "STAB-A11Y-01", "STAB-A11Y-02", "STAB-A11Y-03", "STAB-A11Y-04"];
const DEBT_STATUS = "Принятый долг (D-70)";
const BASIS_V2 = "«Открытые пункты Phase 18 и 19 с staging тоже уйдут как принятые долги» (слова оркестратора, выбранные владельцем «2»); прочтение 20-CONTEXT.md D-70 (4)";
const V18 = ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-VERIFICATION.md";
const V19 = ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-VERIFICATION.md";
const REQ_MD = ".planning/REQUIREMENTS.md";
const ROADMAP_MD = ".planning/ROADMAP.md";
const NOTES_MD = `${gate.PHASE_DIR}/20-RELEASE-NOTES.md`;
const OWNER_QUOTE = "а) да. принято";

const verificationText = (phase: number, gaps: number, unverified = 0) =>
  ["---", `phase: PORTIA-${phase}`, "status: gaps_found", "gaps:", ...Array.from({ length: gaps }, (_, i) => `  - truth: "gap ${i + 1}"\n    status: failed`),
    "deferred: []", ...(unverified > 0 ? ["behavior_unverified_items:", ...Array.from({ length: unverified }, (_, i) => `  - truth: "unverified ${i + 1}"\n    test: "t"`)] : []), "coincidental_reliance_items: []", "---", "", "# Verification", ""].join("\n");

const requirementsText = (o: { phase18?: string; complete20?: string[]; checked20?: string[] } = {}) => {
  const { phase18 = "Pending", complete20 = ["STAB-SEC-06"], checked20 = ["STAB-SEC-06"] } = o;
  const ids20 = [...DEBT20, "STAB-SEC-06"];
  const rows20 = ids20.map((id) => `| ${id} | Phase 20 | ${complete20.includes(id) ? "Complete" : "Accepted debt (D-70)"} |`);
  return [
    "# Requirements", "",
    "- [ ] **STAB-BASE-02**: x", "- [ ] **STAB-DESK-02**: x", "- [x] **STAB-PROM-03**: x", "- [ ] **STAB-PROM-15**: x",
    ...ids20.map((id) => `- [${checked20.includes(id) ? "x" : " "}] **${id}**: x`), "",
    "## Traceability", "", "| Requirement | Phase | Status |", "|---|---|---|",
    "| STAB-BASE-02 | Phase 15 | Pending |", `| STAB-DESK-02 | Phase 18 | ${phase18} |`, "| STAB-PROM-03 | Phase 19 | Complete |", "| STAB-PROM-15 | Phase 19 | Pending |", ...rows20, "",
  ].join("\n");
};

type RegRow = [string, string, string, string, string];
const registryRows = (): RegRow[] => [
  ...DEBT20.map((id): RegRow => [id, "20-UAT.md", "шаги не проходились", "D-70 (3)", DEBT_STATUS]),
  ["STAB-DESK-02", "18-VERIFICATION.md", "открыт", BASIS_V2, DEBT_STATUS],
  ["STAB-PROM-15", "19-VERIFICATION.md", "открыт", BASIS_V2, DEBT_STATUS],
  ["18-VERIF-GAP-1", "18-VERIFICATION.md", "gap", BASIS_V2, DEBT_STATUS],
  ["19-VERIF-GAP-1", "19-VERIFICATION.md", "gap", BASIS_V2, DEBT_STATUS],
  ["CR-01", "19-VERIFICATION.md", "таймер медиа", BASIS_V2, DEBT_STATUS],
  ["19-BLOCKED-DATA", "19-VERIFICATION.md", "ячейки BLOCKED (DATA)", BASIS_V2, DEBT_STATUS],
  ["e2e-full", "20-RELEASE-EVIDENCE.md", "нет цели", "полоса среды D-70", DEBT_STATUS],
  ["D-36(б) production", "20-CLASS-MIGRATION-EVIDENCE.md", "не применена", "D-70 (5)", "ОЖИДАЕТ ВЛАДЕЛЬЦА"],
  ["D-47 production", "20-EDITOR-NOTES-EVIDENCE.md", "не применена", "D-70 (5)", "ОЖИДАЕТ ВЛАДЕЛЬЦА"],
  ["20261106000000", "supabase/migrations", "не применена", "D-70 (5)", "ОЖИДАЕТ ВЛАДЕЛЬЦА"],
  ["todo 2026-11-08-template-builder-framing-dialog", "todos/pending", "отложено", "D-69", "Отложено владельцем"],
  ["STAB-BASE-02", "REQUIREMENTS.md", "Phase 15", "решает владелец", "Вне D-70: решает владелец"],
];
const registryText = (rows: RegRow[]) => ["## Принятые долги (D-70)", "", "| ID | Источник | Почему открыто | Основание | Статус |", "|---|---|---|---|---|", ...rows.map((row) => `| ${row.join(" | ")} |`), ""].join("\n");

const reconciliationDocs = (o: { rows?: RegRow[]; release?: string; vis03?: string | null; device?: string; visual?: string } = {}) => {
  const { rows = registryRows(), release = "BLOCKED", vis03 = "| STAB-VIS-03 / D-39 | 20-58-SUMMARY.md; 20-12-SUMMARY.md; phase20-empty-art-*; phase20-class-icons | два рисунка и 9 иконок (D-48) |", device = `Дата: 2026-11-08. Слова владельца: «${D70_WORDS}». Ответ «2». ${D70_LEDGER_VERDICT}. Источник: 20-CONTEXT.md D-70. PORTIA_REQUIRE_UAT=1: красный.`, visual = `owner_verdict_commit: ${OWNER_COMMIT}; источник: 20-58-SUMMARY.md; «${OWNER_QUOTE}»` } = o;
  return [
    "---", "phase: PORTIA-20", `final_release_commit: ${FRC_COMMIT}`, `release_candidate_commit: ${RC_COMMIT}`, `plan_base: ${"1".repeat(40)}`, "---", "", "# 20-RECONCILIATION", "",
    "## Приёмка на устройствах: принятый риск владельца (D-70)", "", device, "",
    "## Визуальная приёмка (D-68)", "", visual, "",
    "## Решения", "", "| Решение | Источник | Итог |", "|---|---|---|", ...(vis03 === null ? [] : [vis03]), "",
    "## Итог релиза", "", "Итог раннера на FRC: BLOCKED", `Итог релиза: ${release}`, "Закрытие фазы: С ПРИНЯТЫМИ ДОЛГАМИ (D-70)", "",
    registryText(rows),
  ].join("\n");
};

const notesText = (o: { sentence?: string; status?: string; commit?: string; extra?: string } = {}) => {
  const { sentence = "Пошаговая приёмка на физических ПК и телефоне не проводилась.", status = "final", commit = FRC_COMMIT, extra = "" } = o;
  return ["---", `status: ${status}`, `release_commit: ${commit}`, "---", "", "# Release notes", "", "## Приёмка владельцем без UAT (D-70)", "", `${sentence} Слова владельца: «${D70_WORDS}». ${D70_LEDGER_VERDICT}. Итог релиза: BLOCKED. ${extra}`, "", "## Не доказано", ""].join("\n");
};

function docsRepo(o: { files?: Record<string, string | null>; baseRequirements?: string } = {}) {
  const dir = gate.PHASE_DIR;
  const base = lineageRepo({
    files: {
      [`${dir}/20-RELEASE-EVIDENCE.md`]: lineageEvidence("BLOCKED", ["e2e-full"]),
      [`${dir}/20-RECONCILIATION.md`]: reconciliationDocs(),
      [`${dir}/20-12-SUMMARY.md`]: "---\nplan: 12\n---\n",
      [`${dir}/20-58-SUMMARY.md`]: `${OWNER_SUMMARY()}\n> ${OWNER_QUOTE}\n`,
      [NOTES_MD]: notesText(),
      [REQ_MD]: requirementsText(),
      [ROADMAP_MD]: `### Phase 20: x\n\n**Requirements**: ${[...DEBT20, "STAB-SEC-06"].join(", ")}\n`,
      [V18]: verificationText(18, 1),
      [V19]: verificationText(19, 1),
      ...(o.files ?? {}),
    },
  });
  const baseText = o.baseRequirements ?? requirementsText();
  const git = (args: string[]) => (args[0] === "show" ? { status: 0, stdout: baseText, stderr: "" } : base.deps.git(args));
  return { ...base.deps, git };
}
const docsErrors = (o: Parameters<typeof docsRepo>[0] = {}) => gate.verifyDocs(docsRepo(o));
const withRows = (mutate: (rows: RegRow[]) => RegRow[]) => ({ files: { [`${gate.PHASE_DIR}/20-RECONCILIATION.md`]: reconciliationDocs({ rows: mutate(registryRows()) }) } });

test("verifyDocs (D-70): a consistent register, release notes, requirement statuses and STAB-VIS-03 row have no errors", () => {
  assert.deepEqual(docsErrors(), []);
});

test("verifyDocs: a register row of Phase 20 marked Complete, or checked, is rejected; Accepted debt is required in the traceability", () => {
  mentions(docsErrors({ files: { [REQ_MD]: requirementsText({ complete20: ["STAB-SEC-06", "STAB-REL-05"] }) } }), /STAB-REL-05.*Complete/);
  mentions(docsErrors({ files: { [REQ_MD]: requirementsText({ checked20: ["STAB-SEC-06", "STAB-A11Y-03"] }) } }), /STAB-A11Y-03.*(Complete|галочк)/);
  mentions(docsErrors({ files: { [REQ_MD]: requirementsText().replace("| STAB-REL-06 | Phase 20 | Accepted debt (D-70) |", "| STAB-REL-06 | Phase 20 | Pending |") } }), /STAB-REL-06.*Accepted debt \(D-70\)/);
});

test("verifyDocs: every ID of the D-70 (3) minimum needs a register row; so does each open requirement of Phases 15, 18 and 19", () => {
  for (const id of DEBT20) mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== id))), new RegExp(`${id}.*(минимального набора|нет строки)`));
  mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== "STAB-DESK-02"))), /STAB-DESK-02.*Phase 18/);
  mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== "STAB-PROM-15"))), /STAB-PROM-15.*Phase 19/);
  mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== "STAB-BASE-02"))), /STAB-BASE-02.*Phase 15/);
});

test("verifyDocs: each gap and behavior_unverified item of 18/19-VERIFICATION, CR-01 and each BLOCKED gate of the protocol needs a row", () => {
  mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== "18-VERIF-GAP-1"))), /18-VERIF-GAP-1/);
  mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== "19-VERIF-GAP-1"))), /19-VERIF-GAP-1/);
  mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== "CR-01"))), /CR-01/);
  mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== "e2e-full"))), /BLOCKED-гейт e2e-full/);
  mentions(docsErrors({ files: { [V18]: verificationText(18, 1, 2) } }), /18-VERIF-BU-1/);
  mentions(docsErrors({ files: { [V19]: verificationText(19, 3) } }), /19-VERIF-GAP-3/);
});

test("verifyDocs: a register status outside the four allowed, or a row with PASS or Complete, is rejected; Phase 18/19 rows carry the reading mark", () => {
  mentions(docsErrors(withRows((rows) => rows.map((row) => (row[0] === "STAB-REL-05" ? [row[0], row[1], row[2], row[3], "Принято"] as RegRow : row)))), /STAB-REL-05.*статус/);
  mentions(docsErrors(withRows((rows) => rows.map((row) => (row[0] === "STAB-REL-05" ? [row[0], row[1], "всё PASS", row[3], row[4]] as RegRow : row)))), /STAB-REL-05.*PASS/);
  mentions(docsErrors(withRows((rows) => rows.map((row) => (row[0] === "CR-01" ? [row[0], row[1], row[2], row[3], "Complete"] as RegRow : row)))), /CR-01/);
  assert.deepEqual(docsErrors(withRows((rows) => rows.map((row) => (row[0] === "STAB-REL-05" ? [row[0], row[1], "не PASS, не Complete", row[3], row[4]] as RegRow : row)))), [], "a negated mention is allowed");
  mentions(docsErrors(withRows((rows) => rows.map((row) => (row[0] === "STAB-DESK-02" ? [row[0], row[1], row[2], "staging", row[4]] as RegRow : row)))), /STAB-DESK-02.*прочтение 20-CONTEXT\.md D-70 \(4\)/);
});

test("verifyDocs: production migrations and the deferred todo keep their owner statuses; an agent PASS or a wrong status is rejected", () => {
  for (const id of ["D-36(б) production", "D-47 production", "20261106000000"]) {
    mentions(docsErrors(withRows((rows) => rows.map((row) => (row[0] === id ? [row[0], row[1], row[2], row[3], DEBT_STATUS] as RegRow : row)))), new RegExp(`${id.replace(/[().]/g, "\\$&")}.*ОЖИДАЕТ ВЛАДЕЛЬЦА`));
    mentions(docsErrors(withRows((rows) => rows.filter((row) => row[0] !== id))), new RegExp(`${id.replace(/[().]/g, "\\$&")}`));
  }
  mentions(docsErrors(withRows((rows) => rows.map((row) => (row[0] === "D-47 production" ? [row[0], row[1], "PASS агента", row[3], row[4]] as RegRow : row)))), /D-47 production.*PASS/);
  mentions(docsErrors(withRows((rows) => rows.filter((row) => !row[0].startsWith("todo 2026-11-08-template-builder-framing-dialog")))), /template-builder-framing-dialog/);
});

test("verifyDocs: Phase 15, 18 and 19 traceability rows must not change against plan_base", () => {
  mentions(docsErrors({ files: { [REQ_MD]: requirementsText({ phase18: "Complete" }) } }), /STAB-DESK-02.*Phase 18.*plan_base/);
  mentions(docsErrors({ files: { [REQ_MD]: requirementsText().replace("| STAB-PROM-15 | Phase 19 | Pending |", "| STAB-PROM-15 | Phase 19 | Complete |") } }), /STAB-PROM-15.*plan_base/);
  mentions(docsErrors({ files: { [REQ_MD]: requirementsText().replace("| STAB-BASE-02 | Phase 15 | Pending |", "| STAB-BASE-02 | Phase 15 | Complete |") } }), /STAB-BASE-02.*plan_base/);
});

test("verifyDocs: release notes need status final, the FRC, the D-70 section with its first sentence, and no PASS device verdict line", () => {
  mentions(docsErrors({ files: { [NOTES_MD]: notesText({ status: "draft" }) } }), /status: final/);
  mentions(docsErrors({ files: { [NOTES_MD]: notesText({ commit: RC_COMMIT }) } }), /release_commit.*FRC/);
  mentions(docsErrors({ files: { [NOTES_MD]: notesText().replace("## Приёмка владельцем без UAT (D-70)", "## Приёмка") } }), /нет раздела «Приёмка владельцем без UAT \(D-70\)»/);
  mentions(docsErrors({ files: { [NOTES_MD]: notesText({ sentence: "Приёмка проведена." }) } }), /первое предложение/);
  mentions(docsErrors({ files: { [NOTES_MD]: notesText({ extra: "\n\nВердикт PC: PASS" }) } }), /вердикт устройства.*PASS/);
  mentions(docsErrors({ files: { [NOTES_MD]: null } }), /20-RELEASE-NOTES\.md/);
});

test("verifyDocs: «Итог релиза» stronger than releaseVerdict is rejected; the device and visual sections carry the verbatim sources", () => {
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-RECONCILIATION.md`]: reconciliationDocs({ release: "PASS" }) } }), /Итог релиза: PASS/);
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-RECONCILIATION.md`]: reconciliationDocs({ device: "Приёмка не проводилась." }) } }), /Приёмка на устройствах.*слова владельца/);
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-RECONCILIATION.md`]: reconciliationDocs({ device: `«${D70_WORDS}». ${D70_LEDGER_VERDICT}. Источник: 20-CONTEXT.md D-70.` }) } }), /PORTIA_REQUIRE_UAT=1/);
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-RECONCILIATION.md`]: reconciliationDocs({ visual: "принято" }) } }), /Визуальная приёмка \(D-68\)/);
});

test("verifyDocs: the STAB-VIS-03 / D-39 row needs 20-58-SUMMARY.md and 20-12, and both sources must exist", () => {
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-RECONCILIATION.md`]: reconciliationDocs({ vis03: null }) } }), /STAB-VIS-03 \/ D-39/);
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-RECONCILIATION.md`]: reconciliationDocs({ vis03: "| STAB-VIS-03 / D-39 | эталоны | x |" }) } }), /STAB-VIS-03 \/ D-39.*20-58-SUMMARY\.md/);
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-12-SUMMARY.md`]: null } }), /20-12-SUMMARY\.md/);
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-58-SUMMARY.md`]: null } }), /20-58-SUMMARY\.md/);
});

test("main --verify-docs: exit 0 for consistent documents, 1 with reasons otherwise; the usage line names the mode", () => {
  let out = "";
  let err = "";
  const io = { out: (text: string) => { out += text; }, err: (text: string) => { err += text; } };
  assert.equal(gate.main(["--verify-docs"], { ...docsRepo(), ...io }), 0, err);
  assert.match(out, /docs verified/);
  assert.equal(gate.main(["--verify-docs"], { ...docsRepo({ files: { [NOTES_MD]: notesText({ status: "draft" }) } }), ...io }), 1);
  assert.match(err, /PORTIA_RELEASE_GATE:verify-failed.*status: final/);
  err = "";
  gate.main(["--bogus"], { ...docsRepo(), ...io });
  assert.match(err, /--verify-docs/);
});

// --- 20-15 Task 3 (D-70, D-68, D-14, D-34): --verify-reconciliation and --verify-independent ----------------------------------------------

const PLAN_COUNT = 60;
const planNames = (count = PLAN_COUNT) => Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, "0"));
const planCommit = (nn: string) => nn.repeat(20);
const SUMMARY_MD = `${gate.PHASE_DIR}/20-RELEASE-SUMMARY.md`;
const VERIFICATION_MD = `${gate.PHASE_DIR}/20-RELEASE-VERIFICATION.md`;
const DEPLOYED_MD = `${gate.PHASE_DIR}/20-DEPLOYED-EVIDENCE.md`;
const SELF_ROW = `SUMMARY создаётся после гейта; проверяется --verify-independent; FRC ${FRC_COMMIT}`;

const planSummary = (nn: string, o: { status?: string; commit?: boolean } = {}) =>
  ["---", `plan: ${Number(nn)}`, `status: ${o.status ?? "complete"}`, ...(o.commit === false ? [] : [`plan_head_after: ${planCommit(nn)}`]), "---", "", "# Summary", "", o.commit === false ? "без хеша" : ""].join("\n");

const crosswalkText = (o: { skip?: string; row14?: string; release?: string; count?: number } = {}) => {
  const rows = planNames(o.count).filter((nn) => nn !== o.skip).map((nn) => {
    if (nn === "14") return `| 20-14 | 20-14-SUMMARY.md | ${planCommit(nn)} | ${o.row14 ?? D70_LEDGER_VERDICT} | FRC ${FRC_COMMIT} |`;
    if (nn === "15") return `| 20-15 | - | - | ${SELF_ROW} | FRC ${FRC_COMMIT} |`;
    return `| 20-${nn} | 20-${nn}-SUMMARY.md | ${planCommit(nn)} | выполнен | FRC ${FRC_COMMIT} |`;
  });
  return ["# 20-RELEASE-SUMMARY", "", "| План | SUMMARY | Commit | Результат | Связь с FRC |", "|---|---|---|---|---|", ...rows, "", `Итог релиза: ${o.release ?? "BLOCKED"}`, ""].join("\n");
};

const verificationDocText = (o: { status?: Record<string, string>; skip?: string; release?: string; device?: boolean } = {}) => {
  const ids = [...DEBT20, "STAB-SEC-06"].filter((id) => id !== o.skip);
  const rows = ids.map((id) => `| ${id} | ${o.status?.[id] ?? (id === "STAB-SEC-06" ? "PASS" : DEBT_STATUS)} | 20-RELEASE-EVIDENCE.md | ${FRC_COMMIT} |`);
  return ["# 20-RELEASE-VERIFICATION", "", "| ID | Статус | Источник | FRC |", "|---|---|---|---|", ...rows, "", ...(o.device === false ? [] : [`Приёмка на устройствах: ${D70_LEDGER_VERDICT}`]), `Итог релиза: ${o.release ?? "BLOCKED"}`, ""].join("\n");
};

const DEPLOYED_BLOCKED = "# 20-DEPLOYED-EVIDENCE\n\nСтатус: BLOCKED\n\nДоверенных метаданных Netlify deploy нет; опубликованный сайт не запрашивался (D-14).\n";
const DEPLOYED_OK = "# 20-DEPLOYED-EVIDENCE\n\nDeploy ID: 6543abcd\nCommit: 0123456789abcdef\nИсточник: Netlify deploy metadata\n";

function reconRepo(o: { files?: Record<string, string | null>; changes?: string[] | null; count?: number } = {}) {
  const dir = gate.PHASE_DIR;
  const count = o.count ?? PLAN_COUNT;
  const files: Record<string, string | null> = {
    [SUMMARY_MD]: crosswalkText({ count }),
    [VERIFICATION_MD]: verificationDocText(),
    [DEPLOYED_MD]: DEPLOYED_BLOCKED,
    [`${dir}/20-CLASS-MIGRATION-EVIDENCE.md`]: "# class\n",
    [`${dir}/20-EDITOR-NOTES-EVIDENCE.md`]: "# notes\n",
  };
  for (const nn of planNames(count)) {
    files[`${dir}/20-${nn}-PLAN.md`] = "# plan\n";
    if (nn !== "15") files[`${dir}/20-${nn}-SUMMARY.md`] = planSummary(nn);
  }
  files[`${dir}/20-58-SUMMARY.md`] = OWNER_SUMMARY();
  files[`${dir}/20-12-SUMMARY.md`] = planSummary("12");
  const repo = docsRepo({ files: { ...files, ...(o.files ?? {}) } });
  const git = (args: string[]) => {
    if (args[0] === "diff" && args[1] === "--name-only" && args[3] === "HEAD") return o.changes === null ? { status: 128, stdout: "", stderr: "fatal" } : { status: 0, stdout: (o.changes ?? [".planning/STATE.md"]).join("\n"), stderr: "" };
    return repo.git(args);
  };
  return { ...repo, git };
}
const reconErrors = (o: Parameters<typeof reconRepo>[0] = {}) => gate.verifyReconciliation(reconRepo(o));

test("verifyReconciliation: consistent summaries, crosswalk, release verification, deployed evidence and post-FRC files have no errors", () => {
  assert.deepEqual(reconErrors(), []);
});

test("verifyReconciliation: a missing SUMMARY of any plan but 20-15 is rejected, including a gap plan such as 20-58", () => {
  for (const nn of ["01", "33", "58", "60"]) mentions(reconErrors({ files: { [`${gate.PHASE_DIR}/20-${nn}-SUMMARY.md`]: null } }), new RegExp(`20-${nn}-SUMMARY\\.md`));
  assert.deepEqual(reconErrors({ files: { [`${gate.PHASE_DIR}/20-15-SUMMARY.md`]: null } }), [], "20-15-SUMMARY.md is created after the gate");
});

test("verifyReconciliation: a SUMMARY without a commit or with a status that is not complete is rejected", () => {
  mentions(reconErrors({ files: { [`${gate.PHASE_DIR}/20-22-SUMMARY.md`]: planSummary("22", { commit: false }) } }), /20-22-SUMMARY\.md.*commit/);
  mentions(reconErrors({ files: { [`${gate.PHASE_DIR}/20-23-SUMMARY.md`]: planSummary("23", { status: "in-progress" }) } }), /20-23-SUMMARY\.md.*status/);
});

test("verifyReconciliation: the number of plans is read from the files; fewer than 58 is an error; new plans beyond are covered", () => {
  mentions(reconErrors({ count: 10 }), /меньше 58 файлов 20-NN-PLAN\.md/);
  mentions(reconErrors({ files: { [`${gate.PHASE_DIR}/20-61-PLAN.md`]: "# plan\n" } }), /20-61-SUMMARY\.md/);
});

test("verifyReconciliation: every plan needs a crosswalk row; 20-14 is «ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)»; 20-15 carries the after-the-gate note", () => {
  mentions(reconErrors({ files: { [SUMMARY_MD]: crosswalkText({ skip: "37" }) } }), /20-37.*crosswalk/);
  mentions(reconErrors({ files: { [SUMMARY_MD]: crosswalkText({ skip: "15" }) } }), /20-15.*crosswalk/);
  mentions(reconErrors({ files: { [SUMMARY_MD]: crosswalkText({ row14: "PASS" }) } }), /20-14.*ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT \(D-70\)/);
  mentions(reconErrors({ files: { [SUMMARY_MD]: crosswalkText().replace(SELF_ROW, "готово") } }), /20-15.*SUMMARY создаётся после гейта/);
  mentions(reconErrors({ files: { [SUMMARY_MD]: null } }), /20-RELEASE-SUMMARY\.md/);
});

test("verifyReconciliation: release verification needs a row per Phase 20 ID; PASS for a register debt, or a status that contradicts REQUIREMENTS.md, is rejected", () => {
  mentions(reconErrors({ files: { [VERIFICATION_MD]: verificationDocText({ skip: "STAB-REL-05" }) } }), /STAB-REL-05.*20-RELEASE-VERIFICATION/);
  mentions(reconErrors({ files: { [VERIFICATION_MD]: verificationDocText({ status: { "STAB-REL-05": "PASS" } }) } }), /STAB-REL-05.*PASS у принятого долга/);
  mentions(reconErrors({ files: { [VERIFICATION_MD]: verificationDocText({ status: { "STAB-SEC-06": DEBT_STATUS } }) } }), /STAB-SEC-06.*REQUIREMENTS\.md/);
  mentions(reconErrors({ files: { [VERIFICATION_MD]: verificationDocText({ device: false }) } }), /Приёмка на устройствах/);
  mentions(reconErrors({ files: { [VERIFICATION_MD]: null } }), /20-RELEASE-VERIFICATION\.md/);
});

test("verifyReconciliation: «Итог релиза» must be the same in the reconciliation, the crosswalk and the verification, and is never PASS", () => {
  mentions(reconErrors({ files: { [SUMMARY_MD]: crosswalkText({ release: "PASS-WITH-OWNER-WAIVERS" }) } }), /Итог релиза.*20-RELEASE-SUMMARY\.md/);
  mentions(reconErrors({ files: { [VERIFICATION_MD]: verificationDocText({ release: "FAIL" }) } }), /Итог релиза.*20-RELEASE-VERIFICATION\.md/);
  mentions(reconErrors({ files: { [SUMMARY_MD]: crosswalkText({ release: "PASS" }), [VERIFICATION_MD]: verificationDocText({ release: "PASS" }) } }), /Итог релиза: PASS/);
  mentions(reconErrors({ files: { [SUMMARY_MD]: crosswalkText().replace(/Итог релиза: .*/, "") } }), /Итог релиза.*20-RELEASE-SUMMARY\.md/);
});

test("verifyReconciliation: deployed evidence is trusted metadata or an explicit BLOCKED; an unconfirmed deploy or BLOCKED named PASS is rejected", () => {
  assert.deepEqual(reconErrors({ files: { [DEPLOYED_MD]: DEPLOYED_OK } }), []);
  mentions(reconErrors({ files: { [DEPLOYED_MD]: null } }), /20-DEPLOYED-EVIDENCE\.md/);
  mentions(reconErrors({ files: { [DEPLOYED_MD]: "# deploy\n\nDeploy ID: 6543abcd\n" } }), /неподтверждённый deploy/);
  mentions(reconErrors({ files: { [DEPLOYED_MD]: "# deploy\n\nвсё хорошо\n" } }), /неподтверждённый deploy/);
  mentions(reconErrors({ files: { [DEPLOYED_MD]: `${DEPLOYED_BLOCKED}\nСтатус: PASS\n` } }), /BLOCKED.*PASS/);
});

test("verifyReconciliation: after the FRC only .planning, the runner and its test may change; a git error is an error", () => {
  assert.deepEqual(reconErrors({ changes: [".planning/ROADMAP.md", "scripts/phase20-release-gate.mjs", "lib/phase20-release-gate.test.ts"] }), []);
  mentions(reconErrors({ changes: [".planning/STATE.md", "components/portia-desktop.tsx"] }), /после FRC.*components\/portia-desktop\.tsx/);
  mentions(reconErrors({ changes: ["lib/portia-content.ts"] }), /после FRC.*lib\/portia-content\.ts/);
  mentions(reconErrors({ changes: ["package-lock.json"] }), /после FRC.*package-lock\.json/);
  mentions(reconErrors({ changes: null }), /git diff FRC\.\.HEAD не выполнен/);
});

test("verifyReconciliation: the sources 20-UAT.md, 20-CLASS-MIGRATION-EVIDENCE.md and 20-EDITOR-NOTES-EVIDENCE.md must exist; the owner verdict must stay accepted", () => {
  mentions(reconErrors({ files: { [`${gate.PHASE_DIR}/20-CLASS-MIGRATION-EVIDENCE.md`]: null } }), /20-CLASS-MIGRATION-EVIDENCE\.md/);
  mentions(reconErrors({ files: { [`${gate.PHASE_DIR}/20-EDITOR-NOTES-EVIDENCE.md`]: null } }), /20-EDITOR-NOTES-EVIDENCE\.md/);
  mentions(reconErrors({ files: { [`${gate.PHASE_DIR}/20-UAT.md`]: null } }), /20-UAT\.md/);
  mentions(reconErrors({ files: { [`${gate.PHASE_DIR}/20-58-SUMMARY.md`]: OWNER_SUMMARY("fixes-requested") } }), /fixes-requested/);
});

const summary15 = (o: { frc?: string; verdict?: string; closure?: string; completed?: string } = {}) =>
  ["---", "plan: 15", "status: complete", `final_release_commit: ${o.frc ?? FRC_COMMIT}`, `release_verdict: ${o.verdict ?? "BLOCKED"}`, `phase_closure: ${o.closure ?? "С ПРИНЯТЫМИ ДОЛГАМИ (D-70)"}`, `requirements-completed: [${o.completed ?? "STAB-SEC-06"}]`, "---", "", "# Summary", ""].join("\n");
const independentFiles = (extra: Record<string, string | null> = {}) => ({ [`${gate.PHASE_DIR}/20-15-SUMMARY.md`]: summary15(), [`${gate.PHASE_DIR}/20-VERIFICATION.md`]: "---\nstatus: passed\n---\n", ...extra });
const independentErrors = (extra: Record<string, string | null> = {}) => gate.verifyIndependent(reconRepo({ files: independentFiles(extra) }));

test("verifyIndependent: with 20-15-SUMMARY.md, 20-VERIFICATION.md and all plan summaries it passes; the FRC and verdict agree with the row of 20-15 and the reconciliation", () => {
  assert.deepEqual(independentErrors(), []);
});

test("verifyIndependent: a missing 20-15-SUMMARY.md, 20-VERIFICATION.md or any plan SUMMARY is rejected", () => {
  mentions(independentErrors({ [`${gate.PHASE_DIR}/20-15-SUMMARY.md`]: null }), /20-15-SUMMARY\.md/);
  mentions(independentErrors({ [`${gate.PHASE_DIR}/20-VERIFICATION.md`]: null }), /20-VERIFICATION\.md/);
  mentions(independentErrors({ [`${gate.PHASE_DIR}/20-44-SUMMARY.md`]: null }), /20-44-SUMMARY\.md/);
});

test("verifyIndependent: final_release_commit, release_verdict or phase_closure of 20-15-SUMMARY.md that differ from the row and the reconciliation are rejected", () => {
  mentions(independentErrors({ [`${gate.PHASE_DIR}/20-15-SUMMARY.md`]: summary15({ frc: RC_COMMIT }) }), /final_release_commit/);
  mentions(independentErrors({ [`${gate.PHASE_DIR}/20-15-SUMMARY.md`]: summary15({ verdict: "PASS-WITH-OWNER-WAIVERS" }) }), /release_verdict/);
  mentions(independentErrors({ [`${gate.PHASE_DIR}/20-15-SUMMARY.md`]: summary15({ closure: "ЗАБЛОКИРОВАНО: x" }) }), /phase_closure/);
  mentions(independentErrors({ [SUMMARY_MD]: crosswalkText().replace(`${SELF_ROW} | FRC ${FRC_COMMIT} |`, `${SELF_ROW} | FRC ${RC_COMMIT} |`) }), /20-15.*FRC/);
});

test("verifyIndependent: requirements-completed of 20-15-SUMMARY.md must not hold a register debt", () => {
  mentions(independentErrors({ [`${gate.PHASE_DIR}/20-15-SUMMARY.md`]: summary15({ completed: "STAB-SEC-06, STAB-REL-07" }) }), /requirements-completed.*STAB-REL-07/);
  mentions(independentErrors({ [`${gate.PHASE_DIR}/20-15-SUMMARY.md`]: summary15({ completed: "STAB-A11Y-04" }) }), /requirements-completed.*STAB-A11Y-04/);
});

test("main --verify-reconciliation and --verify-independent: exit codes and usage line", () => {
  let out = "";
  let err = "";
  const io = { out: (text: string) => { out += text; }, err: (text: string) => { err += text; } };
  assert.equal(gate.main(["--verify-reconciliation"], { ...reconRepo(), ...io }), 0, err);
  assert.match(out, /reconciliation verified/);
  assert.equal(gate.main(["--verify-reconciliation"], { ...reconRepo({ changes: ["app/page.tsx"] }), ...io }), 1);
  assert.match(err, /PORTIA_RELEASE_GATE:verify-failed.*после FRC/);
  out = "";
  assert.equal(gate.main(["--verify-independent"], { ...reconRepo({ files: independentFiles() }), ...io }), 0, err);
  assert.match(out, /independent verification passed/);
  assert.equal(gate.main(["--verify-independent"], { ...reconRepo(), ...io }), 1);
  err = "";
  gate.main(["--bogus"], { ...reconRepo(), ...io });
  assert.match(err, /--verify-reconciliation \| --verify-independent/);
});

test("verifyDocs: the owner quote is read from the «Вердикт владельца» section, not from the change list shown to the owner", () => {
  const withList = `${OWNER_SUMMARY().replace("## Вердикт владельца (D-68)", "## Список изменений, показанный владельцу (D-68)\n\n> Код сайта тот же.\n\n## Вердикт владельца (D-68)")}`;
  assert.deepEqual(docsErrors({ files: { [`${gate.PHASE_DIR}/20-58-SUMMARY.md`]: withList } }), []);
  const quotedList = reconciliationDocs({ visual: `owner_verdict_commit: ${OWNER_COMMIT}; источник: 20-58-SUMMARY.md; «Код сайта тот же.»` });
  mentions(docsErrors({ files: { [`${gate.PHASE_DIR}/20-58-SUMMARY.md`]: withList, [`${gate.PHASE_DIR}/20-RECONCILIATION.md`]: quotedList } }), /дословной цитаты владельца/);
});
