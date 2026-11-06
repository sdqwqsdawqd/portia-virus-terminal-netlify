// Global search index (D-13): one pure function that builds every searchable item from an explicit allowlist of fields per source.
// A field that is not named here can never be found, whatever the source object carries (drafts, editor notes, reviewer fields, answer keys).
import type { Broadcast, InfoBlock, GuideBlock, RecycleFile } from "./portia-content.ts";

export type SearchItemType = "virus" | "employee" | "info" | "guide" | "broadcast" | "file" | "app";

export type SearchItem = {
  /** `${type}:${id}`: records of different types may share an id (an info section and a guide card), so the id alone is not a key. */
  key: string;
  id: string;
  type: SearchItemType;
  title: string;
  meta: string;
  body: string;
  parts?: string[];
};

// Each source is typed by the fields the index reads, nothing more.
export type SearchApp = { id: string; label: string; path: string };
export type SearchVirus = {
  id: string;
  code: string;
  name: string;
  status: string;
  external: string;
  physiology: string;
  classification: Record<string, string>;
  mutations: { name: string; description: string }[];
};
export type SearchEmployee = { id: string; nickname: string; callsign: string; title: string; rank: string; biography: string };
export type SearchInfoSection = {
  id: string;
  title: string;
  body: string;
  subsections: { id: string; title: string; blocks: InfoBlock[] }[];
};
export type SearchGuideSection = { id: string; title: string; cards: { id: string; title: string; blocks: GuideBlock[] }[] };
export type SearchBroadcast = Pick<Broadcast, "id" | "type" | "title" | "body" | "published">;
export type SearchRecycleFile = Pick<RecycleFile, "id" | "name" | "kind" | "content" | "virusId">;

export type SearchIndexInput = {
  /** Already filtered by the caller to the applications the visitor may open (D-07). */
  apps: readonly SearchApp[];
  viruses: readonly SearchVirus[];
  employees: readonly SearchEmployee[];
  infoSections: readonly SearchInfoSection[];
  guideSections: readonly SearchGuideSection[];
  broadcasts: readonly SearchBroadcast[];
  recycleFiles: readonly SearchRecycleFile[];
  recycledViruses: readonly SearchVirus[];
};

export function broadcastType(type: Broadcast["type"]) {
  return type === "quest" ? "ЕЖЕНЕДЕЛЬНЫЙ КВЕСТ" : type === "task" ? "ЗАДАЧА" : "НОВОСТЬ";
}

export const recycleFileType = (kind: RecycleFile["kind"]) => kind === "virus" ? "Документ вируса" : kind === "image" ? "Изображение" : "Текстовый документ";

export function recycleFileBody(file: Pick<RecycleFile, "kind" | "content" | "virusId">, viruses: readonly Pick<SearchVirus, "id" | "name" | "code" | "status" | "external" | "physiology">[]) {
  if (file.kind !== "virus") return file.content;
  const virus = viruses.find((item) => item.id === file.virusId);
  if (!virus) return file.content;
  const dossier = [
    "PORTIA / АРХИВНАЯ КОПИЯ",
    `ОБЪЕКТ: ${virus.name}`,
    `КОД: ${virus.code}`,
    `СТАТУС: ${virus.status}`,
    "",
    "ВНЕШНИЕ ХАРАКТЕРИСТИКИ:",
    virus.external,
    "",
    "ФИЗИОЛОГИЯ:",
    virus.physiology,
  ].join("\n");
  return file.content.trim() ? `${dossier}\n\n${file.content}` : dossier;
}

// Lowercase in Russian rules and ё = е: «ЁЖ», «ёж» and «еж» are one word, in the query and in the text alike.
// The combining acute accent (D-37) does not matter either: «Люци́диум» and «Люцидиум» match each other. Only U+0301 goes; «й» and other marks stay.
export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\u0301/g, "");
}

const tableText = (rows: readonly { key: string; value: string }[]) => rows.map((row) => `${row.key} ${row.value}`).join(" ");

const item = (type: SearchItemType, id: string, title: string, meta: string, body: string, parts?: string[]): SearchItem => ({ key: `${type}:${id}`, id, type, title, meta, body, ...(parts ? { parts } : {}) });

