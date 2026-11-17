import type { AccessLevel } from "./access-levels.ts";
import type { ImageFraming } from "./image-framing.ts";

export type Mutation = {
  name: string;
  description: string;
  image: string;
  // D-63: the visible part of the picture; absent means the whole picture as before.
  imageFraming?: ImageFraming;
};

export type RichTextStyle = {
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
};

export type RichTextRun = {
  text: string;
  style?: RichTextStyle;
};

export type RichTextDocument = {
  runs: RichTextRun[];
};

export type ScientistLog = {
  id: string;
  title: string;
  scientist: string;
  lockedLevel: number;
  content: string[];
  richContent?: RichTextDocument;
  // Phase 24, D-12: set only by the server redaction on a record the visitor may not read (title and scientist stay, the text does not). Never stored.
  withheld?: true;
};

export const classificationOptions = {
  danger: [
    { value: "Гефест", level: 1 },
    { value: "Протей", level: 2 },
    { value: "Апейрон", level: 3 },
  ],
  spread: [
    { value: "Номос", level: 1 },
    { value: "Тезей", level: 2 },
    { value: "Абраксас", level: 3 },
  ],
  transmission: [
    { value: "Воздушно-капельный" },
    { value: "Воздушно-пылевой" },
    { value: "Контактно-бытовой" },
    { value: "Фекально-оральный" },
    { value: "Половой" },
    { value: "Неизвестно" },
  ],
  escapeRisk: [
    { value: "Предупреждение", level: 1 },
    { value: "Риск", level: 2 },
    { value: "Эснов", level: 3 },
  ],
  mind: [
    { value: "Люцидиум", level: 1 },
    { value: "Транзитиум", level: 2 },
    { value: "Обливиум", level: 3 },
  ],
  appearance: [
    { value: "Изоморф", level: 1 },
    { value: "Полиморф", level: 2 },
    { value: "Ксеноморф", level: 3 },
  ],
  behavior: [
    { value: "Стабилар", level: 1 },
    { value: "Импульсар", level: 2 },
    { value: "Инфернар", level: 3 },
  ],
} satisfies Record<keyof Virus["classification"], readonly { value: string; level?: number }[]>;

// D-35 / D-36(а): the old names of the three renamed axes, mapped to the new ones with the same level.
// Saved records may still carry an old name until the SQL rewrite (20-21) runs; reading maps it, saving writes the new name.
export const legacyClassificationNames: Readonly<Record<string, string>> = Object.freeze({
  "Рубедо": "Люцидиум", "Альбедо": "Транзитиум", "Нигредо": "Обливиум",
  "Фобус": "Стабилар", "Ареус": "Импульсар", "Селенус": "Инфернар",
  "Нюктея": "Изоморф", "Морфея": "Полиморф", "Дедалея": "Ксеноморф",
});

// The accent mark U+0301 belongs only to the text of the «Классификация» section (D-37); a class value never keeps it.
// Own keys only (Object.hasOwn), so "__proto__" or "constructor" never resolve to a prototype member; unknown values stay as they are.
export function canonicalClassificationName(value: string): string {
  const plain = value.replace(/́/g, "");
  return Object.hasOwn(legacyClassificationNames, plain) ? legacyClassificationNames[plain] : plain;
}

export function scientistLogPlainText(log: ScientistLog) {
  if (log.richContent?.runs?.length) return log.richContent.runs.map((run) => run.text).join("");
  return log.content.join("\n\n");
}

export type Virus = {
  id: string;
  code: string;
  name: string;
  status: string;
  infectedImage: string;
  infectedImageFraming?: ImageFraming;
  external: string;
  ppu: { health: string; speed: string; abilities: string };
  physiology: string;
  mutations: Mutation[];
  classification: {
    danger: string;
    spread: string;
    transmission: string;
    escapeRisk: string;
    mind: string;
    appearance: string;
    behavior: string;
  };
  scientistLogs: ScientistLog[];
  // Phase 24, D-03: the access level this record needs; no field means level 1.
  level?: AccessLevel;
};

// Guides (03.3 D-06..D-08): a category holds ordered subcategories, each a list of blocks in any order.
export type InfoBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "table"; rows: { id: string; key: string; value: string }[] }
  | { id: string; type: "photo"; url: string; framing?: ImageFraming }
  | { id: string; type: "video"; videoId: string };

export type InfoSubsection = {
  id: string;
  title: string;
  blocks: InfoBlock[];
  level?: AccessLevel;
};

export type InfoSection = {
  id: string;
  title: string;
  body: string;
  subsections: InfoSubsection[];
  level?: AccessLevel;
};

// Resolves a section id or a subsection id to the section (and subsection) it names.
export function findInfo(sections: InfoSection[], id: string): { section: InfoSection; subsection: InfoSubsection | null } | null {
  for (const section of sections) {
    if (section.id === id) return { section, subsection: null };
    const subsection = section.subsections.find((item) => item.id === id);
    if (subsection) return { section, subsection };
  }
  return null;
}

