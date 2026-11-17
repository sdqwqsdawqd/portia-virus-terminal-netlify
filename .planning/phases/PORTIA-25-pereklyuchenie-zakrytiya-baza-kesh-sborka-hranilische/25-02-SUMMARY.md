---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
plan: 02
subsystem: api
tags: [supabase-storage, nextjs, editor, access-levels, image-address]

requires:
  - phase: PORTIA-24
    provides: LevelPicker, effectiveLevel, the D-64 editor-file registry, uploadGate
provides:
  - "lib/media-rewrite.ts: parsePortiaMediaUrl, imageUrlsOfRecord, replaceImageUrl, replaceImageInContent, retirableUrls, mediaRewriteRefusal"
  - "lib/media-rewrite-client.ts: rewriteImageUrl, retireImageUrl"
  - "POST /api/uploads (JSON action rewrite -> storage copy) and DELETE /api/uploads (references checked, then storage remove)"
  - "Editor button «Сменить адрес картинки» beside the level picker of viruses, info sections and subsections, guide sections and cards"
  - "LevelPicker: optional action slot; WR-02 closed (legend first)"
affects: [25-07 release notes and owner checklist, 25-10 matrix and review]

actuals:
  tokens: 17800
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Editor-file changes stay minimal: logic lives in components/portia-image-rewrite.tsx (hook) and lib/media-rewrite-client.ts, the editor only calls them and each call site is a byte-exact D-64 registry hunk (PORTIA-25)"
    - "One shared editorGate (session, access, declared size) runs before any body is read in POST (upload and rewrite) and DELETE"

key-files:
  created:
    - lib/media-rewrite.ts
    - lib/media-rewrite.test.ts
    - lib/media-rewrite-client.ts
    - components/portia-image-rewrite.tsx
  modified:
    - app/api/uploads/route.ts
    - lib/image-upload.test.ts
    - components/portia-editor.tsx
    - components/portia-level-picker.tsx
    - lib/level-copy.ts
    - lib/level-editor.test.ts
    - lib/format-launch.test.ts
    - lib/portia-desktop.test.ts

key-decisions:
  - "No new route.ts: rewrite is POST /api/uploads with content-type application/json, delete is DELETE /api/uploads, so the Phase 23/24 route matrices are not widened"
  - "The server decides whether a file may go: DELETE reads the stored content payload and employee photo_url before remove; 409 when referenced, 503 when the state is unknown, nothing is removed in either case"
  - "replaceImageUrl is kind-less (walks the keys infectedImage, image, url, photo, cover), kind is needed only to list a record's images"
  - "The queue keeps an address until it is removed: an address that undo brought back stays queued and is skipped while the saved payload still shows it"

patterns-established:
  - "parsePortiaMediaUrl: refuse percent-encoding, backslash, control characters, '..', surrounding whitespace, user info, query and fragment before URL parsing, then exact origin + public route + recycle/<uuid>.<ext>"

requirements-completed: []  # SEC-05 is not checked off: copy, delete and the cache header of the copy are BLOCKED on a real Storage (staging, owner step); the rest of SEC-05 sits in other plans

