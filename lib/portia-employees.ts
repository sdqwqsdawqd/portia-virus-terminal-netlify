import type { SupabaseClient } from "@supabase/supabase-js";

export type PortiaEmployee = {
  id: string;
  nickname: string;
  callsign: string;
  title: string;
  rank: string;
  knowledgeRating: number;
  pawsRating: number | null;
  bioRating: number | null;
  sRating: number | null;
  activityRating: number | null;
  testsRating: number | null;
  overallRating: number | null;
  biography: string;
  photoUrl: string;
  robloxUserId: number | null;
  robloxAvatarUrl: string;
  robloxFullAvatarUrl: string;
  order: number;
  /** "sheet": a row of the Google Sheet; "manual": added by an editor outside the sheet (D-02). */
  source: "sheet" | "manual";
};

type OptionalRatingKey = "pawsRating" | "bioRating" | "sRating" | "activityRating" | "testsRating" | "overallRating";
type EditableFields = "knowledgeRating" | OptionalRatingKey | "biography" | "photoUrl";
export type RosterEmployee = Omit<PortiaEmployee, EditableFields>;
export type EmployeeProfile = Pick<PortiaEmployee, EditableFields>;
/** A save: ratings missing here are not changed; null clears one. */
export type EmployeeUpdate = Omit<EmployeeProfile, OptionalRatingKey> & Partial<Pick<EmployeeProfile, OptionalRatingKey>>;

// Rename a rating here only: the editor fields and the profile card both render from this table (D-01).
// knowledge_rating stays in the database (not null) but is no longer shown or edited (owner, 2026-10-18).
export const employeeRatings = [
  // paws_rating / s_rating keep their first column names; only the labels changed (owner, 2026-10-18).
  { key: "pawsRating", column: "paws_rating", label: "Знания лаборатории" },
  { key: "testsRating", column: "tests_rating", label: "Знания тестов" },
  { key: "bioRating", column: "bio_rating", label: "Умение делать БИО" },
  { key: "sRating", column: "s_rating", label: "Умение делать СС" },
  { key: "activityRating", column: "activity_rating", label: "Актив" },
  { key: "overallRating", column: "overall_rating", label: "Общая" },
] as const;
const optionalRatings: ReadonlyArray<{ key: OptionalRatingKey; column: string; label: string }> = employeeRatings;

/** The editable fields of an employee; a roster cached before the ratings existed has none of the new ones. */
export function profileOf(employee: PortiaEmployee): EmployeeProfile {
  return {
    biography: employee.biography,
    photoUrl: employee.photoUrl,
    knowledgeRating: employee.knowledgeRating,
    pawsRating: employee.pawsRating ?? null,
    bioRating: employee.bioRating ?? null,
    sRating: employee.sRating ?? null,
    activityRating: employee.activityRating ?? null,
    testsRating: employee.testsRating ?? null,
    overallRating: employee.overallRating ?? null,
  };
}

/** Whether the draft differs from the saved profile; null and a missing new rating are the same, whitespace is not. */
export function profileChanged(saved: EmployeeProfile, draft: EmployeeProfile): boolean {
  return saved.biography !== draft.biography || saved.photoUrl !== draft.photoUrl
    || employeeRatings.some(({ key }) => (saved[key] ?? null) !== (draft[key] ?? null));
}

export function isMissingColumnError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST204" || error?.code === "42703";
}

/** The table is not in the database yet (PostgREST schema cache / Postgres undefined_table). */
export function isMissingTableError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** Whether an /api/employees answer may replace the roster on screen and in the cache. */
export function acceptsRoster(payload: { employees?: unknown; degraded?: unknown }): payload is { employees: PortiaEmployee[]; syncedAt?: string | null; degraded?: boolean } {
  // An empty roster comes only from a complete answer: a failed or partial sync must not wipe the list on every device (D-09 #8).
  return Array.isArray(payload.employees) && (payload.employees.length > 0 || payload.degraded === false);
}

// The roster comes live from Google Sheets + Roblox (the CDN caches the API response).
// Editor-written fields live in Supabase (portia_employee_profiles).
type ProfileColumns = { biography: string; photo_url: string; knowledge_rating: number; [column: string]: unknown };
type ProfileRow = ProfileColumns & { employee_id: string; nickname: string };
type RobloxProfile = { id: number; name: string; avatarUrl: string; fullAvatarUrl: string };
export type ProfileIndex = { byId: Map<string, EmployeeProfile>; robloxIdByNickname: Map<string, number> };

