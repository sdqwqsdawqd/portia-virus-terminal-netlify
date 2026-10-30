import assert from "node:assert/strict";
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
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/u);
      assert.match(error.message, /PORTIA_PROMOTION_DEVICE_SECRET/u);
      assert.doesNotMatch(error.message, /isolatedproject|public-anon|phase15-device/u);
      return true;
    },
  );
});

test("visitor preflight rejects versions outside Node 22.13.x", () => {
  assert.throws(
    () => validateVisitorPreflight({ nodeVersion: "24.0.0", environment: validEnvironment }),
    (error: unknown) => error instanceof PreflightError && error.code === "node-version",
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
