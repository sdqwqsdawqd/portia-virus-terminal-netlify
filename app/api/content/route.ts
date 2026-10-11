import {
  createVirusRecycleFiles,
  defaultPortiaContent,
  type PortiaContent,
  type RecycleFile,
  type RichTextDocument,
  type RichTextStyle,
} from "@/lib/portia-content";
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

function normalizeRecycleFiles(value: unknown, viruses: PortiaContent["viruses"]): RecycleFile[] {
  if (!Array.isArray(value)) return createVirusRecycleFiles(viruses);

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const file = item as Partial<RecycleFile>;
    if (
      typeof file.id !== "string" ||
      typeof file.name !== "string" ||
      !["virus", "text", "image"].includes(file.kind ?? "")
    ) return [];

    return [{
      id: file.id,
      name: file.name,
      location: typeof file.location === "string" ? file.location : "C:\\PORTIA\\RECYCLE_BIN",
      kind: file.kind as RecycleFile["kind"],
      content: typeof file.content === "string" ? file.content : "",
      image: normalizeMediaUrl(file.image),
      virusId: typeof file.virusId === "string" ? file.virusId : "",
    }];
  });
}

function normalizeHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}

function normalizeRichText(value: unknown): RichTextDocument | undefined {
  if (!value || typeof value !== "object" || !Array.isArray((value as RichTextDocument).runs)) return undefined;

  const runs = (value as RichTextDocument).runs.slice(0, 500).flatMap((run) => {
    if (!run || typeof run !== "object" || typeof run.text !== "string") return [];
    const rawStyle = run.style && typeof run.style === "object" ? run.style : {};
    const style: RichTextStyle = {};
    const color = normalizeHexColor(rawStyle.color);
    const backgroundColor = normalizeHexColor(rawStyle.backgroundColor);
    if (color) style.color = color;
    if (backgroundColor) style.backgroundColor = backgroundColor;
    if (typeof rawStyle.fontSize === "number" && Number.isFinite(rawStyle.fontSize)) style.fontSize = Math.min(48, Math.max(10, Math.round(rawStyle.fontSize)));
    if (typeof rawStyle.fontWeight === "number" && [400, 500, 600, 700, 800, 900].includes(rawStyle.fontWeight)) style.fontWeight = rawStyle.fontWeight;
    if (typeof rawStyle.backgroundOpacity === "number" && Number.isFinite(rawStyle.backgroundOpacity)) style.backgroundOpacity = Math.min(1, Math.max(0, rawStyle.backgroundOpacity));
    return [{ text: run.text.slice(0, 100_000), ...(Object.keys(style).length ? { style } : {}) }];
  });

  return { runs };
}

function normalizeFormattedText(value: unknown): Record<string, RichTextDocument> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 1000)
      .flatMap(([key, document]) => {
        if (!key || key.length > 240) return [];
        const normalized = normalizeRichText(document);
        return normalized ? [[key, normalized] as const] : [];
      }),
  );
}

