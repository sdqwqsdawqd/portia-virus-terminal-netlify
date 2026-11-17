import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PreflightError,
  runPreflight,
  validateVisitorPreflight,
} from "../scripts/phase15-e2e-preflight.mjs";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "https://isolatedproject00001.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key-for-tests-only",
  PORTIA_PROMOTION_DEVICE_SECRET: "phase15-device-secret-for-tests-only-0001",
};

test("visitor preflight accepts the pinned Node line and sanitized values", () => {
  assert.deepEqual(
    validateVisitorPreflight({ nodeVersion: "22.13.1", environment: validEnvironment }),
    { mode: "visitor", status: "ready" },
  );
});

test("visitor preflight reports only missing variable names", () => {
  assert.throws(
    () => validateVisitorPreflight({ nodeVersion: "22.13.1", environment: { NODE_ENV: "test" } }),
    (error: unknown) => {
      assert.ok(error instanceof PreflightError);
      assert.equal(error.code, "missing-environment");
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_URL/u);
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/u);
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/u);
      assert.match(error.message, /PORTIA_PROMOTION_DEVICE_SECRET/u);
      assert.doesNotMatch(error.message, /isolatedproject|public-anon|phase15-device/u);
      return true;
    },
  );
});

test("visitor preflight pins Node 22.13.x, narrower than package.json engines", () => {
  for (const nodeVersion of ["22.13.0", "22.13.1"]) {
    assert.deepEqual(validateVisitorPreflight({ nodeVersion, environment: validEnvironment }), {
      mode: "visitor",
      status: "ready",
    });
  }
  for (const nodeVersion of ["22.12.9", "22.14.0", "23.0.0", "24.0.0"]) {
    assert.throws(
      () => validateVisitorPreflight({ nodeVersion, environment: validEnvironment }),
      (error: unknown) => error instanceof PreflightError && error.code === "node-version",
    );
  }
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.engines.node, ">=22.13.0 <23");
});

test("visitor preflight takes the publishable key first, like the app", () => {
  const publishableOnly = {
    ...validEnvironment,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-for-tests-only",
  };
  assert.deepEqual(
    validateVisitorPreflight({ nodeVersion: "22.13.1", environment: publishableOnly }),
    { mode: "visitor", status: "ready" },
  );

  assert.throws(
    () =>
      validateVisitorPreflight({
        nodeVersion: "22.13.1",
        environment: { ...validEnvironment, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "tiny-secret" },
      }),
    (error: unknown) => {
      assert.ok(error instanceof PreflightError);
      assert.equal(error.code, "public-key-shape");
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/u);
      assert.doesNotMatch(error.message, /tiny-secret/u);
      return true;
    },
  );
});

