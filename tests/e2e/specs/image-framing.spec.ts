import type { Locator, Page, Request } from "@playwright/test";
import { defaultPortiaContent, type PortiaContent } from "../../../lib/portia-content.ts";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

// UI-контракт: подменено одно чтение GET /api/content фикстурой; показ сайта, не доказательство сохранения.
// Что здесь доказывается: кадр картинки (D-63, 20-51) — выбранная часть, показанная посетителю: objectPosition, масштаб и обрезка рамкой на каждой
// поверхности с картинками из редактора; картинка без кадра остаётся без нового атрибута и без инлайн-стиля; кадр-мусор показывается как отсутствие кадра.
// Чего здесь нет: сохранения (PUT /api/content), прав редактора, живых данных. Любой не-GET запрос к /api и *.supabase.co роняет тест.
// Картинки — отслеживаемые файлы public/assets, сеть к чужим хостам не нужна.

const framed = { x: 20, y: 80, zoom: 160 };

/** Every request that could write to our API or Supabase (GET and HEAD are reads). */
function trackWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const own = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const supabase = url.hostname.endsWith(".supabase.co");
    const readOnly = request.method() === "GET" || request.method() === "HEAD";
    if ((own || supabase) && !readOnly) writes.push(`${request.method()} ${url.pathname}`);
  });
  return writes;
}

/** Answers the one read the desktop needs with the fixture; any other method on the path is aborted (and the tracker records it). */
async function stubContent(page: Page, content: Record<string, unknown>) {
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ content, revision: 1, updatedAt: null }),
    });
  });
}

const fixture = (patch: Partial<PortiaContent> & Record<string, unknown>): Record<string, unknown> => ({ ...structuredClone(defaultPortiaContent), ...patch });

/** The picture of a surface: its frame span and the img inside. */
const imageOf = (scope: Locator) => ({ frame: scope.locator(".portia-image").first(), img: scope.locator(".portia-image img").first() });

/** The frame is on screen: numbers only, in the style of the frame span and of the img. */
async function expectFramed(scope: Locator, framing: { x: number; y: number; zoom: number }) {
  const { frame, img } = imageOf(scope);
  await expect(frame).toHaveAttribute("data-framing", "true");
  await expect(frame).toHaveAttribute("style", /overflow:\s*hidden/);
  await expect(frame).toHaveCSS("overflow", "hidden");
  await expect(img).toHaveCSS("object-position", `${framing.x}% ${framing.y}%`);
  const scale = framing.zoom / 100;
  await expect(img).toHaveCSS("transform", `matrix(${scale}, 0, 0, ${scale}, 0, 0)`);
  await expect(img).toHaveAttribute("style", new RegExp(`transform-origin:\\s*${framing.x}% ${framing.y}%`));
}

/** No frame: no new attribute and no inline style at all, exactly the markup of before. */
async function expectUnframed(scope: Locator) {
  const { frame, img } = imageOf(scope);
  await expect(frame).toBeAttached();
  await expect(frame).not.toHaveAttribute("data-framing", /.*/);
  expect(await frame.getAttribute("style"), "the frame span has no inline style").toBeNull();
  expect(await img.getAttribute("style"), "the img has no inline style").toBeNull();
}

test.describe("[STAB-REL-08] D-63 the site shows the part of a picture that the editor chose", () => {
  test("D-63 the «Справочник» section band shows the chosen part; a section without a frame is untouched", async ({ page }) => {
    const writes = trackWrites(page);
    await stubContent(page, fixture({
      guideSections: [
        { id: "g-framed", title: "Раздел с кадром", photo: "/assets/portia-assistant.png", photoFraming: framed, cards: [] },
        { id: "g-plain", title: "Раздел без кадра", photo: "/assets/portia-logo.png", cards: [] },
      ],
    }));
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Справочник");
    const guide = desktop.window("Справочник");

    const framedBand = guide.locator(".guide-section").filter({ hasText: "Раздел с кадром" }).locator(".guide-section-band");
    await expectFramed(framedBand.locator(".."), framed);
    await expect(framedBand).toHaveAttribute("data-framing", "true");

    const plainBand = guide.locator(".guide-section").filter({ hasText: "Раздел без кадра" }).locator(".guide-section-band");
    await expectUnframed(plainBand.locator(".."));
    await expect(plainBand).not.toHaveAttribute("data-framing", /.*/);

    expect(writes, "no request to write anything").toEqual([]);
  });
});
