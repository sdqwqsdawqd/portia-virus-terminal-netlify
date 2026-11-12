/**
 * The template dossier model (Phase 20, D-52): a local draft that has the shape of a site editor virus card, minus the scientist
 * logs, and that can never reach the site.
 *
 * The model is a pure value. Every edit works on a copy and returns a new object. Nothing here reaches a server or browser storage,
 * and the only modules it may import are the content types and the export module next to it (a test guards this).
 *
 * Image addresses are never stored on the virus record: pictures live only as validated local data URLs in `images`.
 */
import { portiaTextKey, type RichTextDocument, type RichTextStyle, type Virus } from "./portia-content.ts";
import type { TemplateImage } from "./portia-template-export.ts";
import { normalizeImageFraming, type ImageFraming } from "./image-framing.ts";

/** Every template record carries this id; it is also the middle part of its formatting keys. */
export const templateVirusId = "template";

export type TemplateDossier = {
  virus: Virus;
  /** Formatting documents, keyed exactly like the editor keys them (`portiaTextKey`) with the id «template». */
  formattedText: Record<string, RichTextDocument>;
  images: { infected: TemplateImage | null; mutations: (TemplateImage | null)[] };
};

export type TemplateRun = { text: string; style?: RichTextStyle };

/** The classification of a new editor virus (`blankVirus` in components/portia-editor.tsx); a test compares it with that source. */
const newVirusClassification = (): Virus["classification"] => ({
  danger: "Гефест",
  spread: "Номос",
  transmission: "Контактно-бытовой",
  escapeRisk: "Предупреждение",
  mind: "Транзитиум",
  appearance: "Изоморф",
  behavior: "Стабилар",
});

export function emptyTemplateDossier(): TemplateDossier {
  return {
    virus: {
      id: templateVirusId,
      code: "",
      name: "",
      status: "",
      infectedImage: "",
      external: "",
      ppu: { health: "", speed: "", abilities: "" },
      physiology: "",
      mutations: [],
      classification: newVirusClassification(),
      scientistLogs: [],
    },
    formattedText: {},
    images: { infected: null, mutations: [] },
  };
}

/* ---------------------------------------------------------------- keys and invariants */

/** Every formatting key a template may hold: the five card fields and one description per existing mutation. */
function allowedTextKeys(dossier: TemplateDossier) {
  const keys = new Set<string>(
    (["external", "physiology", "ppu-health", "ppu-speed", "ppu-abilities"] as const).map((field) => portiaTextKey.virus(templateVirusId, field)),
  );
  for (let index = 0; index < dossier.virus.mutations.length; index += 1) keys.add(portiaTextKey.mutation(templateVirusId, index));
  return keys;
}

const localImageUrl = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** A slot value is accepted only as a local data URL of an allowed raster type that matches its own declared type. */
export function isLocalTemplateImage(image: unknown): image is TemplateImage {
  if (!image || typeof image !== "object") return false;
  const candidate = image as Partial<TemplateImage>;
  return typeof candidate.dataUrl === "string"
    && localImageUrl.test(candidate.dataUrl)
    && candidate.dataUrl.startsWith(`data:${candidate.mime};base64,`)
    && Number.isInteger(candidate.width) && Number.isInteger(candidate.height)
    && (candidate.width as number) >= 1 && (candidate.height as number) >= 1;
}

/** Copies the parts an edit may change; the immutable image objects are shared. */
function cloneDossier(dossier: TemplateDossier): TemplateDossier {
  return {
    virus: structuredClone(dossier.virus),
    formattedText: structuredClone(dossier.formattedText),
    images: { infected: dossier.images.infected, mutations: [...dossier.images.mutations] },
  };
}

/**
 * Puts a changed copy back into the template shape. Returns null when the edit changed the number of mutations, because that
 * only happens through addTemplateMutation and removeTemplateMutation.
 */
function enforceInvariants(next: TemplateDossier, mutationCount: number): TemplateDossier | null {
  if (next.virus.mutations.length !== mutationCount || next.images.mutations.length !== mutationCount) return null;
  next.virus.id = templateVirusId;
  next.virus.scientistLogs = [];
  next.virus.infectedImage = "";
  for (const mutation of next.virus.mutations) mutation.image = "";
  next.images.infected = isLocalTemplateImage(next.images.infected) ? next.images.infected : null;
  next.images.mutations = next.images.mutations.map((image) => (isLocalTemplateImage(image) ? image : null));
  const allowed = allowedTextKeys(next);
  for (const key of Object.keys(next.formattedText)) if (!allowed.has(key)) delete next.formattedText[key];
  return next;
}

