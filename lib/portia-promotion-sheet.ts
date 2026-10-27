import { parseCsv } from "./portia-employees.ts";
import {
  normalizePromotionTitle,
  promotionTitles,
  type PromotionRosterEntry,
  type PromotionTitleId,
} from "./portia-promotion.ts";

const promotionCsvUrl = "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/gviz/tq?tqx=out:csv&sheet=Portia&range=A61:E85";
const expectedHeaders = ["НИК", "Звание", "След. звание", "Анти-Спидран", "Дата"] as const;
const maxCsvLength = 128 * 1024;

export type PromotionRosterResult =
  | { status: "ok"; roster: PromotionRosterEntry[] }
  | { status: "unavailable"; reason: "network" | "http" | "invalid-data" };

function normalizedNickname(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
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
  const timestamp = Date.UTC(year, month - 1, date);
  const parsed = new Date(timestamp);
  if (
    !Number.isFinite(timestamp)
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== date
  ) throw new Error("Promotion sheet date is invalid.");
  return parsed.toISOString();
}

function expectedNextTitle(titleId: PromotionTitleId) {
  const title = promotionTitles.find((item) => item.id === titleId)!;
  return promotionTitles.at(title.level)?.id ?? null;
}

export function promotionRosterFromRows(rows: string[][]): PromotionRosterEntry[] {
  const headers = rows[0]?.map((value) => value.trim().replace(/^\uFEFF/, "")) ?? [];
  if (headers.length !== expectedHeaders.length || expectedHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error("The promotion sheet headers have changed.");
  }

  const seen = new Set<string>();
  return rows.slice(1, 26).flatMap((row) => {
    const nickname = cleanCell(row[0], 64);
    if (!nickname) return [];
    const nicknameKey = normalizedNickname(nickname);
    if (seen.has(nicknameKey)) throw new Error("The promotion sheet contains duplicate nicknames.");
    seen.add(nicknameKey);

    const title = cleanCell(row[1], 64);
    const titleId = normalizePromotionTitle(title);
    const nextTitle = cleanCell(row[2], 64);
    const nextTitleId = nextTitle ? normalizePromotionTitle(nextTitle) : null;
    const antiSpeedrun = cleanCell(row[3], 128);
    const promotedAt = parseSheetDate(cleanCell(row[4], 32));
    if (!titleId || nextTitleId !== expectedNextTitle(titleId) || !antiSpeedrun) {
      throw new Error("The promotion sheet row is invalid.");
    }
    return [{ nickname, nicknameKey, title, titleId, nextTitle, nextTitleId, antiSpeedrun, promotedAt }];
  });
}

export function findPromotionRosterEntry(roster: PromotionRosterEntry[], nickname: string) {
  const key = normalizedNickname(nickname);
  return key ? roster.find((entry) => entry.nicknameKey === key) : undefined;
}

/** Reads only the promotion range. A failure is never represented as an empty healthy roster. */
export async function loadPromotionRoster(fetchImpl: typeof fetch = fetch): Promise<PromotionRosterResult> {
  let response: Response;
  try {
    response = await fetchImpl(promotionCsvUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { status: "unavailable", reason: "network" };
  }
  if (!response.ok) return { status: "unavailable", reason: "http" };
  try {
    const csv = await response.text();
    if (!csv || csv.length > maxCsvLength) throw new Error("Promotion sheet response is empty or oversized.");
    return { status: "ok", roster: promotionRosterFromRows(parseCsv(csv)) };
  } catch {
    return { status: "unavailable", reason: "invalid-data" };
  }
}