const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/gviz/tq?tqx=out:csv&sheet=Portia";
// The sheet has exactly 34 numbered staff places (rows 2-35); row 36 onwards holds totals and notes.
// The owner confirmed (2026-10-20) rows after the 34th are never filled, so the limit is not raised and nothing warns.
// If the sheet ever grows, change this constant and this comment together.
const staffRowsEnd = 35;

export function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function cleanText(value: string | undefined) {
  const cleaned = (value ?? "").trim().replace(/^"|"$/g, "").trim();
  return cleaned === "—" || cleaned === "-" || cleaned === "N/A" ? "" : cleaned;
}

function nicknameKey(nickname: string) {
  return nickname.trim().toLocaleLowerCase("en-US");
}

// A Roblox user id survives nickname changes; the nickname is only a fallback.
export function employeeId(nickname: string, robloxUserId: number | null) {
  return robloxUserId ? `roblox-${robloxUserId}` : `nick-${nicknameKey(nickname).replace(/[^a-z0-9_]+/g, "-")}`;
}

async function resolveRobloxProfiles(usernames: string[]) {
  const byName = new Map<string, RobloxProfile>();
  if (!usernames.length) return { byName, ok: true };
  try {
    const usersResponse = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usernames, excludeBannedUsers: false }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!usersResponse.ok) return { byName, ok: false };
    const usersPayload = await usersResponse.json() as { data?: Array<{ id: number; name: string; requestedUsername?: string }> };
    const users = (usersPayload.data ?? []).filter((user) => Number.isFinite(user.id));
    if (!users.length) return { byName, ok: true };
    const userIds = users.map((user) => user.id).join(",");
    const [headshotsResponse, fullAvatarsResponse] = await Promise.all([
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds}&size=420x420&format=Png&isCircular=false`, { signal: AbortSignal.timeout(5_000) }),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userIds}&size=720x720&format=Png&isCircular=false`, { signal: AbortSignal.timeout(5_000) }),
    ]);
    const headshotsPayload = headshotsResponse.ok
      ? await headshotsResponse.json() as { data?: Array<{ targetId: number; imageUrl?: string; state?: string }> }
      : { data: [] };
    const fullAvatarsPayload = fullAvatarsResponse.ok
      ? await fullAvatarsResponse.json() as { data?: Array<{ targetId: number; imageUrl?: string; state?: string }> }
      : { data: [] };
    const headshots = new Map((headshotsPayload.data ?? []).map((item) => [item.targetId, item.imageUrl ?? ""]));
    const fullAvatars = new Map((fullAvatarsPayload.data ?? []).map((item) => [item.targetId, item.imageUrl ?? ""]));
    users.forEach((user) => {
      byName.set(nicknameKey(user.requestedUsername || user.name), { id: user.id, name: user.name, avatarUrl: headshots.get(user.id) ?? "", fullAvatarUrl: fullAvatars.get(user.id) ?? "" });
    });
    return { byName, ok: headshotsResponse.ok && fullAvatarsResponse.ok };
  } catch (error) {
    console.error("PORTIA Roblox profile lookup failed", error);
    return { byName, ok: false };
  }
}

export function rosterFromRows(
  rows: string[][],
  robloxProfiles: Map<string, RobloxProfile>,
  knownRobloxIds: Map<string, number> = new Map(),
): RosterEmployee[] {
  const header = rows[0] ?? [];
  const nicknameIndex = header.indexOf("Никнейм сотрудника");
  const callsignIndex = header.indexOf("Позывной");
  const titleIndex = header.indexOf("Звание");
  const rankIndex = header.indexOf("Ранг");
  if ([nicknameIndex, callsignIndex, titleIndex, rankIndex].some((index) => index < 0)) {
    throw new Error("The Portia sheet headers have changed.");
  }

  const seenIds = new Set<string>();
  return rows.slice(1, staffRowsEnd).flatMap((row, rowIndex) => {
    const nickname = cleanText(row[nicknameIndex]);
    if (!nickname) return [];
    const key = nicknameKey(nickname);
    const profile = robloxProfiles.get(key);
    // If Roblox is briefly unreachable, the account saved with the profile keeps the id stable.
    const robloxUserId = profile?.id ?? knownRobloxIds.get(key) ?? null;
    const id = employeeId(nickname, robloxUserId);
    if (seenIds.has(id)) return [];
    seenIds.add(id);
    return [{
      id,
      nickname,
      callsign: cleanText(row[callsignIndex]),
      title: cleanText(row[titleIndex]),
      rank: cleanText(row[rankIndex]),
      robloxUserId,
      robloxAvatarUrl: profile?.avatarUrl ?? "",
      robloxFullAvatarUrl: profile?.fullAvatarUrl ?? "",
      order: rowIndex,
      source: "sheet" as const,
    }];
  });
}

