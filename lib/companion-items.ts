// Owner 2026-11-18: things the visitor gives to the assistant Вивьян and to the spider of the «Паутина» wallpaper — a hat, glasses, an object
// in a paw. Each item is a picture (a local file turned into a small PNG in the browser, or an https link to a picture) placed on one spot of a
// fixed template. Everything lives in localStorage of this device only: nothing is ever sent to the server, and other visitors never see it.
//
// A stored list is untrusted (another tab, an old version, a hand edit): normalizeCompanionItems keeps only items it fully understands, so no
// text of the store ever reaches a style or an attribute except a checked picture address.

export type CompanionTarget = "assistant" | "spider";

export type CompanionItem = {
  id: string;
  target: CompanionTarget;
  slot: string;
  /** A `data:image/...;base64,` picture made on this device, or an `https://` link. */
  src: string;
  /** Size in percent of the slot's own size, 40..250. */
  size: number;
  /** Turn in degrees, -180..180. */
  rotate: number;
  /** Mirror the picture left to right. */
  flip: boolean;
};

/** A spot of the template: where the centre of the item stands and how wide it is at 100%. */
export type CompanionSlot = { id: string; label: string; x: number; y: number; width: number };

// The assistant picture (public/assets/portia-assistant.png, 1536 x 1024): spots in percent of the picture box.
export const assistantSlots: readonly CompanionSlot[] = [
  { id: "head", label: "На голову (шляпа)", x: 46, y: 25, width: 26 },
  { id: "eyes", label: "На глаза (очки)", x: 47, y: 44, width: 24 },
  { id: "back", label: "На спину", x: 62, y: 13, width: 22 },
  { id: "belly", label: "На тело", x: 46, y: 72, width: 22 },
  { id: "left-paw", label: "В левую лапку", x: 9, y: 58, width: 15 },
  { id: "right-paw", label: "В правую лапку", x: 92, y: 58, width: 15 },
];

// The wallpaper spider (components/portia-wallpaper-spider.tsx, artwork 649.5 x 768, head toward +y): spots in artwork units. The front legs are
// L4 and R4 (the pair nearest the head); their items are drawn inside the leg group, so they swing with every step of that leg.
export const spiderSlots: readonly (CompanionSlot & { leg?: "L4" | "R4" })[] = [
  { id: "front-left", label: "В левую переднюю лапку", x: 190, y: 735, width: 150, leg: "L4" },
  { id: "front-right", label: "В правую переднюю лапку", x: 460, y: 735, width: 150, leg: "R4" },
  { id: "back", label: "На спину", x: 325, y: 190, width: 190 },
  { id: "head", label: "На голову", x: 325, y: 420, width: 170 },
];

export const companionSlots: Record<CompanionTarget, readonly CompanionSlot[]> = { assistant: assistantSlots, spider: spiderSlots };

export const companionItemsStorageKey = "portia-companion-items-v1";
export const MAX_COMPANION_ITEMS = 8; // per target
/** A local picture is stored as text in localStorage; one is kept under this many characters (about 300 KB). */
export const MAX_LOCAL_PICTURE_CHARS = 400_000;
/** A local picture is shrunk in the browser so that its longer side is at most this many pixels. */
export const LOCAL_PICTURE_MAX_SIDE = 320;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const localPicture = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

/** A picture address that may be drawn: a picture made on this device, or an https link without spaces and quotes. */
export function companionPictureSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.startsWith("data:")) return text.length <= MAX_LOCAL_PICTURE_CHARS && localPicture.test(text) ? text : null;
  if (text.length > 2000 || /[\s"'<>\\]/.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeItem(value: unknown): CompanionItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const target = record.target === "assistant" || record.target === "spider" ? record.target : null;
  if (!target) return null;
  const slot = typeof record.slot === "string" && companionSlots[target].some((entry) => entry.id === record.slot) ? record.slot : null;
  const src = companionPictureSource(record.src);
  const id = typeof record.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(record.id) ? record.id : null;
  if (!slot || !src || !id) return null;
  const number = (key: string, fallback: number) => (typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] as number : fallback);
  return {
    id, target, slot, src,
    size: Math.round(clamp(number("size", 100), 40, 250)),
    rotate: Math.round(clamp(number("rotate", 0), -180, 180)),
    flip: record.flip === true,
  };
}

/** The list as it may be used: known items only, ids unique, at most MAX_COMPANION_ITEMS per target. */
export function normalizeCompanionItems(value: unknown): CompanionItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const perTarget: Record<CompanionTarget, number> = { assistant: 0, spider: 0 };
  const items: CompanionItem[] = [];
  for (const entry of value) {
    const item = normalizeItem(entry);
    if (!item || seen.has(item.id) || perTarget[item.target] >= MAX_COMPANION_ITEMS) continue;
    seen.add(item.id);
    perTarget[item.target] += 1;
    items.push(item);
  }
  return items;
}

/** Where an item stands, in the units of its target (percent of the assistant picture, artwork units of the spider). */
export function companionPlacement(item: CompanionItem): { x: number; y: number; width: number; slot: CompanionSlot } | null {
  const slot = companionSlots[item.target].find((entry) => entry.id === item.slot);
  return slot ? { x: slot.x, y: slot.y, width: (slot.width * item.size) / 100, slot } : null;
}

// ---- The device store: one list for the whole page, shared by the settings, the assistant and the spider. ----

const listeners = new Set<() => void>();
let cache: CompanionItem[] | null = null;
const emptyList: CompanionItem[] = [];

function read(): CompanionItem[] {
  if (cache) return cache;
  try {
    const stored = window.localStorage.getItem(companionItemsStorageKey);
    cache = stored === null ? [] : normalizeCompanionItems(JSON.parse(stored));
  } catch {
    cache = [];
  }
  return cache;
}

export function subscribeCompanionItems(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== companionItemsStorageKey) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const companionItemsSnapshot = () => read();
export const companionItemsServerSnapshot = () => emptyList;

/** Saves the list on this device. False when the browser refused it (storage full or blocked): the list on screen stays as it was. */
export function saveCompanionItems(items: CompanionItem[]): boolean {
  const next = normalizeCompanionItems(items);
  try {
    window.localStorage.setItem(companionItemsStorageKey, JSON.stringify(next));
  } catch {
    return false;
  }
  cache = next;
  listeners.forEach((listener) => listener());
  return true;
}
