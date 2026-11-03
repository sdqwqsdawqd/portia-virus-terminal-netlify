---
phase: PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - app/api/uploads/route.ts
  - app/portia.css
  - components/portia-desktop-documents.tsx
  - components/portia-desktop-dossier.tsx
  - components/portia-desktop-media.tsx
  - components/portia-desktop-states.tsx
  - components/portia-desktop.tsx
  - components/portia-editor-dossier.tsx
  - components/portia-editor.tsx
  - components/portia-promotion-editor-main.tsx
  - components/portia-promotion-editor.tsx
  - components/portia-promotion-ordinary-editor.tsx
  - components/portia-promotion-qualification-editor.tsx
  - components/portia-promotion.tsx
  - lib/app-state.ts
  - lib/component-source.ts
  - lib/device-cache.ts
  - lib/editor-history.ts
  - lib/editor-save-status.ts
  - lib/image-upload.ts
  - lib/media-display.ts
  - lib/media-url.ts
  - lib/portia-employees.ts
  - lib/portia-promotion-reviewer.ts
  - lib/portia-promotion-sheet.ts
  - lib/portia-promotion-staging-roster.ts
  - lib/portia-promotion.ts
  - lib/search-index.ts
  - scripts/phase16-staging.mjs
  - scripts/phase19-acceptance.mjs
  - tests/e2e/fixtures/staging-harness.ts
  - tests/e2e/specs/app-states.spec.ts
  - tests/e2e/specs/editor-journeys.spec.ts
  - tests/e2e/specs/media-states.spec.ts
  - tests/e2e/specs/search-click.spec.ts
  - tests/e2e/specs/search.spec.ts
  - tests/e2e/visual-candidates/icon-rest.spec.ts
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
  necessity: 1
status: issues_found
---

# Phase PORTIA-19: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 39 (app/portia.css and the two promotion qualification/ordinary editor files were skimmed, not line-audited; the unit tests in lib/*.test.ts were read only for context)
**Status:** issues_found

## Summary

Nothing was run: this is a static review, and nothing touched Supabase or `.env*`.

The security perimeter holds up well:
- `stagingRosterPath` fails closed on every branch I traced: empty production list, production context, ref in both lists, malformed URL.
- `resolveStagingTarget` chains `requireSafeMutationTarget`, `assertAppBoundToTarget`, the DB-URL host/user check and the linked-project check before any spawn or fetch.
- The upload route checks MIME, size and magic bytes, and writes a server-chosen UUID path, so the extension cannot be steered by the client.
- `media-url.ts` handles the `/\host`, `/<TAB>/host` and `//host` cases.
- The search index only reads fields named in the allowlist. `scientistLogs` and drafts never enter it, and broadcasts are filtered on `published`.
- The device-cache source stamp is read, checked and wiped before use. A missing `NEXT_PUBLIC_SUPABASE_URL` yields an empty source that never matches, so it fails closed.
- Promotion eligibility treats column E as the availability date and adds no extra cooldown (`promotion.ts:107-119`).
- The employee range (`A1:Z35`, `slice(1, 35)`) agrees with the 34-place comment.
- The editor save, partial-save and rebase reducers are internally consistent. I traced `saved`/`keep`/`rebase`, `restrict` and `rebaseDecision` and found no state bug.

The one real defect is user-visible: `PortiaImage` marks a picture "failed" after 15 s even when the browser never started fetching it. Every picture the browser defers by design (`loading="lazy"`) is exposed. That includes every cover in a folded «Справочник» section, since sections start folded. The rest are guard-hardening gaps in the staging scripts, error-handling gaps, and a few tests that give false confidence.

Necessity: the rubric was read and applied. One Info-level finding (IN-05).

## Critical Issues

### CR-01: PortiaImage's 15 s timer flips images that were never requested to "Изображение недоступно"

**File:** `components/portia-desktop-media.tsx:48-58` (also `components/portia-desktop-documents.tsx:168-181`, `components/portia-desktop-window.tsx:184`, `lib/media-display.ts:16-19`)
**Issue:** The slow-image timer starts the moment the frame mounts, and the frame mounts whether or not the browser fetches the image.

`mediaLoadingAttrs("lazy")` sets `loading="lazy"`. A lazy image whose box has no layout, or sits far off-screen, is never fetched, and `img.complete` stays false. The effect then arms `window.setTimeout(..., 15_000)`, which sets `state="failed"`. In the `failed` state the `<img>` is unmounted, so it cannot recover when the user scrolls or expands the section.

Three reachable cases:

