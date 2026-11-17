import { createClient } from "@supabase/supabase-js";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import { uploadRefusal } from "../../../lib/image-upload.ts";
import { accessCheckFailedText } from "../../../lib/app-state.ts";
import { EditorPage } from "../pages/editor.page";
import { expect, test, type StagingRun, type StagingSession } from "../fixtures/test";

// Authenticated editor journeys on the isolated staging project (19-12, 19-13, 19-02), run only by `npm run test:e2e:mutation`.
// Identities come from the staging harness (run-prefixed, removed with residual 0); portia_content "main" is put back after each test.
// Own /api routes are never answered with invented data: a request is only held or aborted, then sent on to the real server.
// Without safe staging keys every journey is skipped as BLOCKED (ENV); a skip is never counted as a pass. It runs in 19-14.

const fallbackBase = "http://127.0.0.1:3000";
// 1x1 transparent PNG.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

type ContentRow = { id: string; payload: unknown; revision: number; updated_at: string; updated_by: string | null };
type ServedContent = { content: { infoSections: { title: string }[]; guideSections: unknown[] }; revision: number };

function adminOf(stagingRun: StagingRun) {
  const live = stagingRun.live;
  if (!live) throw new Error("safe target unavailable");
  return createClient(live.url, live.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function sessionOrSkip(stagingRun: StagingRun, baseURL: string, testInfo: TestInfo, label: string) {
  const outcome = await stagingRun.session("editor", baseURL, label);
  testInfo.skip("blocked" in outcome, "blocked" in outcome ? `BLOCKED (ENV): ${outcome.blocked}` : undefined);
  if (!("session" in outcome)) throw new Error("unreachable");
  return outcome.session;
}

async function contextFor(browser: Browser, baseURL: string, session: StagingSession) {
  const context = await browser.newContext({ baseURL, locale: "ru-RU", storageState: { cookies: session.cookies, origins: [] } });
  // The boot animation is not under test here.
  await context.addInitScript(() => window.sessionStorage.setItem("portia-boot-seen-v1", "1"));
  return context;
}

// Records portia_content "main" before a mutating test and puts it back (or removes the row) afterwards.
async function withContentRestored<T>(stagingRun: StagingRun, work: () => Promise<T>): Promise<T> {
  const admin = adminOf(stagingRun);
  const before = await admin.from("portia_content").select("*").eq("id", "main").maybeSingle<ContentRow>();
  expect(before.error, "snapshot portia_content").toBeNull();
  try {
    return await work();
  } finally {
    const restored = before.data
      ? await admin.from("portia_content").update({
          payload: before.data.payload, revision: before.data.revision, updated_at: before.data.updated_at, updated_by: before.data.updated_by,
        }).eq("id", "main")
      : await admin.from("portia_content").delete().eq("id", "main");
    expect(restored.error, "restore portia_content").toBeNull();
    const after = await admin.from("portia_content").select("revision").eq("id", "main").maybeSingle<{ revision: number }>();
    expect(after.data?.revision ?? 0, "content restored to its original revision").toBe(before.data?.revision ?? 0);
  }
}

async function served(context: BrowserContext): Promise<ServedContent> {
  const response = await context.request.get("/api/content");
  expect(response.status()).toBe(200);
  return (await response.json()) as ServedContent;
}

async function openEditor(context: BrowserContext, options: { fakeClock?: boolean } = {}) {
  const page = await context.newPage();
  // Timers must be fake from the first script on, or the page keeps real intervals that a later pause cannot stop.
  if (options.fakeClock) await page.clock.install();
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await expect(editor.openEditor).toBeEnabled();
  await editor.openEditor.click();
  await expect(editor.editorNavigation()).toBeVisible();
  return { page, editor };
}

const tab = (editor: EditorPage, name: RegExp) => editor.editorNavigation().getByRole("button", { name });
const status = (page: Page) => page.locator("p.sr-only[role='status']");

// The first info section's «Заголовок» field, opening its card if it is folded.
async function infoTitleField(page: Page, editor: EditorPage) {
  await tab(editor, /^Информация/).click();
  const unfold = page.getByRole("button", { name: /^Развернуть раздел/ }).first();
  if (await unfold.count()) await unfold.click();
  const field = page.getByLabel("Заголовок", { exact: true }).first();
  await expect(field).toBeVisible();
  return field;
}

// Phase 26 (26-06, D-13b): «СОХРАНИТЬ» stands in the sticky action bar of the draft tab; there is no chip to open first.
async function save(page: Page) {
  await page.locator(".etab-bar").getByRole("button", { name: "СОХРАНИТЬ", exact: true }).click();
}

/** Holds PUT /api/content until released, then sends it on to the real server. Nothing is fulfilled. */
async function holdSave(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/content", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await gate;
    await route.fallback().catch(() => undefined);
  });
  return release;
}

