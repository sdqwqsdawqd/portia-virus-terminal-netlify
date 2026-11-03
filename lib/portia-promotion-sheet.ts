import { parseCsv } from "./portia-employees.ts";
import {
  normalizePromotionTitle,
  promotionTitles,
  type PromotionRosterEntry,
  type PromotionTitleId,
} from "./portia-promotion.ts";
import { loadStagingRoster, stagingRosterPath } from "./portia-promotion-staging-roster.ts";

const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/gviz/tq?tqx=out:csv&sheet=Portia";
const accessCsvUrl = `${sheetCsvUrl}&range=B2:B35`;
const promotionCsvUrl = `${sheetCsvUrl}&range=A61:E85`;
const expectedHeaders = ["НИК", "Звание", "След. звание", "Анти-Спидран", "Дата"] as const;
const maxCsvLength = 128 * 1024;

export type PromotionRosterResult =
  | { status: "ok"; roster: PromotionRosterEntry[] }
  | { status: "unavailable"; reason: "network" | "http" }
  | { status: "invalid-source"; reason: "invalid-data" };

export type PromotionAccessEntry = { nickname: string; nicknameKey: string };
export type PromotionAccessResult =
  | { status: "ok"; roster: PromotionAccessEntry[] }
  | { status: "unavailable"; reason: "network" | "http" }
  | { status: "invalid-source"; reason: "invalid-data" };

function normalizedNickname(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

function cleanCell(value: string | undefined, maxLength: number) {
  const cleaned = (value ?? "").trim();
  if (cleaned.length > maxLength) throw new Error("Promotion sheet field is too long.");
  return cleaned;
}

function parseSheetDate(value: string) {
  const cleaned = value.trim();
  const match = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [year, month, date] = match
    ? [Number(match[3]), Number(match[2]), Number(match[1])]
    : isoMatch
      ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
      : [NaN, NaN, NaN];
  // The sheet value is a Moscow calendar date. Europe/Moscow is UTC+03:00
  // throughout the supported promotion history, so midnight is 21:00 UTC.
  const timestamp = Date.UTC(year, month - 1, date, -3);
  const moscowDate = new Date(timestamp + 3 * 60 * 60 * 1_000);
  if (
    !Number.isFinite(timestamp)
    || moscowDate.getUTCFullYear() !== year
    || moscowDate.getUTCMonth() !== month - 1
    || moscowDate.getUTCDate() !== date
  ) throw new Error("Promotion sheet date is invalid.");
  return new Date(timestamp).toISOString();
}

export function accessRosterFromRows(rows: string[][]): PromotionAccessEntry[] {
  const seen = new Set<string>();
  return rows.slice(0, 34).flatMap((row) => {
    const nickname = cleanCell(row[0], 64);
    if (!nickname) return [];
    const nicknameKey = normalizedNickname(nickname);
    if (seen.has(nicknameKey)) throw new Error("The access roster contains duplicate nicknames.");
    seen.add(nicknameKey);
    return [{ nickname, nicknameKey }];
  });
}

export function findPromotionAccessEntry(roster: PromotionAccessEntry[], nickname: string) {
  const key = normalizedNickname(nickname);
  return key ? roster.find((entry) => entry.nicknameKey === key) : undefined;
}

function expectedNextTitle(titleId: PromotionTitleId) {
  const title = promotionTitles.find((item) => item.id === titleId)!;
  return promotionTitles.at(title.level)?.id ?? null;
}

function isEmptyPromotionSlot(row: string[]) {
  const cells = row.map((cell) => (cell ?? "").trim());
  if (cells.every((cell) => !cell)) return true;
  return cells[0] === ""
    && cells[1] === "N/A"
    && cells[2] === "N/A"
    && cells.slice(3).every((cell) => !cell);
}

export function promotionRosterFromRows(rows: string[][]): PromotionRosterEntry[] {
  const headers = rows[0]?.map((value) => value.trim().replace(/^\uFEFF/, "")) ?? [];
  const hasHeaders = headers.length === expectedHeaders.length
    && expectedHeaders.every((header, index) => headers[index] === header);
  const dataRows = hasHeaders ? rows.slice(1) : rows;

  const seen = new Set<string>();
  return dataRows.slice(0, 25).flatMap((row) => {
    const nickname = cleanCell(row[0], 64);
    if (!nickname) {
      if (isEmptyPromotionSlot(row)) return [];
      throw new Error("The promotion sheet contains a partial row.");
    }
    const nicknameKey = normalizedNickname(nickname);
    if (seen.has(nicknameKey)) throw new Error("The promotion sheet contains duplicate nicknames.");
    seen.add(nicknameKey);

    const title = cleanCell(row[1], 64);
    const titleId = normalizePromotionTitle(title);
    const nextTitle = cleanCell(row[2], 64);
    const nextTitleId = nextTitle ? normalizePromotionTitle(nextTitle) : null;
    const antiSpeedrun = cleanCell(row[3], 128);
    const availableFrom = parseSheetDate(cleanCell(row[4], 32));
    if (!titleId || nextTitleId !== expectedNextTitle(titleId) || !antiSpeedrun) {
      throw new Error("The promotion sheet row is invalid.");
    }
    return [{ nickname, nicknameKey, title, titleId, nextTitle, nextTitleId, antiSpeedrun, availableFrom }];
  });
}

export function findPromotionRosterEntry(roster: PromotionRosterEntry[], nickname: string) {
  const key = normalizedNickname(nickname);
  return key ? roster.find((entry) => entry.nicknameKey === key) : undefined;
}

async function loadSheetRows(url: string, fetchImpl: typeof fetch) {
  let response: Response;
  try {
    response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  } catch {
    return { status: "unavailable", reason: "network" } as const;
  }
  if (!response.ok) return { status: "unavailable", reason: "http" } as const;
  try {
    const csv = await response.text();
    if (!csv || csv.length > maxCsvLength) throw new Error("Promotion sheet response is empty or oversized.");
    return { status: "ok", rows: parseCsv(csv) } as const;
  } catch {
    return { status: "invalid-source", reason: "invalid-data" } as const;
  }
}

export async function loadPromotionAccessRoster(fetchImpl: typeof fetch = fetch): Promise<PromotionAccessResult> {
  const staging = stagingRosterPath(process.env);
  if (staging) return (await loadStagingRoster(staging)).access;
  const result = await loadSheetRows(accessCsvUrl, fetchImpl);
  if (result.status !== "ok") return result;
  try {
    return { status: "ok", roster: accessRosterFromRows(result.rows) };
  } catch {
    return { status: "invalid-source", reason: "invalid-data" };
  }
}

/** Reads only the promotion range. A failure is never represented as an empty healthy roster. */
export async function loadPromotionRoster(fetchImpl: typeof fetch = fetch): Promise<PromotionRosterResult> {
  const staging = stagingRosterPath(process.env);
  if (staging) return (await loadStagingRoster(staging)).promotion;
  const result = await loadSheetRows(promotionCsvUrl, fetchImpl);
  if (result.status !== "ok") return result;
  try {
    return { status: "ok", roster: promotionRosterFromRows(result.rows) };
  } catch {
    return { status: "invalid-source", reason: "invalid-data" };
  }
}
