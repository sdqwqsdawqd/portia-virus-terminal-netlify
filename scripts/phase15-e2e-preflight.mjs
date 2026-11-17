import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

export const PUBLIC_REQUIRED_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "PORTIA_PROMOTION_DEVICE_SECRET",
];

// Same priority as lib/supabase/env.ts: publishable key first, legacy anon key as fallback.
export const PUBLIC_KEY_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

function hasValue(environment, name) {
  return typeof environment[name] === "string" && environment[name].trim() !== "";
}

export class PreflightError extends Error {
  constructor(code, variableNames = []) {
    super(
      `[PORTIA_E2E_PREFLIGHT:${code}] Check: ${variableNames.join(", ") || "runner configuration"}.`,
    );
    this.name = "PreflightError";
    this.code = code;
    this.variableNames = variableNames;
  }
}

function isSupabaseRootUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      /^[a-z0-9]{20}\.supabase\.co$/u.test(url.hostname) &&
      (url.pathname === "/" || url.pathname === "") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function validateVisitorPreflight({
  nodeVersion = process.versions.node,
  environment = process.env,
} = {}) {
  // Intentionally narrower than package.json engines: ROADMAP Phase 15 ties browser/package evidence to Node 22.13.x.
  if (!/^22\.13\.\d+$/u.test(nodeVersion)) {
    throw new PreflightError("node-version", ["Node 22.13.x"]);
  }

  // Truthiness like the `||` in getSupabaseConfig: an empty publishable key falls through to anon.
  const keyName = PUBLIC_KEY_VARIABLES.find((name) => environment[name]) ?? PUBLIC_KEY_VARIABLES[0];
  const missing = PUBLIC_REQUIRED_VARIABLES.filter((name) => !hasValue(environment, name));
  if (!PUBLIC_KEY_VARIABLES.some((name) => hasValue(environment, name))) {
    missing.splice(1, 0, ...PUBLIC_KEY_VARIABLES);
  }
  if (missing.length > 0) throw new PreflightError("missing-environment", missing);

  if (!isSupabaseRootUrl(environment.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new PreflightError("public-url-shape", ["NEXT_PUBLIC_SUPABASE_URL"]);
  }
  const projectRef = new URL(environment.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const productionRefs = (environment.PORTIA_E2E_PRODUCTION_PROJECT_IDS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase());
  if (productionRefs.includes(projectRef)) {
    throw new PreflightError("production-target", [
      "NEXT_PUBLIC_SUPABASE_URL",
      "PORTIA_E2E_PRODUCTION_PROJECT_IDS",
    ]);
  }
  if (environment[keyName].trim().length < 20) {
    throw new PreflightError("public-key-shape", [keyName]);
  }
  if (environment.PORTIA_PROMOTION_DEVICE_SECRET.trim().length < 32) {
    throw new PreflightError("device-secret-shape", ["PORTIA_PROMOTION_DEVICE_SECRET"]);
  }

  return { mode: "visitor", status: "ready" };
}

export async function runPreflight(mode = "visitor", options = {}) {
  if (mode !== "visitor" && mode !== "mutation") {
    throw new PreflightError("mode", ["visitor", "mutation"]);
  }

  const shellEnvironment = { ...process.env };
  if (options.loadEnvironment !== false) {
    loadEnvConfig(options.projectDirectory ?? process.cwd());
  }
  validateVisitorPreflight(options);

  if (mode === "mutation") {
    const { requireSafeMutationTargetFromEnvironment } = await import(
      "../tests/e2e/fixtures/target-guard.ts"
    );
    const { assertAppBoundToTarget } = await import("../tests/e2e/fixtures/target-attestation.ts");
    // Playwright workers do not load env files, so the guard must judge the same shell environment.
    const shell = options.environment ?? shellEnvironment;
    requireSafeMutationTargetFromEnvironment(shell);
    // `next build` inlines the effective values (shell over env files), so bind the app to the target on those (IN-03).
    assertAppBoundToTarget(shell, options.environment ?? process.env);
  }

  return { mode, status: "ready" };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const mode = process.argv[2] ?? "visitor";
  runPreflight(mode)
    .then((result) => {
      process.stdout.write(`[PORTIA_E2E_PREFLIGHT:ready] ${result.mode}\n`);
    })
    .catch((error) => {
      const safeMessage = error instanceof PreflightError
        ? error.message
        : "[PORTIA_E2E_PREFLIGHT:internal] Preflight could not complete.";
      process.stderr.write(`${safeMessage}\n`);
      process.exitCode = 1;
    });
}
