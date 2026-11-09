import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import {
  parseAuthorityMetadata,
  parseUiMapRows,
  validateApprovalCoverage,
  validateAuthorityMetadata,
  validateCandidateRows,
  validateUiMapRows,
  assertCandidateIndexMatches,
  validatePhase20Register,
} from "../scripts/phase15-visual-manifest.mjs";

// The register records the Phase 20 owner verdict by its pre-archive path: its signed identity, compared verbatim by the script.
const phase20VerdictSource = ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-58-SUMMARY.md";
const base = {
  id: "editor-role-clean",
  project: "chromium-desktop",
  state: "clean",
};

const captured = () => ({
  ...base,
  status: "CAPTURED",
  candidateFile: "tests/e2e/visual-candidates/.runs/set/editor.png",
  sha256: "a".repeat(64),
});

const blocked = () => ({
  ...base,
  status: "BLOCKED",
  reasonCode: "ISOLATED_AUTH_REQUIRED",
  recoveryPhase: 16,
  reason: "Isolated authority is required.",
});

const inventory = (status: "CAPTURED" | "BLOCKED") => [{
  project: base.project,
  id: base.id,
  status,
}];

describe("Phase 15 visual manifest integrity", () => {
  test("accepts complete captured and blocked rows", () => {
    assert.doesNotThrow(() => validateCandidateRows([captured()], inventory("CAPTURED")));
    assert.doesNotThrow(() => validateCandidateRows([blocked()], inventory("BLOCKED")));
  });

  test("rejects a missing stable row", () => {
    assert.throws(
      () => validateCandidateRows([], inventory("BLOCKED")),
      /PORTIA_CANDIDATE_ROW_MISSING/,
    );
  });

  test("rejects duplicate stable identities", () => {
    assert.throws(
      () => validateCandidateRows([blocked(), blocked()]),
      /PORTIA_CANDIDATE_ROW_DUPLICATE/,
    );
  });

  test("rejects hash-bearing blocked rows", () => {
    assert.throws(
      () => validateCandidateRows([{ ...blocked(), sha256: "a".repeat(64) }]),
      /PORTIA_BLOCKED_HAS_EVIDENCE/,
    );
  });

  test("rejects reasonless blocked rows", () => {
    const row = { ...blocked(), reason: "" };
    assert.throws(() => validateCandidateRows([row]), /PORTIA_BLOCKED_REASON_MISSING/);
  });

  test("rejects invalid reason and recovery combinations", () => {
    assert.throws(
      () => validateCandidateRows([{ ...blocked(), reasonCode: "UNKNOWN" }]),
      /PORTIA_BLOCKED_REASON_CODE_INVALID/,
    );
    assert.throws(
      () => validateCandidateRows([{ ...blocked(), recoveryPhase: 19 }]),
      /PORTIA_BLOCKED_RECOVERY_INVALID/,
    );
  });

  test("rejects status conversion and unexpected rows", () => {
    assert.throws(
      () => validateCandidateRows([captured()], inventory("BLOCKED")),
      /PORTIA_CANDIDATE_STATUS_CHANGED/,
    );
    assert.throws(
      () => validateCandidateRows([blocked()], []),
      /PORTIA_CANDIDATE_ROW_UNEXPECTED/,
    );
  });
});

const authority = (overrides: Partial<Record<"candidateSet" | "sourceCommit" | "localContractDigest", string>> = {}) => [
  `- Candidate set: \`${overrides.candidateSet ?? "phase15-current-abc123"}\``,
  `- Source commit: \`${overrides.sourceCommit ?? "a".repeat(40)}\``,
  `- Local contract SHA-256: \`${overrides.localContractDigest ?? "b".repeat(64)}\``,
].join("\n");

