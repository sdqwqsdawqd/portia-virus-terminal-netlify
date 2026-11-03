import type { Locator, Page } from "@playwright/test";
import { mediaSource } from "../../../lib/media-display.ts";
import { DesktopPage } from "../pages/desktop.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { expect, test } from "../fixtures/test";

// PortiaImage (19-10): broken, slow and blocked pictures end in the «Изображение недоступно» placeholder of the same size,
// and a picture of the previous record is never shown as the new one. The spec reads the real /api/employees answer and only
// intercepts IMAGE requests to other hosts; own /api routes are never fulfilled (assertNoOwnApiFulfilled). It runs in 19-14.

const PLACEHOLDER = "Изображение недоступно";
// 1x1 PNG: a picture that loads, so record switching can be told apart by src alone.
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

type RosterEntry = { nickname: string; photoUrl?: string; robloxAvatarUrl?: string };
type ImageMode = "pixel" | "missing" | "hold";

const expectedSrc = (employee: RosterEntry) => {
  const source = mediaSource(employee.photoUrl || employee.robloxAvatarUrl);
  return source.kind === "image" ? source.src : "";
};

// Image requests to other hosts only. "hold" never answers: the picture stays on its skeleton until the 15s limit.
async function routeForeignImages(page: Page, mode: ImageMode, gate?: Promise<void>) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const foreign = request.resourceType() === "image" && new URL(request.url()).origin !== new URL(page.url()).origin;
    if (!foreign) return route.fallback();
    if (mode === "pixel") return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
    if (mode === "missing") {
      await gate;
      return route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    }
    return new Promise<void>(() => undefined);
  });
}

// The faults this spec causes on purpose (a 404 or a cancelled image); every other diagnostic still fails the test.
function forgiveImageFaults(diagnostics: DiagnosticLedger) {
  const kept = diagnostics.entries.filter((entry) => !(
    (entry.kind === "response" && entry.source === "image" && entry.status === 404)
    || (entry.kind === "requestfailed" && entry.source === "image")
    || (entry.kind === "console" && /Failed to load resource/.test(entry.text) && !entry.source.startsWith("browser:/"))
  ));
  diagnostics.entries.splice(0, diagnostics.entries.length, ...kept);
}

async function openEmployees(page: Page, desktop: DesktopPage) {
  const roster = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/employees", { timeout: 20_000 }).catch(() => undefined);
  await desktop.goto();
  await desktop.openApp("Сотрудники");
  const answer = await roster;
  const payload = answer ? await answer.json().catch(() => undefined) as { employees?: RosterEntry[] } | undefined : undefined;
  const employees = payload?.employees ?? [];
  test.skip(employees.length === 0, "BLOCKED (DATA): this target serves no employees, so no portrait exists to fault.");
  return { window: desktop.window("Сотрудники"), employees };
}

const rowOf = (window: Locator, nickname: string) => window.locator(".personnel-list button").filter({ has: window.page().locator("strong", { hasText: nickname }) }).first();

async function selectWithImage(window: Locator, employees: RosterEntry[]) {
  const withImage = employees.find((employee) => expectedSrc(employee));
  test.skip(!withImage, "BLOCKED (DATA): no employee with an allowed portrait link on this target.");
  await rowOf(window, withImage!.nickname).click();
  return withImage!;
}

test("[STAB-MEDIA-02] a portrait that answers 404 becomes the placeholder; the window, name and caption stay", async ({ page, diagnostics }) => {
  await routeForeignImages(page, "missing");
  const desktop = new DesktopPage(page);
  const { window, employees } = await openEmployees(page, desktop);
  const employee = await selectWithImage(window, employees);

  const portrait = window.locator(".personnel-portrait .portia-image");
  await expect(portrait).toHaveAttribute("data-media-state", "failed");
  await expect(portrait.getByText(PLACEHOLDER)).toBeVisible();
  await expect(portrait.locator("img")).toHaveCount(0);
  await expect(window).toBeVisible();
  await expect(window.locator(".personnel-profile-identity h2")).toHaveText(employee.nickname);
  forgiveImageFaults(diagnostics);
});

test("[STAB-MEDIA-03] a portrait that never answers gives up after 15s: placeholder, no endless skeleton", async ({ page, diagnostics }) => {
  await routeForeignImages(page, "hold");
  const desktop = new DesktopPage(page);
  const { window, employees } = await openEmployees(page, desktop);
  await selectWithImage(window, employees);

  const portrait = window.locator(".personnel-portrait .portia-image");
  await expect(portrait).toHaveAttribute("data-media-state", "loading");
  await page.clock.runFor(14_000);
  await expect(portrait).toHaveAttribute("data-media-state", "loading");
  await page.clock.runFor(1_500);
  await expect(portrait).toHaveAttribute("data-media-state", "failed");
  await expect(portrait.getByText(PLACEHOLDER)).toBeVisible();
  await expect(portrait.locator(".portia-image-skeleton")).toHaveCount(0);
  await expect(window).toBeVisible();
  forgiveImageFaults(diagnostics);
});

test("[STAB-MEDIA-03] the picture box keeps its size from loading to error (CLS 0 for this element)", async ({ page, diagnostics }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await routeForeignImages(page, "missing", gate);
  const desktop = new DesktopPage(page);
  const { window, employees } = await openEmployees(page, desktop);
  await selectWithImage(window, employees);

  const portrait = window.locator(".personnel-portrait");
  const stage = window.locator(".personnel-avatar-stage");
  await expect(portrait.locator(".portia-image")).toHaveAttribute("data-media-state", "loading");
  const loading = { portrait: await portrait.boundingBox(), stage: await stage.boundingBox() };
  expect(loading.portrait).not.toBeNull();

  release();
  await expect(portrait.locator(".portia-image")).toHaveAttribute("data-media-state", "failed");
  const failed = { portrait: await portrait.boundingBox(), stage: await stage.boundingBox() };
  expect(failed).toEqual(loading);
  forgiveImageFaults(diagnostics);
});

test("[STAB-MEDIA-03] switching A -> B -> A always shows the current record's own picture", async ({ page, diagnostics }) => {
  await routeForeignImages(page, "pixel");
  const desktop = new DesktopPage(page);
  const { window, employees } = await openEmployees(page, desktop);
  test.skip(employees.length < 2, "BLOCKED (DATA): needs two employees to switch between.");

  const [a, b] = employees;
  const portraitImage = window.locator(".personnel-portrait .portia-image img");
  const showsOnly = async (employee: RosterEntry) => {
    await rowOf(window, employee.nickname).click();
    await expect(window.locator(".personnel-profile-identity h2")).toHaveText(employee.nickname);
    const src = expectedSrc(employee);
    // No allowed link: the placeholder shows at once and no <img> exists. Otherwise the <img> carries exactly this record's link.
    if (src) await expect(portraitImage).toHaveAttribute("src", src);
    else {
      await expect(portraitImage).toHaveCount(0);
      await expect(window.locator(".personnel-portrait").getByText(PLACEHOLDER)).toBeVisible();
    }
  };
  await showsOnly(a);
  await showsOnly(b);
  await showsOnly(a);
  forgiveImageFaults(diagnostics);
});
