import {
  type Broadcast,
  classificationOptions,
  type InfoBlock,
  type InfoSection,
  type InfoSubsection,
  createVirusRecycleFiles,
  defaultPortiaContent,
  type PortiaContent,
  type RecycleFile,
  type RichTextDocument,
  type RichTextStyle,
  type Virus,
} from "./portia-content.ts";
import { MAX_SCIENTIST_LOGS } from "./content-limits.ts";

// Every save and every cached read passes through here: unknown input in, a complete PortiaContent out.
// It coerces shape and never cuts or drops user content (D-01); the limits in content-limits.ts only drive editor warnings.
// Kept on purpose: media links at 2048 characters, formatted-text keys over 240 characters, scientist logs at MAX_SCIENTIST_LOGS.
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

  const runs = (value as RichTextDocument).runs.flatMap((run) => {
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
    return [{ text: run.text, ...(Object.keys(style).length ? { style } : {}) }];
  });

  return { runs };
}

function normalizeFormattedText(value: unknown): Record<string, RichTextDocument> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
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

// Text slots only ever hold text: a number or boolean becomes its text, anything else "" (D-20, never an object in a text slot).
const textOf = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "");
const asText = (value: unknown) => (typeof value === "string" ? value : "");
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

const realId = (value: unknown) => {
  const id = textOf(value);
  return id.trim() ? id : "";
};
const claimIds = (items: Record<string, unknown>[], taken: Set<string>) => {
  for (const item of items) {
    const id = realId(item.id);
    if (id) taken.add(id);
  }
};
// D-21: a blank id becomes `${prefix}-${position}`, stable across polls because it depends on position only; never ':' because formatted keys split on it.
function deriveIds(items: Record<string, unknown>[], prefix: string, taken: Set<string>): string[] {
  return items.map((item, index) => {
    const id = realId(item.id);
    if (id) return id;
    let derived = `${prefix}-${index}`;
    for (let n = 2; taken.has(derived); n += 1) derived = `${prefix}-${index}-${n}`;
    taken.add(derived);
    return derived;
  });
}

// Broadcasts saved before 03.2 have no important flag, dates or conditions.
export function normalizeBroadcasts(value: unknown): Broadcast[] {
  if (!Array.isArray(value)) return [];
  const items = value.filter(isRecord);
  const taken = new Set<string>();
  claimIds(items, taken);
  const ids = deriveIds(items, "broadcast", taken);
  return items.map((item, index) => {
    const type = item.type === "quest" || item.type === "task" ? item.type : "news";
    return {
      ...item,
      id: ids[index],
      type,
      title: textOf(item.title),
      body: textOf(item.body),
      published: item.published === true,
      // D-19: only news can be important.
      important: type === "news" && item.important === true,
      startsAt: normalizeDay(item.startsAt),
      endsAt: normalizeDay(item.endsAt),
      conditions: typeof item.conditions === "string" ? item.conditions : "",
    };
  });
}

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
      return [{ id, type: "text", text: asText(value.text) }];
    case "table": {
      // Stable row ids let the editor's ≡ keep a row's identity (EDIT-07); a positional fallback is stable across polls (D-21).
      const seen = new Set<string>();
      return [{
        id,
        type: "table",
        rows: (Array.isArray(value.rows) ? value.rows : []).filter(isRecord).map((row, rowIndex) => {
          const rowId = typeof row.id === "string" && row.id && !seen.has(row.id) ? row.id : `${id}-row-${rowIndex}`;
          seen.add(rowId);
          return { id: rowId, key: asText(row.key), value: asText(row.value) };
        }),
      }];
    }
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
  const blocks = (Array.isArray(value.blocks) ? value.blocks : [])
    .flatMap((block, blockIndex) => normalizeInfoBlock(block, id, blockIndex));
  return [{ id, title: asText(value.title), blocks }];
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
      subsections: (Array.isArray(item.subsections) ? item.subsections : [])
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

  const normalizeVirus = (virus: Record<string, unknown>, id: string): Virus => {
    const ppu = isRecord(virus.ppu) ? virus.ppu : {};
    const classification = isRecord(virus.classification) ? virus.classification : {};
    return {
      ...virus,
      id,
      code: textOf(virus.code),
      name: textOf(virus.name),
      status: textOf(virus.status),
      external: textOf(virus.external),
      physiology: textOf(virus.physiology),
      ppu: { health: textOf(ppu.health), speed: textOf(ppu.speed), abilities: textOf(ppu.abilities) },
      classification: Object.fromEntries(
        Object.keys(classificationOptions).map((key) => [key, textOf(classification[key])]),
      ) as Virus["classification"],
      infectedImage: normalizeMediaUrl(virus.infectedImage),
      mutations: Array.isArray(virus.mutations)
        ? virus.mutations.map((item) => {
            const mutation = isRecord(item) ? item : {};
            return { ...mutation, name: textOf(mutation.name), description: textOf(mutation.description), image: normalizeMediaUrl(mutation.image) };
          })
        : [],
      scientistLogs: Array.isArray(virus.scientistLogs)
        ? virus.scientistLogs.slice(0, MAX_SCIENTIST_LOGS).map((item) => {
            const log = isRecord(item) ? item : {};
            return {
              ...log,
              id: textOf(log.id),
              title: textOf(log.title),
              scientist: textOf(log.scientist),
              lockedLevel: typeof log.lockedLevel === "number" && Number.isFinite(log.lockedLevel) ? log.lockedLevel : 3,
              content: Array.isArray(log.content) ? log.content.filter((paragraph): paragraph is string => typeof paragraph === "string") : [],
              richContent: normalizeRichText(log.richContent),
            };
          })
        : [],
    };
  };
  // One id set spans both lists: they share the `virus:<id>:` formatting namespace and recycleOrder.
  const rawViruses = candidate.viruses.filter(isRecord);
  const rawRecycled = (Array.isArray(candidate.recycledViruses) ? candidate.recycledViruses : []).filter(isRecord);
  const takenIds = new Set<string>();
  claimIds(rawViruses, takenIds);
  claimIds(rawRecycled, takenIds);
  const virusIds = deriveIds(rawViruses, "virus", takenIds);
  const recycledIds = deriveIds(rawRecycled, "recycled", takenIds);
  const viruses = rawViruses.map((virus, index) => normalizeVirus(virus, virusIds[index]));
  const recycledViruses = rawRecycled.map((virus, index) => normalizeVirus(virus, recycledIds[index]));
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