// Both sessions edit the same title; A saves first, then B saves from a stale revision and meets the 409 panel.
async function twoSessionsInConflict(browser: Browser, stagingRun: StagingRun, baseURL: string, testInfo: TestInfo) {
  const session = await sessionOrSkip(stagingRun, baseURL, testInfo, "editor-conflict");
  const contextA = await contextFor(browser, baseURL, session);
  const contextB = await contextFor(browser, baseURL, session);
  const a = await openEditor(contextA);
  const b = await openEditor(contextB);
  const fieldA = await infoTitleField(a.page, a.editor);
  const fieldB = await infoTitleField(b.page, b.editor);
  const run = stagingRun.run!.runId;
  const mineA = `${await fieldA.inputValue()} ${run} A`;
  const mineB = `${await fieldB.inputValue()} ${run} B`;
  await fieldA.fill(mineA);
  await fieldB.fill(mineB);
  await save(a.page);
  await expect(status(a.page)).toContainText("Сохранено");
  await save(b.page);
  await expect(b.page.getByRole("heading", { name: "Запись изменили до вас" })).toBeVisible();
  return { contextA, contextB, a, b, fieldB, mineA, mineB };
}

test.describe("[STAB-APP-04] editor journeys", () => {
  test("[STAB-APP-04] «Сохранить» shows «Сохраняем…», then «Сохранено» only after the server answered", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "editor-save");
    const context = await contextFor(browser, base, session);
    try {
      await withContentRestored(stagingRun, async () => {
        const { page, editor } = await openEditor(context);
        const before = await served(context);
        const field = await infoTitleField(page, editor);
        const mine = `${await field.inputValue()} ${stagingRun.run!.runId}`;
        await field.fill(mine);
        const release = await holdSave(page);
        await save(page);
        await expect(status(page)).toContainText("Сохраняем…");
        await expect(status(page)).not.toContainText("Сохранено");
        // Typing during the save is not lost: the field still holds the text.
        await expect(field).toHaveValue(mine);
        release();
        await expect(status(page)).toContainText("Сохранено");
        const after = await served(context);
        expect(after.revision).toBe(before.revision + 1);
        expect(after.content.infoSections[0].title).toBe(mine);
      });
    } finally {
      await context.close();
    }
  });

  test("[STAB-APP-04] a 409 shows «Запись изменили до вас»; «Загрузить их версию» keeps the user's edits under «Ваши правки»", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    await withContentRestored(stagingRun, async () => {
      const { contextA, contextB, b, fieldB, mineA, mineB } = await twoSessionsInConflict(browser, stagingRun, base, testInfo);
      try {
        await expect(b.page.getByRole("button", { name: "Заменить своей" })).toBeVisible();
        await expect(b.page.getByText("Их изменения будут перезаписаны.")).toBeVisible();
        const loadTheirs = b.page.getByRole("button", { name: "Загрузить их версию" });
        // The buttons wake up once the server copy has been read again.
        await expect(loadTheirs).not.toHaveAttribute("aria-disabled", "true");
        await loadTheirs.click();
        await expect(fieldB).toHaveValue(mineA);
        const edits = b.page.locator("details", { hasText: "Ваши правки" });
        await expect(edits).toBeVisible();
        await edits.locator("summary").click();
        await expect(edits).toContainText(mineB);
        const stored = await served(contextA);
        expect(stored.content.infoSections[0].title).toBe(mineA);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });
  });

  test("[STAB-APP-04] «Заменить своей» saves the user's version over the other one", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    await withContentRestored(stagingRun, async () => {
      const { contextA, contextB, b, mineB } = await twoSessionsInConflict(browser, stagingRun, base, testInfo);
      try {
        const replace = b.page.getByRole("button", { name: "Заменить своей" });
        await expect(replace).not.toHaveAttribute("aria-disabled", "true");
        await replace.click();
        await expect(status(b.page)).toContainText("Сохранено");
        await expect(b.page.getByRole("heading", { name: "Запись изменили до вас" })).toHaveCount(0);
        const stored = await served(contextA);
        expect(stored.content.infoSections[0].title).toBe(mineB);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });
  });

  test("[STAB-APP-04] a section closed while editing: the open section saves, «Сохранено 1 из 2», the closed one stays a draft", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "editor-partial");
    const context = await contextFor(browser, base, session);
    try {
      await withContentRestored(stagingRun, async () => {
        const { page, editor } = await openEditor(context, { fakeClock: true });
        const before = await served(context);
        const info = await infoTitleField(page, editor);
        const mine = `${await info.inputValue()} ${stagingRun.run!.runId}`;
        await info.fill(mine);
        await tab(editor, /^Справочник/).click();
        await page.getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ" }).click();

        // No timer may fire from here on, so the access poll cannot learn about the closed section before the save does.
        await page.clock.pauseAt(new Date(Date.now() + 1_000));
        const closed = await adminOf(stagingRun).from("portia_editors").upsert({ email: session.email, closed_tabs: ["info"], granted_tabs: [] });
        expect(closed.error, "close the info section for this editor").toBeNull();

        await save(page);
        await expect(status(page)).toContainText("Сохранено 1 из 2");
        // The open section reached the server (one new guide section); the closed one did not (its title is still the stored one).
        const stored = await served(context);
        expect(stored.revision).toBe(before.revision + 1);
        expect(stored.content.guideSections.length).toBe(before.content.guideSections.length + 1);
        expect(stored.content.infoSections[0].title).toBe(before.content.infoSections[0].title);
        expect(stored.content.infoSections[0].title).not.toBe(mine);
      });
    } finally {
      await context.close();
    }
  });

  test("[STAB-APP-09] a failed rights check closes the editor body with «Доступ закрыт» and the fail-closed line", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "editor-failclosed");
    const context = await contextFor(browser, base, session);
    try {
      const { page } = await openEditor(context);
      await page.route("**/api/access", (route) => route.abort("failed"));
      const denied = page.locator(".app-denied-panel");
      // The access poll runs every 10s; the failed check then replaces the body (owner verdict 4 A).
      await expect(denied).toBeVisible({ timeout: 25_000 });
      await expect(denied).toContainText("Доступ закрыт");
      await expect(denied).toContainText(accessCheckFailedText);
    } finally {
      await context.close();
    }
  });
});

