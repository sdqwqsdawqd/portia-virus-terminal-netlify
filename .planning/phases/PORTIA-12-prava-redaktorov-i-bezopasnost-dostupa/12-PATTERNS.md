# Phase 12: Права редакторов и безопасность доступа - Pattern Map

**Mapped:** 2026-10-26
**Files analyzed:** 24 (8 new, 16 modified)
**Analogs found:** 24 / 24 (all tracked; verified `git ls-files` for core ones)

Note: 12-RESEARCH.md already contains detailed target code (Patterns 1-8). This map points to the real in-repo analogs and excerpts to copy the style from. Read RESEARCH.md for target shapes.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `lib/media-url.ts` (new) + `.test.ts` | utility | transform | `lib/portia-employees.ts` (small exported helpers, l.93-100) + `lib/editor-changes.test.ts` | role-match |
| `lib/editor-tabs.ts` (new) + `.test.ts` | utility/registry | transform | `lib/editor-changes.ts` l.3-14 (`editorSections`, `sectionLabels`) | exact |
| `lib/editor-changes.ts` (edit: `info-block:` prefix, `deniedSections`, `revertSections`) | utility | transform | itself (`changedSections`, l.26-64) | exact |
| `lib/editor-changes.test.ts` (edit) | test | transform | itself (fixture pattern, l.1-40) | exact |
| `lib/editor-history.ts` (edit: `restrict` action) | store/reducer | event-driven | itself (`HistoryAction`, l.16-23) | exact |
| `lib/editor-access.ts` (edit) + `editor-access.test.ts` (new) | service | request-response | itself; test fakes from `lib/portia-employees.test.ts` (~l.89) | exact |
| `lib/editor-save.ts` (new) + test | utility | transform | `components/portia-editor.tsx` `save()` l.1003-1034 (code to extract) | exact |
| `lib/portia-content-normalize.ts` l.83, `lib/portia-employees.ts` l.523 / l.287, `components/portia-editor.tsx` l.91 | utility | transform | `isLocalMediaPath` in new `lib/media-url.ts` | exact |
| `app/api/content/route.ts` (edit PUT) | route | request-response (CAS write) | itself l.34-75 | exact |
| `app/api/editors/route.ts` (edit GET, add PATCH) | route | CRUD | itself (POST/DELETE); `pending-database` precedent `lib/portia-employees.ts` l.468-477 | exact |
| `app/api/access/route.ts` (edit: 503 on unavailable) | route | request-response | itself | exact |
| `app/api/employees/route.ts`, `app/api/employees/editor/route.ts`, `app/api/uploads/route.ts` (edit) | route | request-response | `app/api/employees/editor/route.ts` l.9-17 guard | exact |
| `app/owner-login/actions.ts`, `page.tsx` (edit) | server action / page | request-response | itself l.8-24; page catch-all l.54 | exact |
| `components/portia-editor.tsx` (tabs strip ~1139, `EditorAccessManager` ~2531) | component | CRUD + event-driven | itself (`EditorAccessManager`, `loadEditors`/`addEditor`) | exact |
| `components/portia-desktop.tsx` (poll ~500, `fetchAccess` ~406) | component | polling | itself | exact |
| `app/portia.css` (chips near `.access-editor-list`) | config/style | n/a | existing `.access-editor-list` rules | role-match |
| `supabase/portia_setup.sql` (edit) | migration | CRUD/RLS | itself l.50-110 | exact |
| `supabase/phase12_apply.sql` (new) | migration | batch | `supabase/portia_setup.sql` idioms (no other apply file) | partial |
| `.planning/PROJECT.md` (Known Limitations) | doc | n/a | existing Known Limitations section | exact |

## Pattern Assignments

### `lib/editor-access.ts` (service, request-response)
**Analog:** itself (lib/editor-access.ts l.1-24). Keep relative-only imports (tests glob `lib/*.test.ts` with `--experimental-strip-types`), so import `isMissingColumnError` by moving it out of `lib/portia-employees.ts` (l.93-95) or re-exporting.

Current core to extend (l.3-20):
```ts
const noAccess = { canEdit: false, canManageEditors: false };
export async function getEditorAccess(supabase: SupabaseClient, user: User | null | undefined) {
  if (!user?.email) return noAccess;
  const [canEdit, isOwner] = await Promise.all([
    supabase.rpc("portia_can_edit"),
    supabase.rpc("portia_is_owner"),
  ]);
  if (canEdit.error || isOwner.error) {
    console.error("PORTIA editor access lookup failed", canEdit.error ?? isOwner.error);
    return noAccess;
  }
  return { canEdit: canEdit.data === true, canManageEditors: isOwner.data === true };
}
```
Add `|| !user.email_confirmed_at` to the first guard (D-18), a third `from("portia_editors").select("closed_tabs, granted_tabs").eq("email", ...).maybeSingle()` in the `Promise.all`, and the `unavailable`/`tabsEnforced` fields (RESEARCH Pattern 1).
Missing-column helper (portia-employees.ts l.93-95):
```ts
export function isMissingColumnError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST204" || error?.code === "42703";
}
```

