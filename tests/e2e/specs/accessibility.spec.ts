import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { deterministicContract } from "../fixtures/determinism";
import { expect, test } from "../fixtures/test";

// Phase 20-07 (STAB-A11Y-01..04). What this file proves and what it does not:
//  - Visitor lanes against the target's own pages and /api/content. A state the target holds no data for is skipped as
//    «BLOCKED (DATA)»; a role lane (participant, reviewer, editor, owner) is «BLOCKED (ENV)». A skip is never a pass.
//  - The participant/template lane stubs ONE read (GET /api/promotion/status?nickname=) exactly like template-builder.spec.ts.
//    That is a UI-contract look at the local markup, not authenticated-role or server evidence.
//  - The qualification-window lane (marked UI-contract stub in its name) stubs the status read and POST /api/promotion/test for that one test only. It proves
//    the client behaviour (inert, Tab trap, focus return), not the server and not a live attempt; the live run stays «BLOCKED (ENV)».
//  - Automated checks (axe, geometry, focus order, DOM structure) do not replace a screen reader, a hardware keyboard or a
//    physical phone. Those belong to 20-14; no physical-device verdict is claimed here.

type AxeViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

const approvedCriticalOrSeriousFingerprints = new Set<string>();

function fingerprint(violation: AxeViolation) {
  return `${violation.id}:${violation.impact ?? "unknown"}`;
}

const isPhone = () => test.info().project.name.endsWith("-phone");

async function scan(page: Page, testInfo: TestInfo, label: string, options: { withoutIframes?: boolean } = {}) {
  let builder = new AxeBuilder({ page });
  // The sheet and charter windows frame pages we do not own (github.io, docs.google.com): axe is run on our own document only.
  if (options.withoutIframes) builder = builder.exclude("iframe");
  const results = await builder.analyze();
  await testInfo.attach(`axe-${label}`, {
    body: Buffer.from(JSON.stringify(results.violations.map((violation) => ({
      fingerprint: fingerprint(violation),
      help: violation.help,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })), null, 2)),
    contentType: "application/json",
  });
  return results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
}

const summary = (violations: AxeViolation[]) => violations.map((violation) => `${fingerprint(violation)} @ ${violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(" | ")}`);

async function settle(page: Page, scope = "body") {
  // A window scales in on open: measure the settled layout, not a frame of the animation.
  await page.locator(scope).first().evaluate((element) => Promise.all(element.ownerDocument.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))));
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Participant + template (UI-contract stub of ONE read; see the header).
// ---------------------------------------------------------------------------------------------------------------------------------

const nickname = "portia_e2e_template";
const participantStatus = {
  nickname,
  promotionRecord: { currentTitle: { id: "academic", label: "Академик" }, nextTitle: { id: "intern", label: "Стажёр" } },
  currentTitle: { id: "academic", label: "Академик" },
  nextTitle: { id: "intern", label: "Стажёр" },
  ordinary: {
    eligibility: { status: "eligible", targetTitleId: null },
    active: {
      status: "assigned",
      targetTitleId: null,
      attemptId: undefined,
      tasks: [
        { id: "task-1", text: "Создать шаблон досье вируса по образцу «Базы вирусов».", sortOrder: 1 },
        { id: "task-2", text: "Описать порядок работы в лаборатории.", sortOrder: 2 },
      ],
    },
  },
  qualification: { eligibility: { status: "not-listed" }, active: null },
  results: [],
};

async function openParticipant(page: Page) {
  await page.route("**/api/promotion/status**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("nickname")) {
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(participantStatus) });
      return;
    }
    await route.fallback();
  });
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  await desktop.goto();
  await promotion.open();
  await promotion.nickname.fill(nickname);
  await promotion.checkNickname.click();
  await expect(promotion.heading(nickname)).toBeVisible();
  await settle(page);
  return { desktop, promotion };
}

