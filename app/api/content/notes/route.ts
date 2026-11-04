import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { MAX_CONTENT_BODY_BYTES, utf8Bytes } from "@/lib/content-limits";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { MAX_NOTES_BODY_BYTES, NOTES_TABS, isMissingNotesTable, normalizeNotesMap, notesPayloadForTabs, notesPutRefusal } from "@/lib/editor-notes";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { parseJsonObject } from "@/lib/request-json";

export const dynamic = "force-dynamic";

// D-47: editor notes are private. They are read and written with the signed-in user's client, so the RLS policies of
// portia_editor_notes (portia_can_edit_tab) apply, and the route filters by the editor's open tabs as well.
// Every answer is no-store: nothing here may sit in a CDN or a browser cache shared with visitors.

const denied = { error: "У вас нет доступа к редактору." };
const unavailable = { error: "Заметки временно недоступны." };
const conflict = { error: "Заметки этой вкладки изменил другой редактор. Загрузите их и повторите." };
const failed = { error: "Не удалось сохранить заметки." };

type NotesRow = { tab: string; notes: unknown; revision: number };

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: noStoreHeaders });

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (isAuthRetryableFetchError(authError)) return reply({ error: "Проверка доступа временно недоступна." }, 503);
    const access = await getEditorAccess(supabase, authData.user);
    if (access.unavailable) return reply({ error: "Проверка доступа временно недоступна." }, 503);
    if (!authData.user || !access.canEdit) return reply(denied, 403);

    const openNotesTabs = NOTES_TABS.filter((tab) => access.openTabs.includes(tab));
    if (!openNotesTabs.length) return reply({ notes: {}, revisions: {} });

    const { data, error } = await supabase.from("portia_editor_notes").select("tab, notes, revision").in("tab", openNotesTabs).returns<NotesRow[]>();
    if (error) {
      if (isMissingNotesTable(error)) return reply(unavailable, 503);
      throw error;
    }
    return reply(notesPayloadForTabs(data ?? [], access.openTabs));
  } catch (error) {
    console.error("PORTIA editor notes read failed", error);
    return reply(unavailable, 503);
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (isAuthRetryableFetchError(authError)) return reply({ error: "Проверка доступа временно недоступна." }, 503);
    const user = authData.user;
    const access = await getEditorAccess(supabase, user);
    if (access.unavailable) return reply({ error: "Проверка доступа временно недоступна." }, 503);
    if (!user || !access.canEdit) return reply(denied, 403);

    const raw = await request.text();
    // Bytes, not characters: Cyrillic text is two bytes per character.
    if (utf8Bytes(raw) > Math.min(MAX_NOTES_BODY_BYTES, MAX_CONTENT_BODY_BYTES)) return reply({ error: "Данные слишком большие." }, 413);
    const body = parseJsonObject(raw);
    if (!body) return reply({ error: "Некорректные данные." }, 400);
    const refusal = notesPutRefusal(body, access.openTabs);
    if (refusal) return reply({ error: refusal.error }, refusal.status);

    const tab = body.tab as string;
    const baseRevision = body.revision as number;
    const row = { notes: normalizeNotesMap(body.notes), revision: baseRevision + 1, updated_at: new Date().toISOString(), updated_by: user.id };

    // Save only if nobody else saved since this editor loaded the notes; otherwise the older copy would overwrite theirs.
    const { data: saved, error: saveError } = baseRevision === 0
      ? await supabase.from("portia_editor_notes").insert({ tab, ...row }).select("revision").maybeSingle<{ revision: number }>()
      : await supabase.from("portia_editor_notes").update(row).eq("tab", tab).eq("revision", baseRevision).select("revision").maybeSingle<{ revision: number }>();
    if (saveError && isMissingNotesTable(saveError)) return reply(unavailable, 503);
    if (!saved && (!saveError || saveError.code === "23505")) return reply(conflict, 409);
    if (saveError || !saved) throw saveError;

    return reply({ ok: true, revision: saved.revision });
  } catch (error) {
    console.error("PORTIA editor notes save failed", error);
    return reply(failed, 500);
  }
}
