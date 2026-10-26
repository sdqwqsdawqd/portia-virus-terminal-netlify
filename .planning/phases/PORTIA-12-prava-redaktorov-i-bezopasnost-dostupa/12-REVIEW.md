---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
reviewed: 2026-10-26T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - app/api/access/route.ts
  - app/api/content/route.ts
  - app/api/editors/route.ts
  - app/api/employees/editor/route.ts
  - app/api/employees/route.ts
  - app/api/uploads/route.ts
  - app/owner-login/actions.ts
  - app/owner-login/page.tsx
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - lib/editor-access.ts
  - lib/editor-changes.ts
  - lib/editor-history.ts
  - lib/editor-tabs.ts
  - lib/media-url.ts
  - lib/portia-content-normalize.ts
  - lib/portia-employees.ts
  - supabase/phase12_apply.sql
  - supabase/portia_setup.sql
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-10-26
**Depth:** standard (diff since beac13d, with callers and SQL read in full)
**Files Reviewed:** 20 source files (tests read for context only)
**Status:** issues_found

## Summary

The tab model is consistent across `getEditorAccess`, `/api/content`, `/api/employees*`, `/api/uploads` and the SQL helper functions. `/api/editors` PATCH is owner-only on the server (`requireOwner`) and in the database (column grant plus owner-only UPDATE policy). The confirmed-email gate exists in the database (`portia_email_confirmed`) and in code. I traced `revertSections`, the history `restrict` reducer and `deniedSections` for the viruses/recycle/D-13 move cases and found no loss or duplication of stored viruses. The phase-12 SQL and `isLocalMediaPath` agree with each other.

Problems found:
- One missed case in the "a blip never unmounts the editor" guard can destroy unsaved drafts.
- The per-tab enforcement for content and uploads is application-level only, which the owner knows (D-11).
- A few classification and robustness defects.

No structural (fallow) findings were supplied.

## Critical Issues

### CR-01: Transient auth failure in /api/access unmounts the editor and discards the unsaved draft

**File:** `app/api/access/route.ts:12-14`, consumer `components/portia-desktop.tsx:412-420`, `1438-1441`
**Issue:** `GET /api/access` ignores the error from `supabase.auth.getUser()`. When the Supabase auth server is briefly unreachable, `getUser()` returns `{ user: null, error }`, and `getEditorAccess(supabase, null)` returns `noAccess`. The route answers 200 with `canEdit: false`. The `unavailable` branch added in this phase (503) is never reached for this path. `fetchAccess` accepts any `response.ok`, calls `setCanEdit(false)`, and the desktop renders `<div className="editor-empty">` in place of `<PortiaEditor>`. This unmounts the editor together with its reducer history and every unsaved edit.

Before this phase `fetchAccess` ran once at load. This phase adds a poll on every `contentSyncMs` tick and every `visibilitychange`, while the editor is open. The exposure is therefore repeated and unattended, and the route comment says the intent is "a blip never unmounts the editor". An expired session or a genuine logout still correctly returns `canEdit: false`.
**Fix:**
```ts
const { data, error: authError } = await supabase.auth.getUser();
// AuthSessionMissingError (400) is a real logout; network/5xx errors are a blip.
if (authError && (authError.status === undefined || authError.status === 0 || authError.status >= 500)) {
  return Response.json(unavailableBody, { status: 503, headers: noStoreHeaders });
}
```
A client-side guard is also cheap: in `portia-desktop.tsx`, do not unmount while `editorDirty` is true (show a "session lost, copy your edits" banner instead).

## Warnings

### WR-01: Tab enforcement for content and uploads is bypassable with the editor's own JWT (accepted D-11, but not a security boundary)

**File:** `supabase/phase12_apply.sql:201`, `supabase/portia_setup.sql:255-268`, `app/api/content/route.ts:58-70`, `app/api/uploads/route.ts:18-19`
**Issue:** The employees tables are gated in the database by `portia_can_edit_tab('employees')`. `portia_content` INSERT/UPDATE and the `portia-media` storage policies still require only `portia_can_edit()`. Any editor with a session can send a PostgREST `PATCH /rest/v1/portia_content?id=eq.main` with their access token and the public anon key, and write closed sections. `@supabase/ssr` cookies are readable by page JavaScript. That skips `contentRefusal`, the revision check and the CDN purge. A zero-tab editor can likewise upload straight to storage, ignoring the `openTabs.length === 0` check in `/api/uploads`. The `/api/content` section check is therefore a guardrail against accidents and the UI, not a permission boundary. The product decision is recorded as accepted risk, so this is a WARNING. It should be stated plainly in the owner-facing "Доступ" UI or docs, because the chips read as a hard permission.
**Fix:** If it needs to become real, add a `BEFORE UPDATE` trigger on `portia_content` that, for non-owners, compares `old.payload` and `new.payload` per top-level key against the editor's `closed_tabs`. Alternatively, revoke direct writes and route the save through a `security definer` RPC that takes the tab list into account. For storage, require `portia_can_edit()` plus "at least one open tab".

### WR-02: Transient `unavailable` access is reported as "no access" and logs the owner out

