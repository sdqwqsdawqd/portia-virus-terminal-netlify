import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MutationTargetBlockedError,
  requireSafeMutationTarget,
} from "../tests/e2e/fixtures/target-guard.ts";

const testProjectId = "abcdefghijklmnopqrst";
const safeTarget = {
  confirmation: "ISOLATED_TEST_PROJECT",
  environment: "isolated-test",
  projectId: testProjectId,
  supabaseUrl: `https://${testProjectId}.supabase.co/`,
};

function expectBlocked(
  code: string,
  input: Parameters<typeof requireSafeMutationTarget>[0],
  secrets: readonly string[] = [],
) {
  assert.throws(
    () => requireSafeMutationTarget(input),
    (error) => {
      assert.ok(error instanceof MutationTargetBlockedError);
      assert.equal(error.code, code);
      for (const secret of secrets) assert.ok(!error.message.includes(secret));
      assert.ok(!error.message.includes("https://"));
      return true;
    },
  );
}

describe("Phase 15 mutation target guard", () => {
  test("rejects a missing target before setup", () => {
    expectBlocked("confirmation", {});
  });

  test("rejects an unconfirmed target without reflecting its values", () => {
    expectBlocked(
      "confirmation",
      { ...safeTarget, confirmation: "not-confirmed" },
      [testProjectId, safeTarget.supabaseUrl],
    );
  });

  test("rejects a known production project", () => {
    expectBlocked(
      "production-project",
      { ...safeTarget, productionProjectIds: `otherprojectref00000,${testProjectId}` },
      [testProjectId, safeTarget.supabaseUrl],
    );
  });

  test("rejects a project identity mismatch", () => {
    const differentProject = "zyxwvutsrqponmlkjihg";
    expectBlocked(
      "identity-mismatch",
      { ...safeTarget, supabaseUrl: `https://${differentProject}.supabase.co/` },
      [testProjectId, differentProject],
    );
  });

  test("accepts only the matching isolated test project identity", () => {
    assert.deepEqual(requireSafeMutationTarget(safeTarget), {
      environment: "isolated-test",
      projectId: testProjectId,
    });
  });
});
