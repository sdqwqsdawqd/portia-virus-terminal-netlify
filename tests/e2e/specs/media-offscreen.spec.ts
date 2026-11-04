import type { Locator, Page, Route } from "@playwright/test";
import { mediaSource } from "../../../lib/media-display.ts";
import { DesktopPage } from "../pages/desktop.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { expect, test } from "../fixtures/test";

// CR-01: only the external frame host and foreign image requests are held or answered.
// Own /api routes always return the target's real data; the fixture asserts that none were fulfilled here.

const CHARTER_HOST = "https://sdqwqsdawqd.github.io/**";
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

type RosterEntry = { nickname: string; photoUrl?: string; robloxAvatarUrl?: string };

async function routeForeignImages(page: Page, mode: "pixel" | "hold") {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const foreign = request.resourceType() === "image" && new URL(request.url()).origin !== new URL(page.url()).origin;
    if (!foreign) return route.fallback();
    if (mode === "pixel") return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
    return new Promise<void>(() => undefined);
  });
}

function forgiveImageFaults(diagnostics: DiagnosticLedger) {
  const kept = diagnostics.entries.filter((entry) => !(
    (entry.kind === "requestfailed" && entry.source === "image")
    || (entry.kind === "console" && /Failed to load resource/.test(entry.text) && !entry.source.startsWith("browser:/"))
  ));
  diagnostics.entries.splice(0, diagnostics.entries.length, ...kept);
}

const rowOf = (window: Locator, nickname: string) => window.locator(".personnel-list button").filter({ has: window.page().locator("strong", { hasText: nickname }) }).first();

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

test("[CR-01] a portrait that has not answered while «Сотрудники» was minimized stays on its skeleton", async ({ page, diagnostics }) => {
  await routeForeignImages(page, "hold");
  const desktop = new DesktopPage(page);
  const roster = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/employees", { timeout: 20_000 }).catch(() => undefined);
  await desktop.goto();
  await desktop.openApp("Сотрудники");
  const answer = await roster;
  const payload = answer ? await answer.json().catch(() => undefined) as { employees?: RosterEntry[] } | undefined : undefined;
  const employee = payload?.employees?.find((entry) => mediaSource(entry.photoUrl || entry.robloxAvatarUrl).kind === "image");
  test.skip(!employee, "BLOCKED (DATA): this target serves no employee with an allowed portrait link.");
  const window = desktop.window("Сотрудники");
  await rowOf(window, employee!.nickname).click();
  const portrait = window.locator(".personnel-portrait .portia-image");
  await expect(portrait).toHaveAttribute("data-media-state", "loading");
  await page.getByRole("button", { name: "Свернуть Сотрудники" }).click();
  await expect(window).toBeHidden();
  await expect(portrait).toHaveAttribute("data-media-armed", "false");
  await page.clock.runFor(16_000);
  await page.locator('[data-taskbar-app="employees"]').click();
  await expect(window).toBeVisible();
  await expect(portrait).toHaveAttribute("data-media-state", "loading");
  await page.clock.runFor(15_500);
  await expect(portrait).toHaveAttribute("data-media-state", "failed");
  await expect(portrait.getByText("Изображение недоступно")).toBeVisible();
  forgiveImageFaults(diagnostics);
});

test("[CR-01] covers of a folded «Справочник» section are not failed after 16 s and load once the section is opened", async ({ page, diagnostics }) => {
  const response = await page.request.get("/api/content");
  const payload = response.ok() ? await response.json() as { content?: { guideSections?: { cards?: { cover?: string }[] }[] } } : {};
  const sectionIndex = payload.content?.guideSections?.findIndex((section) => section.cards?.some((card) => mediaSource(card.cover).kind === "image")) ?? -1;
  test.skip(sectionIndex < 0, "BLOCKED (DATA): this target serves no guide card with a cover (seeded in 19-19).");
  await routeForeignImages(page, "pixel");
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Справочник");
  const guide = desktop.window("Справочник");
  const section = guide.locator(".guide-section").nth(sectionIndex);
  const head = section.locator('.guide-section-head[aria-expanded="false"]');
  await expect(head).toBeAttached();
  const covers = section.locator(".guide-tile-cover .portia-image");
  await expect(covers.first()).toHaveAttribute("data-media-state", /^(loading|loaded)$/);
  await page.clock.runFor(16_000);
  await expect(section.locator('.guide-tile-cover .portia-image[data-media-state="failed"]')).toHaveCount(0);
  await expect(covers.first()).toHaveAttribute("data-media-state", /^(loading|loaded)$/);
  await head.click();
  await expect(covers.first()).toHaveAttribute("data-media-state", "loaded");
  await expect(section.locator('.guide-tile-cover .portia-image[data-media-state="failed"]')).toHaveCount(0);
  forgiveImageFaults(diagnostics);
});
