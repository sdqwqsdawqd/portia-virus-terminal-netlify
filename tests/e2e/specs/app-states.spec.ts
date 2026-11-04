import type { Locator, Page, Route } from "@playwright/test";
import { emptyCopy, failureCopy, iframeFailureCopy } from "../../../lib/app-state.ts";
import { DesktopPage } from "../pages/desktop.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { expect, test } from "../fixtures/test";

// States of the eight data apps (19-08): loading, populated, empty, stale, fatal. The spec reads the real /api answers of the target and
// only injects faults into them (abort or hold, never fulfil): own /api routes are never answered with invented data (assertNoOwnApiFulfilled).
// «denied» has no row: the eight apps hold public data, so appViewState gets denied=false for them (19-08); AppDeniedPanel is proven in the editor (editor-journeys.spec.ts).
// A state the target cannot show without replacing its own answers is skipped with «BLOCKED (DATA)», never counted as a pass. It runs in 19-14.

type Source = "content" | "employees" | "frame";
type AppCase = {
  key: string;
  name: string;
  source: Source;
  /** One record on screen (the app is populated). */
  records: (window: Locator) => Locator;
  /** The shared empty-state heading when the source holds nothing (frames have none). */
  empty?: string;
  /** Host of an embedded app. */
  host?: string;
};

const apps: AppCase[] = [
  { key: "archive", name: "База вирусов", source: "content", records: (w) => w.locator(".virus-row"), empty: emptyCopy.archive.heading },
  { key: "employees", name: "Сотрудники", source: "employees", records: (w) => w.locator(".personnel-list > button"), empty: emptyCopy.employees.heading },
  { key: "info", name: "Информация", source: "content", records: (w) => w.locator(".info-index button"), empty: emptyCopy.info.heading },
  { key: "guide", name: "Справочник", source: "content", records: (w) => w.locator(".guide-tile"), empty: emptyCopy.guide.heading },
  { key: "broadcasts", name: "Сводка", source: "content", records: (w) => w.locator(".broadcast-card"), empty: emptyCopy.news.heading },
  { key: "trash", name: "Корзина", source: "content", records: (w) => w.locator(".trash-file-row"), empty: emptyCopy.trash.heading },
  { key: "sheet", name: "Таблица", source: "frame", records: (w) => w.locator("iframe"), host: "https://docs.google.com/**" },
  { key: "charter", name: "Устав", source: "frame", records: (w) => w.locator("iframe"), host: "https://sdqwqsdawqd.github.io/**" },
];

const dataApps = apps.filter((app) => app.source !== "frame");
const frameApps = apps.filter((app) => app.source === "frame");
const apiPath = (app: AppCase) => (app.source === "employees" ? "**/api/employees" : "**/api/content");

const skeleton = (window: Locator) => window.locator('.app-skeleton[aria-busy="true"]').first();
const staleBanner = (window: Locator) => window.locator(".app-stale-banner");
const fatalPanel = (window: Locator) => window.locator(".app-fatal-panel");

/** Fault on an own API path: every request is aborted until the route is removed. Nothing is fulfilled. */
async function abortApi(page: Page, pattern: string) {
  await page.route(pattern, (route) => route.abort("failed"));
  return () => page.unroute(pattern);
}

/** Holds requests (own API or an external host) until released, then lets them through to the real target. */
async function holdRoute(page: Page, pattern: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const hold = async (route: Route) => {
    await gate;
    await route.fallback().catch(() => undefined);
  };
  await page.route(pattern, hold);
  return release;
}

type FaultKind = "aborted-api" | "held-request" | "third-party-frame" | "reload-cancels-images";

/** The faults this spec causes on purpose, registered BEFORE the action (20-25, T-20-37). Each rule is per test and narrow: kind + resource
 *  type (or console source) + error text. Host names are not matched in requestfailed/console text because the ledger redacts every URL.
 *  Any other diagnostic, and any image or CSP event, still fails the test. */
