import { createHmac } from "node:crypto";
import { accessSubmitSecret } from "./access-session.ts";
import type { AccessRpcClient } from "./access-store.ts";
import type { ContentRow } from "./content-response.ts";
import type { Viewer } from "./access-viewer.ts";

// Server-signed reads (Phase 25, SEC-01). After the contract migration the tables no longer answer the public key, so a
// visitor's content and roster come from SECURITY DEFINER functions that answer only a call the site server signed. The
// secret is the one that already signs access requests (PORTIA_ACCESS_SUBMIT_SECRET, row 'submit' in portia_access_secrets);
// the message label tells the scopes and the request signature apart ("access-submit-v1|..."), so one signature never opens
// another door. An editor reads with the session of the caller and needs no signature (portia_can_edit() in the function).
// Server only: it reaches node:crypto through the secret helper, so client code must not import it. The Supabase clients are
// passed in, which keeps this module importable without next/headers. lib/server-read.test.ts pins labels, window and
// grants to supabase/migrations/20261115000000_portia_server_read_expand.sql (offline, text only).

export const serverReadRpc = {
  content: "portia_content_read",
  employees: "portia_employees_read",
} as const;

export type ServerReadScope = keyof typeof serverReadRpc;

export function serverReadMessage(scope: ServerReadScope, issuedAt: number) {
  return `${scope}-read-v1|${issuedAt}`;
}

const secretMinLength = 32;

export function signServerRead(scope: ServerReadScope, issuedAt: number, secret: string) {
  if (secret.length < secretMinLength) throw new Error(`Server read secret must contain at least ${secretMinLength} characters.`);
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) throw new Error("Invalid issuedAt time.");
  return createHmac("sha256", secret).update(serverReadMessage(scope, issuedAt)).digest("hex");
}

// "unauthorized": the function refused the call. "unavailable": no secret, a client error or a reply of an unknown shape.
// Either way the caller answers 503 and logs the kind only: never a secret, a signature or the text of the error.
export class ServerReadError extends Error {
  readonly kind: "unauthorized" | "unavailable";

  constructor(kind: "unauthorized" | "unavailable") {
    super(`Server read failed: ${kind}`);
    this.name = "ServerReadError";
    this.kind = kind;
  }
}

export type ServerReadClients = {
  session: AccessRpcClient;
  anonymous: () => AccessRpcClient;
};

export type ServerReadOptions = {
  secret?: () => string;
  now?: () => number;
};

async function callServerRead(
  scope: ServerReadScope,
  viewer: Viewer,
  clients: ServerReadClients,
  options: ServerReadOptions,
): Promise<Record<string, unknown>> {
  let reply: Awaited<ReturnType<AccessRpcClient["rpc"]>>;
  try {
    if (viewer.editor) {
      // The function lets an editor through by portia_can_edit(): no signature, and no secret is read here.
      reply = await clients.session.rpc(serverReadRpc[scope], { p_issued_at: 0, p_signature: "" });
    } else {
      const issuedAt = Math.floor((options.now ?? Date.now)() / 1000);
      const signature = signServerRead(scope, issuedAt, (options.secret ?? accessSubmitSecret)());
      reply = await clients.anonymous().rpc(serverReadRpc[scope], { p_issued_at: issuedAt, p_signature: signature });
    }
  } catch {
    // A missing or short secret, an unreachable client: the caller sees one neutral kind and no text.
    throw new ServerReadError("unavailable");
  }
  if (reply.error) throw new ServerReadError("unavailable");
  const data = reply.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new ServerReadError("unavailable");
  const body = data as Record<string, unknown>;
  if (body.code === "unauthorized") throw new ServerReadError("unauthorized");
  if (body.code !== "ok") throw new ServerReadError("unavailable");
  return body;
}

// The content row as the table read gave it: { payload, revision, updated_at }, or null when no row is stored yet.
export async function readContentRow(viewer: Viewer, clients: ServerReadClients, options: ServerReadOptions = {}): Promise<ContentRow> {
  const body = await callServerRead("content", viewer, clients, options);
  const row = body.row;
  if (row === null) return null;
  if (typeof row !== "object" || Array.isArray(row)) throw new ServerReadError("unavailable");
  const { payload, revision, updated_at: updatedAt } = row as Record<string, unknown>;
  if (typeof revision !== "number" || !Number.isInteger(revision) || typeof updatedAt !== "string") throw new ServerReadError("unavailable");
  return { payload, revision, updated_at: updatedAt };
}

export type EmployeeRows = { profiles: unknown[]; manual: unknown[] };

function recordsOnly(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) throw new ServerReadError("unavailable");
    return row as Record<string, unknown>;
  });
}

// The stored profiles and the manual employees as the table reads gave them. The function already leaves updated_by out; it is
// dropped here again so a changed function can never hand an editor's user id to a visitor. An empty list is a healthy answer.
export async function readEmployeeRows(viewer: Viewer, clients: ServerReadClients, options: ServerReadOptions = {}): Promise<EmployeeRows> {
  const body = await callServerRead("employees", viewer, clients, options);
  if (!Array.isArray(body.profiles) || !Array.isArray(body.manual)) throw new ServerReadError("unavailable");
  const profiles = recordsOnly(body.profiles).map((row) => {
    const copy = { ...row };
    delete copy.updated_by;
    return copy;
  });
  return { profiles, manual: recordsOnly(body.manual) };
}
