import type { Locator, Page, Request } from "@playwright/test";
import { defaultPortiaContent } from "../../../lib/portia-content.ts";
import { tabRegistry } from "../../../lib/editor-tabs.ts";
import { DesktopPage } from "../pages/desktop.page";
import { EditorPage } from "../pages/editor.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate } from "./support";

// Phase 20-53, 20-57 (D-62, D-63, D-66, D-67): candidate frames for the owner's gallery (20-54, 20-58): the editor with the «Информация» add-section bar on top, the dialog
// «Видимая часть» opened from the block under a «Справочник» section photo and under the photo after infection (D-66: the whole picture dimmed, a light frame of the
// place on the site — the band of a section in a window of the usual size, or the picture as it lies — D-67), and the site showing the same part of a picture.
// Candidates only: every frame goes under visual-candidates/.runs, nothing here touches tests/e2e/visual/__screenshots__.
//
// UI-контракт на подменённых чтениях GET /api/access, GET /api/content (и GET /api/employees при «a»): не доказательство ролей; записи нет — трекер
// роняет тест. Employee photos have no frame here: the owner chose variant b in 20-52 (no frame for «Фото сотрудника»), so the frames
// editor-image-framing-employee and employee-portrait-framed are not taken. The pictures are tracked files of public/assets, not real photos:
// how a chosen part looks on the owner's real photos is the owner's check (20-UAT EDITOR-FRAMING-01).
// The requirement id of a frame is STAB-BASE-03 because that is the only family support.ts accepts; the evidence belongs to STAB-REL-08
// (frames of the visible part) and STAB-EDIT-02 (editor-info-add-section).

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
test.beforeEach(({}, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20-53 editor-image candidates run on chromium-desktop and chromium-phone.");
});

const surfaceEditor = "Редактор: вкладки с картинками";
const surfaceSite = "Сайт: показ выбранной части картинки";
const actor = "editor-ui-contract-stub";
const snapshot = (id: string, project: string) => `tests/e2e/visual/__screenshots__/phase20-${id}--${project}.png`;
const contract = "UI-контракт на подменённых чтениях GET /api/access и GET /api/content, не доказательство ролей";

let writes: string[] = [];

/** Every request that could write to our API or Supabase (GET and HEAD are reads): the test fails on any of them. */
function trackWrites(page: Page) {
  writes = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const own = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const supabase = url.hostname.endsWith(".supabase.co");
    const readOnly = request.method() === "GET" || request.method() === "HEAD";
    if ((own || supabase) && !readOnly) writes.push(`${request.method()} ${url.pathname}`);
  });
}

test.afterEach(() => {
  expect(writes, "the candidate frames must not write to our API or Supabase").toEqual([]);
});

/** The two reads the desktop needs to mount the editor; a write to either path is aborted (and the tracker records it). */
async function stubReads(page: Page, content: unknown) {
  await page.route("**/api/access", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ canEdit: true, canManageEditors: false, openTabs: tabRegistry.map((tab) => tab.id), tabsEnforced: false }),
    });
  });
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify({ content, revision: 1, updatedAt: null }) });
  });
}

async function openEditorTab(page: Page, content: unknown, tabName: RegExp) {
  await stubReads(page, content);
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await expect(editor.openEditor).toBeEnabled();
  await editor.openEditor.click();
  await expect(editor.editorNavigation()).toBeVisible();
  await editor.editorNavigation().getByRole("button", { name: tabName }).click();
}

/** A slider of the dialog by the arrow keys (steps of 5): «Масштаб» is an input range (value), «Положение картинки» holds two values read from aria-valuetext. */
async function stepKey(slider: Locator, from: number, to: number, keys: [string, string]) {
  const steps = (to - from) / 5;
  for (let step = 0; step < Math.abs(steps); step += 1) await slider.press(steps > 0 ? keys[0] : keys[1]);
}

const frame = { x: 30, y: 60, zoom: 150 };
const picture = "/assets/portia-assistant.png";
const fixture = (patch: Record<string, unknown>) => ({ ...structuredClone(defaultPortiaContent), ...patch });
const framedVirus = (framing?: typeof frame) => ({ ...structuredClone(defaultPortiaContent.viruses[0]), id: "virus-frames", name: "Вирус для кадра", infectedImage: picture, ...(framing ? { infectedImageFraming: framing } : {}), mutations: [] });

/** The block «Видимая часть» of a field: «Изменить» opens the dialog, «Масштаб» and «Положение картинки» (arrow keys) choose the frame; the dialog stays open for the frame. */
async function chooseFrame(page: Page, group: Locator) {
  await expect(group).toBeVisible();
  await group.scrollIntoViewIfNeeded();
  await expect(group.locator(".portia-image.is-loaded")).toBeVisible();
  await group.getByRole("button", { name: "Изменить" }).click();
  const dialog = page.getByRole("dialog", { name: /^Видимая часть/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".image-framing-window")).toBeVisible();
  const zoom = dialog.getByRole("slider", { name: "Масштаб" });
  await zoom.focus();
  await stepKey(zoom, 100, frame.zoom, ["ArrowRight", "ArrowLeft"]);
  await expect(zoom).toHaveValue(String(frame.zoom));
  const position = dialog.getByRole("slider", { name: "Положение картинки" });
  await position.focus();
  await stepKey(position, 50, frame.x, ["ArrowRight", "ArrowLeft"]);
  await stepKey(position, 50, frame.y, ["ArrowDown", "ArrowUp"]);
  await expect(position).toHaveAttribute("aria-valuetext", `по горизонтали ${frame.x} %, по вертикали ${frame.y} %`);
}