**File:** `app/owner-login/actions.ts:21-25`, `app/api/content/route.ts:43-45`, `app/api/uploads/route.ts:18`, `app/api/employees/route.ts:32`, `:71`, `:105`, `app/api/employees/editor/route.ts:15`
**Issue:** `getEditorAccess` distinguishes `unavailable: true` (RPC or lookup failure) from `noAccess`, but every caller except `/api/access` tests only `!access.canEdit`. Effects:
- `ownerLogin` signs the user out and redirects to `?error=denied` ("owner did not give this account access") on a database blip, even for the owner.
- A save during a blip returns 403 "У вас нет доступа к редактору." The desktop then shows that text in the save status (`saveError`) and fires `fetchAccess()`. The editor is told its access was withdrawn when it was not.
**Fix:** Return 503 when `access.unavailable`. In `ownerLogin`, redirect to `?error=setup` or a new "temporarily unavailable" code without calling `signOut()`.
```ts
if (access.unavailable) return Response.json({ error: "Проверка доступа временно недоступна." }, { status: 503 });
```

### WR-03: The "unconfirmed email" check does not close SEC-02 when Confirm email is off; the comment is misleading

**File:** `app/owner-login/actions.ts:16-20`, `lib/editor-access.ts:22-23`
**Issue:** The comment says that with confirmation off "the session exists but the email was never confirmed". In Supabase, with Confirm email disabled, `email_confirmed_at` is set at sign-up time. `ownerLogin`, `getEditorAccess` and `portia_email_confirmed()` therefore all pass. Anyone can then register an approved but unclaimed editor address via `editorSignUp` (`portia_editor_is_approved` is callable by `anon`), and the in-code gate never fires. The only protection is the manual STEP 0 dashboard toggle. There is no runtime signal if it is switched off later.
**Fix:** Correct the comment so it does not suggest a code-level defence. Optionally add a cheap tripwire. `editorSignUp` already sees `data.session`. A session returned immediately from `signUp` means confirmation is off, so refuse and sign out:
```ts
if (data.session) { await supabase.auth.signOut(); redirect("/owner-login?error=setup"); }
```
Today, a session from `signUp` is accepted whenever `canEdit` is true.

### WR-04: Formatted-text classification fails open for virus ids containing ":" and for unknown virus ids

**File:** `lib/editor-changes.ts:36-39`
**Issue:** `sectionOfFormattedKey` takes `key.split(":")[1]` as the virus id. `normalizePortiaContent` accepts any non-blank client-supplied id (`realId`) and does not reject ":", although the comment at `portia-content-normalize.ts:105` claims ids are "never ':'". For a virus with id `a:b`, the key `virus:a:b:external` is parsed as id `a`, which is not in the lists, so it is classified `recycle` instead of `viruses`. An editor with «Корзина» open and «База вирусов» closed can then rewrite that live virus's texts, and a legitimate editor of that virus is wrongly refused. Independently, an unknown id falls through to `"recycle"` rather than failing closed, contradicting the `unclassifiedTextKeys` comment. Existing generated ids (`virus-<ts>-<rand>`, `vir-d17`) contain no colon, so exploitation needs a virus created with such an id (a collusion or bug case).
**Fix:** Match on the known id instead of splitting:
```ts
if (key.startsWith("virus:")) {
  const owns = (list: Virus[]) => list.some((v) => key.startsWith(`virus:${v.id}:`));
  if ([...baseline.viruses, ...draft.viruses].some((v) => key.startsWith(`virus:${v.id}:`))) return "viruses";
  if (owns(baseline.recycledViruses ?? []) || owns(draft.recycledViruses ?? [])) return "recycle";
  return null; // unknown owner: refused for a restricted editor
}
```
Also reject ":" in `realId` / `deriveIds`, or add a normalize test.

## Info

### IN-01: `/api/editors` handlers have no try/catch

**File:** `app/api/editors/route.ts:12-18`, `:28`, `:46`, `:73`, `:86`
**Issue:** Unlike `/api/content`, `/api/employees` and `/api/uploads`, the four handlers (and `requireOwner`) let a thrown error (cookie store, network) escape as a bare Next.js 500. The client's `.json().catch(() => ({}))` copes, so the owner only sees a generic message. `POST` also ignores the `error` of the "existing" lookup and returns `{ editor: existing }` without tab lists, which `loadEditors` papers over.
**Fix:** Wrap bodies in `try { ... } catch (error) { console.error(...); return Response.json({ error: "..." }, { status: 500, headers: noStoreHeaders }); }` as in the sibling routes.

### IN-02: The "employees" tab id is a bare string in many places

**File:** `components/portia-editor.tsx:92`, `:101`, `lib/editor-tabs.ts:13`
**Issue:** The id `"employees"` is a bare string in six places (the registry, the three route guards, the editor's `employeesClosed`, the closure effect and the SQL `portia_can_edit_tab('employees')`). A rename would silently open or close the wrong gate with no type error. Minor, but it is the one id that is not an `EditorSection`.
**Fix:** Export `export const EMPLOYEES_TAB = "employees"` from `editor-tabs.ts` and use it in the routes and the editor.

---

_Reviewed: 2026-10-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
