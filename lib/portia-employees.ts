import { getStore } from "@netlify/blobs";

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

export type PortiaEmployeesSnapshot = {
  employees: PortiaEmployee[];
  syncedAt: string;
  source: "google-sheets";
};

const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/gviz/tq?tqx=out:csv&sheet=Portia";
const storeName = "portia-employees";
const snapshotKey = "latest";

function hasNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_SITE_ID);
}

function parseCsv(source: string) {
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

function stableId(nickname: string) {
  return nickname.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9_]+/g, "-");
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
      const key = (user.requestedUsername || user.name).trim().toLocaleLowerCase("en-US");
      byName.set(key, { id: user.id, avatarUrl: headshots.get(user.id) ?? "", fullAvatarUrl: fullAvatars.get(user.id) ?? "" });
    });
  } catch (error) {
    console.error("PORTIA Roblox profile lookup failed", error);
  }
  return byName;
}

export async function readEmployeesSnapshot() {
  if (!hasNetlifyRuntime()) return null;
  try {
    const store = getStore({ name: storeName, consistency: "strong" });
    return await store.get(snapshotKey, { type: "json", consistency: "strong" }) as PortiaEmployeesSnapshot | null;
  } catch (error) {
    console.error("PORTIA employee snapshot read failed", error);
    return null;
  }
}

export async function writeEmployeesSnapshot(snapshot: PortiaEmployeesSnapshot) {
  if (!hasNetlifyRuntime()) return false;
  const store = getStore({ name: storeName, consistency: "strong" });
  await store.setJSON(snapshotKey, snapshot, { metadata: { syncedAt: snapshot.syncedAt, count: snapshot.employees.length } });
  return true;
}

export async function syncEmployeesSnapshot() {
  const response = await fetch(sheetCsvUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);
  const rows = parseCsv(await response.text());
  const header = rows[0] ?? [];
  const nicknameIndex = header.indexOf("Никнейм сотрудника");
  const callsignIndex = header.indexOf("Позывной");
  const titleIndex = header.indexOf("Звание");
  const rankIndex = header.indexOf("Ранг");
  if ([nicknameIndex, callsignIndex, titleIndex, rankIndex].some((index) => index < 0)) {
    throw new Error("The Portia sheet headers have changed.");
  }

  const previous = await readEmployeesSnapshot();
  const previousById = new Map((previous?.employees ?? []).map((employee) => [employee.id, employee]));
  const sheetEmployeesRaw = rows.slice(1, 35).flatMap((row, rowIndex) => {
    const nickname = cleanText(row[nicknameIndex]);
    if (!nickname) return [];
    return [{
      id: stableId(nickname),
      nickname,
      callsign: cleanText(row[callsignIndex]),
      title: cleanText(row[titleIndex]),
      rank: cleanText(row[rankIndex]),
      order: rowIndex,
    }];
  });
  const seenIds = new Set<string>();
  const sheetEmployees = sheetEmployeesRaw.filter((employee) => employee.id && !seenIds.has(employee.id) && Boolean(seenIds.add(employee.id)));
  const robloxProfiles = await resolveRobloxProfiles(sheetEmployees.map((employee) => employee.nickname));
  const employees = sheetEmployees.map((sheetEmployee) => {
    const previousEmployee = previousById.get(sheetEmployee.id);
    const profile = robloxProfiles.get(sheetEmployee.nickname.toLocaleLowerCase("en-US"));
    return {
      id: sheetEmployee.id,
      nickname: sheetEmployee.nickname,
      callsign: sheetEmployee.callsign,
      title: sheetEmployee.title,
      rank: sheetEmployee.rank,
      knowledgeRating: previousEmployee?.knowledgeRating ?? 1,
      biography: previousEmployee?.biography ?? "",
      photoUrl: previousEmployee?.photoUrl ?? "",
      robloxUserId: profile?.id ?? previousEmployee?.robloxUserId ?? null,
      robloxAvatarUrl: profile?.avatarUrl ?? previousEmployee?.robloxAvatarUrl ?? "",
      robloxFullAvatarUrl: profile?.fullAvatarUrl ?? previousEmployee?.robloxFullAvatarUrl ?? "",
      order: sheetEmployee.order,
    } satisfies PortiaEmployee;
  });
  const snapshot: PortiaEmployeesSnapshot = { employees, syncedAt: new Date().toISOString(), source: "google-sheets" };
  await writeEmployeesSnapshot(snapshot);
  return snapshot;
}

export function sanitizeEmployeeUpdate(value: unknown) {
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