test.describe("[STAB-MEDIA-04] upload and cache", () => {
  const photoField = (page: Page) => page.locator(".image-editor-field", { hasText: "Фото раздела" }).first();

  async function openPhotoField(context: BrowserContext) {
    const { page, editor } = await openEditor(context);
    await tab(editor, /^Справочник/).click();
    await page.getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ" }).click();
    await expect(photoField(page)).toBeVisible();
    return page;
  }

  test("[STAB-MEDIA-04] a file with a forged type is refused under the field and the field keeps its URL", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "editor-upload-bad");
    const context = await contextFor(browser, base, session);
    try {
      const page = await openPhotoField(context);
      const field = photoField(page);
      const previous = "https://example.com/previous.png";
      await field.locator("input:not([type='file'])").fill(previous);
      await field.locator("input[type='file']").setInputFiles({ name: "forged.png", mimeType: "image/png", buffer: Buffer.from("this is plain text, not an image") });
      const refusal = field.locator(".editor-media-error[role='alert']");
      await expect(refusal).toHaveText(uploadRefusal.signature);
      await expect(field.locator("input:not([type='file'])")).toHaveValue(previous);
    } finally {
      await context.close();
    }
  });

  test("[STAB-MEDIA-04] a good upload gives an immutable /recycle/<uuid> URL that a second load does not download again", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "editor-upload-ok");
    const context = await contextFor(browser, base, session);
    let url = "";
    try {
      const page = await openPhotoField(context);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      const urls = new Map<string, string>();
      const downloads: { url: string; fromCache: boolean; cacheControl: string }[] = [];
      cdp.on("Network.requestWillBeSent", (event) => { urls.set(event.requestId, event.request.url); });
      cdp.on("Network.responseReceived", (event) => {
        downloads.push({
          url: event.response.url,
          fromCache: Boolean(event.response.fromDiskCache || event.response.fromPrefetchCache),
          cacheControl: String(event.response.headers["cache-control"] ?? event.response.headers["Cache-Control"] ?? ""),
        });
      });

      const field = photoField(page);
      await field.locator("input[type='file']").setInputFiles({ name: "probe.png", mimeType: "image/png", buffer: png });
      const input = field.locator("input:not([type='file'])");
      await expect(input).toHaveValue(/\/recycle\/[0-9a-f-]{36}\.png$/);
      url = await input.inputValue();
      expect(new URL(url).protocol).toBe("https:");

      // First load of the picture: the only download. Second load: served from the cache or not requested at all.
      const loadImage = (src: string) => page.evaluate((target) => new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("image-load-failed"));
        image.src = target;
      }), src);
      await loadImage(url);
      await page.evaluate(async (target) => { const response = await fetch(target, { mode: "no-cors" }); await response.blob().catch(() => undefined); }, url);
      await loadImage(`${url}`);

      const own = downloads.filter((entry) => entry.url === url);
      const fresh = own.filter((entry) => !entry.fromCache);
      expect(fresh.length, "the picture is downloaded once").toBe(1);
      expect(fresh[0].cacheControl).toContain("31536000");
    } finally {
      await context.close();
      // The route writes to recycle/<uuid>, outside the run prefix, so the object is removed here.
      if (url) {
        const path = decodeURIComponent(new URL(url).pathname.split("/portia-media/")[1] ?? "");
        if (path) expect((await adminOf(stagingRun).storage.from("portia-media").remove([path])).error, "remove the uploaded probe object").toBeNull();
      }
    }
  });
});