1. **«Справочник».**
   - Sections start folded; `collapsed` defaults to all ids at `documents.tsx:104`.
   - Folded grids use `hidden`, which `.guide-grid[hidden] { display:none }` (`portia.css:1816`) enforces.
   - Every tile cover is still mounted inside it as `<PortiaImage priority="lazy">` (`documents.tsx:179`).
   - Chrome, Firefox and Safari never fetch lazy images inside `display:none`.
   - After 15 s every cover in a folded section is permanently "unavailable". Expanding it later shows placeholders for valid links.
2. **«Информация» and «Корзина» photos** (`desktop.tsx:1597`, `1661`). A photo below the fold, outside the browser's lazy margin, has the same fate if the visitor reads for 15 s before scrolling.
3. **Minimized windows.** `AppWindow` keeps a minimized window mounted with `display:none` (`desktop-window.tsx:184`). The same applies to `EmbeddedDocument`'s `loading="lazy"` iframe (`documents.tsx:70`, timer at 49-53) if the window is minimized before the frame loads. The visitor gets the fatal panel for a frame that was never requested.

The e2e coverage in `media-states.spec.ts` only exercises the eagerly visible employee portrait, so none of this is caught. I did not execute it in a browser; the conclusion follows from the lazy-loading and `display:none` semantics.

**Fix:** Arm the timer only once a request can have started.
```tsx
// in PortiaImageFrame: observe real visibility, arm the timer only while the <img> has a layout box in/near the viewport
const [armed, setArmed] = useState(priority === "hero");
useEffect(() => {
  const node = image.current;
  if (!node || armed) return;
  const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setArmed(true); observer.disconnect(); } });
  observer.observe(node);
  return () => observer.disconnect();
}, [armed]);
useEffect(() => {
  if (state !== "loading" || !armed) return;
  /* existing complete-check + 15 s timer */
}, [state, armed]);
```
IntersectionObserver never reports `isIntersecting` for `display:none`, so folded and minimized frames stay on their skeleton. `EmbeddedDocument` needs the same guard (arm the timer only while the window is not minimized and the frame is visible). Add an e2e case: open «Справочник», wait 16 s, expand a section, and expect `data-media-state` to be `loading` or `loaded`, never `failed`.

## Warnings

### WR-01: `parseDbUrl` ignores the query string, so the production/staging DB-host guard can be bypassed

**File:** `scripts/phase16-staging.mjs:38-53`
**Issue:** The guard checks scheme, port, hostname and username, then passes the raw `env[DB_URL_VAR]` to the supabase CLI as `--db-url` (`resolveStagingTarget:73`, `runCli:158`). The CLI parses it with pgx/pgconn, where URL query parameters override the authority part.

A value such as `postgresql://postgres:pw@db.<isolated-ref>.supabase.co:5432/postgres?host=db.<prod-ref>.supabase.co` (or `hostaddr=`, `user=`, `dbname=`, `service=`) passes every check here and connects somewhere else. The input is operator-controlled, so this is defence in depth. But it is exactly the "guards must fail closed" surface, and the destructive subcommands (`push`, `teardown`, the L0/phase12/phase14 ladder SQL) go through it.

**Fix:**
```js
if (url.search || url.hash || !["", "/postgres"].includes(url.pathname)) throw bad();
```
Also build `dbUrl` from the parsed parts instead of echoing the raw env string, and add a unit test with `?host=`/`?hostaddr=`.

### WR-02: Acceptance teardown and shift delete or update by time window, not by run

**File:** `scripts/phase19-acceptance.mjs:256, 262, 357, 359` (header claim at lines 10-13, clock caveat at 165)
**Issue:** The header says "Only rows of one run are touched". Four operations are only bounded by `created_at/updated_at >= manifest.createdAt`:
- `penalty`: update `portia_promo_attempt_buckets`.
- `cleanup`: update the same table.
- teardown: delete task/qualification banks.
- teardown: delete buckets.

Any bank or bucket created by another session on the shared isolated project after the run began is deleted or altered. Bucket keys are HMACs, so they cannot be prefix-scoped. `createdAt` is the local clock compared with DB time. A local clock that is behind widens the window backwards over other people's rows.

The risk is limited to the isolated project, but it contradicts the stated invariant. It also makes the residual-zero check meaningless as proof that "this run's rows" are gone.

**Fix:**
- Record bank ids (already done) and delete only by id, dropping the `gte("created_at")` bank deletes.
- For buckets, snapshot the existing `bucket_key` set at seed time and operate on `keys − snapshot`.
- If the window stays, take `createdAt` from the DB (`select now()` via an RPC or the response `Date` header) and subtract nothing.
- Weaken the header comment to match whatever remains.

### WR-03: Upload route reports a failed access check as "forbidden" and parses the whole body before the size gate

