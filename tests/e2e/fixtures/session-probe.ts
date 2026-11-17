import { assertIssuerMatchesTarget } from "./target-attestation.ts";
import { MutationTargetBlockedError, type SafeMutationTarget } from "./target-guard.ts";

type ProbeRole = "participant" | "editor" | "promo-reviewer" | "owner";

declare const verifiedBrand: unique symbol;
export type VerifiedSession = Readonly<{
  [verifiedBrand]: true;
  role: ProbeRole;
  projectId: string;
}>;

// The only registry of proofs: an object is a proof only if probeSession put it here (WR-01).
const minted = new WeakSet<object>();

function failed(code: "session-probe-failed" | "session-role-mismatch"): never {
  throw new MutationTargetBlockedError(code, ["/api/access"]);
}

async function getJson(fetchImpl: typeof fetch, url: string, cookieHeader: string) {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { cookie: cookieHeader }, cache: "no-store" });
  } catch {
    return failed("session-probe-failed");
  }
  if (response.status !== 200) return failed("session-probe-failed");
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return failed("session-probe-failed");
  }
}

function roleMatches(role: ProbeRole, access: Record<string, unknown>) {
  const { canEdit, canManageEditors, openTabs } = access;
  if (typeof canEdit !== "boolean" || typeof canManageEditors !== "boolean" || !Array.isArray(openTabs)) {
    return failed("session-probe-failed");
  }
  const promo = openTabs.includes("promo");
  if (role === "participant") return !canEdit;
  if (role === "owner") return canEdit && canManageEditors;
  if (role === "promo-reviewer") return canEdit && !canManageEditors && promo;
  return canEdit && !canManageEditors && !promo;
}

export async function probeSession(
  input: {
    role: ProbeRole;
    target: SafeMutationTarget;
    baseURL: string;
    cookieHeader: string;
    accessToken: string;
    participant?: { nickname: string };
  },
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedSession> {
  const { role, target, baseURL, cookieHeader, accessToken, participant } = input;
  assertIssuerMatchesTarget(accessToken, target);

  const access = await getJson(fetchImpl, `${baseURL}/api/access`, cookieHeader);
  if (!roleMatches(role, access)) failed("session-role-mismatch");

  if (role === "participant") {
    const nickname = participant?.nickname;
    if (!nickname) failed("session-role-mismatch");
    const status = await getJson(
      fetchImpl,
      `${baseURL}/api/promotion/status?nickname=${encodeURIComponent(nickname)}`,
      cookieHeader,
    );
    if (typeof status.nickname !== "string" || status.nickname.toLowerCase() !== nickname.toLowerCase()) {
      failed("session-role-mismatch");
    }
  }

  const proof = Object.freeze({ role, projectId: target.projectId }) as VerifiedSession;
  minted.add(proof);
  return proof;
}

export function isVerifiedSession(
  value: unknown,
  role: ProbeRole,
  target: SafeMutationTarget,
): value is VerifiedSession {
  if (typeof value !== "object" || value === null || !minted.has(value)) return false;
  const proof = value as VerifiedSession;
  return proof.role === role && proof.projectId === target.projectId;
}
