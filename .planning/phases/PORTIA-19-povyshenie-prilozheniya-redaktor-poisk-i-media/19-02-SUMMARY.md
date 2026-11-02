---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 02
subsystem: api
tags: [uploads, media-url, editor, nextjs, supabase-storage]
requires:
  - phase: 18
    provides: staging baseline migration with the photo_url constraint
provides:
  - uploadRefusal catalogue and MAX_UPLOAD_BYTES in lib/image-upload.ts
  - /api/uploads with noStoreHeaders on every branch
  - editor shows server/network refusal under the image field without touching URL or draft
  - isAllowedMediaUrl refuses control characters in the https branch; parity test with the baseline SQL rule
affects: [19-14 visual check of long refusal text]
status: complete
actuals:
  tokens: 12000
  tasks: 3
  commits: 3
plan_head_before: 14f3680b15a17d61652208bd5b641b6535c16691
plan_head_after: 8a22335453cdb7920289a48de6539a71c1772c40
tech-stack:
  added: []
  patterns:
    - "Fixed Russian refusal catalogue shared by route and client"
    - "Source tests pin route invariants (UUID path, upsert false, cacheControl)"
key-files:
  created: []
  modified:
    - lib/image-upload.ts
    - lib/image-upload.test.ts
    - app/api/uploads/route.ts
    - lib/media-url.ts
    - lib/media-url.test.ts
    - components/portia-editor.tsx
    - components/portia-editor-dossier.tsx
key-decisions:
  - "SQL not touched: parity test quotes the baseline photo_url rule verbatim; only the TS side is stricter (control chars after https://)."
  - "ImageEditorField (server-agnostic part, D-03) gets the refusal text through an uploadMessage prop; it does not import lib/image-upload."
requirements-completed: [STAB-MEDIA-01, STAB-MEDIA-02, STAB-MEDIA-04]
coverage:
  - id: D1
    description: "Upload refuses by real bytes with a fixed Russian text, every response no-store, limits unchanged"
    requirement: STAB-MEDIA-01
    verification:
      - kind: unit
        ref: "lib/image-upload.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Editor keeps URL and draft on refusal and shows the text under the field (role=alert), loading label with aria-disabled"
    requirement: STAB-MEDIA-01
    verification: []
    human_judgment: true
    rationale: "Rendering and long-text wrap on the 340px card are checked visually in 19-14; no component render test exists."
  - id: D3
    description: "One URL contract: isAllowedMediaUrl vs photo_url SQL rule parity"
    requirement: STAB-MEDIA-02
    verification:
      - kind: unit
        ref: "lib/media-url.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Immutable UUID media path, upsert false, year cache, no revision dependency"
    requirement: STAB-MEDIA-04
    verification:
      - kind: unit
        ref: "lib/image-upload.test.ts#uploads get a fresh immutable path"
        status: pass
    human_judgment: false
---

# Phase 19 Plan 02: Upload refusal and media URL contract Summary

Upload now refuses by real bytes with fixed Russian texts on no-store responses, the editor keeps the current URL and shows the refusal under the field, and isAllowedMediaUrl agrees with the baseline SQL rule except where it is deliberately stricter.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1 tracer: refusal end to end | 1c300c6 | `uploadRefusal`, `MAX_UPLOAD_BYTES`; route on the catalogue with `noStoreHeaders` on all 7 responses (403/400/415/413/415/500/200); `uploadImage` sets `uploadMessage` (server text, `network`, or `server` for non-JSON) and never calls `onUploaded` on refusal; dropzone shows «ЗАГРУЖАЕМ…» with `aria-disabled` and ignores picks while uploading |
| 2 media URL contract | 206fa84 | control characters refused in the whole string; parity test with the verbatim SQL rule from the baseline migration and a "stricter than SQL" list |
| 3 immutability test | 8a22335 | source test: `crypto.randomUUID()` path, `upsert: false`, `cacheControl: "31536000"`, `getPublicUrl(path)`, no revision |

Tracer gate: `<verify>` (unit tests, tsc, lint) re-run green before tasks 2 and 3; `npm run build` also passes.

## Deviations from Plan

**1. [Rule 3 - Blocking] Refusal text passed by prop instead of an import in the dossier part**
- Found during: Task 1
- Issue: `lib/dossier-parts.test.ts` forbids `portia-editor-dossier.tsx` from importing `@/lib/image-upload` (D-03, part must stay server-agnostic), and pins the line `if (file && onUpload) onUpload(file);`.
- Fix: `ImageEditorField` takes an optional `uploadMessage` prop; `uploadMessage` is plumbed from `portia-editor.tsx` to every `uploadState` call site (including `ArchivedVirusEditor` and `EmployeeProfilesEditor`). The pinned line is kept.
- Files: components/portia-editor-dossier.tsx, components/portia-editor.tsx

**2. [Plan wording] The UI has a dropzone, not a «Загрузить файл» button**
- The loading state is applied to the existing dropzone label (text «ЗАГРУЖАЕМ…», `aria-disabled`); the old "ЗАГРУЗКА…/НЕ УДАЛОСЬ ЗАГРУЗИТЬ" status span is replaced by the `.editor-media-error` alert. The now unused `.editor-upload-status` CSS rules were left in place.

**3. [Plan acceptance] `grep -c "MAX_UPLOAD_BYTES" route.ts` prints 2, not 1**
- The import line and the single use both match. The test asserts the single use (`file.size > MAX_UPLOAD_BYTES`) and the absence of `4 * 1024 * 1024`.

**4. [Scope] "Файл не выбран." on the client**
- The editor cannot submit without a file; the text is shown when the server returns it (400, `uploadRefusal.missing`) and is pinned in the catalogue test. No separate client-side empty-pick message was added.

**Total deviations:** 4 (1 auto-fixed blocking, 3 plan-wording notes). **Impact:** none on D-16 limits or behavior.

## Known limitations

- `uploadState`/`uploadMessage` stay editor-global (as `uploadState` was). To avoid an alert under every image field, `ImageEditorField` shows the message only after a file was picked in that field; two fields that both picked a file in one session can show the same latest message.
- Control-character class is 0x00-0x1f and 0x7f; Postgres `[:cntrl:]` can additionally match C1 characters depending on locale. The gap only matters for URLs the TS side already accepts and SQL rejects, never the reverse.
- Long refusal text on the 340px card is not verified here (backstop, 19-14). No Playwright/browser run was done; BLOCKED, not a pass.

## Verification

- `npm test`: 893 pass, 0 fail; `tsc --noEmit` clean; `npm run lint`: 0 errors (18 existing warnings); `npm run build` passes.
- `git diff --name-only -- supabase/` empty; no packages installed.

## Stubs / Threat flags

None.

## Self-Check: PASSED

- Commits 1c300c6, 206fa84, 8a22335 present in HEAD; modified files exist on disk.