function isRichDocument(value: unknown): value is RichTextDocument {
  return !!value && typeof value === "object" && Array.isArray((value as RichTextDocument).runs)
    && (value as RichTextDocument).runs.every((run) => !!run && typeof run === "object" && typeof run.text === "string");
}

/**
 * The same change as `changeFormattedText` in the editor: `apply` writes the plain text on a copy and the formatting document is
 * stored under the same key. A key outside the template, or a malformed document, returns the draft unchanged.
 */
export function editTemplateText(
  dossier: TemplateDossier,
  key: string,
  text: string,
  document: RichTextDocument,
  apply: (next: TemplateDossier, text: string) => void,
): TemplateDossier {
  if (!allowedTextKeys(dossier).has(key) || !isRichDocument(document)) return dossier;
  const next = cloneDossier(dossier);
  apply(next, text);
  next.formattedText[key] = {
    runs: document.runs.map((run) => ({ text: run.text, ...(run.style && typeof run.style === "object" ? { style: { ...run.style } } : {}) })),
  };
  return enforceInvariants(next, dossier.virus.mutations.length) ?? dossier;
}

/* ---------------------------------------------------------------- fragment style */

function hexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}

/**
 * The rules of `normalizeRichText` in lib/portia-content-normalize.ts: hex colours in lower case, font size rounded into 10–48,
 * weight from a fixed list, background opacity clamped into 0–1. Anything else, including unknown keys, is dropped.
 */
export function safeTemplateRunStyle(style: unknown): RichTextStyle {
  const raw = style && typeof style === "object" && !Array.isArray(style) ? (style as Record<string, unknown>) : {};
  const safe: RichTextStyle = {};
  const color = hexColor(raw.color);
  const backgroundColor = hexColor(raw.backgroundColor);
  if (color) safe.color = color;
  if (backgroundColor) safe.backgroundColor = backgroundColor;
  if (typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)) safe.fontSize = Math.min(48, Math.max(10, Math.round(raw.fontSize)));
  if (typeof raw.fontWeight === "number" && [400, 500, 600, 700, 800, 900].includes(raw.fontWeight)) safe.fontWeight = raw.fontWeight;
  if (typeof raw.backgroundOpacity === "number" && Number.isFinite(raw.backgroundOpacity)) safe.backgroundOpacity = Math.min(1, Math.max(0, raw.backgroundOpacity));
  return safe;
}

