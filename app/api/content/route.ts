import { defaultPortiaContent } from "@/lib/portia-content";
import { normalizePortiaContent } from "@/lib/portia-content-normalize";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { readPortiaContentSnapshot, writePortiaContentSnapshot } from "@/lib/portia-content-cache";

export const dynamic = "force-dynamic";

type ContentRow = { payload: unknown; revision: number; updated_at: string };

const contentReadTimeoutMs = 4_500;

function withTimeout<T>(promise: PromiseLike<T>, milliseconds: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const authPromise = withTimeout(supabase.auth.getUser(), 2_500, "Supabase auth").catch(() => null);
    const { data: row, error } = await withTimeout(
      supabase
        .from("portia_content")
        .select("payload, revision, updated_at")
        .eq("id", "main")
        .maybeSingle<ContentRow>(),
      contentReadTimeoutMs,
      "Supabase content",
    );
    if (error) throw error;
    const authResult = await authPromise;
    const access = authResult?.data.user
      ? await withTimeout(getEditorAccess(supabase, authResult.data.user), 2_000, "Editor access").catch(() => ({ canEdit: false, canManageEditors: false }))
      : { canEdit: false, canManageEditors: false };

    let content = defaultPortiaContent;
    if (row?.payload) {
      const normalized = normalizePortiaContent(row.payload);
      if (normalized) content = normalized;
    }

    return Response.json({
      content,
      canEdit: access.canEdit,
      canManageEditors: access.canManageEditors,
      revision: row?.revision ?? 0,
      updatedAt: row?.updated_at ?? null,
      degraded: false,
      source: "supabase",
    });
  } catch (error) {
    console.error("PORTIA content read failed", error);
    const snapshot = await readPortiaContentSnapshot();
    const normalizedSnapshot = snapshot ? normalizePortiaContent(snapshot.content) : null;
    if (snapshot && normalizedSnapshot) {
      return Response.json({
        content: normalizedSnapshot,
        canEdit: false,
        canManageEditors: false,
        revision: snapshot.revision,
        updatedAt: snapshot.updatedAt,
        cachedAt: snapshot.cachedAt,
        degraded: true,
        source: "netlify-cache",
      }, { status: 200 });
    }
    return Response.json(
      { content: defaultPortiaContent, canEdit: false, canManageEditors: false, revision: 0, updatedAt: null, degraded: true, source: "bundled-default" },
      { status: 200 },
    );
  }
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
    const body = JSON.parse(raw) as { content?: unknown; revision?: unknown };
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

    await writePortiaContentSnapshot({
      content: normalized,
      revision: saved.revision,
      updatedAt: saved.updated_at,
      cachedAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, revision: saved.revision, updatedAt: saved.updated_at });
  } catch (error) {
    console.error("PORTIA content save failed", error);
    return Response.json({ error: "Не удалось сохранить изменения." }, { status: 500 });
  }
}
