// Phase 24: who is reading the content. Taken from the gate decision only (editor session, then the device cookie), never
// from a request parameter.
import { MIN_ACCESS_LEVEL, EDITOR_ACCESS_LEVEL, type AccessLevel } from "./access-levels.ts";
import type { GateDecision } from "./access-gate.ts";
import { viewerKeyOf } from "./content-sync.ts";
import { nicknameKey } from "./nickname.ts";

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

// The key a cached or fetched copy carries (format owned by viewerKeyOf in content-sync).
export function viewerKey(viewer: Viewer | null): string {
  return viewerKeyOf(viewer);
}

// D-21: closed site and this device is not allowed in (never approved, pending, rejected or revoked).
export function shouldClearDeviceCaches(decision: GateDecision): boolean {
  return decision.mode === "closed" && !decision.allowed;
}

// SEC-04 (D-16): who this device is for the cache, besides the level: the nickname key of the approved request. Empty for an
// editor, for a visitor of the open site without an approval, and when nobody is let in. Client-only stamp: the server key
// payload.viewer stays as it is.
export function viewerPersonOf(decision: GateDecision): string {
  const viewer = viewerOf(decision);
  if (viewer === null || viewer.editor) return "";
  return decision.state.state === "approved" ? nicknameKey(decision.state.nickname) ?? "" : "";
}

// The identity compared between two gate answers; any difference wipes the device copies.
export function cacheIdentityOf(decision: GateDecision): string {
  return `${viewerKey(viewerOf(decision))}|${viewerPersonOf(decision)}`;
}
