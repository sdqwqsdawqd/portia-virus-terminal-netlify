import type { Locator, Page, Route } from "@playwright/test";
import { mediaSource } from "../../../lib/media-display.ts";
import { parkClock } from "../fixtures/determinism";
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

// The image faults these tests cause on purpose (a picture held until the page closes, then cancelled), registered BEFORE the action (20-25, T-20-37).
// Per test, by kind + resource type + error text; an own-origin console error or any CSP event is not covered.
function expectImageFaults(diagnostics: DiagnosticLedger) {
  diagnostics.expectFault({ kind: "requestfailed", source: "image", text: /ERR_FAILED|ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR|aborted|cancelled|Blocked by Web Inspector/i, reason: "a foreign image request held by the test is cancelled when the page closes" });
  diagnostics.expectFault({ kind: "console", source: /^browser:(?!\/)/, text: /Failed to load resource/, reason: "the browser mirrors the cancelled foreign image request to its console" });
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

// The charter frame is held by the test and cancelled when the frame remounts or the page closes (20-25, T-20-37). The text of a requestfailed/console
// entry is redacted (the host is gone from it), so the rules rest on kind + resource type + error text; the third-party 404 keeps the host in a response entry.
function expectHeldFrameFaults(diagnostics: DiagnosticLedger) {
  diagnostics.expectFault({ kind: "requestfailed", source: "document", text: /ERR_FAILED|ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i, reason: "the charter frame document held by the test is cancelled when the frame remounts or the page closes" });
  // The test releases the held document and remounts the frame at once; the scripts, styles and images the first frame had started are cancelled with it
  // (WebKit reports each one as «Load request cancelled»). Only the cancellation texts are covered, never a failed or corrupt resource.
  diagnostics.expectFault({ kind: "requestfailed", source: /^(script|stylesheet|image|font|fetch|xhr|other)$/, text: /ERR_ABORTED|NS_BINDING_ABORTED|Load request cancelled/i, reason: "the subresources of the charter frame the test remounts are cancelled with it" });
  diagnostics.expectFault({ kind: "console", source: "browser:sdqwqsdawqd.github.io", text: /Failed to load resource/, reason: "the embedded charter page logs its own failed resource" });
  diagnostics.expectFault({ kind: "response", text: /^GET sdqwqsdawqd\.github\.io -> \d{3}$/, reason: "the embedded charter page answers an error for a file of its own" });
}

test("[CR-01] a minimized «Устав» whose frame never answered keeps its skeleton; 15 s on screen still end in the fatal panel", async ({ page, diagnostics }) => {
  // runFor spends real time on every engine (about 1:1 on WebKit): the two 15 s steps of this test exceed the 30 s default. The assertions stay as they are.
  test.slow();
  expectHeldFrameFaults(diagnostics);
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
  await parkClock(page);
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
});

test("[CR-01] a portrait that has not answered while «Сотрудники» was minimized stays on its skeleton", async ({ page, diagnostics }) => {
  // runFor spends real time on every engine (about 1:1 on WebKit): the two 15 s steps of this test exceed the 30 s default. The assertions stay as they are.
  test.slow();
  expectImageFaults(diagnostics);
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
  await parkClock(page);
  await page.clock.runFor(16_000);
  await page.locator('[data-taskbar-app="employees"]').click();
  await expect(window).toBeVisible();
  await expect(portrait).toHaveAttribute("data-media-state", "loading");
  await page.clock.runFor(15_500);
  await expect(portrait).toHaveAttribute("data-media-state", "failed");
  await expect(portrait.getByText("Изображение недоступно")).toBeVisible();
});

test("[CR-01] covers of a folded «Справочник» section are not failed after 16 s and load once the section is opened", async ({ page, diagnostics }) => {
  // runFor spends real time on every engine (about 1:1 on WebKit): the 16 s step plus the page load is close to the 30 s default.
  test.slow();
  const response = await page.request.get("/api/content");
  const payload = response.ok() ? await response.json() as { content?: { guideSections?: { cards?: { cover?: string }[] }[] } } : {};
  const sectionIndex = payload.content?.guideSections?.findIndex((section) => section.cards?.some((card) => mediaSource(card.cover).kind === "image")) ?? -1;
  test.skip(sectionIndex < 0, "BLOCKED (DATA): this target serves no guide card with a cover (seeded in 19-19).");
  expectImageFaults(diagnostics);
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
  await parkClock(page);
  await page.clock.runFor(16_000);
  await expect(section.locator('.guide-tile-cover .portia-image[data-media-state="failed"]')).toHaveCount(0);
  await expect(covers.first()).toHaveAttribute("data-media-state", /^(loading|loaded)$/);
  await head.click();
  await expect(covers.first()).toHaveAttribute("data-media-state", "loaded");
  await expect(section.locator('.guide-tile-cover .portia-image[data-media-state="failed"]')).toHaveCount(0);
});
