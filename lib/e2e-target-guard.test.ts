import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MutationTargetBlockedError,
  requireSafeMutationTarget,
} from "../tests/e2e/fixtures/target-guard.ts";
import {
  assertAppBoundToTarget,
  assertIssuerMatchesTarget,
  issuerHost,
} from "../tests/e2e/fixtures/target-attestation.ts";

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

describe("Phase 16 target attestation", () => {
  const ref = "aaaaaaaaaaaaaaaaaaaa";
  const other = "bbbbbbbbbbbbbbbbbbbb";
  const shell = {
    PORTIA_E2E_MUTATION_CONFIRM: "ISOLATED_TEST_PROJECT",
    PORTIA_E2E_TARGET_ENVIRONMENT: "isolated-test",
    PORTIA_E2E_TARGET_ID: ref,
    PORTIA_E2E_SUPABASE_URL: `https://${ref}.supabase.co`,
    PORTIA_E2E_PRODUCTION_PROJECT_IDS: "productionproject000",
    PORTIA_E2E_ISOLATED_PROJECT_IDS: ref,
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  };
  const codeOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      assert.ok(error instanceof MutationTargetBlockedError);
      assert.ok(!error.message.includes(ref) && !error.message.includes(other));
      return error.code;
    }
    return "none";
  };
  const jwt = (payload: unknown) =>
    ["{\"alg\":\"none\"}", JSON.stringify(payload), "sig"]
      .map((part) => Buffer.from(part).toString("base64url"))
      .join(".");

  test("accepts an app bound to the attested target", () => {
    assert.deepEqual(assertAppBoundToTarget(shell), { environment: "isolated-test", projectId: ref });
    assert.equal(
      codeOf(() => assertAppBoundToTarget(shell, { ...shell, PORTIA_PROMO_LIVE_URL: `https://${ref}.supabase.co` })),
      "none",
    );
  });

  test("blocks an app or live suite pointing at another host", () => {
    assert.equal(
      codeOf(() => assertAppBoundToTarget(shell, { ...shell, NEXT_PUBLIC_SUPABASE_URL: `https://${other}.supabase.co` })),
      "app-target-mismatch",
    );
    assert.equal(codeOf(() => assertAppBoundToTarget(shell, { PORTIA_E2E_BASE_URL: undefined })), "app-target-mismatch");
    assert.equal(
      codeOf(() => assertAppBoundToTarget(shell, { ...shell, PORTIA_PROMO_LIVE_URL: `https://${other}.supabase.co` })),
      "live-target-mismatch",
    );
  });

  test("forbids an external base URL in either environment", () => {
    assert.equal(codeOf(() => assertAppBoundToTarget({ ...shell, PORTIA_E2E_BASE_URL: "https://x.test" })), "external-base-url");
    assert.equal(
      codeOf(() => assertAppBoundToTarget(shell, { ...shell, PORTIA_E2E_BASE_URL: "https://x.test" })),
      "external-base-url",
    );
  });

  test("propagates target-guard errors unchanged", () => {
    assert.equal(codeOf(() => assertAppBoundToTarget({ ...shell, PORTIA_E2E_PRODUCTION_PROJECT_IDS: ref })), "list-overlap");
    assert.equal(codeOf(() => assertAppBoundToTarget({ ...shell, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "" })), "production-list-missing");
    assert.equal(codeOf(() => assertAppBoundToTarget({})), "confirmation");
  });

  test("derives the issuer host and rejects foreign or broken tokens", () => {
    const target = { environment: "isolated-test", projectId: ref } as const;
    assert.equal(issuerHost(jwt({ iss: `https://${ref}.supabase.co/auth/v1` })), `${ref}.supabase.co`);
    assert.doesNotThrow(() => assertIssuerMatchesTarget(jwt({ iss: `https://${ref}.supabase.co/auth/v1` }), target));
    for (const token of [jwt({ iss: `https://${other}.supabase.co/auth/v1` }), jwt({}), jwt({ iss: "not a url" }), "garbage", ""]) {
      assert.equal(codeOf(() => assertIssuerMatchesTarget(token, target)), "issuer-mismatch");
    }
  });
});