// Справочник (Phase 13 D-01..D-06): a section holds cards, a card is one ribbon of blocks; heading text, captions and the callout label are plain strings, text and callout bodies are formatted.
export type GuideBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "table"; rows: { id: string; key: string; value: string }[] }
  | { id: string; type: "photo"; url: string; caption: string; width?: number; height?: number; align?: "left" | "center" | "right"; focusX?: number; focusY?: number }
  | { id: string; type: "video"; videoId: string }
  | { id: string; type: "callout"; label: string; text: string };

export type GuideCard = {
  id: string;
  title: string;
  cover: string;
  coverFraming?: ImageFraming;
  blocks: GuideBlock[];
  level?: AccessLevel;
};

export type GuideSection = {
  id: string;
  title: string;
  photo: string;
  photoFraming?: ImageFraming;
  cards: GuideCard[];
  level?: AccessLevel;
};

// Resolves a section id or a card id to the section (and card) it names.
export function findGuide(sections: GuideSection[], id: string): { section: GuideSection; card: GuideCard | null } | null {
  for (const section of sections) {
    if (section.id === id) return { section, card: null };
    const card = section.cards.find((item) => item.id === id);
    if (card) return { section, card };
  }
  return null;
}

export type Broadcast = {
  id: string;
  type: "quest" | "task" | "news";
  title: string;
  body: string;
  published: boolean;
  important: boolean;
  // Quest period, YYYY-MM-DD or empty, and plain-text conditions (03.2 D-03).
  startsAt: string;
  endsAt: string;
  conditions: string;
  // D-41: the editor group (a section or subsection id of broadcastSections, "" for «Без раздела»). The site does not read it.
  sectionId?: string;
};

// D-41/D-47: stored sections of the «Сводка» and «Рекомендации» tabs. The editor no longer shows them (20-33); they are kept
// only so old data stays readable. There is no note field: the owner removed editor notes.
export type OutlineSubsection = { id: string; title: string };
export type OutlineSection = { id: string; title: string; subsections: OutlineSubsection[] };
export type RecommendationSubsection = OutlineSubsection & { items: string[] };
export type RecommendationSection = { id: string; title: string; items: string[]; subsections: RecommendationSubsection[] };

export type RecycleFile = {
  id: string;
  name: string;
  location: string;
  kind: "virus" | "text" | "image";
  content: string;
  image: string;
  imageFraming?: ImageFraming;
  virusId: string;
};

// Phase 24, O-1: the apps whose window can be closed by level. One new line here is one new closable app.
export const LEVELED_APP_IDS = ["charter"] as const;
export type LeveledAppId = (typeof LEVELED_APP_IDS)[number];

// Phase 24, D-08/D-09: the place of a closed record. Only the level it needs, an opaque key and the index it had in the full list.
export type RedactedSlot = { slot: string; requiredLevel: AccessLevel; at: number };

// Phase 24: what the server withheld from this visitor. Present only in the copy built for a visitor (never for the editor).
export type ContentRedaction = {
  level: AccessLevel;
  // id of an open record -> its slot key, so the client can tell that a record it had became closed (D-20).
  slots: Record<string, string>;
  viruses: RedactedSlot[];
  recycle: RedactedSlot[];
  infoSections: RedactedSlot[];
  infoSubsections: Record<string, RedactedSlot[]>;
  guideSections: RedactedSlot[];
  guideCards: Record<string, RedactedSlot[]>;
  apps: Partial<Record<LeveledAppId, { requiredLevel: AccessLevel }>>;
};

// A document window: the embedded address and the external one.
export type DocumentLink = { src: string; external: string };
export type DocumentLinks = Partial<Record<LeveledAppId, DocumentLink>>;

export type PortiaContent = {
  viruses: Virus[];
  recycledViruses: Virus[];
  infoSections: InfoSection[];
  guideSections: GuideSection[];
  broadcasts: Broadcast[];
  recycleFiles: RecycleFile[];
  recycleOrder: string[];
  searchRecommendations: string[];
  // D-41: the editor's view of the two lists above; the site reads only broadcasts and the flat searchRecommendations.
  broadcastSections?: OutlineSection[];
  searchRecommendationSections?: RecommendationSection[];
  assistantAdvice: string[];
  assistantOffendedPhrase: string;
  assistantOffendedPhrases: string[];
  assistantPatienceSeconds: number;
  assistantPatienceVariants: number[];
  assistantIdlePhrases: string[];
  assistantActivityPhrases: string[];
  assistantIdleEnabled: boolean;
  assistantActivityEnabled: boolean;
  assistantAutoTimingMode: "fixed" | "random";
  assistantAutoIntervalSeconds: number;
  assistantAutoMinSeconds: number;
  assistantAutoMaxSeconds: number;
  formattedText: Record<string, RichTextDocument>;
  // Phase 24: the level each leveled app asks of its visitor (a missing key is level 1).
  appLevels?: Partial<Record<LeveledAppId, AccessLevel>>;
  // Only in the copy for a visitor; PUT rejects it.
  redaction?: ContentRedaction;
};

