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
  productionProjectIds: "productionproject000",
  isolatedProjectIds: testProjectId,
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
      {
        ...safeTarget,
        productionProjectIds: `otherprojectref00000,${testProjectId}`,
        isolatedProjectIds: "isolatedproject00001",
      },
      [testProjectId, safeTarget.supabaseUrl],
    );
  });

  test("requires both project lists", () => {
    expectBlocked("production-list-missing", {
      ...safeTarget,
      productionProjectIds: undefined,
    });
    expectBlocked("isolated-list-missing", {
      ...safeTarget,
      isolatedProjectIds: undefined,
    });
  });

  test("rejects malformed and duplicate project lists", () => {
    expectBlocked("production-list-malformed", {
      ...safeTarget,
      productionProjectIds: "not-a-ref",
    });
    expectBlocked("isolated-list-malformed", {
      ...safeTarget,
      isolatedProjectIds: "not-a-ref",
    });
    expectBlocked("production-list-duplicate", {
      ...safeTarget,
      productionProjectIds: "productionproject000,productionproject000",
    });
    expectBlocked("isolated-list-duplicate", {
      ...safeTarget,
      isolatedProjectIds: `${testProjectId},${testProjectId}`,
    });
  });

  test("rejects overlap and unknown targets", () => {
    expectBlocked("list-overlap", {
      ...safeTarget,
      productionProjectIds: testProjectId,
    });
    expectBlocked("unknown-target", {
      ...safeTarget,
      isolatedProjectIds: "isolatedproject00001",
    });
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
