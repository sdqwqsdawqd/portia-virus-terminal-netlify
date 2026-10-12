import { getStore } from "@netlify/blobs";
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

// The roster is a cache of Google Sheets + Roblox. Editor-written fields live in
// Supabase (portia_employee_profiles), so the hourly sync can never overwrite them.
export type PortiaRosterSnapshot = {
  employees: RosterEmployee[];
  syncedAt: string;
  source: "google-sheets";
};

type ProfileRow = { employee_id: string; biography: string; photo_url: string; knowledge_rating: number };

const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/gviz/tq?tqx=out:csv&sheet=Portia";
const storeName = "portia-employees";
const snapshotKey = "roster-v2";
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
  const byName = new Map<string, { id: number; avatarUrl: string; fullAvatarUrl: string }>();
  if (!usernames.length) return byName;
  try {
    const usersResponse = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usernames, excludeBannedUsers: false }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!usersResponse.ok) return byName;
    const usersPayload = await usersResponse.json() as { data?: Array<{ id: number; name: string; requestedUsername?: string }> };
    const users = (usersPayload.data ?? []).filter((user) => Number.isFinite(user.id));
    if (!users.length) return byName;
    const userIds = users.map((user) => user.id).join(",");
    const [headshotsResponse, fullAvatarsResponse] = await Promise.all([
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds}&size=420x420&format=Png&isCircular=false`, { signal: AbortSignal.timeout(10_000) }),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userIds}&size=720x720&format=Png&isCircular=false`, { signal: AbortSignal.timeout(10_000) }),
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
  } catch (error) {
    console.error("PORTIA Roblox profile lookup failed", error);
  }
  return byName;
}

// getStore throws outside Netlify (local dev); the roster is then fetched live.
export async function readRosterSnapshot() {
  try {
    const store = getStore({ name: storeName, consistency: "strong" });
    return await store.get(snapshotKey, { type: "json", consistency: "strong" }) as PortiaRosterSnapshot | null;
  } catch (error) {
    console.error("PORTIA roster snapshot read failed", error);
    return null;
  }
}

async function writeRosterSnapshot(snapshot: PortiaRosterSnapshot) {
  try {
    const store = getStore({ name: storeName, consistency: "strong" });
    await store.setJSON(snapshotKey, snapshot, { metadata: { syncedAt: snapshot.syncedAt, count: snapshot.employees.length } });
  } catch (error) {
    console.error("PORTIA roster snapshot write failed", error);
  }
}

export function rosterFromRows(
  rows: string[][],
  robloxProfiles: Map<string, { id: number; avatarUrl: string; fullAvatarUrl: string }>,
  previous: RosterEmployee[] = [],
): RosterEmployee[] {
  const header = rows[0] ?? [];
  const nicknameIndex = header.indexOf("Никнейм сотрудника");
  const callsignIndex = header.indexOf("Позывной");
  const titleIndex = header.indexOf("Звание");
  const rankIndex = header.indexOf("Ранг");
  if ([nicknameIndex, callsignIndex, titleIndex, rankIndex].some((index) => index < 0)) {
    throw new Error("The Portia sheet headers have changed.");
  }

  const previousByNickname = new Map(previous.map((employee) => [nicknameKey(employee.nickname), employee]));
  const seenIds = new Set<string>();
  return rows.slice(1, staffRowsEnd).flatMap((row, rowIndex) => {
    const nickname = cleanText(row[nicknameIndex]);
    if (!nickname) return [];
    const key = nicknameKey(nickname);
    const profile = robloxProfiles.get(key);
    const earlier = previousByNickname.get(key);
    // If Roblox is briefly unreachable, keep the last known account so the id stays stable.
    const robloxUserId = profile?.id ?? earlier?.robloxUserId ?? null;
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
      robloxAvatarUrl: profile?.avatarUrl ?? earlier?.robloxAvatarUrl ?? "",
      robloxFullAvatarUrl: profile?.fullAvatarUrl ?? earlier?.robloxFullAvatarUrl ?? "",
      order: rowIndex,
    }];
  });
}

export async function syncRosterSnapshot() {
  const response = await fetch(sheetCsvUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);
  const rows = parseCsv(await response.text());
  const previous = await readRosterSnapshot();
  const sheetOnly = rosterFromRows(rows, new Map(), previous?.employees);
  const robloxProfiles = await resolveRobloxProfiles(sheetOnly.map((employee) => employee.nickname));
  const snapshot: PortiaRosterSnapshot = {
    employees: rosterFromRows(rows, robloxProfiles, previous?.employees),
    syncedAt: new Date().toISOString(),
    source: "google-sheets",
  };
  await writeRosterSnapshot(snapshot);
  return snapshot;
}

const emptyProfile: EmployeeProfile = { knowledgeRating: 1, biography: "", photoUrl: "" };

export async function readEmployeeProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("portia_employee_profiles")
    .select("employee_id, biography, photo_url, knowledge_rating")
    .returns<ProfileRow[]>();
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.employee_id, {
    biography: row.biography,
    photoUrl: row.photo_url,
    knowledgeRating: row.knowledge_rating,
  } satisfies EmployeeProfile]));
}

export function withProfile(employee: RosterEmployee, profiles: Map<string, EmployeeProfile>): PortiaEmployee {
  // A profile saved before the Roblox account was resolved stays reachable by nickname.
  const profile = profiles.get(employee.id) ?? profiles.get(employeeId(employee.nickname, null)) ?? emptyProfile;
  return { ...employee, ...profile };
}

export async function saveEmployeeProfile(supabase: SupabaseClient, employeeIdValue: string, profile: EmployeeProfile, userId: string) {
  const { error } = await supabase.from("portia_employee_profiles").upsert({
    employee_id: employeeIdValue,
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
