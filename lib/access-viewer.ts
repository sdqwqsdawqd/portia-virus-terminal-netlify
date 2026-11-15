// Phase 24: who is reading the content. Taken from the gate decision only (editor session, then the device cookie), never
// from a request parameter.
import { MIN_ACCESS_LEVEL, EDITOR_ACCESS_LEVEL, type AccessLevel } from "./access-levels.ts";
import type { GateDecision } from "./access-gate.ts";

export type Viewer = { editor: boolean; level: AccessLevel };

// null = closed site and no access: the caller answers 401 before reading any content.
export function viewerOf(decision: GateDecision): Viewer | null {
  if (decision.mode === "open") {
    // Open site: the level of an approved request on this device, else level 1 (the site as before).
    return { editor: false, level: decision.state.state === "approved" ? decision.state.level : MIN_ACCESS_LEVEL };
  }
  if (decision.editor) return { editor: true, level: EDITOR_ACCESS_LEVEL };
  if (!decision.allowed || decision.level === null) return null;
  return { editor: false, level: decision.level };
}