coverage:
  - id: D1
    description: "parsePortiaMediaUrl accepts only https public addresses of the site bucket in the recycle/<uuid>.<ext> shape; encoding, traversal, other host/bucket/scheme/extension are refused"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "lib/media-rewrite.test.ts#parsePortiaMediaUrl: path-traversal and encoding decoys are refused before any storage call (EDGE SEC-05/encoding)"
        status: pass
      - kind: unit
        ref: "lib/media-rewrite.test.ts#parsePortiaMediaUrl: another host, scheme, bucket, route or shape is refused (T-25-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Route source: one shared gate before any body read in POST and DELETE, address parsed before copy and remove, references read before remove, 409/503 before remove, noStoreHeaders on every answer, no elevated key"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "lib/image-upload.test.ts (T-25-06, T-25-07, T-25-08 and the no-store count)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Client calls: POST JSON rewrite and DELETE with the address; 409 maps to in-use; network failures map to the fixed texts"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "lib/media-rewrite.test.ts#rewriteImageUrl / retireImageUrl"
        status: pass
    human_judgment: false
  - id: D4
    description: "Editor: the offer and the button appear only after a raise of a record with site-bucket pictures, change all of them with one press, show a result line, and the old files go only after a save"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "lib/level-editor.test.ts#D-14 the offer stands beside the pickers ... (source level), lib/format-launch.test.ts D-64 registry PORTIA-25"
        status: pass
    human_judgment: true
    rationale: "Source-level tests prove the wiring, not the browser behavior; the click path in a real editor session and the result lines are an owner check. No browser or role session was run (BLOCKED, authenticated roles)."
  - id: D5
    description: "Real Storage behavior: copy under authenticated, the copy keeps Cache-Control of one year, the old link answers 404 after save"
    requirement: SEC-05
    verification: []
    human_judgment: true
    rationale: "BLOCKED: no Supabase project is available to the agent. Assumption A-25-02 (copy keeps the source metadata) is unproven; the owner proves it on staging (25-OWNER-CHECKLIST.md)."
  - id: D6
    description: "WR-02: legend is the first child of the fieldset; caption after it; action slot last"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "lib/level-editor.test.ts#WR-02 the legend is the first child of the fieldset"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-11-15
status: complete
plan_head_before: e340a7fdcb4f84d1f59c64db4743382dbeacdd56
plan_head_after: 764b78aa2fcacbb3d6bada27aead288ec0fb0670
---

# Phase 25 Plan 02: Change the address of a picture Summary

**After an editor raises the level of a record, a button «Сменить адрес картинки» copies each site-bucket picture under a new random `recycle/<uuid>.<ext>` name through `/api/uploads`, and the old file is removed on the server only after the record is saved and only when no saved record or employee photo still shows it.**

## Performance

- **Duration:** about 70 min
- **Completed:** 2026-11-15T18:25:00Z
- **Tasks:** 2 of 2 (Task 1 tracer, Task 2 auto)
- **Files:** 12 (4 created, 8 modified)

## Accomplishments

- `lib/media-rewrite.ts` decides everything pure: `parsePortiaMediaUrl` (exact host, public route, `^recycle/[0-9a-f-]{36}\.(png|jpg|webp|gif)$`; refuses `%`, `..`, backslash, control characters, user info, query, fragment, other bucket/host/scheme), the images of a virus, a section, a subsection, a guide section or a card, the address replacement and the post-save queue filter.
- `/api/uploads` gets `POST` JSON `rewrite` (storage `copy`) and `DELETE` (stored content and `portia_employee_profiles.photo_url` read first; 409 `media-in-use` if referenced, 503 if the read failed, `remove` otherwise). One `editorGate` serves upload, rewrite and delete before any body read. Session client only, no elevated key. All 13 answers carry `noStoreHeaders`.
- Editor: `useImageRewrite` (new `components/portia-image-rewrite.tsx`) shows the offer and button beside the picker only after a raise of a record with site-bucket pictures. A press rewrites all of them, replaces the addresses in the draft (`changeDraft`), queues the old ones, and shows a result line (done count, external links left as they are, or failure). `void rewrite.retire(outgoing)` runs right after the `saved` dispatch.
- WR-02 (Phase 24) closed: `<legend>` is the first child of the picker `fieldset`.
- D-64 registry: new entry `PORTIA-25` (`applyImageRewriteHunk`), byte-exact, with a «file without the hunk is a difference» case; the registry test was not weakened. The editor file got no new Russian string (D-58 holds) and no new `/api/` literal (count stays pinned).

## Task Commits

1. **Task 1: tracer — virus, raise, button, copy, draft, save, delete** - `5c7eb55` (feat)
2. **Task 2: info and guide records; WR-02** - `764b78a` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Offer logic in a new component file instead of inside the editor**
- **Found during:** Task 1
- **Issue:** State, queue, button and result line inside `components/portia-editor.tsx` would have needed a large byte-exact D-64 hunk and Russian-free JSX; the plan's acceptance grep expects `imageRewriteButton` in the editor.
- **Fix:** The hook and the button live in `components/portia-image-rewrite.tsx`; the editor imports it (4 call sites + 1 hook line). `imageRewriteButton` is therefore referenced in the hook file, not in the editor, so acceptance check `grep -c imageRewriteButton components/portia-editor.tsx >= 1` is 0 by design. The component was added to the allowed seams in `lib/portia-desktop.test.ts` (comment says why).
- **Files modified:** components/portia-image-rewrite.tsx, lib/portia-desktop.test.ts
- **Commit:** 5c7eb55

