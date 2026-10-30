import AxeBuilder from "@axe-core/playwright";
import type { TestInfo } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

type AxeViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

const approvedCriticalOrSeriousFingerprints = new Set<string>();

function fingerprint(violation: AxeViolation) {
  return `${violation.id}:${violation.impact ?? "unknown"}`;
}

test("[STAB-BASE-02] keyboard reaches and activates a desktop application", async ({ page }) => {
  const desktop = new DesktopPage(page);
  await desktop.goto();

  await desktop.shortcut("Настройки").focus();
  await page.keyboard.press("Enter");
  await expect(desktop.window("Настройки")).toBeVisible();
  await desktop.setting("Анимации", "Выключены").focus();
  await page.keyboard.press("Space");
  await expect(desktop.setting("Анимации", "Выключены")).toHaveAttribute("aria-pressed", "true");
});

test("[STAB-BASE-02] Axe inventory rejects new critical or serious fingerprints", async ({ page }, testInfo: TestInfo) => {
  const desktop = new DesktopPage(page);
  await desktop.goto();

  const results = await new AxeBuilder({ page }).analyze();
  const inventory = results.violations.map((violation) => ({
    fingerprint: fingerprint(violation),
    impact: violation.impact,
    help: violation.help,
    nodeCount: violation.nodes.length,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary,
    })),
  }));
  await testInfo.attach("axe-inventory", {
    body: Buffer.from(JSON.stringify(inventory, null, 2)),
    contentType: "application/json",
  });

  const unapproved = results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map(fingerprint)
    .filter((entry) => !approvedCriticalOrSeriousFingerprints.has(entry));
  expect(unapproved, "new critical/serious Axe fingerprints require owner disposition").toEqual([]);
});
