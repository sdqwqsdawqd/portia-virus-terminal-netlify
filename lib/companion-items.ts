// Owner 2026-11-18: things the visitor gives to the assistant Вивьян and to the spider of the «Паутина» wallpaper — a hat, glasses, an object
// in a paw. Each item is a picture (a local file turned into a small PNG in the browser, or an https link to a picture) that the visitor places
// freely on the figure in a mini-editor (round 2: free drag and stretch replace the old fixed slots). Everything lives in localStorage of this
// device only: nothing is ever sent to the server, and other visitors never see it.
//
// A stored list is untrusted (another tab, an old version, a hand edit): normalizeCompanionItems keeps only items it fully understands, so no
// text of the store ever reaches a style or an attribute except a checked picture address.

export type CompanionTarget = "assistant" | "spider";

/** Where an item hangs: on the body, or (the spider only) on a front paw. A paw item swings with that leg on the wallpaper. */
export type CompanionAttach = "body" | "L4" | "R4";

export const companionAttachLabels: Record<CompanionAttach, string> = { body: "Тело", L4: "Левая лапа", R4: "Правая лапа" };

export type CompanionItem = {
  id: string;
  target: CompanionTarget;
  attach: CompanionAttach;
  /** A `data:image/...;base64,` picture made on this device, or an `https://` link. */
  src: string;
  /** Centre of the item box in figure units (see companionFigures). */
  x: number;
  y: number;
  /** Size of the item box in figure units; stretched independently. */
  width: number;
  height: number;
  /** Turn in degrees about the centre, -180..180. */
  rotate: number;
  /** Mirror the picture left to right. */
  flip: boolean;
};

/**
 * The figure an item stands on, in its own units. The assistant is the svg box of her 1536 x 1024 picture (100 wide, 66.667 high);
 * the spider is her artwork box (components/portia-wallpaper-spider.tsx, head toward +y).
 */
export const companionFigures: Record<CompanionTarget, { width: number; height: number; picture?: string }> = {
  assistant: { width: 100, height: 66.667, picture: "/assets/portia-assistant.png" },
  spider: { width: 649.5, height: 768 },
};

export const companionItemsStorageKey = "portia-companion-items-v2";
/** The list of the slot version (round 1). It is not migrated: it is ignored and removed after the first successful save. */
const legacyStorageKey = "portia-companion-items-v1";
export const MAX_COMPANION_ITEMS = 8; // per target
/** A local picture is stored as text in localStorage; one is kept under this many characters (about 300 KB). */
export const MAX_LOCAL_PICTURE_CHARS = 400_000;
/** A local picture is shrunk in the browser so that its longer side is at most this many pixels. */
export const LOCAL_PICTURE_MAX_SIDE = 320;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const tenth = (value: number) => Math.round(value * 10) / 10;
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

/** Limits of one target: the centre may leave the figure by half of it, the box stays between 2% of the width and 1.5 x the longer side. */
function limits(target: CompanionTarget) {
  const { width, height } = companionFigures[target];
  return { minX: -0.5 * width, maxX: 1.5 * width, minY: -0.5 * height, maxY: 1.5 * height, minSize: 0.02 * width, maxSize: 1.5 * Math.max(width, height) };
}

const attachFor = (target: CompanionTarget, value: unknown): CompanionAttach => (target === "spider" && (value === "L4" || value === "R4") ? value : "body");

function normalizeItem(value: unknown): CompanionItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const target = record.target === "assistant" || record.target === "spider" ? record.target : null;
  if (!target) return null;
  const src = companionPictureSource(record.src);
  const id = typeof record.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(record.id) ? record.id : null;
  if (!src || !id) return null;
  // The numbers of the free placement are required: an entry of the slot version (slot and size, no width and height) is dropped.
  const finite = (key: string) => (typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] as number : null);
  const x = finite("x"), y = finite("y"), width = finite("width"), height = finite("height");
  if (x === null || y === null || width === null || height === null) return null;
  const limit = limits(target);
  return {
    id, target, src,
    attach: attachFor(target, record.attach),
    x: tenth(clamp(x, limit.minX, limit.maxX)),
    y: tenth(clamp(y, limit.minY, limit.maxY)),
    width: tenth(clamp(width, limit.minSize, limit.maxSize)),
    height: tenth(clamp(height, limit.minSize, limit.maxSize)),
    rotate: Math.round(clamp(finite("rotate") ?? 0, -180, 180)),
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

// ---- Free placement: pure helpers of the editor. ----

/** Shifts the centre by the delta (figure units) and keeps it in range. */
export function moveCompanionItem(item: CompanionItem, dx: number, dy: number): CompanionItem {
  const limit = limits(item.target);
  return { ...item, x: clamp(item.x + dx, limit.minX, limit.maxX), y: clamp(item.y + dy, limit.minY, limit.maxY) };
}

export type CompanionHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * Stretches the box by a handle dragged by (dx, dy) figure units. The delta is taken in the item's own axes (so a turned item stretches
 * along its own sides), width and height change independently (no aspect lock), and the opposite edge stays put, also at a size limit.
 */
export function resizeCompanionItem(item: CompanionItem, handle: CompanionHandle, dx: number, dy: number): CompanionItem {
  const limit = limits(item.target);
  const radians = (item.rotate * Math.PI) / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const localX = dx * cos + dy * sin, localY = -dx * sin + dy * cos;
  let width = item.width, height = item.height, shiftX = 0, shiftY = 0;
  if (handle.includes("e")) { width = clamp(item.width + localX, limit.minSize, limit.maxSize); shiftX = (width - item.width) / 2; }
  if (handle.includes("w")) { width = clamp(item.width - localX, limit.minSize, limit.maxSize); shiftX = -(width - item.width) / 2; }
  if (handle.includes("s")) { height = clamp(item.height + localY, limit.minSize, limit.maxSize); shiftY = (height - item.height) / 2; }
  if (handle.includes("n")) { height = clamp(item.height - localY, limit.minSize, limit.maxSize); shiftY = -(height - item.height) / 2; }
  return { ...item, width, height, x: item.x + shiftX * cos - shiftY * sin, y: item.y + shiftX * sin + shiftY * cos };
}

/** Changes the box by (dw, dh) figure units about its centre (the keyboard resize of the editor); the size limits hold. */
export function scaleCompanionItem(item: CompanionItem, dw: number, dh: number): CompanionItem {
  const limit = limits(item.target);
  return { ...item, width: clamp(item.width + dw, limit.minSize, limit.maxSize), height: clamp(item.height + dh, limit.minSize, limit.maxSize) };
}

export const makeCompanionItemId = () => `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** A new item in the middle of its figure, about a quarter of the assistant or a quarter of the spider wide; `aspect` is width / height of the picture. */
export function newCompanionItem(target: CompanionTarget, src: string, aspect?: number): CompanionItem {
  const ratio = aspect && Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const width = target === "assistant" ? 24 : 160;
  const centre = target === "assistant" ? { x: 50, y: 33.3 } : { x: 325, y: 360 };
  return { id: makeCompanionItemId(), target, attach: "body", src, ...centre, width, height: width / ratio, rotate: 0, flip: false };
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
  try { window.localStorage.removeItem(legacyStorageKey); } catch { /* the old list is only ignored then */ }
  cache = next;
  listeners.forEach((listener) => listener());
  return true;
}