### `lib/editor-changes.ts` (utility, transform)
**Analog:** itself. Add to `prefixSections` (l.26-32) the entry `"info-block:": "info"`. New `deniedSections` / `revertSections` go beside `changedSections` (l.44-64), reusing `sectionOfKey` (l.16-24) and `sectionOfFormattedKey` (l.34-41). Virus keys resolve through `[...baseline.viruses, ...draft.viruses].some(...)` (l.37), so moved-virus texts are already "viruses".
Tests: copy fixture style from `lib/editor-changes.test.ts` l.1-15:
```ts
const fixture = (): PortiaContent => structuredClone(defaultPortiaContent);
test("moving a virus to the bin changes viruses and the bin", () => {
  const draft = fixture();
  const [virus] = draft.viruses.splice(0, 1);
  draft.recycledViruses.push(virus);
  draft.recycleOrder.push(`virus:${virus.id}`);
  assert.deepEqual(changedSections(fixture(), draft), ["viruses", "recycle"]);
});
```

### `lib/editor-tabs.ts` (utility, transform)
**Analog:** `lib/editor-changes.ts` l.3-14 (`editorSections`, `sectionLabels: Record<EditorSection,string>`). Import with `./editor-changes.ts` (relative, `.ts`). Keep `"employees"` out of `EditorSection`; "access" never in registry.

### `lib/editor-history.ts` (reducer)
**Analog:** itself, `HistoryAction<T>` union (l.16-23). Add a member and a `case` alongside `"discard"`/`"sync"`:
```ts
| { type: "sync"; content: T };   // add: | { type: "restrict"; project: (content: T) => T }
```
Reducer never mutates `present`/`past`; apply `project` to `present`, `past[]`, `future[]`, leave `baseline`/`source`, `key: null`.

### `app/api/content/route.ts` PUT (route, request-response)
**Analog:** itself. Insert the restricted-editor diff after `normalizePortiaContent` (l.49-53) and before the CAS write (l.57-66). Existing 403/409/500 shape to match:
```ts
if (!user || !access.canEdit) {
  return Response.json({ error: "У вас нет доступа к редактору." }, { status: 403 });
}
...
return Response.json({ error: "Пока вы редактировали, кто-то другой сохранил изменения. Скопируйте свои правки и обновите страницу." }, { status: 409 });
```
Return before write and before `purgeCacheTag(contentCacheTag)` (l.68).

### `app/api/editors/route.ts` (route, CRUD)
**Analog:** itself. Guard + helpers to copy for new `PATCH`:
```ts
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function requireOwner() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const access = await getEditorAccess(supabase, data.user);
  if (!data.user || !access.canManageEditors) return null;
  return { supabase, user: data.user };
}
...
const body = parseJsonObject(await request.text());
if (!body) return Response.json({ error: "Некорректные данные." }, { status: 400 });
const email = normalizeEditorEmail(typeof body.email === "string" ? body.email : "");
if (!emailPattern.test(email)) return Response.json({ error: "Введите корректный email." }, { status: 400 });
```
GET select (l.21-24) currently `"email, created_at"`; extend with the two columns and a retry without them on `isMissingColumnError`, returning `tabsEnforced:false`. `pending-database` precedent: `lib/portia-employees.ts` l.468-477, retry pattern l.502-508.

### `app/api/access/route.ts`
**Analog:** itself. Replace catch fallback (l.12-15, currently `200 {canEdit:false,...}`) and the `unavailable` case with `status: 503` plus `noStoreHeaders`, so `fetchAccess` (`if (!response.ok) return;`, portia-desktop.tsx l.409) keeps previous state.

### `app/api/employees/editor/route.ts`, `employees/route.ts`, `uploads/route.ts`
**Analog:** `employees/editor/route.ts` l.9-17:
```ts
const access = await getEditorAccess(supabase, data.user);
if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403, headers: noStoreHeaders });
```
Add a second check (tab `employees` open, else 403 `Вкладка «Сотрудники» для вас закрыта.`) in GET here and in PATCH/POST/DELETE of `employees/route.ts` (guards at ~l.32, 70, 103). Uploads guard at `uploads/route.ts` l.18: allow owner or >=1 open tab.

### `app/owner-login/actions.ts` / `page.tsx`
**Analog:** `ownerLogin` l.13-20:
```ts
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) redirect("/owner-login?error=invalid");
const access = await getEditorAccess(supabase, data.user);
if (!access.canEdit) { await supabase.auth.signOut(); redirect("/owner-login?error=denied"); }
```
Add `error?.code === "email_not_confirmed"` -> `?error=unconfirmed`; after sign-in `!data.user.email_confirmed_at` -> signOut + same redirect (before the `denied` branch so message differs). In `page.tsx` add `unconfirmed` to the known list at the catch-all (~l.54) with text from D-19.