test("visitor preflight rejects malformed values without reflecting them", () => {
  for (const [name, value, code] of [
    ["NEXT_PUBLIC_SUPABASE_URL", "https://secret.invalid/path", "public-url-shape"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "tiny-secret", "public-key-shape"],
    ["PORTIA_PROMOTION_DEVICE_SECRET", "short-secret", "device-secret-shape"],
  ] as const) {
    const environment = { ...validEnvironment, [name]: value };
    assert.throws(
      () => validateVisitorPreflight({ nodeVersion: "22.13.1", environment }),
      (error: unknown) => {
        assert.ok(error instanceof PreflightError);
        assert.equal(error.code, code);
        assert.match(error.message, new RegExp(name, "u"));
        assert.doesNotMatch(error.message, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
        return true;
      },
    );
  }
});

test("visitor preflight refuses a Supabase project listed as production", () => {
  const environment = {
    ...validEnvironment,
    PORTIA_E2E_PRODUCTION_PROJECT_IDS: "otherproject00000001, ISOLATEDPROJECT00001",
  };
  assert.throws(
    () => validateVisitorPreflight({ nodeVersion: "22.13.1", environment }),
    (error: unknown) => {
      assert.ok(error instanceof PreflightError);
      assert.equal(error.code, "production-target");
      assert.doesNotMatch(error.message, /isolatedproject/iu);
      return true;
    },
  );
  assert.deepEqual(
    validateVisitorPreflight({
      nodeVersion: "22.13.1",
      environment: { ...validEnvironment, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "otherproject00000001" },
    }),
    { mode: "visitor", status: "ready" },
  );
});

test("unknown modes fail before mutation imports", async () => {
  await assert.rejects(
    runPreflight("unsafe", {
      nodeVersion: "22.13.1",
      environment: validEnvironment,
      loadEnvironment: false,
    }),
    (error: unknown) => error instanceof PreflightError && error.code === "mode",
  );
});

test("mutation mode composes visitor checks with the isolated target guard", async () => {
  const projectId = "isolatedproject00001";
  await assert.doesNotReject(
    runPreflight("mutation", {
      nodeVersion: "22.13.1",
      environment: {
        ...validEnvironment,
        PORTIA_E2E_MUTATION_CONFIRM: "ISOLATED_TEST_PROJECT",
        PORTIA_E2E_TARGET_ENVIRONMENT: "isolated-test",
        PORTIA_E2E_TARGET_ID: projectId,
        PORTIA_E2E_SUPABASE_URL: `https://${projectId}.supabase.co`,
        PORTIA_E2E_PRODUCTION_PROJECT_IDS: "productionproject000",
        PORTIA_E2E_ISOLATED_PROJECT_IDS: projectId,
      },
      loadEnvironment: false,
    }),
  );
});

test("mutation preflight binds the app to the attested target and forbids an external base URL", async () => {
  const projectId = "isolatedproject00001";
  const mutation = {
    ...validEnvironment,
    PORTIA_E2E_MUTATION_CONFIRM: "ISOLATED_TEST_PROJECT",
    PORTIA_E2E_TARGET_ENVIRONMENT: "isolated-test",
    PORTIA_E2E_TARGET_ID: projectId,
    PORTIA_E2E_SUPABASE_URL: `https://${projectId}.supabase.co`,
    PORTIA_E2E_PRODUCTION_PROJECT_IDS: "productionproject000",
    PORTIA_E2E_ISOLATED_PROJECT_IDS: projectId,
  };
  const run = (environment: NodeJS.ProcessEnv) =>
    runPreflight("mutation", { nodeVersion: "22.13.1", environment, loadEnvironment: false });
  const codeOf = (promise: Promise<unknown>) =>
    promise.then(
      () => "none",
      (error: { code?: string }) => error.code,
    );
  assert.equal(await codeOf(run({ ...mutation, PORTIA_E2E_BASE_URL: "https://external.test" })), "external-base-url");
  assert.equal(
    await codeOf(run({ ...mutation, NEXT_PUBLIC_SUPABASE_URL: "https://otherproject00000001.supabase.co" })),
    "app-target-mismatch",
  );
  assert.equal(await codeOf(run(mutation)), "none");
  // Visitor mode keeps tolerating an external base URL.
  await assert.doesNotReject(
    runPreflight("visitor", {
      nodeVersion: "22.13.1",
      environment: { ...mutation, PORTIA_E2E_BASE_URL: "https://external.test" },
      loadEnvironment: false,
    }),
  );
});

test("mutation preflight ignores mutation config that exists only in an env file", async () => {
  const projectId = "fileonlyproject00001";
  const fileEnvironment = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectId}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fake-publishable-key-for-tests-only-0001",
    PORTIA_PROMOTION_DEVICE_SECRET: "fake-device-secret-for-tests-only-0000001",
    PORTIA_E2E_MUTATION_CONFIRM: "ISOLATED_TEST_PROJECT",
    PORTIA_E2E_TARGET_ENVIRONMENT: "isolated-test",
    PORTIA_E2E_TARGET_ID: projectId,
    PORTIA_E2E_SUPABASE_URL: `https://${projectId}.supabase.co`,
    PORTIA_E2E_PRODUCTION_PROJECT_IDS: "productionproject000",
    PORTIA_E2E_ISOLATED_PROJECT_IDS: projectId,
  };
  // Control: the same values supplied as the shell environment are accepted.
  await assert.doesNotReject(
    runPreflight("mutation", {
      nodeVersion: "22.13.1",
      environment: { NODE_ENV: "test", ...fileEnvironment },
      loadEnvironment: false,
    }),
  );

  const directory = mkdtempSync(path.join(os.tmpdir(), "portia-preflight-"));
  const saved = new Map(Object.keys(fileEnvironment).map((name) => [name, process.env[name]]));
  try {
    writeFileSync(
      path.join(directory, ".env"),
      Object.entries(fileEnvironment).map(([name, value]) => `${name}=${value}`).join("\n"),
    );
    for (const name of saved.keys()) delete process.env[name];
    // @next/env caches its first load per process: keep exactly one loading call in this file.
    await assert.rejects(
      runPreflight("mutation", { nodeVersion: "22.13.1", projectDirectory: directory }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.name, "MutationTargetBlockedError");
        assert.doesNotMatch(error.message, /fileonlyproject|fake-/u);
        return true;
      },
    );
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
