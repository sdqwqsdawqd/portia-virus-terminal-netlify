import { readFileSync } from "node:fs";
import { isVerifiedSession, type VerifiedSession } from "./session-probe.ts";
import {
  MutationTargetBlockedError,
  requireSafeMutationTargetFromEnvironment,
  type SafeMutationTarget,
} from "./target-guard.ts";

export type ActorRole =
  | "visitor"
  | "participant"
  | "editor"
  | "promo-reviewer"
  | "owner";

export type ActorDeclaration = Readonly<{
  id: string;
  role: ActorRole;
  lifecycleOwner: string;
  cleanup: string;
}>;

export type ActorBlockCode =
  | "TARGET_NOT_ISOLATED"
  | "AUTHENTICATED_SESSION_UNPROVEN";

type RosterFile = {
  schema: "portia-phase15-actor-roster-v1";
  revision: string;
  target: { status: "BLOCKED" | "READY"; safeMarker: string };
  actors: ActorDeclaration[];
};

const rosterPath = new URL("./data/roster.json", import.meta.url);
const roster = JSON.parse(readFileSync(rosterPath, "utf8")) as RosterFile;

export const actorRoster = Object.freeze({
  ...roster,
  actors: Object.freeze(roster.actors.map((actor) => Object.freeze(actor))),
});

export class ActorLaneBlockedError extends Error {
  readonly role: ActorRole;
  readonly code: ActorBlockCode;
  readonly reason: string;

  constructor(role: ActorRole, code: ActorBlockCode, reason: string) {
    super(`[PORTIA_E2E_ROLE_BLOCKED:${role}:${code}] ${reason}`);
    this.name = "ActorLaneBlockedError";
    this.role = role;
    this.code = code;
    this.reason = reason;
  }
}

export type ActorAvailability =
  | Readonly<{
      status: "READY";
      actor: ActorDeclaration;
      target?: SafeMutationTarget;
      sessionProof?: VerifiedSession;
    }>
  | Readonly<{
      status: "BLOCKED";
      actor: ActorDeclaration;
      code: ActorBlockCode;
      reason: string;
    }>;

export function actorAvailability(
  role: ActorRole,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  sessionProof?: VerifiedSession,
): ActorAvailability {
  const actor = actorRoster.actors.find((candidate) => candidate.role === role);
  if (!actor) throw new Error(`[PORTIA_E2E_ROSTER_INVALID:${role}]`);
  if (role === "visitor") return Object.freeze({ status: "READY", actor });

  try {
    const target = requireSafeMutationTargetFromEnvironment(environment);
    if (!isVerifiedSession(sessionProof, role, target)) {
      return Object.freeze({
        status: "BLOCKED",
        actor,
        code: "AUTHENTICATED_SESSION_UNPROVEN",
        reason: "a matching immutable server-derived session proof is required",
      });
    }
    return Object.freeze({ status: "READY", actor, target, sessionProof });
  } catch (error) {
    if (!(error instanceof MutationTargetBlockedError)) throw error;
    return Object.freeze({
      status: "BLOCKED",
      actor,
      code: "TARGET_NOT_ISOLATED",
      reason: `safe target unavailable (${error.code})`,
    });
  }
}

export function requireActor(
  role: ActorRole,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  sessionProof?: VerifiedSession,
) {
  const availability = actorAvailability(role, environment, sessionProof);
  if (availability.status === "BLOCKED") {
    throw new ActorLaneBlockedError(role, availability.code, availability.reason);
  }
  return availability;
}