async function openBuilder(page: Page) {
  const { desktop, promotion } = await openParticipant(page);
  const trigger = promotion.window.getByRole("button", { name: "Создать шаблон" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const builder = promotion.window.locator(".template-builder");
  await expect(builder.getByRole("heading", { name: "Шаблон досье", level: 1 })).toBeFocused();
  return { desktop, promotion, builder, trigger };
}

/** The fault this spec causes on purpose (an aborted lookup, or a request cut by our own reload); every other diagnostic still fails the test. */
function forgiveFaults(diagnostics: DiagnosticLedger) {
  const kept = diagnostics.entries.filter((entry) => !(
    (entry.kind === "requestfailed" && /ERR_FAILED|ERR_ABORTED|NS_ERROR|Failed|aborted|cancelled|Blocked by Web Inspector/i.test(entry.text))
    || (entry.kind === "console" && /Failed to load resource|ERR_FAILED/i.test(entry.text))
  ));
  diagnostics.entries.splice(0, diagnostics.entries.length, ...kept);
}

test.describe("[STAB-A11Y-01] PC controls: axe, names, focus", () => {
  test("home desktop and the opened desktop surfaces have no critical or serious axe violations", async ({ page }, testInfo) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    const found: string[] = [];
    found.push(...summary(await scan(page, testInfo, "home")));
    for (const app of ["Настройки", "Повышение", "Информация", "Справочник", "Сводка"]) {
      await desktop.openApp(app);
      await settle(page);
      found.push(...summary(await scan(page, testInfo, app)).map((entry) => `${app}: ${entry}`));
      // A phone shows one window at a time and hides the shortcuts while it is open.
      await desktop.closeApp(app);
    }
    expect(found, "critical/serious axe violations on the scoped surfaces").toEqual([]);
  });

  test("the Promotion gate: empty, error and long Cyrillic nickname keep names, one alert and the typed value", async ({ page, diagnostics }, testInfo) => {
    const desktop = new DesktopPage(page);
    const promotion = new PromotionPage(page);
    await desktop.goto();
    await promotion.open();
    await settle(page);

    // empty: the button is disabled and the reason is in text that the button is described by.
    await expect(promotion.checkNickname).toBeDisabled();
    const describedBy = await promotion.checkNickname.getAttribute("aria-describedby");
    expect(describedBy, "the disabled button names its reason").toBeTruthy();
    const reason = (await promotion.window.locator(`[id="${describedBy}"]`).innerText()).trim();
    expect(reason.length, "the reason is written out").toBeGreaterThan(8);
    expect(reason).toMatch(/[А-Яа-яЁё]/u);
    expect(await scan(page, testInfo, "gate-empty").then(summary)).toEqual([]);

    // long Cyrillic value survives an aborted request, with one alert and a retry note.
    await page.route("**/api/promotion/status**", (route) => (new URL(route.request().url()).searchParams.has("nickname") ? route.abort() : route.fallback()));
    const long = "Ёжик_Жужелица_Ёлочкин_Щёлкунчик_Ъ_Ыыыыыыыыыыыыыыыыыыыыыыыыыыыы_123456".slice(0, 64);
    await promotion.nickname.fill(long);
    await expect(promotion.checkNickname).toBeEnabled();
    await promotion.checkNickname.click();
    await expect(promotion.alert()).toHaveCount(1);
    const alertText = (await promotion.alert().innerText()).trim();
    expect(alertText.length).toBeGreaterThan(8);
    expect(alertText).toMatch(/[А-Яа-яЁё]/u);
    await expect(promotion.nickname).toHaveValue(long);
    await expect(promotion.window.getByText("Введённый ник сохранён", { exact: false })).toHaveCount(1);
    const texts = await promotion.window.locator('[role="alert"], [role="status"]').allInnerTexts();
    const visibleTexts = texts.map((text) => text.trim()).filter(Boolean);
    expect(new Set(visibleTexts).size, `no status or alert text is announced twice: ${JSON.stringify(visibleTexts)}`).toBe(visibleTexts.length);
    expect(await scan(page, testInfo, "gate-error").then(summary)).toEqual([]);
    const overflow = await promotion.window.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "the long nickname does not widen the window").toBeLessThanOrEqual(1);
    forgiveFaults(diagnostics);
  });

  test("Promotion participant (UI-contract stub): axe, written state, focus visible on the keyboard path", async ({ page }, testInfo) => {
    const { promotion } = await openParticipant(page);
    expect(await scan(page, testInfo, "participant").then(summary)).toEqual([]);
    // The state is written out, never colour alone.
    await expect(promotion.window.locator(".promotion-step-badge").first()).toHaveText(/ДОСТУПНО СЕЙЧАС|ПОКА НЕДОСТУПНО|В ПРОЦЕССЕ/);

    const visits = await tabVisits(page, promotion.window, 8);
    expect(visits.length, "the keyboard reaches controls in the participant window").toBeGreaterThan(1);
    for (const visit of visits) {
      expect(visit.name, `${visit.tag} has an accessible name`).not.toBe("");
      expect(visit.indicator, `${visit.tag} «${visit.name}» shows a focus indicator`).toBe(true);
    }
  });

  test("template builder (UI-contract stub): axe and accessible names on every tab, dialog trap and focus restore", async ({ page }, testInfo) => {
    const { promotion, builder, trigger } = await openBuilder(page);
    const tabs = builder.getByRole("navigation", { name: "Разделы досье" });

    // The builder is the editor's virus card: every input, select, textarea and formatted text field has an accessible name
    // (a label, aria-labelledby for the formatted text and the file input), and axe finds nothing critical or serious, on each tab.
    const expectNamedFields = async (tab: string) => {
      const fields = builder.locator("input:not([hidden]), select, textarea, [role=textbox]");
      const count = await fields.count();
      expect(count, `${tab}: the tab has fields`).toBeGreaterThan(2);
      for (let index = 0; index < count; index += 1) {
        await expect(fields.nth(index), `${tab}: field #${index} has an accessible name`).toHaveAccessibleName(/\S/);
      }
    };
    await expectNamedFields("Основное");
    expect(await scan(page, testInfo, "template-main").then(summary)).toEqual([]);

    await tabs.getByRole("button", { name: "Описание", exact: true }).click();
    await expectNamedFields("Описание");
    expect(await scan(page, testInfo, "template-text").then(summary)).toEqual([]);

    // one mutation, so its fields (name, formatted description, image slot, delete) are on the tab too
    await tabs.getByRole("button", { name: "Мутации", exact: true }).click();
    await builder.getByRole("button", { name: "+ ДОБАВИТЬ МУТАЦИЮ" }).click();
    await expect(builder.getByText("МУТАЦИЯ 01")).toBeVisible();
    await expectNamedFields("Мутации");
    expect(await scan(page, testInfo, "template-mutations").then(summary)).toEqual([]);

    // D-55: the view switch is two named buttons with aria-pressed, and axe finds nothing critical or serious in either view.
    const views = builder.getByRole("group", { name: "Вид", exact: true });
    const fieldsView = views.getByRole("button", { name: "Поля", exact: true });
    const previewView = views.getByRole("button", { name: "Предпросмотр", exact: true });
    await expect(fieldsView).toHaveAccessibleName("Поля");
    await expect(previewView).toHaveAccessibleName("Предпросмотр");
    await expect(fieldsView).toHaveAttribute("aria-pressed", "true");
    await expect(previewView).toHaveAttribute("aria-pressed", "false");
    await previewView.click();
    await expect(previewView).toHaveAttribute("aria-pressed", "true");
    await expect(fieldsView).toHaveAttribute("aria-pressed", "false");
    const card = builder.getByLabel("Предпросмотр шаблона");
    await expect(card).toBeVisible();
    await expect(builder.getByRole("button", { name: "Скачать HTML" })).toBeVisible();
    // The card fades in when it mounts (the archive's content-fade): measure it at rest, not a frame of the fade.
    await settle(page);
    expect(await scan(page, testInfo, "template-preview").then(summary)).toEqual([]);
    await fieldsView.click();
    await expect(builder.getByRole("group", { name: "Поля шаблона" })).toBeVisible();
    await expect(card).toHaveCount(0);
    expect(await scan(page, testInfo, "template-fields-after-view").then(summary)).toEqual([]);

    // empty, Cyrillic and long values keep the preview named and the page unwidened
    await tabs.getByRole("button", { name: "Основное", exact: true }).click();
    const first = builder.getByLabel("Название", { exact: true });
    const value = "Вирус «Ёж-Щ» ".repeat(30).slice(0, 80);
    await first.fill(value);
    await expect(first).toHaveValue(value);
    const overflow = await promotion.window.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // dirty draft: «Вернуться к повышению» asks first; focus lands on the safe action and cannot leave the dialog
    const back = builder.getByRole("button", { name: "Вернуться к повышению" });
    await back.focus();
    await page.keyboard.press("Enter");
    const dialog = builder.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const stay = dialog.getByRole("button", { name: "Остаться и скачать" });
    const discard = dialog.getByRole("button", { name: "Вернуться без скачивания" });
    await expect(stay).toBeFocused();
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((element) => element.contains(document.activeElement));
      expect(inside, `Tab #${step + 1} stays inside the dialog`).toBe(true);
    }
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press("Shift+Tab");
      const inside = await dialog.evaluate((element) => element.contains(document.activeElement));
      expect(inside, `Shift+Tab #${step + 1} stays inside the dialog`).toBe(true);
    }
    // Escape closes it and puts the focus back on the control that opened it (not on <body>)
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(back).toBeFocused();

    // discarding returns to the participant view with the focus on «Создать шаблон»
    await page.keyboard.press("Enter");
    await expect(discard).toBeVisible();
    await discard.focus();
    await page.keyboard.press("Enter");
    await expect(promotion.heading(nickname)).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("names, alt and decorative graphics on the scoped surfaces", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    const report: string[] = [];
    for (const app of ["Настройки", "Повышение", "Информация", "Справочник", "Сводка"]) {
      await desktop.openApp(app);
      await settle(page);
      report.push(...(await inspectNames(page)).map((problem) => `${app}: ${problem}`));
      await desktop.closeApp(app);
    }
    expect(report).toEqual([]);
  });
});