**File:** `app/api/uploads/route.ts:18-23, 25, 35`
**Issue:**
- `getEditorAccess` returns `unavailable: true` on RPC/DB errors. `/api/access` maps that to 503, and the promotion reviewer maps it to "unavailable". Here `access.canEdit` is false, so a transient failure answers 403 «У вас нет доступа к загрузке.».
- `supabase.auth.getUser()`'s `error` is discarded, so a network blip reads as "no user".
- `request.formData()` buffers the entire multipart body before `file.size > MAX_UPLOAD_BYTES` runs. The 4 MB limit does not bound memory or time. Only the platform payload cap does, and only for authenticated editors.

**Fix:**
```ts
const { data: authData, error: authError } = await supabase.auth.getUser();
const access = await getEditorAccess(supabase, authData.user);
if (authError || access.unavailable) return Response.json({ error: uploadRefusal.server }, { status: 503, headers: noStoreHeaders });
const declared = Number(request.headers.get("content-length"));
if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 64 * 1024) return Response.json({ error: uploadRefusal.size }, { status: 413, headers: noStoreHeaders });
```
Note `isAuthRetryableFetchError` is already used this way in `app/api/access/route.ts:16`.

### WR-04: A non-503 error in the status poll ejects the participant to the nickname gate and unmounts a running qualification test

**File:** `components/portia-promotion.tsx:326-333` (runner cleanup at 75-78)
**Issue:** `loadStatus` polls every 5 s. Only `503 && status` is treated as stale. Any other JSON error response (429 from the rate limiter, 500, 4xx) falls through to `setStatus(null); setError(...)`.

With `status === null`, `PortiaPromotion` renders `PromotionIdentityGate`. `QualificationRunner` unmounts, its effect cleanup calls `onLockChange(false)`, and the desktop's qualification lock is released. The heartbeat stops with no `failure` report. The server attempt keeps running on its lease while the user has lost the test UI and can navigate freely. A single transient 429 or 500 mid-test is enough.

**Fix:** For background polls (`!explicit && !restore`), treat every `!response.ok` the same way when a status is already shown.
```ts
if (!response.ok) {
  if (status && !explicit) { setStale(true); setError(""); return; }
  if (restore) return;
  setStatus(null); setError(publicError(body, "Не удалось проверить ник. Попробуйте позже."));
  return;
}
```
Only an explicit nickname check, or a definitive "unbound-device" or 404, should reset the view.

### WR-05: Employee editor shows raw `error.message` ("Failed to fetch") and does not use the shared network text

**File:** `components/portia-editor.tsx:1808, 1834-1835` (same pattern at 1854/1868)
**Issue:** `lib/editor-save-status.ts:29-30` defines `networkSaveError` as the one vocabulary for "no answer" (UI E3). `EmployeeProfilesEditor.save()` does `await response.json()` with no `.catch`, then `setErrorMessage(error.message)`.
- Offline: the visitor sees the English "Failed to fetch".
- A non-JSON 502/504 page: they see "Unexpected token '<'…".
- The add flow (`addEmployee`) has the same defect.
- There is also no in-flight guard (`state === "saving"`), so a second Ctrl+S or click can send a second PATCH.

**Fix:** Distinguish transport failures from refusals.
```ts
let response: Response;
try { response = await fetch(...); } catch { setErrorMessage(networkSaveError); setState("error"); resolveQueued(false); return false; }
const payload = await response.json().catch(() => ({})) as {...};
```
Add `if (state === "saving") return false;` at the top of `save`.

### WR-06: `reset-device` rejects every nickname that is not ASCII-alphanumeric-first, including all acceptance participants

**File:** `lib/portia-promotion-reviewer.ts:30, 112-114` (nickname shape in `scripts/phase19-acceptance.mjs:56`)
**Issue:** The API accepts any nickname of 1-64 characters (`portia-promotion-api.ts:95-96`, DB check `length(nickname_key) between 1 and 64`), and `nicknameKey` is NFKC and lowercased. `keyPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/i` allows ASCII only and requires an alphanumeric first character.
- Acceptance nicknames are `__portia_live_<run>_<label>`, which start with `_`. Reviewer «СБРОСИТЬ ПРИВЯЗКУ» returns `400 → null` for every one of them, so the device-reset path cannot be accepted on staging.
- Any real nickname containing a space or non-ASCII letter hits the same wall in production.
- The UI only says «Привязку не удалось сбросить.», with no hint.

