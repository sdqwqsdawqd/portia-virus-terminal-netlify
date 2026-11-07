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
// Not a frame: a string where a number belongs and a key with a style injection. The site shows such a picture as it shows one without a frame.
// The cast only silences the type of the fixture field: the value is exactly what a hostile request could carry.
const garbage = { x: "20; background:url(//evil.example/x)", y: 80, zoom: 160, extra: "expression(alert(1))" } as unknown as typeof framed;

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

  test("D-63 the cover of a «Справочник» card shows the chosen part (4:3 frame); no frame and a garbage frame stay as before", async ({ page }) => {
    const writes = trackWrites(page);
    await stubContent(page, fixture({
      guideSections: [{ id: "g", title: "Раздел", photo: "", cards: [
        { id: "c-framed", title: "Карточка с кадром", cover: "/assets/portia-assistant.png", coverFraming: framed, blocks: [] },
        { id: "c-plain", title: "Карточка без кадра", cover: "/assets/portia-logo.png", blocks: [] },
        { id: "c-garbage", title: "Карточка с мусором", cover: "/assets/portia-virus-icon.png", coverFraming: garbage, blocks: [] },
      ] }],
    }));
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Справочник");
    const guide = desktop.window("Справочник");
    // A folded section is not rendered, and the computed transform of an element without a box reads «none»: open it first.
    const head = guide.locator('.guide-section-head[aria-expanded="false"]');
    if (await head.count()) await head.first().click();
    const cover = (title: string) => guide.locator(".guide-tile").filter({ hasText: title }).locator(".guide-tile-cover");
    await expectFramed(cover("Карточка с кадром"), framed);
    await expectUnframed(cover("Карточка без кадра"));
    await expectUnframed(cover("Карточка с мусором"));
    expect(writes, "no request to write anything").toEqual([]);
  });

  test("D-63 the dossier shows the chosen part of the photo after infection and of a mutation image", async ({ page }) => {
    const writes = trackWrites(page);
    const [virus] = defaultPortiaContent.viruses;
    await stubContent(page, fixture({
      viruses: [{
        ...structuredClone(virus), id: "virus-framed",
        infectedImage: "/assets/portia-virus-icon.png", infectedImageFraming: framed,
        mutations: [
          { name: "Мутация с кадром", description: "", image: "/assets/portia-assistant.png", imageFraming: { x: 70, y: 10, zoom: 220 } },
          { name: "Мутация с мусором", description: "", image: "/assets/portia-logo.png", imageFraming: garbage },
          { name: "Мутация без кадра", description: "", image: "/assets/portia-logo.png" },
        ],
      }],
    }));
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("База вирусов");
    const media = desktop.window("База вирусов").locator(".record-view .subject-media");
    await expect(media).toHaveCount(4);
    await expectFramed(media.nth(0), framed);
    await expectFramed(media.nth(1), { x: 70, y: 10, zoom: 220 });
    await expectUnframed(media.nth(2));
    await expectUnframed(media.nth(3));
    expect(writes, "no request to write anything").toEqual([]);
  });

  test("D-63 an «Информация» photo block shows the chosen part (contain frame); no frame and a garbage frame stay as before", async ({ page }) => {
    const writes = trackWrites(page);
    await stubContent(page, fixture({
      infoSections: [{ id: "i-1", title: "Раздел фото", body: "", subsections: [{ id: "i-1-s", title: "Страница фото", blocks: [
        { id: "ph-framed", type: "photo", url: "/assets/portia-assistant.png", framing: framed },
        { id: "ph-plain", type: "photo", url: "/assets/portia-logo.png" },
        { id: "ph-garbage", type: "photo", url: "/assets/portia-virus-icon.png", framing: garbage },
      ] }] }],
    }));
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Информация");
    const info = desktop.window("Информация");
    // On a phone the section only opens its group; on PC it is already the open one. Either way the page is chosen from the row of the group.
    await info.locator(".info-index > div > button").filter({ hasText: "Раздел фото" }).click();
    await info.locator('.info-index [data-info-id="i-1-s"]').click();
    const photos = info.locator(".info-document .info-block-photo");
    await expect(photos).toHaveCount(3);
    await expectFramed(photos.nth(0), framed);
    await expectUnframed(photos.nth(1));
    await expectUnframed(photos.nth(2));
    expect(writes, "no request to write anything").toEqual([]);
  });

  test("D-63 the «Корзина» image file and the photo of a virus in the bin show the chosen part", async ({ page }) => {
    const writes = trackWrites(page);
    const [virus] = defaultPortiaContent.viruses;
    await stubContent(page, fixture({
      recycleFiles: [
        { id: "f-framed", name: "Файл с кадром", location: "C:\PORTIA\RECYCLE_BIN", kind: "image", content: "", image: "/assets/portia-assistant.png", imageFraming: framed, virusId: "" },
        { id: "f-plain", name: "Файл без кадра", location: "C:\PORTIA\RECYCLE_BIN", kind: "image", content: "", image: "/assets/portia-logo.png", virusId: "" },
        { id: "f-garbage", name: "Файл с мусором", location: "C:\PORTIA\RECYCLE_BIN", kind: "image", content: "", image: "/assets/portia-virus-icon.png", imageFraming: garbage, virusId: "" },
      ],
      recycledViruses: [{ ...structuredClone(virus), id: "virus-recycled", name: "Вирус в корзине", infectedImage: "/assets/portia-virus-icon.png", infectedImageFraming: framed, mutations: [] }],
      recycleOrder: ["file:f-framed", "file:f-plain", "file:f-garbage", "virus:virus-recycled"],
    }));
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Корзина");
    const trash = desktop.window("Корзина");
    const open = async (name: string) => {
      const close = trash.getByRole("button", { name: "Закрыть файл" });
      if (await close.count()) await close.click();
      await trash.locator(".trash-file-row").filter({ hasText: name }).click();
    };
    await open("Файл с кадром");
    await expectFramed(trash.locator(".trash-image-document"), framed);
    await open("Файл без кадра");
    await expectUnframed(trash.locator(".trash-image-document"));
    await open("Файл с мусором");
    await expectUnframed(trash.locator(".trash-image-document"));
    await open("Вирус в корзине");
    await expectFramed(trash.locator(".trash-virus-document .subject-media").first(), framed);
    expect(writes, "no request to write anything").toEqual([]);
  });
});
