import { closedMessage } from "./editor-tabs.ts";

// Private editor notes (Phase 20, D-41 / D-47). They live in public.portia_editor_notes, never in PortiaContent:
// normalizePortiaContent builds its result from explicit fields, so a "note" key in a stored payload cannot reach
// /api/content or a visitor's cache. Everything here is pure: no DOM, no Supabase.

export const NOTES_TABS = ["guide", "broadcasts", "search"] as const;
export type NotesTab = (typeof NOTES_TABS)[number];
export type NotesMap = Record<string, string>;
export type NotesByTab = Partial<Record<NotesTab, NotesMap>>;

export const MAX_NOTE_LENGTH = 300;
export const MAX_NOTES_PER_TAB = 500;
export const MAX_NOTE_KEY_LENGTH = 80;
export const MAX_NOTES_BODY_BYTES = 64 * 1024;

const keyPattern = /^[A-Za-z0-9_-]+$/;
const notesTabSet: ReadonlySet<string> = new Set(NOTES_TABS);

export const isNotesTab = (value: unknown): value is NotesTab => typeof value === "string" && notesTabSet.has(value);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Keys are section or card ids, values are the trimmed note text. Anything else is dropped, not repaired.
export function normalizeNotesMap(value: unknown): NotesMap {
  const result: NotesMap = {};
  if (!isPlainObject(value)) return result;
  let count = 0;
  for (const [key, raw] of Object.entries(value)) {
    if (count >= MAX_NOTES_PER_TAB) break;
    if (key === "__proto__" || key.length < 1 || key.length > MAX_NOTE_KEY_LENGTH || !keyPattern.test(key)) continue;
    if (typeof raw !== "string") continue;
    const text = raw.trim();
    if (!text) continue;
    result[key] = text;
    count += 1;
  }
  return result;
}

export type NotesRow = { tab: unknown; notes: unknown; revision: unknown };
export type NotesPayload = { notes: NotesByTab; revisions: Partial<Record<NotesTab, number>> };

// The editor answer: only the tabs open to this editor are present, so a closed tab leaks neither text nor revision.
// A tab without a stored row reads as no notes at revision 0 (the first save inserts).
export function notesPayloadForTabs(rows: readonly NotesRow[], openTabs: readonly string[]): NotesPayload {
  const payload: NotesPayload = { notes: {}, revisions: {} };
  for (const tab of NOTES_TABS) {
    if (!openTabs.includes(tab)) continue;
    const row = rows.find((candidate) => candidate.tab === tab);
    payload.notes[tab] = normalizeNotesMap(row?.notes);
    payload.revisions[tab] = typeof row?.revision === "number" && Number.isInteger(row.revision) && row.revision >= 0 ? row.revision : 0;
  }
  return payload;
}

export type NotesPutRefusal = { status: 400 | 403; error: string };

// Server rule for PUT /api/content/notes: null means the request may go on.
export function notesPutRefusal(body: Record<string, unknown>, openTabs: readonly string[]): NotesPutRefusal | null {
  const badData: NotesPutRefusal = { status: 400, error: "Некорректные данные." };
  const tab = body.tab;
  if (!isNotesTab(tab)) return badData;
  if (!openTabs.includes(tab)) return { status: 403, error: closedMessage([tab]) };
  const revision = body.revision;
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) return badData;
  if (!isPlainObject(body.notes)) return badData;
  for (const raw of Object.values(body.notes)) {
    if (typeof raw === "string" && raw.trim().length > MAX_NOTE_LENGTH) {
      return { status: 400, error: `Заметка длиннее ${MAX_NOTE_LENGTH} символов.` };
    }
  }
  return null;
}

// Drops notes whose section or card no longer exists, so a deleted card does not keep a stale note.
export function pruneNotes(notes: NotesMap, liveIds: Iterable<string>): NotesMap {
  const live = new Set(liveIds);
  return Object.fromEntries(Object.entries(notes).filter(([id]) => live.has(id)));
}

function sameNotes(left: NotesMap | undefined, right: NotesMap | undefined): boolean {
  const a = Object.entries(left ?? {});
  const b = Object.entries(right ?? {});
  if (a.length !== b.length) return false;
  return a.every(([key, text]) => (right ?? {})[key] === text);
}

// The tabs whose notes differ; a tab missing on one side counts as an empty map.
export function changedNotesTabs(baseline: NotesByTab, draft: NotesByTab): NotesTab[] {
  return NOTES_TABS.filter((tab) => !sameNotes(baseline[tab], draft[tab]));
}

// 42P01: Postgres "undefined table"; PGRST205: PostgREST "table not found in the schema cache".
// The migration may not be applied yet; the route then answers 503 instead of failing the whole editor.
export function isMissingNotesTable(error: unknown): boolean {
  const code = isPlainObject(error) ? error.code : undefined;
  return code === "42P01" || code === "PGRST205";
}

// After a 409 the editor reloads the notes another editor saved. Its own unsaved changes (edited, added or cleared notes)
// are put back over that copy, so «Загрузить заметки» never throws typed text away.
export function rebaseNotes(before: NotesMap, mine: NotesMap, server: NotesMap): NotesMap {
  const result: NotesMap = { ...server };
  for (const [key, text] of Object.entries(mine)) {
    if (before[key] !== text) result[key] = text;
  }
  for (const key of Object.keys(before)) {
    if (!(key in mine)) delete result[key];
  }
  return normalizeNotesMap(result);
}
