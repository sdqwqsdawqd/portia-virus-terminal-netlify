import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";

import { loadStagingRoster, stagingRosterPath } from "./portia-promotion-staging-roster.ts";
import { loadPromotionAccessRoster, loadPromotionRoster } from "./portia-promotion-sheet.ts";

const iso = "aaaaaaaaaaaaaaaaaaaa";
const prod = "bbbbbbbbbbbbbbbbbbbb";
const dir = mkdtempSync(join(tmpdir(), "portia-staging-roster-test-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const rosterFile = join(dir, "roster.json");
const base: Record<string, string | undefined> = {
  PORTIA_PROMOTION_STAGING_ROSTER: rosterFile,
  NEXT_PUBLIC_SUPABASE_URL: `https://${iso}.supabase.co`,
  PORTIA_E2E_ISOLATED_PROJECT_IDS: iso,
  PORTIA_E2E_PRODUCTION_PROJECT_IDS: prod,
  CONTEXT: "deploy-preview",
};

describe("stagingRosterPath returns a path only on an isolated, non-production project", () => {
  const cases: [string, Record<string, string | undefined>, string | null][] = [
    ["variable is not set", { ...base, PORTIA_PROMOTION_STAGING_ROSTER: undefined }, null],
    ["variable is blank", { ...base, PORTIA_PROMOTION_STAGING_ROSTER: "  " }, null],
    ["CONTEXT is production", { ...base, CONTEXT: "production" }, null],
    ["CONTEXT is Production (case)", { ...base, CONTEXT: "Production" }, null],
    ["production list is empty", { ...base, PORTIA_E2E_PRODUCTION_PROJECT_IDS: "" }, null],
    ["production list is absent", { ...base, PORTIA_E2E_PRODUCTION_PROJECT_IDS: undefined }, null],
    ["ref is in the production list", { ...base, PORTIA_E2E_PRODUCTION_PROJECT_IDS: `${prod},${iso}` }, null],
    ["ref is not in the isolated list", { ...base, PORTIA_E2E_ISOLATED_PROJECT_IDS: "cccccccccccccccccccc" }, null],
    ["isolated list is absent", { ...base, PORTIA_E2E_ISOLATED_PROJECT_IDS: undefined }, null],
    ["host is not *.supabase.co", { ...base, NEXT_PUBLIC_SUPABASE_URL: `https://${iso}.example.com` }, null],
    ["url is not set", { ...base, NEXT_PUBLIC_SUPABASE_URL: undefined }, null],
    ["everything holds", base, rosterFile],
    ["everything holds, CONTEXT unset", { ...base, CONTEXT: undefined }, rosterFile],
  ];
  for (const [name, env, expected] of cases) {
    test(name, () => assert.equal(stagingRosterPath(env), expected));
  }
});

const goodRoster = {
  access: [["__portia_live_x_p1"]],
  promotion: [
    ["НИК", "Звание", "След. звание", "Анти-Спидран", "Дата"],
    ["__portia_live_x_p1", "Стажёр", "Лаборант", "нет", "01.10.2026"],
  ],
};

describe("loadPromotionRoster and loadPromotionAccessRoster read only the staging roster when it is active", () => {
  const saved = Object.fromEntries(Object.keys(base).map((key) => [key, process.env[key]]));
  const apply = (env: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  after(() => apply(saved));
  const spy = () => {
    const calls = { fetch: 0 };
    return { calls, fetchImpl: (async () => { calls.fetch += 1; throw new Error("sheet must not be read"); }) as unknown as typeof fetch };
  };

  test("a temporary nickname resolves from roster.json and the sheet is never fetched", async () => {
    writeFileSync(rosterFile, JSON.stringify(goodRoster));
    apply(base);
    const { calls, fetchImpl } = spy();
    const result = await loadPromotionRoster(fetchImpl);
    assert.equal(result.status, "ok");
    assert.ok(result.status === "ok");
    assert.equal(result.roster[0].nickname, "__portia_live_x_p1");
    assert.equal(result.roster[0].titleId, "trainee");
    const access = await loadPromotionAccessRoster(fetchImpl);
    assert.ok(access.status === "ok");
    assert.equal(access.roster[0].nickname, "__portia_live_x_p1");
    assert.equal(calls.fetch, 0);
  });

  test("broken JSON gives invalid-source and still does not fetch the sheet", async () => {
    writeFileSync(rosterFile, "{not json");
    apply(base);
    const { calls, fetchImpl } = spy();
    assert.deepEqual(await loadPromotionRoster(fetchImpl), { status: "invalid-source", reason: "invalid-data" });
    assert.deepEqual(await loadPromotionAccessRoster(fetchImpl), { status: "invalid-source", reason: "invalid-data" });
    assert.equal(calls.fetch, 0);
  });

  test("a bad row gives invalid-source", async () => {
    writeFileSync(rosterFile, JSON.stringify({ ...goodRoster, promotion: [["__portia_live_x_p1", "Стажёр", "Эксперт вирусолог", "нет", "01.10.2026"]] }));
    apply(base);
    assert.deepEqual(await loadPromotionRoster(spy().fetchImpl), { status: "invalid-source", reason: "invalid-data" });
  });

  test("a missing file gives unavailable/network, not the live table", async () => {
    apply({ ...base, PORTIA_PROMOTION_STAGING_ROSTER: join(dir, "absent.json") });
    const { calls, fetchImpl } = spy();
    assert.deepEqual(await loadPromotionRoster(fetchImpl), { status: "unavailable", reason: "network" });
    assert.deepEqual(await loadStagingRoster(join(dir, "absent.json")), {
      access: { status: "unavailable", reason: "network" },
      promotion: { status: "unavailable", reason: "network" },
    });
    assert.equal(calls.fetch, 0);
  });

  test("without the guard the live table is read (fetch is called)", async () => {
    apply({ ...base, CONTEXT: "production" });
    const { calls, fetchImpl } = spy();
    assert.deepEqual(await loadPromotionRoster(fetchImpl), { status: "unavailable", reason: "network" });
    assert.equal(calls.fetch, 1);
  });
});