const emptyProfile: EmployeeProfile = { knowledgeRating: 1, pawsRating: null, bioRating: null, sRating: null, activityRating: null, testsRating: null, overallRating: null, biography: "", photoUrl: "" };

// Stored junk is shown as "not rated" rather than clamped into a different number.
const storedRating = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10 ? value : null);

export function profileFromRow(row: ProfileColumns): EmployeeProfile {
  return {
    biography: row.biography,
    photoUrl: row.photo_url,
    knowledgeRating: row.knowledge_rating,
    pawsRating: storedRating(row.paws_rating),
    bioRating: storedRating(row.bio_rating),
    sRating: storedRating(row.s_rating),
    activityRating: storedRating(row.activity_rating),
    testsRating: storedRating(row.tests_rating),
    overallRating: storedRating(row.overall_rating),
  };
}

export async function readEmployeeProfiles(supabase: SupabaseClient): Promise<ProfileIndex> {
  // select("*") so columns the database does not have yet cannot fail the whole read.
  const { data, error } = await supabase
    .from("portia_employee_profiles")
    .select("*")
    .returns<ProfileRow[]>();
  if (error) throw error;
  const rows = data ?? [];
  return {
    byId: new Map(rows.map((row) => [row.employee_id, profileFromRow(row)])),
    robloxIdByNickname: new Map(rows.flatMap((row) => {
      const robloxId = Number(row.employee_id.match(/^roblox-(\d+)$/)?.[1]);
      return row.nickname && robloxId ? [[nicknameKey(row.nickname), robloxId] as const] : [];
    })),
  };
}

export function withProfile(employee: RosterEmployee, profiles: ProfileIndex): PortiaEmployee {
  // A profile saved before the Roblox account was resolved stays reachable by nickname.
  const profile = profiles.byId.get(employee.id) ?? profiles.byId.get(employeeId(employee.nickname, null)) ?? emptyProfile;
  return { ...employee, ...profile };
}

// People added by editors outside the Google Sheet (phase 03.3); title, rank and callsign are typed at add time.
export type ManualEmployeeInput = { nickname: string; title: string; rank: string; callsign: string };
export type ManualRow = { employee_id: string; nickname: string; title: string; rank: string; callsign: string };

const manualTableName = "portia_manual_employees";
const robloxNickname = /^[A-Za-z0-9_]{3,20}$/;

export function sanitizeManualEmployee(value: unknown): ManualEmployeeInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const text = (field: unknown) => (typeof field === "string" ? field.trim().slice(0, 64) : "");
  const nickname = typeof candidate.nickname === "string" ? candidate.nickname.trim() : "";
  if (!nickname) return null;
  return { nickname, title: text(candidate.title), rank: text(candidate.rank), callsign: text(candidate.callsign) };
}

/** Explicit columns, so created_by never reaches an API answer. A missing table is an empty, healthy list. */
export async function readManualEmployees(supabase: SupabaseClient): Promise<{ rows: ManualRow[]; ok: boolean }> {
  try {
    const { data, error } = await supabase
      .from(manualTableName)
      .select("employee_id, nickname, title, rank, callsign")
      .order("created_at")
      .returns<ManualRow[]>();
    if (!error) return { rows: data ?? [], ok: true };
    if (isMissingTableError(error)) return { rows: [], ok: true };
    console.error("PORTIA manual employees read failed", error);
  } catch (error) {
    console.error("PORTIA manual employees read failed", error);
  }
  return { rows: [], ok: false };
}

