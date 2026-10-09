import { defaultPortiaContent, type PortiaContent } from "@/lib/portia-content";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ContentRow = { payload: unknown; revision: number; updated_at: string };

function isOwnerEmail(email: string | undefined | null) {
  const ownerEmail = process.env.PORTIA_OWNER_EMAIL?.trim().toLocaleLowerCase("en-US");
  return Boolean(ownerEmail && email?.trim().toLocaleLowerCase("en-US") === ownerEmail);
}

function normalizePortiaContent(value: unknown): PortiaContent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PortiaContent>;
  if (
    !Array.isArray(candidate.viruses) ||
    !Array.isArray(candidate.infoSections) ||
    !Array.isArray(candidate.broadcasts) ||
    !Array.isArray(candidate.searchRecommendations)
  ) return null;

  return {
    viruses: candidate.viruses,
    infoSections: candidate.infoSections,
    broadcasts: candidate.broadcasts,
    searchRecommendations: candidate.searchRecommendations.filter((item): item is string => typeof item === "string"),
    assistantAdvice: Array.isArray(candidate.assistantAdvice)
      ? candidate.assistantAdvice.filter((item): item is string => typeof item === "string")
      : [...defaultPortiaContent.assistantAdvice],
  };
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const [{ data: authData }, { data: row, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("portia_content")
        .select("payload, revision, updated_at")
        .eq("id", "main")
        .maybeSingle<ContentRow>(),
    ]);
    if (error) throw error;

    let content = defaultPortiaContent;
    if (row?.payload) {
      const normalized = normalizePortiaContent(row.payload);
      if (normalized) content = normalized;
    }

    return Response.json({
      content,
      canEdit: isOwnerEmail(authData.user?.email),
      revision: row?.revision ?? 0,
      updatedAt: row?.updated_at ?? null,
    });
  } catch (error) {
    console.error("PORTIA content read failed", error);
    return Response.json(
      { content: defaultPortiaContent, canEdit: false, revision: 0, updatedAt: null, degraded: true },
      { status: 200 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user || !isOwnerEmail(user.email)) {
      return Response.json({ error: "Редактирование доступно только владельцу." }, { status: 403 });
    }

    const raw = await request.text();
    if (raw.length > 2_000_000) return Response.json({ error: "Данные слишком большие." }, { status: 413 });
    const body = JSON.parse(raw) as { content?: unknown };
    const normalized = normalizePortiaContent(body.content);
    if (!normalized) {
      return Response.json({ error: "Некорректная структура данных." }, { status: 400 });
    }

    const { data: previous, error: readError } = await supabase
      .from("portia_content")
      .select("revision")
      .eq("id", "main")
      .maybeSingle<{ revision: number }>();
    if (readError) throw readError;

    const now = new Date().toISOString();
    const revision = (previous?.revision ?? 0) + 1;
    const { data: saved, error: saveError } = await supabase
      .from("portia_content")
      .upsert({
        id: "main",
        payload: normalized,
        revision,
        updated_at: now,
        updated_by: user.id,
      })
      .select("revision, updated_at")
      .single<{ revision: number; updated_at: string }>();
    if (saveError) throw saveError;

    return Response.json({ ok: true, revision: saved.revision, updatedAt: saved.updated_at });
  } catch (error) {
    console.error("PORTIA content save failed", error);
    return Response.json({ error: "Не удалось сохранить изменения." }, { status: 500 });
  }
}
