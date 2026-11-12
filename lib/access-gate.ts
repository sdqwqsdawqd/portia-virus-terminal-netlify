import { EDITOR_ACCESS_LEVEL, type AccessLevel } from "./access-levels.ts";
import { accessTokenDigest, readAccessToken } from "./access-session.ts";
import { isClosureEnabled, resolveAccess, type AccessRpcClient, type AccessState } from "./access-store.ts";

export type GateDecision =
  | { mode: "open"; state: AccessState }
  | { mode: "closed"; state: AccessState; allowed: boolean; level: AccessLevel | null; editor: boolean };

export type GateDependencies = {
  client: AccessRpcClient;
  sessionSecret: string;
  editorAccess: () => Promise<{ canEdit: boolean; unavailable?: true }>;
};

export async function resolveGate(headers: Headers, dependencies: GateDependencies): Promise<GateDecision> {
  const closed = await isClosureEnabled(dependencies.client);
  const token = readAccessToken(headers);
  if (!closed) {
    let state: AccessState = { state: "none" };
    if (token) {
      try { state = await resolveAccess(dependencies.client, accessTokenDigest(token, dependencies.sessionSecret)); }
      catch { /* The open desktop remains usable while an optional request status is unavailable. */ }
    }
    return { mode: "open", state };
  }
  const editorAccess = await dependencies.editorAccess();
  if (editorAccess.unavailable) throw new Error("Editor verification unavailable.");
  if (editorAccess.canEdit) return { mode: "closed", state: { state: "none" }, allowed: true, level: EDITOR_ACCESS_LEVEL, editor: true };
  const state = token
    ? await resolveAccess(dependencies.client, accessTokenDigest(token, dependencies.sessionSecret))
    : { state: "none" } as const;
  if (state.state === "approved") return { mode: "closed", state, allowed: true, level: state.level, editor: false };
  return { mode: "closed", state, allowed: false, level: null, editor: false };
}