/** The sheet staff first, then the manual rows; the sheet wins when the same Roblox account is in both (D-03). */
export function mergeManualEmployees(sheet: RosterEmployee[], rows: ManualRow[], robloxByName: Map<string, RobloxProfile>): RosterEmployee[] {
  const ids = new Set(sheet.map((employee) => employee.id));
  const nicknames = new Set(sheet.map((employee) => nicknameKey(employee.nickname)));
  const manual: RosterEmployee[] = [];
  for (const row of rows) {
    if (ids.has(row.employee_id) || nicknames.has(nicknameKey(row.nickname))) continue;
    const profile = robloxByName.get(nicknameKey(row.nickname));
    manual.push({
      id: row.employee_id,
      nickname: profile?.name ?? row.nickname,
      callsign: row.callsign,
      title: row.title,
      rank: row.rank,
      robloxUserId: Number(row.employee_id.match(/^roblox-(\d+)$/)?.[1]) || null,
      robloxAvatarUrl: profile?.avatarUrl ?? "",
      robloxFullAvatarUrl: profile?.fullAvatarUrl ?? "",
      order: sheet.length + manual.length,
      source: "manual",
    });
  }
  return [...sheet, ...manual];
}

export async function loadEmployees(supabase: SupabaseClient) {
  const [sheetResponse, profiles, manual] = await Promise.all([
    fetch(sheetCsvUrl, { cache: "no-store", signal: AbortSignal.timeout(8_000) }),
    readEmployeeProfiles(supabase).catch((error) => {
      console.error("PORTIA employee profiles read failed", error);
      return null;
    }),
    readManualEmployees(supabase),
  ]);
  if (!sheetResponse.ok) throw new Error(`Google Sheets returned ${sheetResponse.status}`);
  const rows = parseCsv(await sheetResponse.text());
  const index = profiles ?? { byId: new Map(), robloxIdByNickname: new Map() };
  const sheetOnly = rosterFromRows(rows, new Map(), index.robloxIdByNickname);
  // shortcut: manual employees are looked up by their stored nickname; after a Roblox rename the avatar is empty until they are removed and added again.
  const roblox = await resolveRobloxProfiles([...sheetOnly, ...manual.rows].map((employee) => employee.nickname));
  const roster = mergeManualEmployees(rosterFromRows(rows, roblox.byName, index.robloxIdByNickname), manual.rows, roblox.byName);
  return {
    employees: roster.map((employee) => withProfile(employee, index)),
    syncedAt: new Date().toISOString(),
    // An incomplete answer is cached only briefly so avatars and biographies return quickly.
    complete: Boolean(profiles) && roblox.ok && manual.ok,
    // Without the stored profiles every employee looks blank; a save from that would wipe them.
    profilesRead: Boolean(profiles),
    profiles: index,
  };
}

export type AddManualResult =
  | { status: "added"; employee: RosterEmployee }
  | { status: "not-found" | "duplicate" | "roblox-unavailable" | "pending-database" };

/** Adds a person by Roblox nickname; `roster` is the current merged list, used to refuse a person already in it. */
export async function addManualEmployee(supabase: SupabaseClient, input: ManualEmployeeInput, roster: RosterEmployee[], userId: string): Promise<AddManualResult> {
  if (!robloxNickname.test(input.nickname)) return { status: "not-found" };
  const lookup = await resolveRobloxProfiles([input.nickname]);
  const found = lookup.byName.get(nicknameKey(input.nickname));
  // "ok" is false for a failed thumbnail call too, so only a missing user decides between the two refusals.
  if (!found) return { status: lookup.ok ? "not-found" : "roblox-unavailable" };
  const id = employeeId(input.nickname, found.id);
  if (roster.some((employee) => employee.id === id || nicknameKey(employee.nickname) === nicknameKey(input.nickname))) return { status: "duplicate" };
  const { error } = await supabase.from(manualTableName).insert({
    employee_id: id,
    nickname: found.name,
    title: input.title,
    rank: input.rank,
    callsign: input.callsign,
    created_by: userId,
  });
  if (error?.code === "23505") return { status: "duplicate" };
  if (isMissingTableError(error)) return { status: "pending-database" };
  if (error) throw error;
  return {
    status: "added",
    employee: {
      id,
      nickname: found.name,
      callsign: input.callsign,
      title: input.title,
      rank: input.rank,
      robloxUserId: found.id,
      robloxAvatarUrl: found.avatarUrl,
      robloxFullAvatarUrl: found.fullAvatarUrl,
      order: roster.length,
      source: "manual",
    },
  };
}