describe("Phase 15 signed authority metadata", () => {
  test("accepts one identical authority tuple", () => {
    assert.deepEqual(validateAuthorityMetadata({
      approval: authority(),
      contract: authority(),
      frameMap: authority(),
    }), {
      artifact: "approval",
      candidateSet: "phase15-current-abc123",
      sourceCommit: "a".repeat(40),
      localContractDigest: "b".repeat(64),
    });
  });

  test("rejects missing and duplicate metadata", () => {
    assert.throws(
      () => parseAuthorityMetadata(authority().replace(/^.*Source commit.*$/m, ""), "APPROVAL"),
      /PORTIA_APPROVAL_SOURCE_COMMIT_MISSING/,
    );
    assert.throws(
      () => parseAuthorityMetadata(`${authority()}\n- Candidate set: \`duplicate\``, "APPROVAL"),
      /PORTIA_APPROVAL_CANDIDATE_SET_DUPLICATE/,
    );
  });

  test("rejects each cross-artifact mismatch", () => {
    assert.throws(() => validateAuthorityMetadata({
      approval: authority(), contract: authority({ candidateSet: "other" }), frameMap: authority(),
    }), /PORTIA_AUTHORITY_CANDIDATE_SET_MISMATCH/);
    assert.throws(() => validateAuthorityMetadata({
      approval: authority(), contract: authority({ sourceCommit: "b".repeat(40) }), frameMap: authority(),
    }), /PORTIA_AUTHORITY_SOURCE_COMMIT_MISMATCH/);
    assert.throws(() => validateAuthorityMetadata({
      approval: authority(), contract: authority({ localContractDigest: "c".repeat(64) }), frameMap: authority(),
    }), /PORTIA_AUTHORITY_LOCAL_CONTRACT_DIGEST_MISMATCH/);
  });
});

