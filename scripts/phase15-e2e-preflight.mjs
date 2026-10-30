import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

export const PUBLIC_REQUIRED_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "PORTIA_PROMOTION_DEVICE_SECRET",
];

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
  if (!/^22\.13\.\d+$/u.test(nodeVersion)) {
    throw new PreflightError("node-version", ["Node 22.13.x"]);
  }

  const missing = PUBLIC_REQUIRED_VARIABLES.filter(
    (name) => typeof environment[name] !== "string" || environment[name].trim() === "",
  );
  if (missing.length > 0) throw new PreflightError("missing-environment", missing);

  if (!isSupabaseRootUrl(environment.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new PreflightError("public-url-shape", ["NEXT_PUBLIC_SUPABASE_URL"]);
  }
  if (environment.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim().length < 20) {
    throw new PreflightError("public-key-shape", ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
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

  if (options.loadEnvironment !== false) {
    loadEnvConfig(options.projectDirectory ?? process.cwd());
  }
  validateVisitorPreflight(options);

  if (mode === "mutation") {
    const { requireSafeMutationTargetFromEnvironment } = await import(
      "../tests/e2e/fixtures/target-guard.ts"
    );
    requireSafeMutationTargetFromEnvironment(options.environment ?? process.env);
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