export type ManualDetails = Pick<ManualEmployeeInput, "title" | "rank" | "callsign">;

export function sanitizeManualDetails(value: unknown): ManualDetails | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const text = (field: unknown) => (typeof field === "string" ? field.trim().slice(0, 64) : "");
  return { title: text(candidate.title), rank: text(candidate.rank), callsign: text(candidate.callsign) };
}

/** Title, rank and callsign of a manual employee; sheet employees keep the values from the sheet. */
export async function updateManualEmployee(supabase: SupabaseClient, employee: RosterEmployee, details: ManualDetails): Promise<{ status: "updated" | "sheet" | "pending-database" }> {
  if (employee.source !== "manual") return { status: "sheet" };
  const { data, error } = await supabase.from(manualTableName).update(details).eq("employee_id", employee.id).select("employee_id");
  // Before the update grant and policy exist: 42501 without the grant, zero rows without the policy.
  if (error?.code === "42501" || isMissingTableError(error)) return { status: "pending-database" };
  if (error) throw error;
  return { status: data?.length ? "updated" : "pending-database" };
}

/** Only a manual employee is removed, and only its manual row: the stored profile stays for a later re-add or a sheet row. */
export async function removeManualEmployee(supabase: SupabaseClient, roster: RosterEmployee[], id: string): Promise<{ status: "deleted" | "not-found" | "sheet" }> {
  const employee = roster.find((item) => item.id === id);
  if (!employee) return { status: "not-found" };
  // Sheet rows are decided here, before any database call (T-03.3-02).
  if (employee.source !== "manual") return { status: "sheet" };
  const { data, error } = await supabase.from(manualTableName).delete().eq("employee_id", id).select("employee_id");
  if (error) throw error;
  return { status: data?.length ? "deleted" : "not-found" };
}

export async function saveEmployeeProfile(supabase: SupabaseClient, employee: RosterEmployee, profile: EmployeeUpdate, userId: string) {
  const base = {
    employee_id: employee.id,
    nickname: employee.nickname,
    biography: profile.biography,
    photo_url: profile.photoUrl,
    knowledge_rating: profile.knowledgeRating,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
  const ratings = Object.fromEntries(optionalRatings.flatMap((rating) => (profile[rating.key] === undefined ? [] : [[rating.column, profile[rating.key]]])));
  const table = supabase.from("portia_employee_profiles");
  const { error } = await table.upsert({ ...base, ...ratings });
  if (!error) return { ratingsSaved: true };
  // Tolerates the rating columns being absent until 03.2-06 applies the SQL.
  if (!isMissingColumnError(error) || !Object.keys(ratings).length) throw error;
  const retry = await table.upsert(base);
  if (retry.error) throw retry.error;
  return { ratingsSaved: false };
}

export function sanitizeEmployeeUpdate(value: unknown): EmployeeUpdate | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const photoUrl = typeof candidate.photoUrl === "string" ? candidate.photoUrl.trim().slice(0, 2048) : "";
  if (photoUrl && !photoUrl.startsWith("https://") && !photoUrl.startsWith("/")) return null;
  const knowledgeRating = Number(candidate.knowledgeRating);
  const update: EmployeeUpdate = {
    biography: typeof candidate.biography === "string" ? candidate.biography.slice(0, 20_000) : "",
    photoUrl,
    knowledgeRating: Number.isFinite(knowledgeRating) ? Math.min(10, Math.max(1, Math.round(knowledgeRating))) : 1,
  };
  for (const { key } of optionalRatings) {
    const raw = candidate[key];
    if (raw === null || (typeof raw === "string" && !raw.trim())) update[key] = null;
    else if (typeof raw === "number" || typeof raw === "string") {
      // A value that is not a number leaves the rating unchanged rather than wiping it.
      const rating = Number(raw);
      if (Number.isFinite(rating)) update[key] = Math.min(10, Math.max(1, Math.round(rating)));
    }
  }
  return update;
}
