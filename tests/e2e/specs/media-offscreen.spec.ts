import type { Page, Route } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { expect, test } from "../fixtures/test";

// CR-01: only the external frame host and foreign image requests are held or answered.
// Own /api routes always return the target's real data; the fixture asserts that none were fulfilled here.

const CHARTER_HOST = "https://sdqwqsdawqd.github.io/**";

async function holdRoute(page: Page, pattern: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(pattern, async (route: Route) => {
    await gate;
    await route.fallback().catch(() => undefined);
  });
  return release;
}

function forgiveHeldHostFaults(diagnostics: DiagnosticLedger) {
  const kept = diagnostics.entries.filter((entry) => !(
    (entry.kind === "requestfailed" && /sdqwqsdawqd\.github\.io|ERR_FAILED|ERR_ABORTED|cancelled/i.test(entry.text))
    || (entry.kind === "console" && /sdqwqsdawqd\.github\.io|Failed to load resource/i.test(entry.text))
    || (entry.kind === "response" && /sdqwqsdawqd\.github\.io/.test(entry.text))
  ));
  diagnostics.entries.splice(0, diagnostics.entries.length, ...kept);
}

test("[CR-01] a minimized «Устав» whose frame never answered keeps its skeleton; 15 s on screen still end in the fatal panel", async ({ page, diagnostics }) => {
  const release = await holdRoute(page, CHARTER_HOST);
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Устав");
  const charter = desktop.window("Устав");
  const document = charter.locator(".document-app");
  await expect(document.locator('.app-skeleton[aria-busy="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Свернуть Устав" }).click();
  await expect(charter).toBeHidden();
  await expect(document).toHaveAttribute("data-frame-armed", "false");
  await page.clock.runFor(16_000);
  await page.locator('[data-taskbar-app="charter"]').click();
  await expect(charter).toBeVisible();
  await expect(document).toHaveAttribute("data-frame-state", "loading");
  await expect(document.locator('.app-skeleton[aria-busy="true"]')).toBeVisible();
  await page.clock.runFor(15_500);
  const panel = document.locator(".app-fatal-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Повторить загрузку" })).toBeVisible();
  release();
  await panel.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(panel).toHaveCount(0);
  await expect(document.locator('.app-skeleton[aria-busy="true"]')).toHaveCount(0, { timeout: 25_000 });
  forgiveHeldHostFaults(diagnostics);
});
