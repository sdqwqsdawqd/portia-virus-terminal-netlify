import assert from "node:assert/strict";
import test from "node:test";
import {
  findPromotionRosterEntry,
  loadPromotionRoster,
  promotionRosterFromRows,
} from "./portia-promotion-sheet.ts";
import { promotionTitles } from "./portia-promotion.ts";

const header = ["НИК", "Звание", "След. звание", "Анти-Спидран", "Дата"];

test("promotion sheet parses quoted CSV and preserves display spelling", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    request = { url: String(input), init };
    return new Response(`${header.join(",")}\n"Portia,User",Академик,Стажёр,"Можно повысить ✅",01.10.2026`);
  }) as typeof fetch;
  const result = await loadPromotionRoster(fetcher);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.roster[0]?.nickname, "Portia,User");
  assert.equal(result.roster[0]?.nicknameKey, "portia,user");
  assert.equal(result.roster[0]?.promotedAt, "2026-10-01T00:00:00.000Z");
  assert.match(request?.url ?? "", /range=A61:E85/);
  assert.equal(request?.init?.cache, "no-store");
  assert.ok(request?.init?.signal instanceof AbortSignal);
});

test("promotion sheet treats changed headers and invalid dates as unavailable", async () => {
  for (const csv of [
    `Ник,Звание,След. звание,Анти-Спидран,Дата\nUser,Академик,Стажёр,Ожидание,01.10.2026`,
    `${header.join(",")}\nUser,Академик,Стажёр,Ожидание,31.02.2026`,
  ]) {
    const result = await loadPromotionRoster((async () => new Response(csv)) as typeof fetch);
    assert.deepEqual(result, { status: "unavailable", reason: "invalid-data" });
  }
});

test("promotion sheet returns unavailable for network and HTTP failures", async () => {
  assert.deepEqual(
    await loadPromotionRoster((async () => { throw new Error("offline"); }) as typeof fetch),
    { status: "unavailable", reason: "network" },
  );
  assert.deepEqual(
    await loadPromotionRoster((async () => new Response("bad", { status: 503 })) as typeof fetch),
    { status: "unavailable", reason: "http" },
  );
});

test("promotion sheet ignores blank nickname rows and lookup is case-insensitive", () => {
  const roster = promotionRosterFromRows([
    header,
    ["", "", "", "", ""],
    ["Display_Name", "Лаборант", "Исследователь", "Можно повысить ✅", "2026-10-01"],
  ]);
  assert.equal(roster.length, 1);
  assert.equal(findPromotionRosterEntry(roster, " display_NAME ")?.nickname, "Display_Name");
  assert.equal(findPromotionRosterEntry(roster, "missing"), undefined);
});

test("promotion sheet accepts every canonical title spelling and its exact successor", () => {
  const rows = promotionTitles.map((title, index) => [
    `User_${index + 1}`,
    title.label,
    promotionTitles[index + 1]?.label ?? "",
    "Можно повысить ✅",
    "01.10.2026",
  ]);
  const roster = promotionRosterFromRows([header, ...rows]);
  assert.deepEqual(roster.map(({ titleId }) => titleId), promotionTitles.map(({ id }) => id));
});

test("promotion sheet rejects unknown titles, wrong successors, duplicate nicknames and oversized fields", () => {
  const invalidRows = [
    [["User", "Неизвестно", "Стажёр", "Ожидание", "01.10.2026"]],
    [["User", "Академик", "Лаборант", "Ожидание", "01.10.2026"]],
    [
      ["User", "Академик", "Стажёр", "Ожидание", "01.10.2026"],
      ["user", "Академик", "Стажёр", "Ожидание", "01.10.2026"],
    ],
    [["x".repeat(65), "Академик", "Стажёр", "Ожидание", "01.10.2026"]],
  ];
  for (const rows of invalidRows) assert.throws(() => promotionRosterFromRows([header, ...rows]));
});