async function inspectNames(page: Page) {
  return page.evaluate(() => {
      const problems: string[] = [];
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      // Technical, empty, joke or placeholder labels.
      const technical = /(^|[\s_.:-])(undefined|null|nan|todo|fixme|lorem|ipsum|asdf|test(ing)?|foo|bar)([\s_.:-]|$)|\[object|\{\{|\}\}|^\s*[-–—_.]+\s*$/iu;
      const seen = new Map<string, number>();
      for (const element of document.querySelectorAll<HTMLElement>(".app-window :is(button, a[href], [role=button], [role=tab]), .taskbar button")) {
        if (!visible(element)) continue;
        const name = (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/gu, " ").trim();
        if (!name) problems.push(`empty name: ${element.tagName}.${element.className}`);
        else if (technical.test(name)) problems.push(`technical label: «${name}»`);
        const windowName = element.closest("[data-window-app]")?.getAttribute("data-window-app") ?? "taskbar";
        const key = `${windowName}|${element.tagName}|${name}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      for (const [key, times] of seen) if (times > 1 && !key.endsWith("|ВОЙТИ В РЕДАКТОР")) problems.push(`duplicated label ×${times}: ${key}`);
      // Images: an alt attribute, never a file name; the decorative ones are empty.
      for (const image of document.querySelectorAll<HTMLImageElement>("img")) {
        if (!visible(image) && !image.hasAttribute("alt")) problems.push(`img without alt: ${image.src}`);
        const alt = image.getAttribute("alt");
        if (alt === null) problems.push(`img without alt attribute: ${image.src}`);
        else if (/\.(png|jpe?g|gif|webp|svg)\b/iu.test(alt)) problems.push(`img alt is a file name: «${alt}»`);
      }
      // SVG: hidden from AT, or an image with a name.
      for (const svg of document.querySelectorAll<SVGElement>("svg")) {
        if (!visible(svg)) continue;
        const hiddenByAncestor = svg.closest('[aria-hidden="true"]');
        const named = svg.getAttribute("role") === "img" && (svg.getAttribute("aria-label") || svg.querySelector("title"));
        if (!hiddenByAncestor && !named) problems.push(`svg neither aria-hidden nor named: ${svg.parentElement?.className ?? ""} ${svg.getAttribute("class") ?? ""}`);
      }
      return problems;
  });
}

// A keyboard walk: the focus indicator is an outline or a box-shadow, read from computed style. The first focus is set by script and a
// script focus after a mouse click does not match :focus-visible, so sampling starts after the first real Tab press.
async function tabVisits(page: Page, scope: Locator, steps: number) {
  const visits: { tag: string; name: string; indicator: boolean }[] = [];
  await scope.getByRole("textbox").or(scope.getByRole("button")).first().focus();
  await page.keyboard.press("Tab");
  for (let step = 0; step < steps; step += 1) {
    const visit = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow !== "none" && style.boxShadow !== "";
      const name = (element.getAttribute("aria-label") ?? element.textContent ?? (element as HTMLInputElement).placeholder ?? "").replace(/\s+/gu, " ").trim();
      return { tag: element.tagName, name: name || element.id || "", indicator: outline || shadow };
    });
    if (visit) visits.push(visit);
    await page.keyboard.press("Tab");
  }
  return visits;
}

test.describe("[STAB-A11Y-01] drag-only actions have a keyboard alternative", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(isPhone(), `${testInfo.project.name}: the phone grid has no free drag, so there is no drag-only action to replace.`);
  });

  test("a desktop shortcut moves with Alt+Arrow and the position is announced", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    const shortcut = desktop.shortcut("Настройки");
    await shortcut.focus();
    const before = await shortcut.boundingBox();
    await page.keyboard.press("Alt+ArrowRight");
    await page.keyboard.press("Alt+ArrowDown");
    const after = await shortcut.boundingBox();
    expect(after && before && after.x > before.x, "moved right").toBe(true);
    expect(after && before && after.y > before.y, "moved down").toBe(true);
    await expect(shortcut).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Ярлык «Настройки» перемещён" })).toHaveCount(1);
    // A plain arrow key and Enter keep their old meaning: no move, the app opens.
    const still = await shortcut.boundingBox();
    await page.keyboard.press("ArrowRight");
    expect((await shortcut.boundingBox())?.x).toBe(still?.x);
    await page.keyboard.press("Enter");
    await expect(desktop.window("Настройки")).toBeVisible();
  });

  test("a taskbar entry is reordered with Alt+Arrow and keeps the focus", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Настройки");
    await desktop.openApp("Информация");
    const entries = page.locator("[data-taskbar-app]");
    await expect(entries).toHaveCount(2);
    const order = () => entries.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.taskbarApp));
    const initial = await order();
    await entries.nth(0).focus();
    await page.keyboard.press("Alt+ArrowRight");
    expect(await order()).toEqual([...initial].reverse());
    await expect(page.locator(`[data-taskbar-app="${initial[0]}"]`)).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "перемещена" })).toHaveCount(1);
  });
});

test.describe("[STAB-A11Y-01] modal qualification window", () => {
  test("source contract: the rest of the desktop is inert while the check runs and the focus is restored", async () => {
    // BLOCKED (ENV) for the live look: a running qualification needs a participant session and reviewer approval on the isolated staging project.
    // What can be proven offline is that the desktop wires the trap; the browser behaviour is not claimed.
    const source = readFileSync(new URL("../../../components/portia-desktop.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/qualificationLocked[\s\S]{0,1200}\.inert\s*=\s*true/u);
    expect(source).toMatch(/\.inert\s*=\s*false/u);
    expect(source).toMatch(/restore[A-Za-z]*Focus|\.focus\(\{ preventScroll/u);
  });

  test("[STAB-A11Y-01] (UI-contract stub) qualification window: the rest of the desktop is inert, Tab stays inside, focus returns after finish", async ({ page }, testInfo) => {
    test.skip(isPhone(), `${testInfo.project.name}: PC trap; phone is UAT QUAL-LOCK-01.`);
    // The shapes below are copies of QualificationTest (components/portia-promotion.tsx) and safeProjection (app/api/promotion/test/route.ts).
    const attemptId = "e2e-qualification-attempt";
    const deadlineAt = new Date(Date.parse(deterministicContract.now) + 10 * 60_000).toISOString();
    const activeProjection = {
      attemptId, status: "active", clientMode: "desktop", deadlineAt,
      question: { id: "q-1", type: "single", text: "Какой вариант верный?", options: ["Первый вариант", "Второй вариант"], index: 0, total: 1 },
    };
    const finishedProjection = { attemptId, status: "finished", clientMode: "desktop", deadlineAt, question: null, result: "passed", percent: 100 };
    const posts: { action: unknown }[] = [];
    await page.route("**/api/promotion/status**", async (route) => {
      if (new URL(route.request().url()).searchParams.has("nickname")) {
        const body = { ...participantStatus, qualification: { eligibility: { status: "eligible", targetTitleId: null }, active: { status: "testing", targetTitleId: null, attemptId } } };
        await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
        return;
      }
      await route.fallback();
    });
    await page.route("**/api/promotion/test", async (route) => {
      if (route.request().method() !== "POST") { await route.fallback(); return; }
      const action = (route.request().postDataJSON() as { action?: unknown } | null)?.action;
      posts.push({ action });
      const respond = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
      if (action === "start" || action === "heartbeat") await respond(activeProjection);
      else if (action === "answer") await respond(finishedProjection);
      else if (action === "failure") await respond({});
      else await route.fallback();
    });

    const desktop = new DesktopPage(page);
    const promotion = new PromotionPage(page);
    await desktop.goto();
    await promotion.open();
    await promotion.nickname.fill(nickname);
    await promotion.checkNickname.click();
    const runner = promotion.window.locator(".promotion-qualification-runner");
    await expect(runner).toBeVisible();
    await expect(runner.getByRole("heading", { name: "Какой вариант верный?" })).toBeVisible();
    await expect(runner.getByRole("radio")).toHaveCount(2);
    await settle(page);

    // (1) shortcuts and taskbar entries are inert (themselves or through an ancestor)
    const inertReport = () => page.evaluate(() => {
      const report = (selector: string) => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
        return { total: elements.length, notInert: elements.filter((element) => !element.closest("[inert]")).map((element) => element.getAttribute("data-shortcut") ?? element.getAttribute("data-taskbar-app") ?? element.tagName) };
      };
      return { shortcuts: report("[data-shortcut]"), taskbar: report("[data-taskbar-app]") };
    });
    const locked = await inertReport();
    expect(locked.shortcuts.total, "the desktop has shortcuts to check").toBeGreaterThan(0);
    expect(locked.taskbar.total, "the taskbar has entries to check").toBeGreaterThan(0);
    expect(locked.shortcuts.notInert, "every desktop shortcut is inert while the check runs").toEqual([]);
    expect(locked.taskbar.notInert, "every taskbar entry is inert while the check runs").toEqual([]);
    expect(await promotion.window.evaluate((element) => !element.closest("[inert]")), "the qualification window itself is not inert").toBe(true);

    // (2) Tab and Shift+Tab never leave the window
    const insideWindow = () => page.evaluate(() => {
      const element = document.activeElement;
      return { inside: !!element && !!element.closest(".promotion-window"), where: element ? `${element.tagName}.${String(element.className).slice(0, 40)}` : "none" };
    });
    await runner.locator('input[type="radio"]').first().focus();
    for (let step = 1; step <= 15; step += 1) {
      await page.keyboard.press("Tab");
      const state = await insideWindow();
      expect(state.inside, `Tab #${step} stays inside the window (focus on ${state.where})`).toBe(true);
    }
    for (let step = 1; step <= 15; step += 1) {
      await page.keyboard.press("Shift+Tab");
      const state = await insideWindow();
      expect(state.inside, `Shift+Tab #${step} stays inside the window (focus on ${state.where})`).toBe(true);
    }

    // (4) axe on the window while the check runs
    expect(await scan(page, testInfo, "qualification-window").then(summary)).toEqual([]);

    // (5) answer: the projection becomes finished, inert is lifted and the focus is back on the opener or the «Повышение» heading
    await runner.getByRole("radio", { name: "Первый вариант" }).check();
    await runner.getByRole("button", { name: "ОТПРАВИТЬ И ДАЛЬШЕ" }).click();
    await expect(promotion.window.getByRole("heading", { name: "ПРОВЕРКА ПРОЙДЕНА" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.querySelectorAll("[inert]").length), { message: "no inert attribute is left on the page after the finish" }).toBe(0);
    const released = await inertReport();
    expect(released.shortcuts.notInert.length, "no shortcut stays inert").toBe(released.shortcuts.total);
    expect(released.taskbar.notInert.length, "no taskbar entry stays inert").toBe(released.taskbar.total);
    await expect.poll(() => page.evaluate(() => {
      const element = document.activeElement;
      return !!element && (element.matches(".promotion-window h1") || (!!element.closest(".promotion-window") && element.matches("button")));
    }), { message: "the focus is back on the opening button or the «Повышение» heading, not on <body>" }).toBe(true);

    // (3) the trap never made the attempt fail: no failure signal was sent in the whole run
    expect(posts.filter((entry) => entry.action === "failure"), "no POST with action failure").toEqual([]);
    expect(posts.some((entry) => entry.action === "start") && posts.some((entry) => entry.action === "answer"), "the stub saw start and answer").toBe(true);
  });

  test("BLOCKED (ENV): a live qualification run (dialog trap and focus restore) needs the participant and reviewer roles", async () => {
    test.skip(true, "BLOCKED (ENV): no participant/reviewer identity on an isolated staging project in this run (19-21 owns it). Not a pass.");
  });
});

test.describe("[STAB-A11Y-01] role lanes", () => {
  for (const lane of ["Promotion reviewer queue and editors", "content editor dialogs and drag handles", "owner access manager"]) {
    test(`BLOCKED (ENV): ${lane} are not exercised`, async () => {
      test.skip(true, `BLOCKED (ENV): ${lane} need an authenticated role on an isolated staging project. Not a pass; the component source was not changed for them in 20-07.`);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Owner verdict 2026-11-05 (20-32): the D-10 contrast issue is fixed here; every serious or critical violation fails.
// ---------------------------------------------------------------------------------------------------------------------------------

test.describe("[STAB-A11Y-03] windows outside 20-07's scope: no serious or critical violations", () => {
  const windows = ["База вирусов", "Сотрудники", "Глобальный поиск", "Корзина"];

  test("no serious or critical violation in the four windows", async ({ page }, testInfo) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    const critical: string[] = [];
    const serious: string[] = [];
    for (const app of windows) {
      await desktop.openApp(app);
      await settle(page);
      for (const violation of await scan(page, testInfo, `other-${app}`, { withoutIframes: true })) {
        const line = `${app}: ${summary([violation])[0]}`;
        if (violation.impact === "critical") critical.push(line);
        else serious.push(line);
      }
      await desktop.closeApp(app);
    }
    expect(critical, "critical violations").toEqual([]);
    expect(serious, "serious violations").toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// STAB-A11Y-02: phone.
// ---------------------------------------------------------------------------------------------------------------------------------

test.describe("[STAB-A11Y-02] phone touch, overflow, occlusion", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isPhone(), `${testInfo.project.name}: phone-only checks (these lanes carry the phone geometry).`);
  });

  const phoneApps = ["База вирусов", "Сотрудники", "Глобальный поиск", "Информация", "Справочник", "Повышение", "Настройки", "Сводка", "Корзина"];

  test("every control is at least 44×44 CSS px and nothing widens the page", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    // The tap area is what the finger hits: measured outward from the centre with elementFromPoint, so a padding box, a label around an
    // input or a pseudo-element counts, and an element covered by another one does not.
    const small = (selector: string) => page.evaluate((scope) => {
      const out: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>(scope)) {
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || element.closest("[inert]")) continue;
        const target = element.tagName === "INPUT" ? (element.closest<HTMLElement>("label") ?? element) : element;
        if (target.getBoundingClientRect().width === 0 || target.getBoundingClientRect().height === 0) continue;
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const owns = (x: number, y: number) => { const hit = document.elementFromPoint(x, y); return !!hit && target.contains(hit); };
        const label = `${element.tagName}.${String(element.className).slice(0, 30)} «${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 24)}»`;
        if (!owns(cx, cy)) { out.push(`${label} is covered at its centre`); continue; }
        const reach = (dx: number, dy: number) => { let n = 0; while (n < 60 && owns(cx + dx * (n + 1), cy + dy * (n + 1))) n += 1; return n; };
        const width = reach(-1, 0) + reach(1, 0) + 1;
        const height = reach(0, -1) + reach(0, 1) + 1;
        if (width < 43.5 || height < 43.5) out.push(`${label} tap area ${width}×${height}`);
      }
      return out;
    }, selector);
    const chrome = ".taskbar button, .start-button, .desktop-icon, .assistant-button";
    expect(await small(chrome), "home chrome").toEqual([]);
    const problems: string[] = [];
    for (const app of phoneApps) {
      await desktop.openApp(app);
      await settle(page);
      const found = await small(".app-window :is(button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, summary, [role=button], [role=option], [role=tab])");
      problems.push(...found.map((entry) => `${app}: ${entry}`));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) problems.push(`${app}: page-level horizontal overflow ${overflow}px`);
      problems.push(...(await small(chrome)).map((entry) => `${app}: ${entry}`));
      await desktop.closeApp(app);
    }
    expect(problems).toEqual([]);
  });

  test("actions work by tap alone, without hover", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.shortcut("Настройки").tap();
    await expect(desktop.window("Настройки")).toBeVisible();
    await desktop.setting("Размер ярлыков", "Крупный").tap();
    await expect(desktop.setting("Размер ярлыков", "Крупный")).toHaveAttribute("aria-pressed", "true");
    await desktop.setting("Размер ярлыков", "Стандартный").tap();
    await page.getByRole("button", { name: "Закрыть Настройки" }).tap();
    await expect(desktop.window("Настройки")).toHaveCount(0);
    // Nothing the user needs is revealed only on :hover: the window controls are visible at rest.
    await desktop.shortcut("Информация").tap();
    for (const name of ["Свернуть Информация", "Закрыть Информация"]) await expect(page.getByRole("button", { name })).toBeVisible();
  });

  test("the focused field is not covered by the bottom bar and long text stays inside the window", async ({ page }) => {
    const desktop = new DesktopPage(page);
    const promotion = new PromotionPage(page);
    await desktop.goto();
    await promotion.open();
    await settle(page);
    await promotion.nickname.focus();
    await promotion.nickname.fill("Ёжик".repeat(16));
    await page.keyboard.press("Tab");
    for (const target of [promotion.nickname, promotion.checkNickname]) {
      await target.focus();
      await target.scrollIntoViewIfNeeded();
      const covered = await target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const taskbar = document.querySelector(".taskbar")?.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const top = document.elementFromPoint(x, y);
        return { hit: !!top && (top === element || element.contains(top) || top.contains(element)), underBar: !!taskbar && rect.bottom > taskbar.top && rect.top < taskbar.bottom };
      });
      expect(covered.hit, "the control receives a tap at its centre").toBe(true);
      expect(covered.underBar, "the control is not under the bottom bar").toBe(false);
    }
    expect(await promotion.window.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("«Информация» on a phone: the list and an article screen have no critical or serious axe violations", async ({ page }, testInfo) => {
    const response = await page.request.get("/api/content");
    const content = response.ok() ? ((await response.json()) as { content?: { infoSections?: { id: string; title: string }[] } }).content : undefined;
    const sections = content?.infoSections ?? [];
    test.skip(sections.length === 0, "BLOCKED (DATA): the target serves no «Информация» section; the phone screens cannot be scanned.");
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Информация");
    const window = desktop.window("Информация");
    await expect(window.locator(".info-index")).toBeVisible();
    await settle(page);
    const list = summary(await scan(page, testInfo, "info-phone-list"));
    const plain = sections.find((section) => section.title.trim());
    const article: string[] = [];
    if (plain) {
      await window.locator(`[data-info-id="${plain.id}"]`).click();
      await expect(window.locator(".info-library")).toHaveAttribute("data-info-screen", "article");
      await settle(page);
      article.push(...summary(await scan(page, testInfo, "info-phone-article")));
    }
    expect({ list, article }, "critical/serious axe violations on the phone «Информация» screens").toEqual({ list: [], article: [] });
    test.info().annotations.push({ type: "note", description: "Behaviour of expansion, «Далее» and search reveal stays in info-phone-nav.spec.ts (BLOCKED (DATA) when the target has no section with subsections)." });
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// STAB-A11Y-03: announcements; focus and layout survive accent and size changes.
// ---------------------------------------------------------------------------------------------------------------------------------

test.describe("[STAB-A11Y-03] announcements and stable focus", () => {
  test("a saved setting is announced once in a polite status and the pressed state is exposed", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Настройки");
    await settle(page);
    const status = desktop.window("Настройки").getByRole("status");
    await expect(status).toHaveCount(1);
    await expect(status).toHaveAttribute("aria-live", "polite");
    await desktop.setting("Размер ярлыков", "Компактный").click();
    await expect(desktop.setting("Размер ярлыков", "Компактный")).toHaveAttribute("aria-pressed", "true");
    await expect(status).toHaveText("Настройки сохранены");
    await expect(status).toBeVisible();
  });

  test("focus survives a change of accent and of the window size", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Настройки");
    await settle(page);
    const amber = desktop.setting("Цвет интерфейса", "Янтарный");
    await amber.focus();
    await page.keyboard.press("Enter");
    await expect(amber).toHaveAttribute("aria-pressed", "true");
    await expect(amber).toBeFocused();
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) return;
    await page.setViewportSize({ width: Math.max(360, Math.round(viewport.width * 0.8)), height: Math.max(560, Math.round(viewport.height * 0.8)) });
    await expect(amber).toBeFocused();
    await page.setViewportSize(viewport);
    await expect(amber).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    // A focus indicator is drawn on it in the new accent.
    const indicator = await amber.evaluate((element) => { const style = getComputedStyle(element); return (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none"; });
    expect(indicator).toBe(true);
  });

  test("the custom-accent popover returns the focus to «Свой» on Escape", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Настройки");
    await settle(page);
    const custom = desktop.setting("Цвет интерфейса", "Свой");
    await custom.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".accent-picker")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".accent-picker")).toHaveCount(0);
    await expect(custom).toBeFocused();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// STAB-A11Y-04 / D-01..D-04: motion.
// ---------------------------------------------------------------------------------------------------------------------------------

const runningLoops = (page: Page) => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity).length);
const runningAnimations = (page: Page) => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length);

test.describe("[STAB-A11Y-04] motion modes (D-01..D-04); the physical verdict stays with 20-14", () => {
  const wallpapers = ["Лабораторные колбы", "Гель", "Клетки", "Спирали ДНК", "Паутина"];

  test("full → off in the middle of an animation stops every UI loop, keeps the action and writes the result", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Настройки");
    await settle(page);
    await desktop.chooseSetting("Анимации", "Включены");
    await desktop.chooseSetting("Фон рабочего стола", "Лабораторные колбы");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await expect.poll(() => runningLoops(page), { message: "full motion runs the flask loops" }).toBeGreaterThan(0);

    // A window opens (animation in flight) and, in the same turn, the user switches the motion off.
    await page.evaluate(() => {
      const shortcut = document.querySelector<HTMLElement>('[data-shortcut="guide"]');
      const off = [...document.querySelectorAll<HTMLElement>("[data-window-app=settings] button")].find((button) => button.textContent?.trim() === "Выключены");
      shortcut?.click();
      off?.click();
    });
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await expect.poll(() => runningAnimations(page), { message: "nothing keeps moving after «Выключены»", timeout: 3000 }).toBe(0);

    // Terminal state and text feedback: the opened window is whole, the earlier choice is kept, the status is written.
    const guide = desktop.window("Справочник");
    await expect(guide).toBeVisible();
    const final = await guide.evaluate((element) => { const style = getComputedStyle(element); return { opacity: style.opacity, scale: style.scale, transform: style.transform }; });
    expect(final.opacity).toBe("1");
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(final.transform);
    // A phone shows one window at a time: bring Настройки back through its taskbar entry to read what it kept.
    await page.locator('[data-taskbar-app="settings"]').click();
    await expect(desktop.window("Настройки")).toBeVisible();
    await expect(desktop.setting("Фон рабочего стола", "Лабораторные колбы")).toHaveAttribute("aria-pressed", "true");
    await expect(desktop.setting("Анимации", "Выключены")).toHaveAttribute("aria-pressed", "true");
    await expect(desktop.window("Настройки").getByRole("status")).toHaveText("Настройки сохранены");
  });

  test("off and reduced leave no looping UI motion on any wallpaper, and the spider stands still", async ({ page }) => {
    test.setTimeout(120_000);
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Настройки");
    await settle(page);
    // page.evaluate, not locator.evaluate: an absent spider (hidden or not yet drawn) must read as «absent», not wait for the element.
    const spiderPose = () => page.evaluate(() => { const element = document.querySelector(".wallpaper-spider"); return element ? `${getComputedStyle(element).transform}|${element.getAttribute("style") ?? ""}|${element.innerHTML.length}` : "absent"; });
    for (const mode of ["Выключены", "Уменьшены"] as const) {
      await desktop.chooseSetting("Анимации", mode);
      await expect(page.locator("html")).toHaveAttribute("data-motion", mode === "Выключены" ? "off" : "reduced");
      for (const wallpaper of wallpapers) {
        await desktop.chooseSetting("Фон рабочего стола", wallpaper);
        await expect(desktop.setting("Фон рабочего стола", wallpaper)).toHaveAttribute("aria-pressed", "true");
        await expect.poll(() => runningLoops(page), { message: `${mode} / ${wallpaper}: looping animations`, timeout: 3000 }).toBe(0);
        const first = await spiderPose();
        await page.waitForTimeout(300);
        expect(await spiderPose(), `${mode} / ${wallpaper}: the spider does not move`).toBe(first);
      }
    }
  });

  test("the operating system's reduced-motion preference does not switch the PORTIA OS mode (D-01)", async ({ page, diagnostics }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await desktop.openApp("Настройки");
    await expect(desktop.setting("Анимации", "Включены")).toHaveAttribute("aria-pressed", "true");
    await expect(desktop.window("Настройки").getByText("Системная настройка «уменьшить движение» не учитывается", { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    forgiveFaults(diagnostics);
  });

  test("animated images and video keep their behaviour (D-03): no motion rule touches media playback", async () => {
    // GIF and video playback is not a CSS animation, so the blanket «animation-duration: 0s» of the off mode cannot stop it. What could
    // change it is a motion rule that targets the media elements or pauses animations; none may exist. (.portia-image img only fades opacity
    // in while it loads, and the assistant PNG is a UI sprite.)
    const css = readFileSync(new URL("../../../app/portia.css", import.meta.url), "utf8");
    const motionRules = css.split(/\r?\n/u).filter((line) => /data-motion/u.test(line) && line.includes("{"));
    const touchingMedia = motionRules.filter((line) => /(^|[\s,>+~(])(video|audio|picture|source)\b|\.gif|\[src/u.test(line.split("{")[0]) || /animation-play-state|content-visibility|image-rendering/u.test(line));
    expect(touchingMedia, "no data-motion rule reaches video, audio, picture or a gif").toEqual([]);
    const imageRules = motionRules.filter((line) => /(^|[\s,>+~(])img\b/u.test(line.split("{")[0]) && !/assistant-button img/u.test(line));
    for (const rule of imageRules) expect(rule.split("{")[1], "an img motion rule only fades opacity").toMatch(/^\s*transition: opacity[^;]*;\s*\}\s*$/u);
  });
});
