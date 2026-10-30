import { readFileSync } from "node:fs";
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
  readonly reason: string;

  constructor(role: ActorRole, reason: string) {
    super(`[PORTIA_E2E_ROLE_BLOCKED:${role}] ${reason}`);
    this.name = "ActorLaneBlockedError";
    this.role = role;
    this.reason = reason;
  }
}

export type ActorAvailability =
  | Readonly<{ status: "READY"; actor: ActorDeclaration; target?: SafeMutationTarget }>
  | Readonly<{ status: "BLOCKED"; actor: ActorDeclaration; reason: string }>;

export function actorAvailability(
  role: ActorRole,
  environment: NodeJS.ProcessEnv = process.env,
): ActorAvailability {
  const actor = actorRoster.actors.find((candidate) => candidate.role === role);
  if (!actor) throw new Error(`[PORTIA_E2E_ROSTER_INVALID:${role}]`);
  if (role === "visitor") return Object.freeze({ status: "READY", actor });

  try {
    const target = requireSafeMutationTargetFromEnvironment(environment);
    return Object.freeze({ status: "READY", actor, target });
  } catch (error) {
    if (!(error instanceof MutationTargetBlockedError)) throw error;
    return Object.freeze({
      status: "BLOCKED",
      actor,
      reason: `safe target unavailable (${error.code})`,
    });
  }
}

export function requireActor(
  role: ActorRole,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const availability = actorAvailability(role, environment);
  if (availability.status === "BLOCKED") {
    throw new ActorLaneBlockedError(role, availability.reason);
  }
  return availability;
}
