import type { Locator, Page } from "@playwright/test";
import { mediaSource } from "../../../lib/media-display.ts";
import { parkClock } from "../fixtures/determinism";
import { DesktopPage } from "../pages/desktop.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { expect, test } from "../fixtures/test";

// PortiaImage (19-10): broken, slow and blocked pictures end in the «Изображение недоступно» placeholder of the same size,
// and a picture of the previous record is never shown as the new one. The spec reads the real /api/employees answer and only
// intercepts IMAGE requests to other hosts; own /api routes are never fulfilled (assertNoOwnApiFulfilled). It runs in 19-14.
// 20-08 adds the CSP side (STAB-MEDIA-07, STAB-SEC-03): both policy headers, approved frame hosts without a CSP event, and a
// refused host that ends in a static placeholder. The diagnostics fixture fails every unexpected console/CSP event.

const PLACEHOLDER = "Изображение недоступно";
// 1x1 PNG: a picture that loads, so record switching can be told apart by src alone.
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

type RosterEntry = { nickname: string; photoUrl?: string; robloxAvatarUrl?: string };
type ImageMode = "pixel" | "missing" | "hold" | "rejected";

const expectedSrc = (employee: RosterEntry) => {
  const source = mediaSource(employee.photoUrl || employee.robloxAvatarUrl);
  return source.kind === "image" ? source.src : "";
};

// Image requests to other hosts only. "hold" never answers: the picture stays on its skeleton until the 15s limit.
// onHold reports each held request from inside the route handler, so a test can prove the picture was intercepted and is waiting.
async function routeForeignImages(page: Page, mode: ImageMode, gate?: Promise<void>, onHold?: () => void) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const foreign = request.resourceType() === "image" && new URL(request.url()).origin !== new URL(page.url()).origin;
    if (!foreign) return route.fallback();
    if (mode === "pixel") return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
    if (mode === "missing") {
      await gate;
      return route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    }
    // "rejected": the host is refused before any answer, the way a blocking policy or an extension would.
    if (mode === "rejected") {
      await gate;
      return route.abort("accessdenied");
    }
    onHold?.();
    return new Promise<void>(() => undefined);
  });
}

// The faults this spec causes on purpose (a 404 or a cancelled image); every other diagnostic still fails the test.
function forgiveImageFaults(diagnostics: DiagnosticLedger) {
  const kept = diagnostics.entries.filter((entry) => !(
    (entry.kind === "response" && entry.source === "image" && entry.status === 404)
    || (entry.kind === "requestfailed" && entry.source === "image")
    || (entry.kind === "console" && /Failed to load resource|Cannot load image .* due to access control checks/.test(entry.text) && !entry.source.startsWith("browser:/"))
  ));
  diagnostics.entries.splice(0, diagnostics.entries.length, ...kept);
}

// A limit counted in fake seconds (the 15 s portrait limit) must not tick while the test waits for the window and the roster: openEmployees
// parks the clock once the desktop has mounted (see parkClock), so the 15 s limit moves only through runFor, whatever the load or the previous test.
async function openEmployees(page: Page, desktop: DesktopPage, options: { parkClock?: boolean } = {}) {
  const roster = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/employees", { timeout: 20_000 }).catch(() => undefined);
  await desktop.goto();
  if (options.parkClock) await parkClock(page);
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
  let holdSeen!: () => void;
  const held = new Promise<void>((resolve) => { holdSeen = resolve; });
  await routeForeignImages(page, "hold", undefined, holdSeen);
  const desktop = new DesktopPage(page);
  const { window, employees } = await openEmployees(page, desktop, { parkClock: true });
  await selectWithImage(window, employees);

  const portrait = window.locator(".personnel-portrait .portia-image");
  await expect(portrait).toHaveAttribute("data-media-state", "loading");
  // The picture is intercepted and unanswered, and its 15 s timer is running (armed) on the parked clock.
  await held;
  await expect(portrait).toHaveAttribute("data-media-armed", "true");
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

const CSP_ENFORCED = "content-security-policy";
const CSP_REPORT_ONLY = "content-security-policy-report-only";

test("[STAB-SEC-03] the document carries the enforced policy and the report-only candidate; the desktop opens without a CSP event", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers[CSP_ENFORCED], "enforced policy").toContain("img-src 'self' data: blob: https:");
  expect(headers[CSP_REPORT_ONLY], "report-only candidate").toContain("img-src 'self' data: blob: https:");
  expect(headers[CSP_REPORT_ONLY]).not.toBe(headers[CSP_ENFORCED]);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
  // LIMITATION (D-08/D-14): this runs over plain HTTP on a local production build. A browser ignores HSTS on HTTP, and
  // upgrade-insecure-requests is dropped for the local E2E server on purpose, so neither is proven here (see 20-MEDIA-CSP.md).
  expect(headers["strict-transport-security"]).toContain("max-age=");
  await new DesktopPage(page).desktop.waitFor();
});

