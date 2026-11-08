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

test("classifyPlaywright (D-68): a skip by project condition is accepted only when the same test passed on another project", () => {
  const report = pwReport([
    { title: "two columns", tests: [pwTest("expected", { projectName: "chromium-desktop" }), pwTest("skipped", { projectName: "chromium-phone", annotations: [{ type: "skip", description: "The two-column PC layout" }] })] },
  ]);
  assert.equal(gate.classifyPlaywright(report).status, "SKIPPED", "by default every skip is SKIPPED");
  const lenient = gate.classifyPlaywright(report, [], { projectSkips: true });
  assert.equal(lenient.status, "PASS");
  assert.equal(lenient.projectSkipped, 1);
  assert.equal(lenient.counts.skipped, 1, "the skip is still counted");
  const onlySkipped = gate.classifyPlaywright(
    pwReport([
      { title: "never ran", tests: [pwTest("skipped", { annotations: [{ type: "skip", description: "x" }] })] },
      { title: "other", tests: [pwTest("expected")] },
    ]),
    [],
    { projectSkips: true },
  );
  assert.equal(onlySkipped.status, "SKIPPED", "a test skipped everywhere is not covered");
  const blocked = gate.classifyPlaywright(
    pwReport([{ title: "data", tests: [pwTest("expected", { projectName: "chromium-desktop" }), pwTest("skipped", { projectName: "chromium-phone", annotations: [{ type: "skip", description: "BLOCKED (DATA): none" }] })] }]),
    [],
    { projectSkips: true },
  );
  assert.equal(blocked.status, "BLOCKED", "a BLOCKED skip is never excused as a project condition");
});

test("runGate offline (D-68): ui-contract-offline accepts project-condition skips, visual-approved does not", () => {
  const report = pwReport([
    { title: "two columns", tests: [pwTest("expected", { projectName: "chromium-desktop" }), pwTest("skipped", { projectName: "chromium-phone", annotations: [{ type: "skip", description: "PC layout" }] })] },
  ]);
  const ui = offlineLane({}, report);
  const uiOutcome = ui.run("ui-contract-offline");
  assert.equal(uiOutcome.status, "PASS");
  assert.match(uiOutcome.reason, /project condition/);
  ui.cleanup();
  const visual = offlineLane({}, report);
  assert.equal(visual.run("visual-approved").status, "SKIPPED");
  visual.cleanup();
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