/** The background of a fragment as `rgba(r,g,b,a)`, like `documentBackground` in the site dossier; undefined without a colour. */
export function templateRunBackground(style: RichTextStyle): string | undefined {
  const safe = safeTemplateRunStyle(style);
  if (!safe.backgroundColor) return undefined;
  const value = Number.parseInt(safe.backgroundColor.slice(1), 16);
  const opacity = Number((safe.backgroundOpacity ?? 1).toFixed(3));
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${opacity})`;
}

/**
 * The fragments of a field. The stored document is used only while its joined text equals the field text (as in the site's
 * `FormattedText`); otherwise the field is one plain fragment. Styles are always passed through `safeTemplateRunStyle`.
 */
export function templateFieldRuns(dossier: TemplateDossier, key: string, text: string): TemplateRun[] {
  const document = Object.hasOwn(dossier.formattedText, key) ? dossier.formattedText[key] : undefined;
  if (isRichDocument(document) && document.runs.length > 0 && document.runs.map((run) => run.text).join("") === text) {
    const runs = document.runs.filter((run) => run.text !== "").map((run): TemplateRun => {
      const style = safeTemplateRunStyle(run.style);
      return Object.keys(style).length > 0 ? { text: run.text, style } : { text: run.text };
    });
    if (runs.length > 0) return runs;
  }
  return [{ text }];
}

/* ---------------------------------------------------------------- edits like the editor */

/**
 * A change to the plain virus fields (code, name, status, classification, mutation names, ...). The id, the scientist logs and all
 * picture addresses are put back after `update`; an edit that changes the number of mutations is refused and the same draft is
 * returned, because mutations are added and removed only through the two functions below.
 */
export function editTemplateVirus(dossier: TemplateDossier, update: (virus: Virus) => void): TemplateDossier {
  const next = cloneDossier(dossier);
  update(next.virus);
  return enforceInvariants(next, dossier.virus.mutations.length) ?? dossier;
}

/** The same new mutation as the editor's «+ ДОБАВИТЬ МУТАЦИЮ» (components/portia-editor.tsx), with an empty picture slot. */
export function addTemplateMutation(dossier: TemplateDossier): TemplateDossier {
  const next = cloneDossier(dossier);
  next.virus.mutations.push({ name: "НОВАЯ МУТАЦИЯ", description: "", image: "" });
  next.images.mutations.push(null);
  return next;
}

/**
 * Deleting a mutation moves each later description key down one place and drops the last, exactly like `removeMutation` in
 * lib/editor-items.ts; the picture slots move the same way. An index outside the list returns the draft unchanged.
 */
export function removeTemplateMutation(dossier: TemplateDossier, index: number): TemplateDossier {
  const count = dossier.virus.mutations.length;
  if (!Number.isInteger(index) || index < 0 || index >= count) return dossier;
  const next = cloneDossier(dossier);
  next.virus.mutations.splice(index, 1);
  next.images.mutations.splice(index, 1);
  for (let position = index; position < count; position += 1) {
    const following = next.formattedText[portiaTextKey.mutation(templateVirusId, position + 1)];
    if (following) next.formattedText[portiaTextKey.mutation(templateVirusId, position)] = following;
    else delete next.formattedText[portiaTextKey.mutation(templateVirusId, position)];
  }
  return next;
}

/** Puts a validated local image into one slot (or clears it). Anything that is not a local raster data URL changes nothing. */
export function setTemplateImage(dossier: TemplateDossier, slot: "infected" | number, image: TemplateImage | null): TemplateDossier {
  if (image !== null && !isLocalTemplateImage(image)) return dossier;
  if (slot !== "infected" && (!Number.isInteger(slot) || slot < 0 || slot >= dossier.virus.mutations.length)) return dossier;
  const next = cloneDossier(dossier);
  const replacement = image?.framing ? { ...image, framing: undefined } : image;
  if (slot === "infected") next.images.infected = replacement;
  else next.images.mutations[slot] = replacement;
  return next;
}

/** Applies a local crop to one existing slot; an empty or replaced slot has no crop to inherit. */
export function setTemplateImageFraming(dossier: TemplateDossier, slot: "infected" | number, framing: ImageFraming | undefined): TemplateDossier {
  if (slot !== "infected" && (!Number.isInteger(slot) || slot < 0 || slot >= dossier.virus.mutations.length)) return dossier;
  const current = slot === "infected" ? dossier.images.infected : dossier.images.mutations[slot];
  if (!current) return dossier;
  const next = cloneDossier(dossier);
  const image = { ...current, framing: normalizeImageFraming(framing) };
  if (slot === "infected") next.images.infected = image;
  else next.images.mutations[slot] = image;
  return next;
}

/* ---------------------------------------------------------------- content and snapshot */

const plainFields = (virus: Virus) => [
  virus.code, virus.name, virus.status, virus.external, virus.ppu.health, virus.ppu.speed, virus.ppu.abilities, virus.physiology,
];

const classificationValues = (virus: Virus) => [
  virus.classification.danger, virus.classification.spread, virus.classification.transmission, virus.classification.escapeRisk,
  virus.classification.mind, virus.classification.appearance, virus.classification.behavior,
];

/** True once the participant provided something: a visible character, a changed class, a mutation or a picture. */
export function hasTemplateDossierContent(dossier: TemplateDossier) {
  const { virus, images } = dossier;
  const defaults = classificationValues(emptyTemplateDossier().virus);
  return plainFields(virus).some((value) => value.trim() !== "")
    || virus.mutations.length > 0
    || classificationValues(virus).some((value, index) => value !== defaults[index])
    || images.infected !== null
    || images.mutations.some((image) => image !== null);
}

const imageKey = (image: TemplateImage | null) => (image === null ? null : [image.name, image.bytes, image.width, image.height, image.dataUrl.length, image.dataUrl.slice(-48), normalizeImageFraming(image.framing) ?? null]);

/** A stable value that changes with every text, formatting, class, mutation or picture change; used to tell a downloaded draft from a changed one. */
export function templateDossierSnapshotKey(dossier: TemplateDossier) {
  const { virus, formattedText, images } = dossier;
  return JSON.stringify([
    plainFields(virus),
    classificationValues(virus),
    virus.mutations.map((mutation) => [mutation.name, mutation.description]),
    Object.keys(formattedText).sort().map((key) => [key, formattedText[key]]),
    imageKey(images.infected),
    images.mutations.map(imageKey),
  ]);
}