test("[STAB-MEDIA-07] the approved charter and sheet frame hosts load under both policies with no CSP or console event", async ({ page }) => {
  // The approved hosts are answered locally so the check does not depend on the network; the frame still has to pass frame-src.
  const approvedHtml = "<!doctype html><title>approved</title><p>approved</p>";
  await page.route(/^https:\/\/(sdqwqsdawqd\.github\.io|docs\.google\.com)\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: approvedHtml }));
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Устав");
  const charter = desktop.window("Устав");
  const frame = charter.locator(".document-app iframe");
  await expect(frame).toHaveAttribute("src", /^https:\/\/sdqwqsdawqd\.github\.io\//);
  await expect(charter.locator(".document-app")).toHaveAttribute("data-frame-state", "loaded");
  await expect(charter.locator(".app-fatal-panel")).toHaveCount(0);
  await desktop.closeApp("Устав"); // on a phone the open window covers the shortcuts
  await desktop.openApp("Таблица");
  const sheet = desktop.window("Таблица");
  await expect(sheet.locator(".document-app iframe")).toHaveAttribute("src", /^https:\/\/docs\.google\.com\//);
  await expect(sheet.locator(".document-app")).toHaveAttribute("data-frame-state", "loaded");
  await expect(sheet.locator(".app-fatal-panel")).toHaveCount(0);
});

test("[STAB-MEDIA-07] a refused image host leaves a static placeholder with the same box, the name and the caption", async ({ page, diagnostics }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await routeForeignImages(page, "rejected", gate);
  const desktop = new DesktopPage(page);
  const { window, employees } = await openEmployees(page, desktop);
  const employee = await selectWithImage(window, employees);

  const portrait = window.locator(".personnel-portrait");
  const frame = portrait.locator(".portia-image");
  await expect(frame).toHaveAttribute("data-media-state", "loading");
  const loading = await portrait.boundingBox();
  release();
  await expect(frame).toHaveAttribute("data-media-state", "failed");
  await expect(frame.getByText(PLACEHOLDER)).toBeVisible();
  await expect(frame.locator("img")).toHaveCount(0);
  expect(await portrait.boundingBox()).toEqual(loading);
  // Static: nothing in the placeholder runs an animation or transition (D-07).
  const running = await frame.locator(".portia-image-placeholder").evaluate((node) => [node, ...node.querySelectorAll("*")].flatMap((element) => element.getAnimations()).length);
  expect(running).toBe(0);
  await expect(window.locator(".personnel-profile-identity h2")).toHaveText(employee.nickname);
  forgiveImageFaults(diagnostics);
});

test("[STAB-MEDIA-07] hidden/lazy covers of a folded «Справочник» section (Phase 19 CR-01)", async () => {
  // This spec does not close CR-01. 19-15 fixed the timer for the minimized charter and portrait (media-offscreen.spec.ts),
  // but its folded-guide-cover case is still "unknown" until 19-19 seeds guide data, so the inherited gap stays open.
  test.skip(true, "BLOCKED (inherited gap, Phase 19 CR-01): folded guide covers have no passing evidence until 19-19; media-offscreen.spec.ts owns the case.");
});