**Fix:** Validate the same shape the rest of the pipeline accepts.
```ts
const nicknameKey = typeof body.nicknameKey === "string" ? body.nicknameKey.trim().normalize("NFKC").toLocaleLowerCase("en-US") : "";
return nicknameKey.length >= 1 && nicknameKey.length <= 64 && !/[\u0000-\u001f\u007f]/u.test(nicknameKey) ? { action: "reset-device", nicknameKey } : null;
```
Keep the lookup an exact-match RPC parameter. Add a test with a `_`-leading and a Cyrillic key.

### WR-07: «Ёж / ёж / еж» e2e test passes vacuously

**File:** `tests/e2e/specs/search.spec.ts:115-121` (and the fixed sleep at 88)
**Issue:** The test only asserts that the three result counts are equal (`new Set(counts).size === 1`). If the target has no «еж» content, or normalization is broken so all three give zero, `[0,0,0]` passes. The title claims behaviour the assertions don't prove.

Separately, `await page.waitForTimeout(600)` at line 88 is a real-time sleep tuned to the 400 ms interaction guard in `desktop.tsx`. It is fragile under load or a fake clock.

**Fix:** Assert `counts[0] > 0`, or `test.skip` with a BLOCKED (DATA) message when the query finds nothing. Replace the sleep with `await page.clock.runFor(450)` or poll on a state attribute.

## Info

### IN-01: Embedded rich-text GIFs swallow trailing punctuation and bypass the media gate

**File:** `components/portia-desktop-dossier.tsx:128-161`
**Issue:**
- `mediaPattern` matches `https://[^\s<>"']+`. `embeddedMediaUrl` strips `[),.!?;:]+$` from the URL, but `cursor = start + matchedText.length` advances past the stripped characters. «см. https://x/a.gif.» renders without the final dot, and «(https://…gif)» loses the `)`.
- These `<img>` elements skip `PortiaImage`/`mediaSource`, so they have no skeleton and no «Изображение недоступно» fallback, and show a broken-image icon on error. That contradicts the STAB-MEDIA contract that says "never a broken icon".

**Fix:** Compute the trimmed length (`const kept = matchedText.replace(/[),.!?;:]+$/, "")`) and set `cursor = start + kept.length`. Render through `<PortiaImage priority="lazy" …/>` or at least add `onError` hiding.

### IN-02: `label in manifest.nicknames` accepts inherited keys

**File:** `scripts/phase19-acceptance.mjs:235`
**Issue:** `labelPattern` allows `constructor`, `valueOf` and similar names, and `in` matches `Object.prototype` members. The result is a confusing downstream failure (`unknown-participant` from `editRoster`, or a function stringified into `.eq("nickname_key", …)` for deadline/retake) instead of the intended usage error.

**Fix:** `Object.hasOwn(manifest.nicknames, label)`.

### IN-03: «ОТОЗВАТЬ» editor access has no confirmation and is not disabled while a request runs

**File:** `components/portia-editor.tsx:2189` (and `removeEditor` at 2109)
**Issue:** An irreversible revoke fires on a single click. The other destructive actions in this editor go through `ConfirmDialog`. Double-click sends two DELETEs, and the second can surface a spurious error.

**Fix:** Route through `ConfirmDialog` and add `disabled={state === "saving"}`.

### IN-04: Acceptance credentials are written to the OS temp dir with a mode Windows ignores

**File:** `scripts/phase19-acceptance.mjs:185`
**Issue:** `{ mode: 0o600 }` has no effect on NTFS. The reviewer and editor passwords for the isolated project sit in `%TEMP%\portia-acceptance-<runId>\credentials.json` until a clean teardown. A crashed run leaves them behind. Impact is low (isolated project, run-prefixed users).

**Fix:** Say so in the comment, or keep credentials in memory and hand them to the harness via an env var for the test process. Make `acceptance-teardown` print the temp path when residual is non-zero so it gets cleaned.

### IN-05: Phantom requirement — missing-column fallback for rating columns

**File:** `lib/portia-employees.ts:507-511` (`isMissingColumnError`, `ratingsSaved`/`ratingsPending`, and the `pending-database` plumbing)
**Category:** necessity
**Issue:** `saveEmployeeProfile` retries without ratings "until 03.2-06 applies the SQL". The canonical baseline migration already adds every rating column with `add column if not exists` (`supabase/migrations/20261101000000_portia_baseline.sql:55-60`). Environments built from `supabase/migrations` (Phase 16) cannot lack them, so the branch and the «ratings pending» UI it feeds are dead there. The repo does not prove that production has the baseline applied, so this rests on judgment, not on a repo fact.

**Fix:** Once production is confirmed on the baseline, drop the retry path and the `ratingsPending` UI state. Until then, leave a comment pointing at the baseline so the next reader knows when it lapses.

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
