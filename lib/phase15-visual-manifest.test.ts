import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
} from "../scripts/phase15-visual-manifest.mjs";

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
  const evidenceDir = ".planning/phases/PORTIA-15-baseline/evidence";
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
