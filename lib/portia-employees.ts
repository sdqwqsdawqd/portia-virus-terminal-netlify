import type { SupabaseClient } from "@supabase/supabase-js";

export type PortiaEmployee = {
  id: string;
  nickname: string;
  callsign: string;
  title: string;
  rank: string;
  knowledgeRating: number;
  biography: string;
  photoUrl: string;
  robloxUserId: number | null;
  robloxAvatarUrl: string;
  robloxFullAvatarUrl: string;
  order: number;
};

type EditableFields = "knowledgeRating" | "biography" | "photoUrl";
export type RosterEmployee = Omit<PortiaEmployee, EditableFields>;
export type EmployeeProfile = Pick<PortiaEmployee, EditableFields>;

// The roster comes live from Google Sheets + Roblox (the CDN caches the API response).
// Editor-written fields live in Supabase (portia_employee_profiles).
type ProfileRow = { employee_id: string; nickname: string; biography: string; photo_url: string; knowledge_rating: number };
type RobloxProfile = { id: number; avatarUrl: string; fullAvatarUrl: string };
export type ProfileIndex = { byId: Map<string, EmployeeProfile>; robloxIdByNickname: Map<string, number> };

const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/gviz/tq?tqx=out:csv&sheet=Portia";
// The sheet has 34 numbered staff slots (rows 2-35); row 36 onwards holds totals and notes.
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
      byName.set(nicknameKey(user.requestedUsername || user.name), { id: user.id, avatarUrl: headshots.get(user.id) ?? "", fullAvatarUrl: fullAvatars.get(user.id) ?? "" });
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
    }];
  });
}

const emptyProfile: EmployeeProfile = { knowledgeRating: 1, biography: "", photoUrl: "" };

export async function readEmployeeProfiles(supabase: SupabaseClient): Promise<ProfileIndex> {
  const { data, error } = await supabase
    .from("portia_employee_profiles")
    .select("employee_id, nickname, biography, photo_url, knowledge_rating")
    .returns<ProfileRow[]>();
  if (error) throw error;
  const rows = data ?? [];
  return {
    byId: new Map(rows.map((row) => [row.employee_id, {
      biography: row.biography,
      photoUrl: row.photo_url,
      knowledgeRating: row.knowledge_rating,
    } satisfies EmployeeProfile])),
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

export async function loadEmployees(supabase: SupabaseClient) {
  const [sheetResponse, profiles] = await Promise.all([
    fetch(sheetCsvUrl, { cache: "no-store", signal: AbortSignal.timeout(8_000) }),
    readEmployeeProfiles(supabase).catch((error) => {
      console.error("PORTIA employee profiles read failed", error);
      return null;
    }),
  ]);
  if (!sheetResponse.ok) throw new Error(`Google Sheets returned ${sheetResponse.status}`);
  const rows = parseCsv(await sheetResponse.text());
  const index = profiles ?? { byId: new Map(), robloxIdByNickname: new Map() };
  const sheetOnly = rosterFromRows(rows, new Map(), index.robloxIdByNickname);
  const roblox = await resolveRobloxProfiles(sheetOnly.map((employee) => employee.nickname));
  return {
    employees: rosterFromRows(rows, roblox.byName, index.robloxIdByNickname).map((employee) => withProfile(employee, index)),
    syncedAt: new Date().toISOString(),
    // An incomplete answer is cached only briefly so avatars and biographies return quickly.
    complete: Boolean(profiles) && roblox.ok,
  };
}

export async function saveEmployeeProfile(supabase: SupabaseClient, employee: RosterEmployee, profile: EmployeeProfile, userId: string) {
  const { error } = await supabase.from("portia_employee_profiles").upsert({
    employee_id: employee.id,
    nickname: employee.nickname,
    biography: profile.biography,
    photo_url: profile.photoUrl,
    knowledge_rating: profile.knowledgeRating,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
  if (error) throw error;
}

export function sanitizeEmployeeUpdate(value: unknown): EmployeeProfile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { biography?: unknown; photoUrl?: unknown; knowledgeRating?: unknown };
  const photoUrl = typeof candidate.photoUrl === "string" ? candidate.photoUrl.trim().slice(0, 2048) : "";
  if (photoUrl && !photoUrl.startsWith("https://") && !photoUrl.startsWith("/")) return null;
  const knowledgeRating = Number(candidate.knowledgeRating);
  return {
    biography: typeof candidate.biography === "string" ? candidate.biography.slice(0, 20_000) : "",
    photoUrl,
    knowledgeRating: Number.isFinite(knowledgeRating) ? Math.min(10, Math.max(1, Math.round(knowledgeRating))) : 1,
  };
}
