import {
  MutationTargetBlockedError,
  requireSafeMutationTargetFromEnvironment,
  type SafeMutationTarget,
} from "./target-guard.ts";

type Env = Readonly<Record<string, string | undefined>>;

function hostOf(value: string | undefined) {
  try {
    return new URL(value ?? "").hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

// shellEnv is judged by the target guard (Playwright workers see only the shell);
// effectiveEnv is what `next build` will inline (shell over env files). Messages name variables, never values.
export function assertAppBoundToTarget(shellEnv: Env, effectiveEnv: Env = shellEnv): SafeMutationTarget {
  const target = requireSafeMutationTargetFromEnvironment(shellEnv);
  if (shellEnv.PORTIA_E2E_BASE_URL?.trim() || effectiveEnv.PORTIA_E2E_BASE_URL?.trim()) {
    throw new MutationTargetBlockedError("external-base-url", ["PORTIA_E2E_BASE_URL"]);
  }
  const expectedHost = `${target.projectId}.supabase.co`;
  if (hostOf(effectiveEnv.NEXT_PUBLIC_SUPABASE_URL) !== expectedHost) {
    throw new MutationTargetBlockedError("app-target-mismatch", [
      "NEXT_PUBLIC_SUPABASE_URL",
      "PORTIA_E2E_SUPABASE_URL",
    ]);
  }
  for (const env of [shellEnv, effectiveEnv]) {
    if (env.PORTIA_PROMO_LIVE_URL && hostOf(env.PORTIA_PROMO_LIVE_URL) !== expectedHost) {
      throw new MutationTargetBlockedError("live-target-mismatch", [
        "PORTIA_PROMO_LIVE_URL",
        "PORTIA_E2E_SUPABASE_URL",
      ]);
    }
  }
  return target;
}

// Unsigned decode: the host claim is a routing/identity hint, the signature is verified by the server on use.
export function issuerHost(accessToken: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    return hostOf(typeof payload?.iss === "string" ? payload.iss : undefined);
  } catch {
    return undefined;
  }
}

export function assertIssuerMatchesTarget(accessToken: string, target: SafeMutationTarget) {
  if (issuerHost(accessToken) !== `${target.projectId}.supabase.co`) {
    throw new MutationTargetBlockedError("issuer-mismatch", ["PORTIA_E2E_TARGET_ID"]);
  }
}