test("[STAB-EDIT-02] editor-info-add-section: «Информация» with the «+ ДОБАВИТЬ РАЗДЕЛ» bar above the section tabs (UI contract, substituted reads)", async ({ page, browser, determinism }, testInfo) => {
  trackWrites(page);
  await openEditorTab(page, defaultPortiaContent, /^Информация/);
  await expect(page.getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Разделы информации" })).toBeVisible();
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "editor-info-add-section", requirement: "STAB-BASE-03", surface: surfaceEditor, actor,
    state: `D-62 / STAB-EDIT-02 ${contract}: вкладка «Информация», кнопка «+ ДОБАВИТЬ РАЗДЕЛ» сверху над вкладками разделов, как в «Справочнике»`,
    intendedSnapshot: snapshot("editor-info-add-section", testInfo.project.name),
  });
});

test("[STAB-REL-08] editor-image-framing-guide: «Справочник», the dialog «Видимая часть» opened from the section photo (D-66, D-67; UI contract, substituted reads)", async ({ page, browser, determinism }, testInfo) => {
  trackWrites(page);
  await openEditorTab(page, fixture({ guideSections: [{ id: "g-frames", title: "Раздел с фото", photo: picture, cards: [] }] }), /^Справочник/);
  const toggle = page.locator(".editor-section-column > .nested-editor-card > .nested-editor-head .nested-editor-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const group = page.locator(".image-editor-field").filter({ hasText: "Фото раздела" }).getByRole("group", { name: "Видимая часть" });
  await chooseFrame(page, group);
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "editor-image-framing-guide", requirement: "STAB-BASE-03", surface: surfaceEditor, actor,
    state: `D-66 / D-67 / STAB-REL-08 ${contract}: вкладка «Справочник», окно «Видимая часть»: вся картинка затемнена, светлая рамка — полоса раздела «Справочника» в окне обычного размера, кадр 30 / 60 / 150 % (положение стрелками, «Масштаб»); в рамке полосы сайт показывает то же; картинка из public/assets, не настоящее фото`,
    intendedSnapshot: snapshot("editor-image-framing-guide", testInfo.project.name),
  });
});

test("[STAB-REL-08] editor-image-framing-dossier: «База вирусов», the dialog «Видимая часть» opened from the photo after infection (D-66, D-67; UI contract, substituted reads)", async ({ page, browser, determinism }, testInfo) => {
  trackWrites(page);
  await openEditorTab(page, fixture({ viruses: [framedVirus()] }), /^База вирусов/);
  await page.locator(".editor-record-list .editor-record-row button", { has: page.locator("strong") }).first().click();
  await page.getByRole("navigation", { name: "Разделы досье" }).getByRole("button", { name: "Основное" }).click();
  const group = page.locator(".image-editor-field").first().getByRole("group", { name: "Видимая часть" });
  await chooseFrame(page, group);
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "editor-image-framing-dossier", requirement: "STAB-BASE-03", surface: surfaceEditor, actor,
    state: `D-66 / D-67 / STAB-REL-08 ${contract}: вкладка «База вирусов», «Основное», окно «Видимая часть»: вся картинка затемнена, светлая рамка — картинка целиком (как на странице досье), кадр 30 / 60 / 150 %; картинка из public/assets, не настоящее фото`,
    intendedSnapshot: snapshot("editor-image-framing-dossier", testInfo.project.name),
  });
});

test("[STAB-REL-08] guide-framed: the «Справочник» window shows a section band and a card cover with a chosen part (UI contract, substituted read)", async ({ page, browser, determinism }, testInfo) => {
  trackWrites(page);
  await stubReads(page, fixture({
    guideSections: [{
      id: "g-frames", title: "Раздел с кадром", photo: picture, photoFraming: frame,
      cards: [
        { id: "c-framed", title: "Обложка с кадром", cover: picture, coverFraming: frame, blocks: [] },
        { id: "c-plain", title: "Обложка без кадра", cover: picture, blocks: [] },
      ],
    }],
  }));
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Справочник");
  const guide = desktop.window("Справочник");
  const head = guide.locator('.guide-section-head[aria-expanded="false"]');
  if (await head.count()) await head.first().click();
  await expect(guide.locator(".guide-tile")).toHaveCount(2);
  await expect(guide.locator(".guide-section-band")).toHaveAttribute("data-framing", "true");
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "guide-framed", requirement: "STAB-BASE-03", surface: surfaceSite, actor,
    state: `D-66 / D-67 / STAB-REL-08 ${contract}: окно «Справочник», полоса раздела и плитка с тем же кадром 30 / 60 / 150 %, что в окне выбора, рядом плитка той же картинки без кадра; картинка из public/assets, не настоящее фото`,
    intendedSnapshot: snapshot("guide-framed", testInfo.project.name),
  });
});

test("[STAB-REL-08] dossier-framed: the dossier shows the chosen part of the photo after infection (UI contract, substituted read)", async ({ page, browser, determinism }, testInfo) => {
  trackWrites(page);
  await stubReads(page, fixture({ viruses: [framedVirus(frame)] }));
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("База вирусов");
  const media = desktop.window("База вирусов").locator(".record-view .subject-media").first();
  await expect(media.locator(".portia-image")).toHaveAttribute("data-framing", "true");
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "dossier-framed", requirement: "STAB-BASE-03", surface: surfaceSite, actor,
    state: `D-66 / D-67 / STAB-REL-08 ${contract}: досье вируса, фото после заражения с тем же кадром 30 / 60 / 150 %, что в окне выбора; картинка из public/assets, не настоящее фото`,
    intendedSnapshot: snapshot("dossier-framed", testInfo.project.name),
  });
});