### `components/portia-editor.tsx` `EditorAccessManager` (l.2531+)
**Analog:** itself. State/call style to copy for chip PATCH (every call ends in idle or error; 15 s timeout):
```ts
const response = await fetch("/api/editors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }), signal: AbortSignal.timeout(15_000) });
if (!response.ok) {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  setState("error"); setMessage(payload.error ?? "..."); return;
}
```
Effects must use `window.setTimeout(..., 0)` for setState (lint rule), as in `useEffect(() => { const timer = window.setTimeout(() => { void loadEditors(); }, 0); return () => window.clearTimeout(timer); }, [])`. Tabs strip ~l.1139-1152, initial tab l.674, employee dirty state l.684-686, `onDirtyChange` l.1079, restore button ~l.1436-1444 (disable when `viruses` closed), `role="status"` region ~l.1547, `save()` l.1003-1034 (extract to `lib/editor-save.ts`), local-path check l.91.

### `components/portia-desktop.tsx`
**Analog:** itself. `fetchAccess` l.406-414:
```ts
const fetchAccess = useCallback(async () => {
  try {
    const response = await fetchWithTimeout("/api/access", { cache: "no-store" });
    if (!response.ok) return;
    const access = await response.json() as { canEdit?: boolean; canManageEditors?: boolean };
    setCanEdit(Boolean(access.canEdit)); setCanManageEditors(Boolean(access.canManageEditors));
  } catch {}
}, []);
```
Extend with `closedTabs`/`tabsEnforced` state. Poll l.500-501: add `if (canEditRef.current) void fetchAccess();` to the interval and `onVisible`. `saveContent` l.1000 `throw new Error("save failed")` discards body; read `{error}` on 403. `<PortiaEditor>` rendered at l.1425.

### `supabase/portia_setup.sql`
**Analog:** itself. Function style (l.50-75): `create or replace function ... language sql stable security definer set search_path = public as $$ ... $$;` then `revoke all ... from public, anon;` and `grant execute ... to authenticated;` (l.88-93). Table grants/policies (l.99-120):
```sql
grant select, insert, delete on table public.portia_editors to authenticated;
drop policy if exists "Owner can revoke editor access" on public.portia_editors;
create policy "Owner can revoke editor access" on public.portia_editors for delete to authenticated
using ((select public.portia_is_owner()));
```
Add: `grant update (closed_tabs, granted_tabs)`, an update policy, `portia_email_confirmed()`, `portia_can_edit_tab(text)`, tightened `portia_is_owner`/`portia_can_edit` (note `portia_editor_is_approved` l.77-88 is pre-sign-up and stays unconfirmed-agnostic), employee-table policies switched to `portia_can_edit_tab('employees')`, photo_url CHECK (l.22) replaced, trailing `notify pgrst, 'reload schema';` (existing idiom l.40, l.226).

## Shared Patterns

### API error shape
**Source:** `app/api/editors/route.ts`, `app/api/content/route.ts`. `Response.json({ error: "<русский текст>" }, { status: 403|400|500 })`; per-user routes keep `export const dynamic = "force-dynamic"` and `noStoreHeaders` from `@/lib/portia-cdn`. Never add per-user data to `/api/content` (CDN-shared).

### Missing-column/table detection
**Source:** `lib/portia-employees.ts` l.93-100 (`isMissingColumnError`, `isMissingTableError`). Apply to `getEditorAccess`, `/api/editors` GET/PATCH.

### Test style
**Source:** `lib/editor-changes.test.ts`; fake Supabase clients in `lib/portia-employees.test.ts`. Run: `node --experimental-strip-types --test lib/*.test.ts`. Anything testable lives in `lib/` with relative `.ts` imports; route handlers stay thin.

### Effects/lint
setState or dispatch in effects only through `window.setTimeout(..., 0)` (portia-editor.tsx l.729-737, l.1115), or derive at render.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `supabase/phase12_apply.sql` | migration (preflight/apply/verify/rollback) | No prior owner-apply script; build from `portia_setup.sql` idioms plus RESEARCH Pattern 5/6 and skeleton |
| `lib/editor-access.test.ts` | test | No existing test for access; use fake-client style of `portia-employees.test.ts` |

## Metadata

**Analog search scope:** `lib/`, `app/api/`, `app/owner-login/`, `components/portia-editor.tsx`, `components/portia-desktop.tsx`, `supabase/portia_setup.sql`
**Files read:** lib/editor-access.ts, lib/editor-changes.ts, lib/editor-history.ts (head), app/api/{editors,access,content}/route.ts, app/api/employees/editor/route.ts, app/owner-login/actions.ts, portia_setup.sql (l.50-130), editor/desktop excerpts
**Tracked check:** `git ls-files` confirms lib/editor-changes.test.ts, lib/editor-history.ts, lib/portia-employees.test.ts, app/api/content/route.ts, supabase/portia_setup.sql
**Pattern extraction date:** 2026-10-26
