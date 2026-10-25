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
