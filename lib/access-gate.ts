import { EDITOR_ACCESS_LEVEL, type AccessLevel } from "./access-levels.ts";
import { accessTokenDigest, readAccessToken } from "./access-session.ts";
import { accessRpc, AccessStoreError, isClosureEnabled, resolveAccess, type AccessRpcClient, type AccessState } from "./access-store.ts";

export type GateDecision =
  | { mode: "open"; state: AccessState }
  | { mode: "closed"; state: AccessState; allowed: boolean; level: AccessLevel | null; editor: boolean };

export type GateWarn = (message: string, detail: { sqlState: string | null }) => void;

export type GateDependencies = {
  client: AccessRpcClient;
  sessionSecret: string;
  editorAccess: () => Promise<{ canEdit: boolean; unavailable?: true }>;
  warn?: GateWarn;
};

// The closure RPC name as a whole identifier: "public.portia_access_closure_enabled" and "portia_access_closure_enabled()"
// match, a longer identifier such as "portia_access_closure_enabled_legacy" does not. The name holds only [a-z_].
const closureFunctionName = new RegExp(`(^|[^A-Za-z0-9_])${accessRpc.closureEnabled}($|[^A-Za-z0-9_])`);

// Owner decision 2026-11-14: only the exact "this function is not in the database" signal turns closure OFF (D-01).
// AccessStoreError.code carries the PostgREST message; sqlState carries the PostgREST code or SQLSTATE.
export function isMissingClosureFunction(error: unknown): boolean {
  return error instanceof AccessStoreError
    && (error.sqlState === "PGRST202" || error.sqlState === "42883")
    && closureFunctionName.test(error.code);
}

export function onceWarn(sink: GateWarn): GateWarn {
  let warned = false;
  return (message, detail) => {
    if (warned) return;
    warned = true;
    sink(message, detail);
  };
}

// Once per server process, not on every 5 s status poll.
const defaultWarn = onceWarn((message, detail) => { console.warn(message, detail); });

const closureMissingMessage = "PORTIA access gate: closure RPC is missing in the database; treating closure as OFF (pre-Phase-23 behaviour)";

export async function resolveGate(headers: Headers, dependencies: GateDependencies): Promise<GateDecision> {
  let closed: boolean;
  try {
    closed = await isClosureEnabled(dependencies.client);
  } catch (error) {
    if (!isMissingClosureFunction(error)) throw error;
    (dependencies.warn ?? defaultWarn)(closureMissingMessage, { sqlState: (error as AccessStoreError).sqlState });
    return { mode: "open", state: { state: "none" } };
  }
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