**2. [Rule 2 - Missing critical] Bounded body read for rewrite and DELETE**
- **Found during:** Task 1
- **Issue:** The plan reads the body with `parseJsonObject(await request.text())`; the declared-size gate passes a missing Content-Length, so a large body would be buffered whole.
- **Fix:** `parseLimitedJsonObject(request, 4096)` (existing helper). The source test forbids `request.text()`/`request.json()` in the route.
- **Files modified:** app/api/uploads/route.ts, lib/image-upload.test.ts
- **Commit:** 5c7eb55

**3. [Rule 1 - Bug] Registry cases depended on the order of approved edits**
- **Found during:** Task 1
- **Issue:** The existing «file without the PORTIA-22 / PORTIA-24 / PORTIA-24-08 hunk» cases removed an edit by position or prefix; adding PORTIA-25 (which anchors on PORTIA-24 text) broke them.
- **Fix:** They filter by id and also drop PORTIA-25 where it depends on the removed edit. The assertions themselves are unchanged.
- **Files modified:** lib/format-launch.test.ts
- **Commit:** 5c7eb55

**4. [Task split] All five image kinds implemented in Task 1**
- Plan expected the info/guide branches of `imageUrlsOfRecord` in Task 2; the pure module was written whole in Task 1 (same tests). Task 2 added the editor call sites, WR-02 and the tests of the slot.

**Total deviations:** 4 (1 blocking, 1 critical-missing, 1 bug, 1 ordering). **Impact:** none on behavior; the one visible difference is where the button code lives.

## Verification

- Red-window gate (`node --experimental-strip-types --test` with the two matrix skip patterns, all `lib/*.test.ts`): 2137 pass, 0 fail. Without the skips only the two known 25-01 red cases fail (`migration coverage`, `matrix freshness`), both until plan 25-10.
- `node node_modules/typescript/bin/tsc --noEmit`: 0 errors. ESLint on the whole tree: 0 errors (17 pre-existing warnings, none from these files except the existing `<img>` ones).
- Acceptance: `export async function DELETE` = 1; `parsePortiaMediaUrl(` in the route = 2; `PORTIA-25` in format-launch.test.ts = 7; `fetch("/api/uploads"` in the editor = 1; `imageRewriteButton` in level-copy = 1 (editor: 0, see deviation 1); `%2e%2e` and other-host cases present and passing; legend line above caption line in the picker.
- Not run: `npm run lint` / `npm test` through npm (npm fails on the temp Node 22.13.1), the tools were called directly. No browser, no E2E.

## Known Stubs

None.

## BLOCKED and owner steps

- Real Storage: `copy` and `remove` under the `authenticated` role, that the copy keeps `Cache-Control` of one year (assumption A-25-02, D-12), and that the old link answers 404 after a save are BLOCKED until staging (25-OWNER-CHECKLIST.md, plan 25-07).
- The click path in a real editor session (raise a level, press the button, read the result line, save) was not run in a browser.
- D-15 (known limit for 25-RELEASE-NOTES.md, plan 25-07): downloaded copies (browser, CDN up to a year) are not deleted; a new copy left without a link after an undo stays in the bucket.
- The delete check is read-then-remove, not atomic: a save landing between the two reads can still reference the file. Accepted, recorded for the 25-10 review.

## Threat Flags

None beyond the plan's threat model (T-25-06 .. T-25-10). `app/api/uploads/route.ts` is covered by the Phase 24 matrix; its freshness stays red until plan 25-10. No `supabase/*.sql`, RLS, RPC or storage-policy file changed in this plan; the 25-04 contract migration adds the editor `select` policy on `storage.objects` that `copy` needs.

## Self-Check: PASSED

- Created files present: lib/media-rewrite.ts, lib/media-rewrite.test.ts, lib/media-rewrite-client.ts, components/portia-image-rewrite.tsx.
- Commits 5c7eb55 and 764b78a are ancestors of HEAD.