describe("Phase 15 CLI authority binding (disposable fixtures)", () => {
  const script = path.resolve("scripts/phase15-visual-manifest.mjs");
  const evidenceDir = ".planning/milestones/v1.3-phases/PORTIA-15-baseline/evidence";
  const files = ["15-VISUAL-APPROVAL.md", "15-LOCAL-UI-CONTRACT.md", "15-FRAME-TEST-MAP.md", "15-STABLE-ROW-INVENTORY.json", "15-CANDIDATE-INDEX.json"];

  function fixture(mutate: (name: string, text: string) => string = (_, text) => text, omit: string[] = []) {
    const dir = mkdtempSync(path.join(tmpdir(), "portia-authority-"));
    const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
    git("init", "-q");
    git("commit", "-q", "--allow-empty", "-m", "fixture");
    mkdirSync(path.join(dir, evidenceDir), { recursive: true });
    for (const name of files.filter((file) => !omit.includes(file))) {
      const text = readFileSync(path.resolve(evidenceDir, name), "utf8");
      writeFileSync(path.join(dir, evidenceDir, name), mutate(name, text));
    }
    return dir;
  }

  function run(dir: string, flag: string) {
    const result = spawnSync(process.execPath, [script, flag], { cwd: dir, encoding: "utf8" });
    rmSync(dir, { recursive: true, force: true });
    return `${result.status}:${result.stderr}${result.stdout}`;
  }

  const real = "phase15-current-efbc1401080d";
  const cases: Array<[string, string, (text: string) => string, RegExp]> = [
    ["approval candidate set", "15-VISUAL-APPROVAL.md", (t) => t.replace(real, "phase15-current-000000000000"), /PORTIA_AUTHORITY_CANDIDATE_SET_MISMATCH/],
    ["frame-map source commit", "15-FRAME-TEST-MAP.md", (t) => t.replace(/Source commit:\*{0,2}\s*`[a-f0-9]{40}`/, "Source commit:** `" + "0".repeat(40) + "`"), /PORTIA_AUTHORITY_SOURCE_COMMIT_MISMATCH/],
    ["approval digest", "15-VISUAL-APPROVAL.md", (t) => t.replace(/(Local contract SHA-256:\*{0,2}\s*`)[a-f0-9]{64}/, "$1" + "0".repeat(64)), /PORTIA_AUTHORITY_LOCAL_CONTRACT_DIGEST_MISMATCH/],
    ["contract bytes", "15-LOCAL-UI-CONTRACT.md", (t) => `${t}\nextra byte drift\n`, /PORTIA_AUTHORITY_LOCAL_CONTRACT_DIGEST_MISMATCH/],
    ["approval missing digest", "15-VISUAL-APPROVAL.md", (t) => t.replace(/^.*Local contract SHA-256.*$/m, ""), /PORTIA_APPROVAL_LOCAL_CONTRACT_DIGEST_MISSING/],
    ["frame-map duplicate set", "15-FRAME-TEST-MAP.md", (t) => `${t}\n- Candidate set: \`${real}\`\n`, /PORTIA_FRAME_MAP_CANDIDATE_SET_DUPLICATE/],
    ["inventory set", "15-STABLE-ROW-INVENTORY.json", (t) => t.replace(real, "phase15-current-000000000000"), /PORTIA_AUTHORITY_CANDIDATE_SET_MISMATCH/],
  ];

  for (const [name, file, mutate, expected] of cases) {
    test(`--verify-promotion rejects ${name}`, () => {
      const out = run(fixture((n, t) => (n === file ? mutate(t) : t)), "--verify-promotion");
      assert.match(out, expected);
      assert.match(out, /^1:/);
    });
  }

  test("--verify-ui-map passes from the tracked index when no raw capture exists", () => {
    const out = run(fixture(), "--verify-ui-map");
    assert.match(out, /^0:/);
    assert.match(out, /Verified repository UI map for 84 rows \(51 captured, 33 blocked\)/);
    assert.match(out, /Source: tracked index/);
  });

  const indexFile = "15-CANDIDATE-INDEX.json";
  const tamperIndex = (change: (index: { rows: Array<Record<string, unknown>> }) => void) => (name: string, text: string) => {
    if (name !== indexFile) return text;
    const index = JSON.parse(text);
    change(index);
    return JSON.stringify(index);
  };
  const indexCases: Array<[string, (name: string, text: string) => string, string, RegExp]> = [
    ["a changed row hash", tamperIndex((i) => { i.rows.find((r) => r.status === "CAPTURED")!.sha256 = "0".repeat(64); }), "--verify-ui-map", /PORTIA_UI_MAP_HASH_MISMATCH/],
    ["a changed row hash (approval)", tamperIndex((i) => { i.rows.find((r) => r.status === "CAPTURED")!.sha256 = "0".repeat(64); }), "--verify-approval", /PORTIA_APPROVAL_VERDICT_MISSING/],
    ["a replaced candidate set", (n, t) => (n === indexFile ? t.replaceAll(real, "phase15-current-000000000000") : t), "--verify-ui-map", /PORTIA_CANDIDATE_INDEX_INVALID/],
    ["a replaced source commit", (n, t) => (n === indexFile ? t.replaceAll("efbc1401080d6b65ba1f4916ad0343b783c62bb8", "0".repeat(40)) : t), "--verify-ui-map", /PORTIA_CANDIDATE_SET_SOURCE_MISMATCH/],
    ["a removed row", tamperIndex((i) => { i.rows.pop(); }), "--verify-ui-map", /PORTIA_CANDIDATE_ROW_MISSING/],
    ["drifted contract bytes", (n, t) => (n === "15-LOCAL-UI-CONTRACT.md" ? `${t}
extra byte drift
` : t), "--verify-ui-map", /PORTIA_AUTHORITY_LOCAL_CONTRACT_DIGEST_MISMATCH/],
    ["drifted contract bytes (approval)", (n, t) => (n === "15-LOCAL-UI-CONTRACT.md" ? `${t}
extra byte drift
` : t), "--verify-approval", /PORTIA_AUTHORITY_LOCAL_CONTRACT_DIGEST_MISMATCH/],
  ];
  for (const [name, mutate, flag, expected] of indexCases) {
    test(`${flag} rejects index with ${name}`, () => {
      const out = run(fixture(mutate), flag);
      assert.match(out, expected);
      assert.match(out, /^1:/);
    });
  }

  test("--verify-approval passes from the tracked index when no raw capture exists", () => {
    const out = run(fixture(), "--verify-approval");
    assert.match(out, /^0:/);
    assert.match(out, /Verified owner verdict coverage for 51 captured rows; 33 blocked rows excluded./);
    assert.match(out, /Source: tracked index/);
  });

  for (const flag of ["--verify-ui-map", "--verify-approval"]) {
    test(`${flag} fails closed with neither raw capture nor index`, () => {
      const out = run(fixture(undefined, [indexFile]), flag);
      assert.match(out, /PORTIA_CANDIDATE_SET_MISSING/);
      assert.match(out, /^1:/);
    });
  }

  test("untouched fixture passes authority and fails only later on missing snapshots", () => {
    const out = run(fixture(), "--verify-promotion");
    assert.doesNotMatch(out, /PORTIA_(AUTHORITY|APPROVAL_(CANDIDATE|SOURCE|LOCAL)|CONTRACT|FRAME_MAP)/);
    assert.match(out, /PORTIA_APPROVED_SNAPSHOT_MISSING/);
  });
});

describe("Phase 15 candidate index drift guard", () => {
  const row = (id: string) => ({ ...captured(), id, viewport: { width: 1280, height: 800 } });

  test("accepts the same rows in a different order", () => {
    assert.doesNotThrow(() => assertCandidateIndexMatches([row("a"), row("b")], [row("b"), row("a")]));
  });

  test("rejects a changed field, a missing row and an extra row", () => {
    const changed = { ...row("a"), viewport: { width: 1, height: 800 } };
    assert.throws(() => assertCandidateIndexMatches([changed], [row("a")]), /PORTIA_CANDIDATE_INDEX_DRIFT/);
    assert.throws(() => assertCandidateIndexMatches([row("a")], [row("a"), row("b")]), /PORTIA_CANDIDATE_INDEX_DRIFT/);
    assert.throws(() => assertCandidateIndexMatches([row("a"), row("b")], [row("a")]), /PORTIA_CANDIDATE_INDEX_DRIFT/);
  });
});

describe("Phase 15 repository UI map", () => {
  const mappedCaptured = () => ({
    project: base.project,
    id: base.id,
    status: "CAPTURED",
    section: "04 Editor CURRENT",
    sha256: "a".repeat(64),
    candidateFile: "tests/e2e/visual-candidates/.runs/set/editor.png",
    intendedSnapshot: "tests/e2e/visual/__screenshots__/editor.png",
  });
  const mappedBlocked = () => ({
    project: base.project,
    id: base.id,
    status: "BLOCKED",
    section: "04 Editor CURRENT",
    reasonCode: "ISOLATED_AUTH_REQUIRED",
    recoveryPhase: 16,
    intendedSnapshot: "tests/e2e/visual/__screenshots__/editor.png",
  });
  const capturedCandidate = () => ({ ...captured(), intendedSnapshot: "tests/e2e/visual/__screenshots__/editor.png" });
  const blockedCandidate = () => ({ ...blocked(), intendedSnapshot: "tests/e2e/visual/__screenshots__/editor.png" });

  test("parses JSONL and accepts exact captured and blocked mappings", () => {
    const text = `<!-- UI-MAP:START -->\n\`\`\`jsonl\n${JSON.stringify(mappedCaptured())}\n\`\`\`\n<!-- UI-MAP:END -->`;
    assert.deepEqual(parseUiMapRows(text), [mappedCaptured()]);
    assert.doesNotThrow(() => validateUiMapRows([capturedCandidate()], [mappedCaptured()]));
    assert.doesNotThrow(() => validateUiMapRows([blockedCandidate()], [mappedBlocked()]));
  });

  test("rejects missing, duplicate, mismatched and PROPOSED mappings", () => {
    assert.throws(() => validateUiMapRows([capturedCandidate()], []), /PORTIA_UI_MAP_ROW_MISSING/);
    assert.throws(() => validateUiMapRows([capturedCandidate()], [mappedCaptured(), mappedCaptured()]), /PORTIA_UI_MAP_ROW_DUPLICATE/);
    assert.throws(() => validateUiMapRows([capturedCandidate()], [{ ...mappedCaptured(), sha256: "c".repeat(64) }]), /PORTIA_UI_MAP_HASH_MISMATCH/);
    assert.throws(() => validateUiMapRows([capturedCandidate()], [{ ...mappedCaptured(), section: "07 PROPOSED" }]), /PORTIA_UI_MAP_CURRENT_SECTION_INVALID/);
  });
});

describe("Phase 15 approval coverage", () => {
  const verdict = (overrides = {}) => ({
    verdict: "APPROVED",
    hash: "a".repeat(64),
    intendedSnapshot: "tests/e2e/visual/__screenshots__/editor.png",
    reason: "—",
    ...overrides,
  });
  const approvalCandidate = () => ({
    ...captured(),
    intendedSnapshot: "tests/e2e/visual/__screenshots__/editor.png",
  });

  test("accepts one verdict per captured hash and excludes blocked rows", () => {
    assert.doesNotThrow(() => validateApprovalCoverage([approvalCandidate(), blocked()], [verdict()]));
  });

  test("rejects missing, duplicate and blocked verdicts", () => {
    assert.throws(() => validateApprovalCoverage([approvalCandidate()], []), /PORTIA_APPROVAL_VERDICT_MISSING/);
    assert.throws(() => validateApprovalCoverage([approvalCandidate()], [verdict(), verdict()]), /PORTIA_APPROVAL_VERDICT_DUPLICATE/);
    assert.throws(() => validateApprovalCoverage([
      approvalCandidate(),
      { ...blocked(), intendedSnapshot: "tests/e2e/visual/__screenshots__/blocked.png" },
    ], [verdict(), verdict({ hash: "b".repeat(64), intendedSnapshot: "tests/e2e/visual/__screenshots__/blocked.png" })]), /PORTIA_BLOCKED_VERDICT_REFUSED/);
  });

  test("requires a concrete rejection reason and rejects unknown verdicts", () => {
    assert.throws(() => validateApprovalCoverage([approvalCandidate()], [verdict({ verdict: "REJECTED" })]), /PORTIA_REJECTION_REASON_MISSING/);
    assert.throws(() => validateApprovalCoverage([approvalCandidate()], [
      verdict(),
      verdict({ hash: "b".repeat(64), intendedSnapshot: "tests/e2e/visual/__screenshots__/unknown.png" }),
    ]), /PORTIA_APPROVAL_VERDICT_UNKNOWN/);
  });

  test("allows exact historical verdicts through an explicit predicate", () => {
    const historical = verdict({ hash: "b".repeat(64), intendedSnapshot: "tests/e2e/visual/__screenshots__/old.png" });
    assert.doesNotThrow(() => validateApprovalCoverage(
      [approvalCandidate()],
      [verdict(), historical],
      (row) => row === historical,
    ));
  });
});

describe("Phase 20 baseline register (D-68)", () => {
  const dir = "tests/e2e/visual/__screenshots__";
  const verdictCommit = "c".repeat(40);
  const approvedHash = "a".repeat(64);
  const approvedRows = [
    { verdict: "APPROVED", hash: approvedHash, intendedSnapshot: `${dir}/desktop-clean--chromium-desktop.png`, reason: "—" },
  ];
  const summary = (verdict = "accepted", commit = verdictCommit) =>
    `---\nplan: 58\nowner_verdict: ${verdict}\nowner_verdict_date: 2026-11-08\nowner_verdict_commit: ${commit}\n---\n# 20-58\n`;
  const newRow = (overrides = {}) => ({
    snapshot: `${dir}/phase20-spider--chromium-desktop.png`,
    sha256: "b".repeat(64),
    supersedes: null,
    class: "phase20",
    surface: "spider at rest",
    decisions: ["D-45"],
    reason: "baseline on the accepted code",
    ...overrides,
  });
  const replacedRow = (overrides = {}) => newRow({
    snapshot: `${dir}/desktop-clean--chromium-desktop.png`,
    sha256: "d".repeat(64),
    supersedes: approvedHash,
    class: "accepted-redesign",
    ...overrides,
  });
  const register = (rows: unknown[] = [newRow(), replacedRow()], overrides = {}) => ({
    schema: "portia-phase20-baselines-v1",
    decision: "D-68",
    ownerVerdict: { source: phase20VerdictSource, commit: verdictCommit },
    captureCommit: "e".repeat(40),
    data: "offline stub",
    rows,
    ...overrides,
  });
  type Row = { snapshot: string; sha256: string };
  const hashesFor = (rows: Row[]) => new Map(rows.map((row) => [row.snapshot, row.sha256]));
  const check = (parts: { register?: unknown; summaryText?: string; fileHashes?: Map<string, string> } = {}) => {
    const reg = (parts.register ?? register()) as { rows?: Row[] };
    return validatePhase20Register({
      approvedRows,
      register: reg,
      summaryText: parts.summaryText ?? summary(),
      fileHashes: parts.fileHashes ?? hashesFor(Array.isArray(reg.rows) ? reg.rows : []),
    }).map((entry: { code: string }) => entry.code);
  };

  test("accepts a new Phase 20 snapshot and an exactly superseded Phase 15 snapshot", () => {
    assert.deepEqual(check(), []);
  });

  test("a verdict that is not accepted, missing or for another commit gives PORTIA_PHASE20_OWNER_VERDICT_MISSING", () => {
    for (const text of [summary("fixes-requested"), summary("ambiguous"), "---\nplan: 58\n---\n", summary("accepted", "f".repeat(40))]) {
      assert.ok(check({ summaryText: text }).includes("PORTIA_PHASE20_OWNER_VERDICT_MISSING"), text);
    }
  });

  test("a different file hash or a missing file gives PORTIA_PHASE20_SNAPSHOT_HASH_MISMATCH", () => {
    const rows = [newRow(), replacedRow()] as Row[];
    const wrong = hashesFor(rows);
    wrong.set(rows[0].snapshot, "0".repeat(64));
    assert.deepEqual(check({ register: register(rows), fileHashes: wrong }), ["PORTIA_PHASE20_SNAPSHOT_HASH_MISMATCH"]);
    const missing = hashesFor(rows);
    missing.delete(rows[1].snapshot);
    assert.deepEqual(check({ register: register(rows), fileHashes: missing }), ["PORTIA_PHASE20_SNAPSHOT_HASH_MISMATCH"]);
  });

  test("an approved Phase 15 path without a matching supersedes, or supersedes on a foreign path, gives PORTIA_PHASE20_SUPERSEDE_INVALID", () => {
    for (const rows of [
      [replacedRow({ supersedes: null })],
      [replacedRow({ supersedes: "9".repeat(64) })],
      [newRow({ supersedes: approvedHash })],
    ]) {
      assert.deepEqual(check({ register: register(rows) }), ["PORTIA_PHASE20_SUPERSEDE_INVALID"]);
    }
  });

  test("a path outside the screenshots folder gives PORTIA_PHASE20_DESTINATION_INVALID", () => {
    for (const snapshot of ["tests/e2e/visual/phase20-x--chromium-desktop.png", `${dir}/../x.png`, `${dir}/phase20-x.jpg`, "C:/abs/phase20-x.png"]) {
      assert.ok(check({ register: register([newRow({ snapshot })]) }).includes("PORTIA_PHASE20_DESTINATION_INVALID"), snapshot);
    }
  });

  test("two rows with one path give PORTIA_PHASE20_DUPLICATE", () => {
    assert.ok(check({ register: register([newRow(), newRow()]) }).includes("PORTIA_PHASE20_DUPLICATE"));
  });

  test("an unknown schema, no rows or a foreign verdict source give PORTIA_PHASE20_REGISTER_INVALID", () => {
    assert.deepEqual(check({ register: register([newRow()], { schema: "other-v1" }) }), ["PORTIA_PHASE20_REGISTER_INVALID"]);
    assert.deepEqual(check({ register: register([], { rows: undefined }) }), ["PORTIA_PHASE20_REGISTER_INVALID"]);
    assert.deepEqual(check({ register: register([newRow()], { ownerVerdict: { source: "20-VISUAL-APPROVAL.md", commit: verdictCommit } }) }), ["PORTIA_PHASE20_REGISTER_INVALID"]);
    // The register keeps its signed identity: the archived path is not that identity.
    const archivedSource = ".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-58-SUMMARY.md";
    assert.deepEqual(check({ register: register([newRow()], { ownerVerdict: { source: archivedSource, commit: verdictCommit } }) }), ["PORTIA_PHASE20_REGISTER_INVALID"]);
  });
});

describe("Phase 20 baseline register through --verify-promotion (disposable fixtures)", () => {
  const script = path.resolve("scripts/phase15-visual-manifest.mjs");
  const evidenceDir = ".planning/milestones/v1.3-phases/PORTIA-15-baseline/evidence";
  const names = ["15-VISUAL-APPROVAL.md", "15-LOCAL-UI-CONTRACT.md", "15-FRAME-TEST-MAP.md", "15-STABLE-ROW-INVENTORY.json", "15-CANDIDATE-INDEX.json"];
  const summaryPath = ".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-58-SUMMARY.md";
  const commit = "c".repeat(40);
  const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  const spiderPath = "tests/e2e/visual/__screenshots__/phase20-spider--chromium-desktop.png";
  const plainRow = { surface: "s", decisions: ["D-45"], reason: "r" };

  // The fixture owns its snapshot bytes: the approval hashes are rewritten to the fixture bytes, so the test does not depend on the real PNGs.
  function fixture(extra: (dir: string, approved: Map<string, string>) => void = () => undefined, verdict = "accepted") {
    const dir = mkdtempSync(path.join(tmpdir(), "portia-phase20-register-"));
    const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
    git("init", "-q");
    git("commit", "-q", "--allow-empty", "-m", "fixture");
    mkdirSync(path.join(dir, evidenceDir), { recursive: true });
    const approved = new Map<string, string>();
    for (const name of names) {
      let text = readFileSync(path.resolve(evidenceDir, name), "utf8");
      if (name === "15-VISUAL-APPROVAL.md") {
        text = text.split(/\r?\n/).map((line) => {
          if (!/^\| \*\*APPROVED\*\* \|/.test(line)) return line;
          const columns = line.split("|").map((column) => column.trim());
          const oldHash = columns[5].match(/[a-f0-9]{64}/)![0];
          const snapshot = columns[7].match(/`([^`]+)`/)![1];
          const bytes = Buffer.from(`fixture bytes of ${snapshot}`);
          mkdirSync(path.dirname(path.join(dir, snapshot)), { recursive: true });
          writeFileSync(path.join(dir, snapshot), bytes);
          approved.set(snapshot, sha(bytes));
          return line.replaceAll(oldHash, sha(bytes));
        }).join("\n");
      }
      writeFileSync(path.join(dir, evidenceDir, name), text);
    }
    mkdirSync(path.dirname(path.join(dir, summaryPath)), { recursive: true });
    writeFileSync(path.join(dir, summaryPath), `---\nowner_verdict: ${verdict}\nowner_verdict_commit: ${commit}\n---\n`);
    extra(dir, approved);
    return dir;
  }

  function run(dir: string) {
    const result = spawnSync(process.execPath, [script, "--verify-promotion"], { cwd: dir, encoding: "utf8" });
    rmSync(dir, { recursive: true, force: true });
    return `${result.status}:${result.stderr}${result.stdout}`;
  }

  const writeRegister = (dir: string, rows: unknown[]) => writeFileSync(
    path.join(dir, "tests/e2e/visual/phase20-baselines.json"),
    `${JSON.stringify({
      schema: "portia-phase20-baselines-v1",
      decision: "D-68",
      ownerVerdict: { source: phase20VerdictSource, commit },
      captureCommit: "e".repeat(40),
      data: "offline stub",
      rows,
    }, null, 2)}\n`,
  );
  const addPng = (dir: string, name: string, bytes: Buffer) => {
    writeFileSync(path.join(dir, "tests/e2e/visual/__screenshots__", name), bytes);
    return sha(bytes);
  };

  test("without a register the output and the rules are the Phase 15 ones", () => {
    const out = run(fixture());
    assert.match(out, /^0:/);
    assert.match(out, /Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded\./);
  });

  test("without a register an extra PNG is still PORTIA_UNAPPROVED_SNAPSHOT_PRESENT", () => {
    const out = run(fixture((dir) => addPng(dir, "phase20-spider--chromium-desktop.png", Buffer.from("x"))));
    assert.match(out, /^1:/);
    assert.match(out, /PORTIA_UNAPPROVED_SNAPSHOT_PRESENT/);
  });

  test("a register accepts a new Phase 20 PNG and an exactly superseded Phase 15 PNG", () => {
    const out = run(fixture((dir, approved) => {
      const [replacedPath, replacedHash] = [...approved][0];
      const newHash = addPng(dir, "phase20-spider--chromium-desktop.png", Buffer.from("spider"));
      const replacementHash = addPng(dir, path.basename(replacedPath), Buffer.from("replacement"));
      writeRegister(dir, [
        { snapshot: spiderPath, sha256: newHash, supersedes: null, class: "phase20", ...plainRow },
        { snapshot: replacedPath, sha256: replacementHash, supersedes: replacedHash, class: "accepted-redesign", ...plainRow },
      ]);
    }));
    assert.match(out, /^0:/);
    assert.match(out, /Verified 34 exact owner-approved snapshot bytes/);
  });

  test("a register with a verdict that is not accepted is PORTIA_PHASE20_OWNER_VERDICT_MISSING", () => {
    const out = run(fixture((dir) => {
      const newHash = addPng(dir, "phase20-spider--chromium-desktop.png", Buffer.from("spider"));
      writeRegister(dir, [{ snapshot: spiderPath, sha256: newHash, supersedes: null, class: "phase20", ...plainRow }]);
    }, "ambiguous"));
    assert.match(out, /^1:/);
    assert.match(out, /PORTIA_PHASE20_OWNER_VERDICT_MISSING/);
  });

  test("a stray PNG that the register does not list is PORTIA_UNAPPROVED_SNAPSHOT_PRESENT", () => {
    const out = run(fixture((dir) => {
      const newHash = addPng(dir, "phase20-spider--chromium-desktop.png", Buffer.from("spider"));
      addPng(dir, "phase20-stray--chromium-desktop.png", Buffer.from("stray"));
      writeRegister(dir, [{ snapshot: spiderPath, sha256: newHash, supersedes: null, class: "phase20", ...plainRow }]);
    }));
    assert.match(out, /^1:/);
    assert.match(out, /PORTIA_UNAPPROVED_SNAPSHOT_PRESENT/);
  });
});