export const portiaTextKey = {
  virus: (virusId: string, field: "external" | "physiology" | "ppu-health" | "ppu-speed" | "ppu-abilities") => `virus:${virusId}:${field}`,
  mutation: (virusId: string, index: number) => `virus:${virusId}:mutation:${index}:description`,
  info: (sectionId: string) => `info:${sectionId}:body`,
  infoBlock: (blockId: string) => `info-block:${blockId}:text`,
  guideBlock: (blockId: string) => `guide-block:${blockId}:text`,
  broadcast: (broadcastId: string) => `broadcast:${broadcastId}:body`,
  recycle: (fileId: string) => `recycle:${fileId}:content`,
  searchRecommendations: "search:recommendations",
  assistantAdvice: "assistant:advice",
  assistantOffended: "assistant:offended",
  assistantIdle: "assistant:idle",
  assistantActivity: "assistant:activity",
} as const;

export function createVirusRecycleFiles(viruses: Virus[]): RecycleFile[] {
  return viruses.slice(0, 3).map((virus) => ({
    id: `recycle-${virus.id}`,
    name: `${virus.name}_${virus.code}.virus`,
    location: "C:\\PORTIA\\VIRUS_ARCHIVE",
    kind: "virus",
    content: "",
    image: "",
    // D-63: the file made from a virus carries the frame of the virus photo.
    ...(virus.infectedImageFraming ? { imageFraming: virus.infectedImageFraming } : {}),
    virusId: virus.id,
  }));
}

// The working code carries no starting content (Phase 25, owner decision 4б, SEC-03): the records live in the database, and the
// former seed is only a test fixture kept under lib/testing. This empty structure is for a new database and the
// fallback of an editor with no row. A visitor with no data is refused by GET /api/content instead (D-22).

// The assistant's service phrases and timings are interface text, not records (assumption A1 of 25-RESEARCH.md); the normalizer
// falls back to them when a saved field is missing or damaged.
export const assistantDefaults = {
  assistantAdvice: [
    "Глобальный поиск видит названия, коды, классификации и сообщения станции.",
    "В каждой карточке только одна запись учёного доступна с уровнем II.",
    "После сохранения изменения автоматически появляются у посетителей.",
    "Файлы в Корзине доступны только для чтения. Управление ими находится в редакторе владельца.",
  ],
  assistantOffendedPhrase: "Я обиделась. Дайте мне немного времени.",
  assistantOffendedPhrases: [
    "Я обиделась. Дайте мне немного времени.",
    "Слишком много нажатий. Я беру короткую паузу.",
    "Мои лапки устали. Вернусь через десять секунд.",
  ],
  assistantPatienceSeconds: 3,
  assistantPatienceVariants: [3],
  assistantIdlePhrases: [
    "Вы давно ничего не делали. Я всё ещё здесь.",
    "Станция притихла. Может, пора продолжить работу?",
    "Тишина затянулась. Позвать вас ещё раз?",
  ],
  assistantActivityPhrases: [
    "Вижу, работа идёт. Не отвлекаю — просто наблюдаю.",
    "Хороший темп. Продолжайте в том же духе.",
    "Вы заняты, а значит станция не простаивает.",
  ],
  assistantIdleEnabled: true,
  assistantActivityEnabled: true,
  assistantAutoTimingMode: "random",
  assistantAutoIntervalSeconds: 60,
  assistantAutoMinSeconds: 45,
  assistantAutoMaxSeconds: 120,
} satisfies Pick<
  PortiaContent,
  | "assistantAdvice"
  | "assistantOffendedPhrase"
  | "assistantOffendedPhrases"
  | "assistantPatienceSeconds"
  | "assistantPatienceVariants"
  | "assistantIdlePhrases"
  | "assistantActivityPhrases"
  | "assistantIdleEnabled"
  | "assistantActivityEnabled"
  | "assistantAutoTimingMode"
  | "assistantAutoIntervalSeconds"
  | "assistantAutoMinSeconds"
  | "assistantAutoMaxSeconds"
>;

export const emptyPortiaContent: PortiaContent = {
  viruses: [],
  recycledViruses: [],
  infoSections: [],
  guideSections: [],
  broadcasts: [],
  broadcastSections: [],
  recycleFiles: [],
  recycleOrder: [],
  searchRecommendations: [],
  searchRecommendationSections: [],
  ...assistantDefaults,
  formattedText: {},
};
