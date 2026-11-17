// Phase 25, D-13 / D-14 / SEC-05: "change the address of a picture". Pure and client-safe (no server imports): the same
// functions decide on the server which address may be copied or removed, and in the editor which pictures a record holds.

import type { PortiaContent } from "./portia-content.ts";

export const PORTIA_MEDIA_BUCKET = "portia-media";

const PUBLIC_PREFIX = `/storage/v1/object/public/${PORTIA_MEDIA_BUCKET}/`;
// The only shape the site writes (app/api/uploads/route.ts): recycle/<uuid>.<ext>.
const MEDIA_PATH = /^recycle\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/;
const MEDIA_PATH_AT_END = /(recycle\/[0-9a-f-]{36}\.(?:png|jpg|webp|gif))$/;

const hasControlChar = (value: string) => [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);

export type ParsedMediaUrl = { path: string; ext: "png" | "jpg" | "webp" | "gif" };

// T-25-06: the address comes from the browser and is not trusted. Only the public address of a file of this site's bucket
// passes: https, the host of NEXT_PUBLIC_SUPABASE_URL, the exact public route and a path of the recycle/<uuid>.<ext> shape.
// Percent-encoding, backslash, control characters, whitespace around, user info, query and fragment are refused before the
// address is parsed, so a decoy such as "%2e%2e" never reaches storage.
export function parsePortiaMediaUrl(url: string, supabaseUrl: string): ParsedMediaUrl | null {
  if (typeof url !== "string" || typeof supabaseUrl !== "string" || !url || !supabaseUrl) return null;
  if (hasControlChar(url) || url !== url.trim() || url.includes("\\") || url.includes("%") || url.includes("..")) return null;
  let site: URL;
  let target: URL;
  try {
    site = new URL(supabaseUrl);
    target = new URL(url);
  } catch {
    return null;
  }
  if (site.protocol !== "https:" || target.protocol !== "https:" || target.origin !== site.origin) return null;
  if (target.username || target.password || target.search || target.hash) return null;
  if (!target.pathname.startsWith(PUBLIC_PREFIX)) return null;
  const path = target.pathname.slice(PUBLIC_PREFIX.length);
  const match = MEDIA_PATH.exec(path);
  if (!match) return null;
  return { path, ext: match[1] as ParsedMediaUrl["ext"] };
}

export type RewriteKind = "virus" | "info-section" | "info-subsection" | "guide-section" | "guide-card";

type Loose = Record<string, unknown>;
const asList = (value: unknown): Loose[] => (Array.isArray(value) ? value.filter((item): item is Loose => !!item && typeof item === "object") : []);
const textOf = (value: unknown): string => (typeof value === "string" ? value : "");
const photoBlocks = (blocks: unknown): string[] => asList(blocks).filter((block) => block.type === "photo").map((block) => textOf(block.url));

// The pictures a record shows, in reading order, without empty values and without repeats. A section includes its
// children: their effective level rises together with the section (Phase 24, D-17).
export function imageUrlsOfRecord(kind: RewriteKind, record: unknown): string[] {
  const item = (record && typeof record === "object" ? record : {}) as Loose;
  let found: string[];
  switch (kind) {
    case "virus":
      found = [textOf(item.infectedImage), ...asList(item.mutations).map((mutation) => textOf(mutation.image))];
      break;
    case "info-subsection":
      found = photoBlocks(item.blocks);
      break;
    case "info-section":
      found = asList(item.subsections).flatMap((subsection) => photoBlocks(subsection.blocks));
      break;
    case "guide-card":
      found = [textOf(item.cover), ...photoBlocks(item.blocks)];
      break;
    case "guide-section":
      found = [textOf(item.photo), ...asList(item.cards).flatMap((card) => [textOf(card.cover), ...photoBlocks(card.blocks)])];
      break;
  }
  return [...new Set(found.filter(Boolean))];
}

// Keys that hold a picture address in a virus, a section, a subsection, a card or a block. `url` exists only on photo blocks
// (videos hold `videoId`), so one walk serves every kind. Returns a copy; the input is not changed.
const IMAGE_KEYS = new Set(["infectedImage", "image", "url", "photo", "cover"]);

export function replaceImageUrl<T>(record: T, from: string, to: string): T {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const copy: Loose = {};
    for (const [key, inner] of Object.entries(value as Loose)) {
      copy[key] = IMAGE_KEYS.has(key) && inner === from ? to : walk(inner);
    }
    return copy;
  };
  return walk(record) as T;
}

// Changes the draft in place, like the editor's own updaters: the record of this kind and id gets the new address. Used from
// inside the editor's draft change, so the history sees one edit. An unknown id or address changes nothing.
export function replaceImageInContent(next: PortiaContent, kind: RewriteKind, id: string, from: string, to: string): void {
  const swap = <T extends { id: string }>(list: T[]) => {
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) list[index] = replaceImageUrl(list[index], from, to);
  };
  if (kind === "virus") swap(next.viruses);
  else if (kind === "info-section") swap(next.infoSections);
  else if (kind === "guide-section") swap(next.guideSections);
  else if (kind === "info-subsection") for (const section of next.infoSections) swap(section.subsections);
  else for (const section of next.guideSections) swap(section.cards);
}

// D-13: the queue holds addresses the editor replaced. After a save only those whose file no saved record shows any more may
// be removed: an address that undo brought back and that was saved stays. Anything not shaped like a site file is never listed.
export function retirableUrls(queue: Iterable<string>, savedPayloadText: string): string[] {
  const result: string[] = [];
  for (const url of queue) {
    const path = typeof url === "string" ? MEDIA_PATH_AT_END.exec(url)?.[1] : undefined;
    if (!path || savedPayloadText.includes(path) || result.includes(url)) continue;
    result.push(url);
  }
  return result;
}

// Fixed Russian texts of the refusals of /api/uploads rewrite and delete, in the style of uploadRefusal.
export const mediaRewriteRefusal = {
  url: "Адрес не относится к картинкам сайта.",
  inUse: "Файл ещё используется: на него ссылается сохранённая запись.",
  server: "Не удалось сменить адрес картинки.",
} as const;
