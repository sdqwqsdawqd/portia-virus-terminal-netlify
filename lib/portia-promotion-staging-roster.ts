import {
  accessRosterFromRows,
  promotionRosterFromRows,
  type PromotionAccessResult,
  type PromotionRosterResult,
} from "./portia-promotion-sheet.ts";

type Env = Readonly<Record<string, string | undefined>>;

const projectIds = (value: string | undefined) =>
  (value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);

// The acceptance roster is visible only to an app bound to an isolated project (owner decision 1 of Phase 19).
// Same rule as the e2e target guard, repeated here because production code must not import test support.
export function stagingRosterPath(env: Env): string | null {
  const path = env.PORTIA_PROMOTION_STAGING_ROSTER?.trim();
  if (!path || env.CONTEXT?.trim().toLowerCase() === "production") return null;
  const ref = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/u.exec((env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().toLowerCase())?.[1];
  const production = projectIds(env.PORTIA_E2E_PRODUCTION_PROJECT_IDS);
  if (!ref || production.length === 0 || production.includes(ref)) return null;
  return projectIds(env.PORTIA_E2E_ISOLATED_PROJECT_IDS).includes(ref) ? path : null;
}

const invalid = { status: "invalid-source", reason: "invalid-data" } as const;

function parse<T>(rows: unknown, build: (rows: string[][]) => T) {
  try {
    return { status: "ok", roster: build(rows as string[][]) } as const;
  } catch {
    return invalid;
  }
}

/** roster.json is `{ access: string[][], promotion: string[][] }`; a missing file is "unavailable", never the live table. */
export async function loadStagingRoster(path: string): Promise<{ access: PromotionAccessResult; promotion: PromotionRosterResult }> {
  let text: string;
  try {
    const { readFile } = await import("node:fs/promises");
    text = await readFile(path, "utf8");
  } catch {
    const unavailable = { status: "unavailable", reason: "network" } as const;
    return { access: unavailable, promotion: unavailable };
  }
  let file: { access?: unknown; promotion?: unknown };
  try {
    file = JSON.parse(text);
  } catch {
    return { access: invalid, promotion: invalid };
  }
  return { access: parse(file?.access, accessRosterFromRows), promotion: parse(file?.promotion, promotionRosterFromRows) };
}
