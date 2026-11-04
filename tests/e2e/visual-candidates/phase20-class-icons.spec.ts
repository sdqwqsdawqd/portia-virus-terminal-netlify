import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";

// Phase 20-20 (D-39): the nine redrawn class icons next to their class names in the virus card («КЛАССИФИКАЦИЯ» panel).
// Candidates only: frames go under visual-candidates/.runs and wait for the owner approval in 20-11; no baseline is touched.
// The requirement id of a frame is STAB-BASE-03 because that is the only family support.ts accepts; the evidence belongs to STAB-VIS-03.
// A class that no virus of the target carries is recorded as BLOCKED (DATA); nothing is mocked and no record is created.

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
test.beforeEach(({}, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20 class-icon candidates run on chromium-desktop and chromium-phone.");
});

const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
const setId = process.env.PORTIA_VISUAL_SET_ID?.trim() || `phase15-current-${sourceCommit.slice(0, 12)}`;
const runRoot = path.resolve("tests/e2e/visual-candidates/.runs", setId);

const newClasses = {
  mind: ["Люцидиум", "Транзитиум", "Обливиум"],
  behavior: ["Стабилар", "Импульсар", "Инфернар"],
  appearance: ["Изоморф", "Полиморф", "Ксеноморф"],
} as const;
type Axis = keyof typeof newClasses;
const axes = Object.keys(newClasses) as Axis[];
// Latin ids for file names (safeId in support.ts drops Cyrillic).
const latinId: Record<string, string> = {
  "Люцидиум": "lucidium", "Транзитиум": "transitium", "Обливиум": "oblivium",
  "Стабилар": "stabilar", "Импульсар": "impulsar", "Инфернар": "infernar",
  "Изоморф": "isomorph", "Полиморф": "polymorph", "Ксеноморф": "xenomorph",
};
const allNames = axes.flatMap((axis) => newClasses[axis]);

type ServedVirus = { id: string; name: string; classification: Record<string, string> };

test("[STAB-VIS-03] D-39 class icons beside the new class names in the virus card (candidates for 20-11)", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const response = await page.request.get("/api/content");
  const payload = response.ok() ? await response.json() as { content?: { viruses?: ServedVirus[] } } : {};
  const viruses = (payload.content?.viruses ?? []).filter((virus) => virus.classification);
  test.skip(!viruses.length, "BLOCKED (DATA): this target serves no virus, so no class icon can be shown.");

  // The served content is normalized on the client too, so an old stored name still reads as the new one; the card is checked, not the payload.
  const covered = new Set<string>();
  const picks: ServedVirus[] = [];
  for (const virus of viruses) {
    const fresh = axes.map((axis) => virus.classification[axis]).filter((name) => allNames.includes(name as never) && !covered.has(name));
    if (!fresh.length) continue;
    fresh.forEach((name) => covered.add(name));
    picks.push(virus);
  }

  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("База вирусов");
  const archive = desktop.window("База вирусов");
  await expect(archive.getByRole("status").filter({ hasText: /Загрузка/ })).toHaveCount(0);

  mkdirSync(runRoot, { recursive: true });
  for (const virus of picks) {
    await archive.locator(".virus-row").filter({ hasText: virus.name }).first().click();
    const panel = archive.locator(".classification-panel");
    await expect(panel).toBeVisible();
    for (const axis of axes) {
      const name = virus.classification[axis];
      if (allNames.includes(name as never)) await expect(panel.locator(".class-cell strong", { hasText: name }).locator("svg.class-badge")).toBeVisible();
    }
    const stem = `class-icons-dossier-${virus.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
    await captureCandidate(context, {
      id: stem,
      requirement: "STAB-BASE-03",
      surface: "Иконки классов",
      actor: "visitor",
      state: `«База вирусов», запись ${virus.name}; классы ${axes.map((axis) => virus.classification[axis]).join(" / ")}; панель .classification-panel`,
      intendedSnapshot: "phase20-class-icons (после одобрения 20-11)",
    });
    // A close crop of the panel next to the full frame: the 18px badges are readable at this size.
    const cropPath = path.join(runRoot, `${stem}-panel--${testInfo.project.name}.png`);
    if (!cropPath.replaceAll("\\", "/").includes("/visual-candidates/.runs/")) throw new Error("[PORTIA_CANDIDATE_DESTINATION_REQUIRED]");
    await panel.screenshot({ path: cropPath, animations: "disabled", caret: "hide" });
  }

  for (const name of allNames.filter((item) => !covered.has(item))) {
    await recordBlockedCandidate(context, {
      id: `class-icons-dossier-${latinId[name]}`,
      requirement: "STAB-BASE-03",
      surface: "Иконки классов",
      actor: "visitor",
      state: `BLOCKED (DATA): нет вируса с классом ${name} на этой цели; запись не создавалась`,
      intendedSnapshot: "phase20-class-icons (после одобрения 20-11)",
    }, {
      reasonCode: "PUBLIC_STATE_FIXTURE_REQUIRED",
      recoveryPhase: 20,
      reason: `BLOCKED (DATA): no virus served by this target carries the class ${name}; a record is not created or mocked for a candidate frame.`,
    });
  }
});
