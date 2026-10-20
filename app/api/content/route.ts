import { defaultPortiaContent } from "@/lib/portia-content";
import { normalizePortiaContent } from "@/lib/portia-content-normalize";
import { createPublicSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { contentCacheTag, noStoreHeaders, publicCacheHeaders, purgeCacheTag } from "@/lib/portia-cdn";
import { parseJsonObject } from "@/lib/request-json";

export const dynamic = "force-dynamic";

type ContentRow = { payload: unknown; revision: number; updated_at: string };

// Identical for every visitor, so the CDN serves it; each save purges the cache.
// Who may edit comes from /api/access.
export async function GET() {
  const { data: row, error } = await createPublicSupabaseClient()
    .from("portia_content")
    .select("payload, revision, updated_at")
    .eq("id", "main")
    .maybeSingle<ContentRow>();
  if (error) {
    // The CDN keeps serving its last good copy and browsers keep their own.
    console.error("PORTIA content read failed", error);
    return Response.json({ error: "База временно недоступна." }, { status: 503, headers: noStoreHeaders });
  }

  return Response.json({
    content: (row?.payload ? normalizePortiaContent(row.payload) : null) ?? defaultPortiaContent,
    revision: row?.revision ?? 0,
    updatedAt: row?.updated_at ?? null,
  }, { headers: publicCacheHeaders(contentCacheTag, 300) });
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    const access = await getEditorAccess(supabase, user);
    if (!user || !access.canEdit) {
      return Response.json({ error: "У вас нет доступа к редактору." }, { status: 403 });
    }

    const raw = await request.text();
    if (raw.length > 2_000_000) return Response.json({ error: "Данные слишком большие." }, { status: 413 });
    const body = parseJsonObject(raw);
    if (!body) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    const normalized = normalizePortiaContent(body.content);
    const baseRevision = typeof body.revision === "number" && Number.isInteger(body.revision) && body.revision >= 0 ? body.revision : null;
    if (!normalized || baseRevision === null) {
      return Response.json({ error: "Некорректная структура данных." }, { status: 400 });
    }

    // Save only if nobody else saved since this editor loaded the content; otherwise
    // the older copy would silently overwrite the other editor's work.
    const row = { payload: normalized, revision: baseRevision + 1, updated_at: new Date().toISOString(), updated_by: user.id };
    const { data: saved, error: saveError } = baseRevision === 0
      ? await supabase.from("portia_content").insert({ id: "main", ...row })
          .select("revision, updated_at").maybeSingle<{ revision: number; updated_at: string }>()
      : await supabase.from("portia_content").update(row).eq("id", "main").eq("revision", baseRevision)
          .select("revision, updated_at").maybeSingle<{ revision: number; updated_at: string }>();
    if (!saved && (!saveError || saveError.code === "23505")) {
      return Response.json({ error: "Пока вы редактировали, кто-то другой сохранил изменения. Скопируйте свои правки и обновите страницу." }, { status: 409 });
    }
    if (saveError || !saved) throw saveError;

    await purgeCacheTag(contentCacheTag);

    return Response.json({ ok: true, revision: saved.revision, updatedAt: saved.updated_at }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA content save failed", error);
    return Response.json({ error: "Не удалось сохранить изменения." }, { status: 500 });
  }
}