function normalizeMediaUrl(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const url = value.trim().slice(0, 2048);
  return url.startsWith("https://") || url.startsWith("/") ? url : fallback;
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

  const viruses = candidate.viruses.map((virus) => ({
    ...virus,
    infectedImage: normalizeMediaUrl(virus.infectedImage),
    mutations: Array.isArray(virus.mutations)
      ? virus.mutations.map((mutation) => ({ ...mutation, image: normalizeMediaUrl(mutation.image) }))
      : [],
    scientistLogs: Array.isArray(virus.scientistLogs)
      ? virus.scientistLogs.slice(0, 5).map((log) => ({
          ...log,
          content: Array.isArray(log.content) ? log.content.filter((paragraph): paragraph is string => typeof paragraph === "string") : [],
          richContent: normalizeRichText(log.richContent),
        }))
      : [],
  }));
  const assistantOffendedPhrases = Array.isArray(candidate.assistantOffendedPhrases)
    ? candidate.assistantOffendedPhrases.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : typeof candidate.assistantOffendedPhrase === "string" && candidate.assistantOffendedPhrase.trim()
      ? [candidate.assistantOffendedPhrase]
      : [...defaultPortiaContent.assistantOffendedPhrases];
  if (!assistantOffendedPhrases.length) assistantOffendedPhrases.push(...defaultPortiaContent.assistantOffendedPhrases);

  const assistantPatienceVariants = Array.isArray(candidate.assistantPatienceVariants)
    ? candidate.assistantPatienceVariants
        .filter((item): item is number => typeof item === "number" && Number.isFinite(item))
        .map((item) => Math.min(60, Math.max(1, Math.round(item))))
    : typeof candidate.assistantPatienceSeconds === "number" && Number.isFinite(candidate.assistantPatienceSeconds)
      ? [Math.min(60, Math.max(1, Math.round(candidate.assistantPatienceSeconds)))]
      : [...defaultPortiaContent.assistantPatienceVariants];
  if (!assistantPatienceVariants.length) assistantPatienceVariants.push(...defaultPortiaContent.assistantPatienceVariants);

  const assistantIdlePhrases = Array.isArray(candidate.assistantIdlePhrases)
    ? candidate.assistantIdlePhrases.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [...defaultPortiaContent.assistantIdlePhrases];
  if (!assistantIdlePhrases.length) assistantIdlePhrases.push(...defaultPortiaContent.assistantIdlePhrases);

  const assistantActivityPhrases = Array.isArray(candidate.assistantActivityPhrases)
    ? candidate.assistantActivityPhrases.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [...defaultPortiaContent.assistantActivityPhrases];
  if (!assistantActivityPhrases.length) assistantActivityPhrases.push(...defaultPortiaContent.assistantActivityPhrases);

  const clampAutoSeconds = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value)
    ? Math.min(3600, Math.max(1, Math.round(value)))
    : fallback;
  const assistantAutoIntervalSeconds = clampAutoSeconds(candidate.assistantAutoIntervalSeconds, defaultPortiaContent.assistantAutoIntervalSeconds);
  let assistantAutoMinSeconds = clampAutoSeconds(candidate.assistantAutoMinSeconds, defaultPortiaContent.assistantAutoMinSeconds);
  let assistantAutoMaxSeconds = clampAutoSeconds(candidate.assistantAutoMaxSeconds, defaultPortiaContent.assistantAutoMaxSeconds);
  if (assistantAutoMinSeconds > assistantAutoMaxSeconds) {
    [assistantAutoMinSeconds, assistantAutoMaxSeconds] = [assistantAutoMaxSeconds, assistantAutoMinSeconds];
  }

  return {
    viruses,
    infoSections: candidate.infoSections,
    broadcasts: candidate.broadcasts,
    recycleFiles: normalizeRecycleFiles(candidate.recycleFiles, viruses),
    searchRecommendations: candidate.searchRecommendations.filter((item): item is string => typeof item === "string"),
    assistantAdvice: Array.isArray(candidate.assistantAdvice)
      ? candidate.assistantAdvice.filter((item): item is string => typeof item === "string")
      : [...defaultPortiaContent.assistantAdvice],
    assistantOffendedPhrase: typeof candidate.assistantOffendedPhrase === "string"
      ? candidate.assistantOffendedPhrase
      : defaultPortiaContent.assistantOffendedPhrase,
    assistantOffendedPhrases,
    assistantPatienceSeconds: typeof candidate.assistantPatienceSeconds === "number" && Number.isFinite(candidate.assistantPatienceSeconds)
      ? Math.min(60, Math.max(1, Math.round(candidate.assistantPatienceSeconds)))
      : defaultPortiaContent.assistantPatienceSeconds,
    assistantPatienceVariants,
    assistantIdlePhrases,
    assistantActivityPhrases,
    assistantAutoTimingMode: candidate.assistantAutoTimingMode === "fixed" || candidate.assistantAutoTimingMode === "random"
      ? candidate.assistantAutoTimingMode
      : defaultPortiaContent.assistantAutoTimingMode,
    assistantAutoIntervalSeconds,
    assistantAutoMinSeconds,
    assistantAutoMaxSeconds,
    formattedText: normalizeFormattedText(candidate.formattedText),
  };
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
