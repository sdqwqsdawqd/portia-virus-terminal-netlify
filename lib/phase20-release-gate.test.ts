import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
