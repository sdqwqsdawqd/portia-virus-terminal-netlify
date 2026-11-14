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

// The closure RPC name (accessRpc.closureEnabled) as a whole identifier: a schema-qualified name or one followed by
// "()" matches, a longer identifier that merely starts with it does not. The name holds only [a-z_]. The literal is kept
// out of this file on purpose: lib/access-closure.test.ts scans product code for it.
const closureFunctionName = new RegExp(`(^|[^A-Za-z0-9_])${accessRpc.closureEnabled}($|[^A-Za-z0-9_])`);

// Owner decision 2026-11-14 (1a): only the exact "this function is not in the database" signal is read as
// "closure ON, fail-closed" (it replaces the 23-08 fallback to OFF, D-01).
// AccessStoreError.code carries the PostgREST message; sqlState carries the PostgREST code or SQLSTATE.
export function isMissingClosureFunction(error: unknown): error is AccessStoreError {
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

const closureMissingMessage = "PORTIA access gate: closure RPC is missing in the database; treating closure as ON (fail-closed) until the access migrations are applied";

// A thrown or rejected editor check is never a grant: it counts as unavailable.
async function readEditorAccess(dependencies: GateDependencies): Promise<{ canEdit: boolean; unavailable?: true }> {
  try { return await dependencies.editorAccess(); }
  catch { return { canEdit: false, unavailable: true }; }
}

export async function resolveGate(headers: Headers, dependencies: GateDependencies): Promise<GateDecision> {
  // D-03 / owner decision 2026-11-14 item 1: a verified editor is decided before the closure flag is read,
  // so no closure RPC failure can block them.
  const editorAccess = await readEditorAccess(dependencies);
  if (editorAccess.canEdit && !editorAccess.unavailable) {
    return { mode: "closed", state: { state: "none" }, allowed: true, level: EDITOR_ACCESS_LEVEL, editor: true };
  }
  let closed: boolean;
  try {
    closed = await isClosureEnabled(dependencies.client);
  } catch (error) {
    if (!isMissingClosureFunction(error)) throw error;
    // Owner decision 2026-11-14 (1a): a missing closure function means closure ON. The visitor sees the closed screen
    // with the request form; the token is not read, because the resolve function lives in the same unapplied migration.
    (dependencies.warn ?? defaultWarn)(closureMissingMessage, { sqlState: error.sqlState });
    if (editorAccess.unavailable) throw new Error("Editor verification unavailable.");
    return { mode: "closed", state: { state: "none" }, allowed: false, level: null, editor: false };
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
  if (editorAccess.unavailable) throw new Error("Editor verification unavailable.");
  const state = token
    ? await resolveAccess(dependencies.client, accessTokenDigest(token, dependencies.sessionSecret))
    : { state: "none" } as const;
  if (state.state === "approved") return { mode: "closed", state, allowed: true, level: state.level, editor: false };
  return { mode: "closed", state, allowed: false, level: null, editor: false };
}