// Source order is the result order: apps, viruses, employees, info, guide, broadcasts, recycle bin; inside a source the data order.
export function buildSearchIndex(input: SearchIndexInput): SearchItem[] {
  const virusBody = (virus: SearchVirus) => `${virus.status} ${virus.external} ${virus.physiology} ${Object.values(virus.classification).join(" ")} ${virus.mutations.map((mutation) => `${mutation.name} ${mutation.description}`).join(" ")}`;
  const items: SearchItem[] = [
    ...input.apps.map((app) => item("app", app.id, app.label, "ПРИЛОЖЕНИЕ", `${app.path} ${app.id}`)),
    ...input.viruses.map((virus) => item("virus", virus.id, virus.name, virus.code, virusBody(virus))),
    ...input.employees.map((employee) => item("employee", employee.id, employee.nickname, "СОТРУДНИКИ", `${employee.callsign} ${employee.title} ${employee.rank} ${employee.biography}`)),
    ...input.infoSections.flatMap((section) => [
      item("info", section.id, section.title, "ИНФОРМАЦИЯ", section.body),
      ...section.subsections.map((sub) => item("info", sub.id, sub.title, `ИНФОРМАЦИЯ · ${section.title}`, sub.blocks.map((block) => block.type === "text" ? block.text : block.type === "table" ? tableText(block.rows) : "").join(" "))),
    ]),
    // D-15: a card is found by its title, any block text and its section title; the section title sits in meta, so a section match lists every card of it.
    ...input.guideSections.flatMap((section) => section.cards.map((card) => {
      const parts = card.blocks.map((block) => block.type === "heading" || block.type === "text" ? block.text : block.type === "table" ? tableText(block.rows) : block.type === "photo" ? block.caption : block.type === "callout" ? `${block.label} ${block.text}` : "").filter(Boolean);
      return item("guide", card.id, card.title || "Без названия", `СПРАВОЧНИК · ${section.title || "Без названия"}`, parts.join(" "), parts);
    })),
    ...input.broadcasts.filter((broadcast) => broadcast.published).map((broadcast) => item("broadcast", broadcast.id, broadcast.title, broadcastType(broadcast.type), broadcast.body)),
    ...input.recycleFiles.map((file) => item("file", file.id, file.name, recycleFileType(file.kind), recycleFileBody(file, [...input.viruses, ...input.recycledViruses]))),
    ...input.recycledViruses.map((virus) => item("file", `virus:${virus.id}`, virus.name, "ВИРУС В КОРЗИНЕ", `${virus.code} ${virus.status} ${virus.external} ${virus.physiology}`)),
  ];
  // A repeated key would give two rows one React key; the first record wins.
  const seen = new Set<string>();
  return items.filter((entry) => !seen.has(entry.key) && Boolean(seen.add(entry.key)));
}

// An empty query lists the first `limit` items; a query lists every match. The preview of a card starts at the first block that holds the query; matching itself is unchanged.
export function matchSearch(items: readonly SearchItem[], query: string, limit = 8): SearchItem[] {
  const needle = normalizeSearch(query.trim());
  if (!needle) return items.slice(0, limit);
  return items.filter((entry) => normalizeSearch(`${entry.title} ${entry.meta} ${entry.body}`).includes(needle)).map((entry) => {
    const at = entry.parts ? entry.parts.findIndex((part) => normalizeSearch(part).includes(needle)) : -1;
    return at > 0 && entry.parts ? { ...entry, body: [...entry.parts.slice(at), ...entry.parts.slice(0, at)].join(" ") } : entry;
  });
}

// Partial: the roster failed. With a last-good copy the results still list employees (from that copy); without one they list none, and the line says so.
export function rosterDegradedText(sync: { lastGoodAt: string | null; failure: unknown }): string | null {
  if (!sync.failure) return null;
  if (!sync.lastGoodAt) return "Сотрудники сейчас недоступны";
  return "Сотрудники: показаны сохранённые данные";
}

export type SearchKeyAction = "focus-input" | "next" | "prev" | "open" | "clear" | "close";
export type SearchKeyContext = {
  key: string;
  /** Physical key: on a Russian layout the K key reports «л». */
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** The focus is in the search field (true) or on a result (false). */
  inInput: boolean;
  query: string;
  /** Index of the focused result; -1 while the focus is in the field. */
  index: number;
  count: number;
  /** "enter-only": nothing but Enter is taken over (a phone has no hardware keyboard to serve). */
  scope?: "full" | "enter-only";
};

type KeyEventLike = { key: string; code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

// Copies the key and its modifiers from a keyboard event, so the component never reads the modifiers itself.
export function searchKeyContext(event: KeyEventLike, rest: Omit<SearchKeyContext, "key" | "code" | "ctrlKey" | "metaKey" | "altKey">): SearchKeyContext {
  return { key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, ...rest };
}

// Ctrl or Cmd without Alt (AltGr reports Ctrl+Alt) plus K; the physical code keeps it working on a Russian layout, where the K key reports «л».
function isSearchShortcut(event: { key: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): boolean {
  return Boolean((event.ctrlKey || event.metaKey) && !event.altKey && (event.key.toLowerCase() === "k" || event.code === "KeyK"));
}

// D-46: the document-level handler opens the search with Ctrl/Cmd+K alone; the arrows work only inside the search window (searchKeyAction), so typing in a field or pressing Up on an empty desktop never steals the focus (D-44).
export function globalSearchKeyAction(event: KeyEventLike): "focus-input" | null {
  return isSearchShortcut(event) ? "focus-input" : null;
}

// Owner verdict 19-OWNER-DECISIONS #3 (2026-11-02): Ctrl/Cmd+K, arrows between field and results, Enter opens, Escape clears then closes. Tab keeps its native order.
export function searchKeyAction(ctx: SearchKeyContext): SearchKeyAction | null {
  const { key, inInput, query, index, count } = ctx;
  if (key === "Enter") {
    if (inInput) return count === 1 && ctx.scope !== "enter-only" ? "open" : null;
    return index >= 0 && index < count ? "open" : null;
  }
  if (ctx.scope === "enter-only") return null;
  if (isSearchShortcut(ctx)) return "focus-input";
  if (ctx.ctrlKey || ctx.metaKey || ctx.altKey) return null;
  if (key === "Escape") return query ? "clear" : "close";
  if (key === "ArrowDown") {
    if (!count) return null;
    return inInput || index < count - 1 ? "next" : null;
  }
  if (key === "ArrowUp") {
    if (inInput) return count ? "prev" : null;
    return index <= 0 ? "focus-input" : "prev";
  }
  return null;
}
