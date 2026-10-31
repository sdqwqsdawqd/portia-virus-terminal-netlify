import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  parseAuthorityMetadata,
  validateApprovalCoverage,
  validateAuthorityMetadata,
  validateCandidateRows,
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

const authority = (overrides: Partial<Record<"candidateSet" | "sourceCommit" | "figmaRevision", string>> = {}) => [
  `- Candidate set: \`${overrides.candidateSet ?? "phase15-current-abc123"}\``,
  `- Source commit: \`${overrides.sourceCommit ?? "a".repeat(40)}\``,
  `- Figma revision locator: MCP session \`${overrides.figmaRevision ?? "11111111-1111-1111-1111-111111111111"}\``,
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
      figmaRevision: "11111111-1111-1111-1111-111111111111",
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
      approval: authority(), contract: authority({ figmaRevision: "22222222-2222-2222-2222-222222222222" }), frameMap: authority(),
    }), /PORTIA_AUTHORITY_FIGMA_REVISION_MISMATCH/);
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
