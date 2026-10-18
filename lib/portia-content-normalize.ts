import {
  type Broadcast,
  type InfoBlock,
  type InfoSection,
  type InfoSubsection,
  createVirusRecycleFiles,
  defaultPortiaContent,
  type PortiaContent,
  type RecycleFile,
  type RichTextDocument,
  type RichTextStyle,
} from "./portia-content.ts";

// Every save and every cached read passes through here: unknown input in, a complete PortiaContent out.
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

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const normalizeDay = (value: unknown) => (typeof value === "string" && dayPattern.test(value) ? value : "");

// Broadcasts saved before 03.2 have no important flag, dates or conditions.
export function normalizeBroadcasts(value: unknown): Broadcast[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Broadcast => Boolean(item) && typeof item === "object")
    .map((item) => ({
      ...item,
      important: item.important === true,
      startsAt: normalizeDay(item.startsAt),
      endsAt: normalizeDay(item.endsAt),
      conditions: typeof item.conditions === "string" ? item.conditions.slice(0, 4000) : "",
    }));
}

const asText = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

const youtubeIdPattern = /^[\w-]{11}$/;
const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);

// Only a YouTube link yields an id; anything else is "" so no typed URL can reach the player iframe (D-09).
export function parseYoutubeId(value: unknown): string {
  if (typeof value !== "string") return "";
  let url: URL;
  try { url = new URL(value.trim()); } catch { return ""; }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !youtubeHosts.has(url.hostname)) return "";
  const [first = "", second = ""] = url.pathname.split("/").filter(Boolean);
  const id = url.hostname === "youtu.be" ? first
    : first === "watch" ? url.searchParams.get("v") ?? ""
    : first === "embed" || first === "shorts" ? second
    : "";
  return youtubeIdPattern.test(id) ? id : "";
}

function normalizeInfoBlock(value: unknown, subsectionId: string, index: number): InfoBlock[] {
  if (!isRecord(value)) return [];
  const id = typeof value.id === "string" && value.id ? value.id : `${subsectionId}-block-${index}`;
  switch (value.type) {
    case "text":
      return [{ id, type: "text", text: asText(value.text, 20_000) }];
    case "table":
      return [{
        id,
        type: "table",
        rows: (Array.isArray(value.rows) ? value.rows : []).filter(isRecord).slice(0, 100)
          .map((row) => ({ key: asText(row.key, 500), value: asText(row.value, 500) })),
      }];
    case "photo":
      return [{ id, type: "photo", url: normalizeMediaUrl(value.url) }];
    case "video":
      return [{ id, type: "video", videoId: typeof value.videoId === "string" && youtubeIdPattern.test(value.videoId) ? value.videoId : "" }];
    default:
      return [];
  }
}

function normalizeInfoSubsection(value: unknown, sectionId: string, index: number): InfoSubsection[] {
  if (!isRecord(value)) return [];
  const id = typeof value.id === "string" && value.id ? value.id : `${sectionId}-sub-${index}`;
  const blocks = (Array.isArray(value.blocks) ? value.blocks : []).slice(0, 100)
    .flatMap((block, blockIndex) => normalizeInfoBlock(block, id, blockIndex));
  return [{ id, title: asText(value.title, 300), blocks }];
}

// Sections saved before 03.3 have no subsections (D-12); title and body keep today's behaviour, never cut.
export function normalizeInfoSections(value: unknown): InfoSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const id = typeof item.id === "string" && item.id ? item.id : `info-${index}`;
    return [{
      id,
      title: typeof item.title === "string" ? item.title : "",
      body: typeof item.body === "string" ? item.body : "",
      subsections: (Array.isArray(item.subsections) ? item.subsections : []).slice(0, 50)
        .flatMap((sub, subIndex) => normalizeInfoSubsection(sub, id, subIndex)),
    }];
  });
}

export function normalizePortiaContent(value: unknown): PortiaContent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PortiaContent>;
  if (
    !Array.isArray(candidate.viruses) ||
    !Array.isArray(candidate.infoSections) ||
    !Array.isArray(candidate.broadcasts) ||
    !Array.isArray(candidate.searchRecommendations)
  ) return null;

  const normalizeVirus = (virus: PortiaContent["viruses"][number]) => ({
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
  });
  const viruses = candidate.viruses.map(normalizeVirus);
  const recycledViruses = Array.isArray(candidate.recycledViruses)
    ? candidate.recycledViruses.map(normalizeVirus)
    : [];
  const recycleFiles = normalizeRecycleFiles(candidate.recycleFiles, viruses);
  const validRecycleKeys = new Set([
    ...recycleFiles.map((file) => `file:${file.id}`),
    ...recycledViruses.map((virus) => `virus:${virus.id}`),
  ]);
  const requestedRecycleOrder = Array.isArray(candidate.recycleOrder)
    ? candidate.recycleOrder.filter((key): key is string => typeof key === "string" && validRecycleKeys.has(key))
    : [];
  const recycleOrder = [...new Set([
    ...requestedRecycleOrder,
    ...recycleFiles.map((file) => `file:${file.id}`),
    ...recycledViruses.map((virus) => `virus:${virus.id}`),
  ])];
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
    recycledViruses,
    infoSections: normalizeInfoSections(candidate.infoSections),
    broadcasts: normalizeBroadcasts(candidate.broadcasts),
    recycleFiles,
    recycleOrder,
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
    assistantIdleEnabled: typeof candidate.assistantIdleEnabled === "boolean" ? candidate.assistantIdleEnabled : true,
    assistantActivityEnabled: typeof candidate.assistantActivityEnabled === "boolean" ? candidate.assistantActivityEnabled : true,
    assistantAutoTimingMode: candidate.assistantAutoTimingMode === "fixed" || candidate.assistantAutoTimingMode === "random"
      ? candidate.assistantAutoTimingMode
      : defaultPortiaContent.assistantAutoTimingMode,
    assistantAutoIntervalSeconds,
    assistantAutoMinSeconds,
    assistantAutoMaxSeconds,
    formattedText: normalizeFormattedText(candidate.formattedText),
  };
}
