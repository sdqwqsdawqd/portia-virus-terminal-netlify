import type { PortiaContent, RichTextDocument } from "./portia-content.ts";
import { portiaTextKey } from "./portia-content.ts";

// One set of limits for the editor and the server. Invisible limits only make the editor warn near «СОХРАНИТЬ»;
// the server never cuts content to meet them (D-01, D-16).
export const MAX_RICH_RUNS = 5_000;
export const MAX_RUN_CHARS = 1_000_000;
export const MAX_FORMATTED_KEYS = 10_000;
export const MAX_CONDITIONS = 40_000;
export const MAX_BLOCK_TEXT = 200_000;

// Visible limits: the editor disables «+» when reached (D-15). Scientist logs are also capped by the server (D-25).
export const MAX_TABLE_ROWS = 500;
export const MAX_BLOCKS = 300;
export const MAX_SUBSECTIONS = 150;
export const MAX_SCIENTIST_LOGS = 5;

// 1 MB under Netlify's 6 MB buffered request limit (docs.netlify.com/build/functions/configuration, checked 2026-10-25) (D-23).
export const MAX_CONTENT_BODY_BYTES = 5_000_000;

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export type LimitStatus = "free" | "counter" | "full";

// D-15: the counter shows only near the limit, from 80%.
export function limitStatus(count: number, max: number): LimitStatus {
  if (count >= max) return "full";
  return count >= Math.ceil(max * 0.8) ? "counter" : "free";
}

export function limitText(count: number, max: number): string {
  const status = limitStatus(count, max);
  if (status === "full") return `МАКСИМУМ ${max}`;
  return status === "counter" ? `${count} / ${max}` : "";
}

const isBigDocument = (doc?: RichTextDocument) => !!doc && (doc.runs.length > MAX_RICH_RUNS || doc.runs.some((run) => run.text.length > MAX_RUN_CHARS));
const labelOf = (kind: string, name: string) => `${kind} «${name || "БЕЗ НАЗВАНИЯ"}»`;

// Invisible limits (D-16): the editor only warns, naming the first fields in editor tab order.
export function oversizeFields(content: PortiaContent): string[] {
  const formatted = content.formattedText ?? {};
  const keys = Object.keys(formatted);
  const big = keys.filter((key) => isBigDocument(formatted[key]));
  const hasBig = (prefix: string) => big.some((key) => key.startsWith(prefix));
  const found: string[] = [];
  const add = (label: string) => { if (!found.includes(label)) found.push(label); };
  for (const virus of [...content.viruses, ...(content.recycledViruses ?? [])]) if (hasBig(`virus:${virus.id}:`)) add(labelOf("ВИРУС", virus.name));
  for (const section of content.infoSections) {
    if (big.includes(portiaTextKey.info(section.id))) add(labelOf("РАЗДЕЛ", section.title));
    for (const subsection of section.subsections) {
      if (subsection.blocks.some((block) => block.type === "text" && (block.text.length > MAX_BLOCK_TEXT || big.includes(portiaTextKey.infoBlock(block.id))))) add(labelOf("ПОДРАЗДЕЛ", subsection.title));
    }
  }
  for (const item of content.broadcasts) if (item.conditions.length > MAX_CONDITIONS || big.includes(portiaTextKey.broadcast(item.id))) add(labelOf("СВОДКА", item.title));
  for (const file of content.recycleFiles) if (big.includes(portiaTextKey.recycle(file.id))) add(labelOf("ФАЙЛ", file.name));
  if (big.includes(portiaTextKey.searchRecommendations)) add("РЕКОМЕНДАЦИИ");
  if (hasBig("assistant:")) add("ПОМОЩНИК");
  if (keys.length > MAX_FORMATTED_KEYS) add("ОФОРМЛЕНИЕ ТЕКСТОВ");
  return found;
}

export function oversizeMessage(fields: string[]): string {
  if (!fields.length) return "";
  const more = fields.length > 1 ? ` И ЕЩЁ ${fields.length - 1}` : "";
  return `ТЕКСТ ОЧЕНЬ БОЛЬШОЙ: ${fields[0]}${more}. СОХРАНЯЕТСЯ ЦЕЛИКОМ.`;
}

// The longest possible revision makes this an upper bound of what saveContent sends (D-23).
export function contentBodyBytes(content: PortiaContent): number {
  return utf8Bytes(JSON.stringify({ content, revision: Number.MAX_SAFE_INTEGER }));
}

export function bodyTooLargeMessage(bytes: number): string {
  if (bytes <= MAX_CONTENT_BODY_BYTES) return "";
  return `СЛИШКОМ МНОГО ДАННЫХ: ${(bytes / 1_000_000).toFixed(1)} МБ ИЗ ${(MAX_CONTENT_BODY_BYTES / 1_000_000).toFixed(1)}. СОКРАТИТЕ ТЕКСТ, ЧТОБЫ СОХРАНИТЬ.`;
}
