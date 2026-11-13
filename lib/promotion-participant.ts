import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { currentAccessHash } from "./access-identity.ts";
import { accessSessionSecret } from "./access-session.ts";
import { resolveAccess, resolveEditorRequest } from "./access-store.ts";
import { getEditorAccess } from "./editor-access.ts";
import { createServerSupabaseClient } from "./supabase/server.ts";

export type PromotionParticipant =
  | { status: "approved"; nickname: string; accessHash: string; client: SupabaseClient; editor: boolean }
  | { status: "unapproved"; state: "none" | "pending" | "rejected" | "revoked"; editor: boolean }
  | { status: "unavailable" };

export async function resolvePromotionParticipant(headers: Headers): Promise<PromotionParticipant> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (isAuthRetryableFetchError(error)) return { status: "unavailable" };
  const editorAccess = await getEditorAccess(client, data.user);
  if (editorAccess.unavailable) return { status: "unavailable" };
  const editor = editorAccess.canEdit;
  const accessHash = currentAccessHash(headers, accessSessionSecret());
  if (!accessHash) return { status: "unapproved", state: "none", editor };
  const state = editor ? await resolveEditorRequest(client, accessHash) : await resolveAccess(client, accessHash);
  if (state.state !== "approved" || state.origin !== "sheet") {
    return { status: "unapproved", state: state.state === "approved" ? "none" : state.state, editor };
  }
  return { status: "approved", nickname: state.nickname, accessHash, client, editor };
}

export function promotionParticipantResponse(participant: Exclude<PromotionParticipant, { status: "approved" }>) {
  if (participant.status === "unavailable") {
    return Response.json({ code: "access-unavailable", error: "Проверка доступа временно недоступна. Повторите позже." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ code: "access-required", accessState: participant.state, editor: participant.editor,
    error: participant.editor ? "Для участия нужна собственная одобренная заявка из таблицы." : "Для участия нужна одобренная заявка с этого устройства." },
  { status: 403, headers: { "Cache-Control": "no-store" } });
}
