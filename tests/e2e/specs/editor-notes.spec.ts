import { createClient } from "@supabase/supabase-js";
import type { Browser, BrowserContext, TestInfo } from "@playwright/test";
import { expect, test, type StagingRun, type StagingSession } from "../fixtures/test";

// Private editor notes (D-47, 20-24) on the isolated staging project, run only by the mutation lane.
// Needs supabase/migrations/20261104000100_portia_editor_notes.sql on staging. The owner decides when it is applied; until then
// the notes table is absent, the lane is not runnable and the result is BLOCKED (OWNER), never a pass.
// Without safe staging keys every test is skipped as BLOCKED (ENV). Own /api routes are never answered with invented data.
// The rows of portia_editor_notes and the editor's access row are recorded first and put back after each test.

const fallbackBase = "http://127.0.0.1:3000";

type NotesRow = { tab: string; notes: unknown; revision: number; updated_at: string; updated_by: string | null };
type NotesAnswer = { notes: Record<string, Record<string, string>>; revisions: Record<string, number> };
type EditorRow = { email: string; closed_tabs: string[]; granted_tabs: string[] };

function adminOf(stagingRun: StagingRun) {
  const live = stagingRun.live;
  if (!live) throw new Error("safe target unavailable");
  return createClient(live.url, live.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function publicOf(stagingRun: StagingRun) {
  const live = stagingRun.live;
  if (!live) throw new Error("safe target unavailable");
  return createClient(live.url, live.publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function sessionOrSkip(stagingRun: StagingRun, baseURL: string, testInfo: TestInfo, label: string) {
  const outcome = await stagingRun.session("editor", baseURL, label);
  testInfo.skip("blocked" in outcome, "blocked" in outcome ? `BLOCKED (ENV): ${outcome.blocked}` : undefined);
  if (!("session" in outcome)) throw new Error("unreachable");
  return outcome.session;
}

async function contextFor(browser: Browser, baseURL: string, session: StagingSession) {
  return browser.newContext({ baseURL, locale: "ru-RU", storageState: { cookies: session.cookies, origins: [] } });
}

// The table is added by the owner-approved migration. When it is absent the lane is BLOCKED (OWNER), not failed.
async function skipUnlessTable(stagingRun: StagingRun, testInfo: TestInfo) {
  const probe = await adminOf(stagingRun).from("portia_editor_notes").select("tab").limit(1);
  const absent = probe.error?.code === "42P01" || probe.error?.code === "PGRST205";
  testInfo.skip(absent, "BLOCKED (OWNER): portia_editor_notes is not applied on staging (migration 20261104000100 awaits the owner)");
  expect(probe.error, "probe portia_editor_notes").toBeNull();
}

// Records portia_editor_notes and the editor's closed tabs before a mutating test and puts them back afterwards.
async function withNotesRestored<T>(stagingRun: StagingRun, email: string, work: () => Promise<T>): Promise<T> {
  const admin = adminOf(stagingRun);
  const notesBefore = await admin.from("portia_editor_notes").select("*").returns<NotesRow[]>();
  expect(notesBefore.error, "snapshot portia_editor_notes").toBeNull();
  const editorBefore = await admin.from("portia_editors").select("email, closed_tabs, granted_tabs").eq("email", email).maybeSingle<EditorRow>();
  try {
    return await work();
  } finally {
    const wipe = await admin.from("portia_editor_notes").delete().in("tab", ["guide", "broadcasts", "search"]);
    expect(wipe.error, "clear portia_editor_notes").toBeNull();
    if (notesBefore.data?.length) {
      const back = await admin.from("portia_editor_notes").insert(notesBefore.data);
      expect(back.error, "restore portia_editor_notes").toBeNull();
    }
    if (editorBefore.data) {
      const reopened = await admin.from("portia_editors").update({ closed_tabs: editorBefore.data.closed_tabs, granted_tabs: editorBefore.data.granted_tabs }).eq("email", email);
      expect(reopened.error, "restore portia_editors").toBeNull();
    }
  }
}

async function readNotes(context: BrowserContext) {
  const response = await context.request.get("/api/content/notes");
  return { status: response.status(), cache: response.headers()["cache-control"] ?? "", body: (await response.json()) as NotesAnswer };
}

test.describe("[STAB-EDIT-04] private editor notes (D-47)", () => {
  test("[STAB-EDIT-04] the editor saves and reads a note of an open tab; the answer is no-store", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "notes-save");
    await skipUnlessTable(stagingRun, testInfo);
    const context = await contextFor(browser, base, session);
    try {
      await withNotesRestored(stagingRun, session.email, async () => {
        const run = stagingRun.run!.runId;
        const first = await readNotes(context);
        expect(first.status).toBe(200);
        expect(first.cache).toMatch(/no-store/);
        const put = await context.request.put("/api/content/notes", { data: { tab: "guide", notes: { [`${run}-g`]: `${run} заметка` }, revision: first.body.revisions.guide ?? 0 } });
        expect(put.status()).toBe(200);
        const after = await readNotes(context);
        expect(after.body.notes.guide[`${run}-g`]).toBe(`${run} заметка`);
      });
    } finally {
      await context.close();
    }
  });

  test("[STAB-EDIT-04] a visitor and the public key never see the notes; /api/content carries no note", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "notes-visitor");
    await skipUnlessTable(stagingRun, testInfo);
    const editor = await contextFor(browser, base, session);
    const visitor = await browser.newContext({ baseURL: base, locale: "ru-RU" });
    try {
      await withNotesRestored(stagingRun, session.email, async () => {
        const run = stagingRun.run!.runId;
        const put = await editor.request.put("/api/content/notes", { data: { tab: "guide", notes: { [`${run}-v`]: `${run} заметка` }, revision: 0 } });
        // A leftover row would answer 409; the restore wipes the table, so a clean start is expected.
        expect(put.status()).toBe(200);

        const denied = await visitor.request.get("/api/content/notes");
        expect(denied.status()).toBe(403);
        const content = await visitor.request.get("/api/content");
        const text = await content.text();
        expect(text).not.toContain(`${run} заметка`);
        expect(text).not.toMatch(/"note"\s*:/);

        const viaPublicKey = await publicOf(stagingRun).from("portia_editor_notes").select("*");
        // A permission error or zero rows both prove privacy; any row would be a leak.
        expect(viaPublicKey.data ?? []).toHaveLength(0);
      });
    } finally {
      await editor.close();
      await visitor.close();
    }
  });

  test("[STAB-EDIT-04] a tab closed to the editor gives no notes and refuses a PUT", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "notes-closed");
    await skipUnlessTable(stagingRun, testInfo);
    const context = await contextFor(browser, base, session);
    try {
      await withNotesRestored(stagingRun, session.email, async () => {
        const run = stagingRun.run!.runId;
        const admin = adminOf(stagingRun);
        const seeded = await admin.from("portia_editor_notes").insert({ tab: "guide", notes: { [`${run}-c`]: `${run} заметка` }, revision: 1 });
        expect(seeded.error, "seed guide notes").toBeNull();
        const closed = await admin.from("portia_editors").upsert({ email: session.email, closed_tabs: ["guide"], granted_tabs: [] });
        expect(closed.error, "close guide tab").toBeNull();

        const read = await readNotes(context);
        expect(read.status).toBe(200);
        expect(read.body.notes.guide).toBeUndefined();
        const put = await context.request.put("/api/content/notes", { data: { tab: "guide", notes: { [`${run}-c`]: "чужая" }, revision: 1 } });
        expect(put.status()).toBe(403);
      });
    } finally {
      await context.close();
    }
  });

  test("[STAB-EDIT-04] a PUT from a stale revision answers 409 and keeps the first editor's notes", async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = await sessionOrSkip(stagingRun, base, testInfo, "notes-conflict");
    await skipUnlessTable(stagingRun, testInfo);
    const context = await contextFor(browser, base, session);
    try {
      await withNotesRestored(stagingRun, session.email, async () => {
        const run = stagingRun.run!.runId;
        const loaded = await readNotes(context);
        const base0 = loaded.body.revisions.guide ?? 0;
        const first = await context.request.put("/api/content/notes", { data: { tab: "guide", notes: { [`${run}-1`]: "первая" }, revision: base0 } });
        expect(first.status()).toBe(200);
        const stale = await context.request.put("/api/content/notes", { data: { tab: "guide", notes: { [`${run}-1`]: "вторая" }, revision: base0 } });
        expect(stale.status()).toBe(409);
        const after = await readNotes(context);
        expect(after.body.notes.guide[`${run}-1`]).toBe("первая");
      });
    } finally {
      await context.close();
    }
  });
});
