import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validateCandidateRows } from "../scripts/phase15-visual-manifest.mjs";

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
    const { reason: _reason, ...row } = blocked();
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