function expectAppFaults(diagnostics: DiagnosticLedger, ...kinds: FaultKind[]) {
  const engineAbort = /ERR_FAILED|NS_ERROR|aborted|Blocked by Web Inspector|cancelled/i;
  if (kinds.includes("aborted-api")) {
    // abortApi answers every own /api request with route.abort("failed"); the browser reports it as a failed fetch and mirrors it to the console.
    diagnostics.expectFault({ kind: "requestfailed", source: /^(fetch|xhr)$/, text: engineAbort, reason: "the test aborts its own /api request on purpose (abortApi)" });
    diagnostics.expectFault({ kind: "console", source: /^browser:\/api\//, text: /Failed to load resource: net::ERR_FAILED/, reason: "the browser mirrors the aborted own /api request to its console" });
  }
  if (kinds.includes("held-request")) {
    // holdRoute keeps a frame document or an API call waiting; remounting the frame or closing the window cancels it.
    diagnostics.expectFault({ kind: "requestfailed", source: /^(document|fetch|xhr)$/, text: /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|aborted/i, reason: "a request held by the test is cancelled when its frame remounts or the window closes" });
  }
  if (kinds.includes("reload-cancels-images")) {
    // page.reload() cancels every image still in flight (the assistant GIF preloads of the previous document). Seen in firefox-desktop
    // (NS_BINDING_ABORTED) and webkit-phone («Load request cancelled»); the rule names those cancellation texts only, not a failed or corrupt image.
    diagnostics.expectFault({ kind: "requestfailed", source: "image", text: /NS_BINDING_ABORTED|ERR_ABORTED|Load request cancelled|cancelled/i, reason: "the test reloads the page, which cancels the images still in flight" });
    // Firefox mirrors an image aborted mid-download to the console as «Image corrupt or truncated» with the image host as the source; it arrived
    // together with the NS_BINDING_ABORTED entries of the same reload. Only an external-host console entry with this exact text, only in this test.
    diagnostics.expectFault({ kind: "console", source: /^browser:(?!\/)/, text: /Image corrupt or truncated/, reason: "Firefox reports an image aborted by the test's reload as corrupt or truncated" });
  }
  if (kinds.includes("third-party-frame")) {
    // The third-party page inside «Устав» (its own 404 for a file of its own) is not PORTIA behaviour. Both entries keep the host name: a response
    // entry carries a host, not a URL, and a console entry carries it as its source.
    diagnostics.expectFault({ kind: "response", text: /^GET sdqwqsdawqd\.github\.io -> 404$/, reason: "the embedded charter page answers 404 for a file of its own" });
    diagnostics.expectFault({ kind: "console", source: "browser:sdqwqsdawqd.github.io", text: /Failed to load resource/, reason: "the embedded charter page logs its own 404" });
  }
}

async function openApp(page: Page, name: string) {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp(name);
  return desktop.window(name);
}

/** Skips when this target serves no record for the app: the state cannot be shown without invented data. */
async function recordsOrBlocked(app: AppCase, window: Locator, why: string) {
  await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
  const count = await app.records(window).count();
  test.skip(count === 0, `BLOCKED (DATA): this target serves no records for «${app.name}», so ${why} cannot be shown without invented data.`);
  return count;
}

// ---- tracer: one app end to end -------------------------------------------------------------------------------------------------

test("[STAB-APP-02] База вирусов: a failed poll keeps the selected record and shows «Не удалось обновить — показаны данные на»", async ({ page, diagnostics }) => {
  expectAppFaults(diagnostics, "aborted-api");
  const archive = await openApp(page, "База вирусов");
  const rows = archive.locator(".virus-row");
  const count = await recordsOrBlocked(apps[0], archive, "a stale strip over last-good data");
  await expect(rows.first()).toBeVisible();
  if (count > 1) await rows.nth(1).click();
  const selected = (await archive.locator(".virus-row.active strong").textContent())?.trim() ?? "";
  expect(selected).not.toBe("");

  const restore = await abortApi(page, "**/api/content");
  await page.clock.runFor(10_500);
  const banner = staleBanner(archive);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Не удалось обновить — показаны данные на");
  await expect(archive.locator(".virus-row.active strong")).toHaveText(selected);
  await expect(rows).toHaveCount(count);

  // A retry that fails again changes neither the data nor the banner time.
  const time = await banner.locator("span").textContent();
  await banner.getByRole("button").click();
  await expect(banner.getByRole("button")).toBeEnabled();
  await expect(banner.locator("span")).toHaveText(time ?? "");
  await expect(archive.locator(".virus-row.active strong")).toHaveText(selected);

  // Once the target answers again the strip goes away and the record is still the same one.
  await restore();
  await banner.getByRole("button").click();
  await expect(staleBanner(archive)).toHaveCount(0);
  await expect(archive.locator(".virus-row.active strong")).toHaveText(selected);
});

// ---- populated ------------------------------------------------------------------------------------------------------------------

for (const app of apps) {
  test(`[STAB-APP-01] ${app.name}: populated, with no skeleton, strip or fatal panel`, async ({ page, diagnostics }) => {
    // The roster window waits up to 20 s for the first read and up to 25 s for a retry by design: webkit-phone timed out at 30 s on a slow sheet read.
    if (app.source === "employees") test.slow();
    expectAppFaults(diagnostics, "third-party-frame");
    const window = await openApp(page, app.name);
    if (app.source === "frame") {
      // The external page answers for itself; the window only has to leave the skeleton once the frame has loaded.
      await expect(window.locator("iframe")).toHaveCount(1);
      await expect(skeleton(window)).toHaveCount(0, { timeout: 25_000 });
    } else {
      await recordsOrBlocked(app, window, "the populated state");
      if (app.source === "employees") {
        // A degraded roster answer is shown under the stale strip by design (19-08). The visitor retries once through the strip; if the sheet still
        // answers degraded the window is correctly in its stale state, which this test does not claim as populated.
        const banner = staleBanner(window);
        if (await banner.count()) {
          await banner.getByRole("button", { name: "Повторить обновление" }).click();
          const cleared = await banner.waitFor({ state: "detached", timeout: 25_000 }).then(() => true, () => false);
          test.skip(!cleared, "BLOCKED (DATA): this target keeps answering a degraded roster after a retry, so the window correctly shows the stale strip instead of the populated state.");
        }
      }
    }
    await expect(fatalPanel(window)).toHaveCount(0);
    await expect(staleBanner(window)).toHaveCount(0);
    await expect(window).toBeVisible();
  });
}

// ---- loading --------------------------------------------------------------------------------------------------------------------

for (const app of apps) {
  test(`[STAB-APP-01] ${app.name}: loading shows a quiet skeleton, then the app`, async ({ page, diagnostics }) => {
    expectAppFaults(diagnostics, "held-request", "third-party-frame");
    const release = await holdRoute(page, app.source === "frame" ? app.host! : apiPath(app));
    const window = await openApp(page, app.name);
    await expect(skeleton(window)).toBeAttached();
    await expect(window.getByText("Загрузка…").first()).toBeAttached();
    await expect(fatalPanel(window)).toHaveCount(0);
    await expect(window).toBeVisible();
    release();
    if (app.source === "frame") await expect(skeleton(window)).toHaveCount(0, { timeout: 25_000 });
    else await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
  });
}

// ---- empty ----------------------------------------------------------------------------------------------------------------------

for (const app of dataApps) {
  test(`[STAB-APP-01] ${app.name}: a successful load with no records says «${app.empty}»`, async ({ page }) => {
    const window = await openApp(page, app.name);
    await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
    const count = await app.records(window).count();
    test.skip(count > 0, `BLOCKED (DATA): this target serves ${count} records for «${app.name}»; the empty state needs a source with none, and own /api answers are never replaced.`);
    await expect(window.getByText(app.empty!, { exact: true })).toBeVisible();
    await expect(window.locator(".empty-state button")).toHaveCount(0);
  });
}

// ---- stale (last-good data stays, a strip says so) ------------------------------------------------------------------------------

for (const app of dataApps.filter((item) => item.source === "content")) {
  test(`[STAB-APP-02] ${app.name}: a failed poll keeps the records and shows the strip with one retry`, async ({ page, diagnostics }) => {
    expectAppFaults(diagnostics, "aborted-api");
    const window = await openApp(page, app.name);
    const count = await recordsOrBlocked(app, window, "a stale strip (a failure with no records is the fatal panel by contract)");
    const restore = await abortApi(page, apiPath(app));
    await page.clock.runFor(10_500);
    const banner = staleBanner(window);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Не удалось обновить — показаны данные на");
    await expect(banner.getByRole("button", { name: "Повторить обновление" })).toBeEnabled();
    await expect(app.records(window)).toHaveCount(count);
    await expect(fatalPanel(window)).toHaveCount(0);
    await restore();
    await banner.getByRole("button").click();
    await expect(staleBanner(window)).toHaveCount(0);
    await expect(app.records(window)).toHaveCount(count);
  });
}

test("[STAB-APP-02] Сотрудники: a reload that cannot reach the roster shows the saved roster under the strip", async ({ page, diagnostics }) => {
  test.slow(); // the first roster read waits up to 20 s by design, then the reload reads again
  expectAppFaults(diagnostics, "aborted-api", "reload-cancels-images");
  const employees = apps[1];
  const window = await openApp(page, employees.name);
  const count = await recordsOrBlocked(employees, window, "a stale strip");
  const cached = await page.evaluate(() => globalThis.localStorage.getItem("portia-employees-last-success-v1"));
  test.skip(!cached, "BLOCKED (DATA): this target's roster is degraded, so no device copy was saved to show again.");
  const restore = await abortApi(page, "**/api/employees");
  await page.reload();
  await new DesktopPage(page).desktop.waitFor();
  await new DesktopPage(page).openApp(employees.name);
  const banner = staleBanner(window);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Не удалось обновить — показаны");
  await expect(employees.records(window)).toHaveCount(count);
  await restore();
  await banner.getByRole("button", { name: "Повторить обновление" }).click();
  // The retry reads the real sheet on the server (up to 15 s, as in STAB-APP-03); the default 5 s expect was shorter than that read. A roster that
  // is still degraded after the wait is the target's data state, recorded as BLOCKED (DATA) like the populated test, never as a pass.
  const recovered = await banner.waitFor({ state: "detached", timeout: 25_000 }).then(() => true, () => false);
  test.skip(!recovered, "BLOCKED (DATA): the upstream employee roster did not recover after retry.");
  await expect(staleBanner(window)).toHaveCount(0);
});

// ---- fatal (first load failed, nothing to show) ---------------------------------------------------------------------------------

for (const app of dataApps) {
  test(`[STAB-APP-03] ${app.name}: a first load that fails shows the reason and «Повторить загрузку»; the retry brings the app`, async ({ page, diagnostics }) => {
    // The roster retry below waits up to 25 s for the real sheet read (26 s measured on chromium-desktop): too close to the 30 s default.
    if (app.source === "employees") test.slow();
    expectAppFaults(diagnostics, "aborted-api");
    const restore = await abortApi(page, apiPath(app));
    const window = await openApp(page, app.name);
    const panel = fatalPanel(window);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("alert")).toContainText(failureCopy.offline.heading);
    await expect(panel.getByRole("button", { name: "Повторить загрузку" })).toBeEnabled();
    await expect(window).toBeVisible();
    await expect(staleBanner(window)).toHaveCount(0);

    await restore();
    await panel.getByRole("button", { name: "Повторить загрузку" }).click();
    // The roster retry waits for the real sheet read on the server (up to 15s).
    if (app.source === "employees") {
      const recovered = await fatalPanel(window).waitFor({ state: "detached", timeout: 25_000 }).then(() => true, () => false);
      test.skip(!recovered, "BLOCKED (DATA): the upstream employee roster did not recover after retry.");
    } else {
      await expect(fatalPanel(window)).toHaveCount(0, { timeout: 25_000 });
    }
    await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
  });
}

for (const app of frameApps) {
  test(`[STAB-APP-06] ${app.name}: a frame that does not load in 15s gives the fatal panel; the retry remounts the frame`, async ({ page, diagnostics }) => {
    expectAppFaults(diagnostics, "held-request", "third-party-frame");
    const release = await holdRoute(page, app.host!);
    const window = await openApp(page, app.name);
    await expect(skeleton(window)).toBeAttached();
    await page.clock.runFor(14_000);
    await expect(fatalPanel(window)).toHaveCount(0);
    await page.clock.runFor(1_500);
    const panel = fatalPanel(window);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("alert")).toContainText(iframeFailureCopy.heading);
    await expect(panel.getByRole("link", { name: "Открыть отдельно" })).toHaveAttribute("href", /^https:\/\//);
    await expect(window).toBeVisible();

    // The retry remounts the frame and goes back to the skeleton at once; a frame that answers late would also have won on its own (19-08).
    await panel.getByRole("button", { name: "Повторить загрузку" }).click();
    await expect(fatalPanel(window)).toHaveCount(0);
    await expect(skeleton(window)).toBeAttached();
    release();
    await expect(skeleton(window)).toHaveCount(0, { timeout: 25_000 });
    await expect(fatalPanel(window)).toHaveCount(0);
  });
}

// ---- layout ---------------------------------------------------------------------------------------------------------------------

test("[STAB-APP-01] the strip and the fatal panel never push the page sideways (320px wrapping is an owner check)", async ({ page, diagnostics }) => {
  expectAppFaults(diagnostics, "aborted-api");
  const restore = await abortApi(page, "**/api/content");
  const archive = await openApp(page, "База вирусов");
  await expect(fatalPanel(archive)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await restore();
});
