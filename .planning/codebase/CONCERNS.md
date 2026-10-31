---
last_mapped_commit: 2904899037d4243c8433d9d16a88f21ce7f7fe18
last_mapped_at: 2026-11-01
---
# Codebase Concerns

**Analysis Date:** 2026-11-01

Scope: `app/`, `components/`, `lib/` (the `--paths` hint). Previous findings from 2026-10-12 were re-verified against the code. Items no longer present were dropped: the ТЯНИТЕ label overflow, the Georgia literals in `app/portia.css`, the client-trusted upload MIME check, the untracked `tsconfig.tsbuildinfo`, and the 2 MB content cap.

## Tech Debt

**Oversized component and stylesheet files:**
- Issue: `components/portia-editor.tsx` is 3033 lines and `components/portia-desktop.tsx` is 2317 lines. `app/portia.css` is 1981 lines. All three grew by roughly 2x since 2026-10-12. Each mixes many unrelated components and rules.
- Files: `components/portia-editor.tsx`, `components/portia-desktop.tsx`, `app/portia.css`
- Impact: Hard to review and to change safely. Unrelated edits collide, and the drag-order and embed code sit in the same files as the rest.
- Fix approach: Split by feature (window chrome, document viewer, editor tabs, recycle list, promotion editors) and move the shared drag-order handle into its own module. Keep the split mechanical so behaviour does not change.

**Duplicated staff sheet source:**
- Issue: The Google Sheets ID is hard-coded in three places, each with its own range or CSV URL.
- Files: `components/portia-desktop.tsx` (line 29, `sheet.src`), `lib/portia-employees.ts` (line 152, `sheetCsvUrl`), `lib/portia-promotion-sheet.ts` (line 9, `sheetCsvUrl` with ranges `B2:B35` and `A61:E85`)
- Impact: Changing or moving the sheet means editing three files. A missed one leaves the desktop link and the data source pointing at different documents.
- Fix approach: Put the sheet ID in one module in `lib/` (for example `lib/portia-sheet-source.ts`) and derive the CSV URLs and ranges from it. The ID is not a secret, so it can be a plain constant.

**Fixed staff row range:**
- Issue: `rosterFromRows` reads `rows.slice(1, staffRowsEnd)` with `staffRowsEnd = 35`, and the promotion access roster is capped at `rows.slice(0, 34)` with the range `B2:B35`.
- Files: `lib/portia-employees.ts` (line 156 and `rosterFromRows`, line ~255), `lib/portia-promotion-sheet.ts` (`accessRosterFromRows`, `B2:B35`)
- Impact: Staff or access entries beyond the fixed row are silently ignored, with no warning.
- Fix approach: Read to the end of the populated sheet, and report a count mismatch in the `degraded` state instead of truncating.

**Global dependence on the promotion device secret:**
- Issue: `promotionDeviceSecret()` throws when `PORTIA_PROMOTION_DEVICE_SECRET` is missing or shorter than 32 characters. The status, requests and banks routes wrap this call in `try/catch`, but `app/api/promotion/test/route.ts` and `app/api/promotion/reviewer/route.ts` do not. A missing secret on those paths becomes an unhandled exception.
- Files: `lib/portia-device-binding.ts` (line 7, line 15), `app/api/promotion/test/route.ts` (`GET`, `POST`), `app/api/promotion/reviewer/route.ts` (`GET`, `POST`)
- Impact: A configuration gap produces a 500 with no JSON error body on the test and reviewer paths. The other promotion routes return a clean 503.
- Fix approach: Wrap the handlers in the same `try/catch` pattern used by `app/api/promotion/status/route.ts`, returning a `promotion-unavailable` body.

**Limited test coverage of components:**
- Issue: The `test` script runs only `lib/*.test.ts`. There are no component tests. Route coverage is partial: promotion routes are tested through `lib/portia-promotion-*.test.ts` and editor tabs through `lib/editor-tabs.test.ts`. There is no direct test of `PUT /api/content` or `POST /api/uploads` status codes.
- Files: `package.json` (line 12), `app/api/content/route.ts`, `app/api/uploads/route.ts`, `components/portia-editor.tsx`, `components/portia-desktop.tsx`
- Impact: Save conflicts (409), size limits (413) and upload type or signature rejection (415) can regress without a failing test.
- Fix approach: Add route-level tests that call the exported handlers with mocked Supabase and request objects.

## Security Considerations

**Public content and employee reads:**
- Risk: `GET /api/content` and `GET /api/employees` are public and CDN-cached. The full content payload and staff profiles are readable by anyone, from `public.portia_content` and `portia_employee_profiles` (both have `select` policies with `using (true)`).
- Files: `app/api/content/route.ts`, `app/api/employees/route.ts`, `lib/supabase/server.ts` (`createPublicSupabaseClient`), `supabase/portia_setup.sql`
- Current mitigation: The owner email is kept out of the API. Writes are gated by `getEditorAccess` (`lib/editor-access.ts`) and by RLS policies that call `portia_can_edit()`. The public client never touches cookies.
- Recommendations: Document which fields are public, keep editor-only data out of `payload`, and add a test that public GET responses carry no editor-only fields.

**Upload validation:**
- Risk: Reduced. `POST /api/uploads` now compares the declared MIME type with the file signature from the first 16 bytes (`imageExtensionFromSignature` in `lib/image-upload.ts`) and rejects a mismatch with 415. The 4 MB limit is checked before the upload.
- Files: `app/api/uploads/route.ts` (lines 24-45), `lib/image-upload.ts`
- Current mitigation: Only PNG, JPEG, WEBP and GIF pass. Names are UUIDs. Access requires an open editor tab.
- Remaining gap: Uploads go to the flat `recycle/` prefix. The uploader is not recorded in storage metadata, so unreferenced objects cannot be attributed or swept safely.
- Recommendations: Store the uploader id in object metadata, and add a periodic sweep for objects no content row references.

**Content-Security-Policy allows inline scripts:**
- Risk: `script-src 'self' 'unsafe-inline'` in `next.config.ts` (line 13) removes most of the XSS protection a script CSP gives. The accent boot script is injected with `dangerouslySetInnerHTML` (`app/layout.tsx`, line 34).
- Files: `next.config.ts` (line 13), `app/layout.tsx` (line 34), `lib/accent-boot.ts`
- Current mitigation: The boot script is built from constants with `JSON.stringify`, so no user data reaches it.
- Recommendations: Move the boot script to a nonce or hash based policy, then drop `'unsafe-inline'` from `script-src`. Keep `style-src` as is unless the styles move to hashed sources.

**Embedded frames with script and same-origin rights:**
- Risk: `embedSandbox` (`components/portia-desktop.tsx`, line 34) is `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`. Together, `allow-scripts` and `allow-same-origin` let embedded content remove its own sandbox. The `frame-src` allow-list (`next.config.ts`, line 20) limits the hosts, but the editor controls the `src` values.
- Files: `components/portia-desktop.tsx` (line 34, `EmbeddedDocument` line 1781, iframe line 1824, YouTube iframe line 1957), `next.config.ts` (line 20)
- Current mitigation: `frame-src` restricts the hosts to Google Docs, the GitHub Pages site, and YouTube.
- Recommendations: Drop `allow-same-origin` for the Google Docs and YouTube embeds if they do not need it, and validate `src` against the same host list in the editor before saving.

**Promotion device binding:**
- Risk: The promotion device token is an HttpOnly, Secure cookie that binds a device to one nickname. Its digest is an HMAC keyed by `PORTIA_PROMOTION_DEVICE_SECRET`. Anyone who can read the secret can compute the digest for any token. A device is locked after a failed attempt, and the lock is not shown to the user as a security event.
- Files: `lib/portia-device-binding.ts`, `lib/portia-promotion-api.ts`, `app/api/promotion/requests/route.ts`, `app/api/promotion/status/route.ts`
- Current mitigation: The secret must be at least 32 characters. Attempt buckets use a keyed coarse IP (`/24` or `/64`) and a keyed user-agent signal. Public clients receive only security-definer RPC execution.
- Recommendations: Confirm in the Supabase test branch that `portia_promo_*` RPCs cannot be called with the anon key for another nickname. Rotate the secret through deployment config only. Record this as evidence only once the authenticated and Postgres checks have passed, not before.

**Owner-only actions in the promotion reviewer:**
- Risk: `reset-device` and `delete-request` are owner-only. The check is in the route (`app/api/promotion/reviewer/route.ts`, `canManageEditors`). The RPCs are the enforcement point for the database.
- Files: `app/api/promotion/reviewer/route.ts`, `app/api/editors/route.ts`
- Current mitigation: `getEditorAccess` returns `canManageEditors` only for the owner.
- Recommendations: Confirm that each `portia_promo_*` RPC re-checks ownership inside the database. The route check alone is not enough.

**Environment file present:**
- `.env.local` exists in the project root. Its contents were not read for this analysis and must not be. It is listed in `.gitignore`. Confirm it is never committed and that `.env.example` lists only variable names.

## Performance Bottlenecks

**Oversized assistant image:**
- Problem: `public/assets/portia-assistant.png` is 854 KB (about 1536x1024) and is shown at about 220px wide.
- Files: `public/assets/portia-assistant.png`, `components/portia-desktop.tsx` (assistant image), `app/portia.css` (line 890, `.assistant-button img`)
- Cause: Full-resolution RGBA PNG for a small on-screen element, loaded on every desktop visit.
- Improvement path: Export a 2x-sized WebP or PNG (about 500px wide).

**Logo PNG reused at several sizes:**
- Problem: `public/assets/portia-logo.png` (73 KB) is referenced in 7 places (6 in `components/portia-desktop.tsx`, 1 in `components/portia-editor.tsx`), from small icons to large headers.
- Files: `components/portia-desktop.tsx`, `components/portia-editor.tsx`
- Cause: One raster for icons of very different sizes.
- Improvement path: Use an SVG, or a 2x raster sized to the largest use.

**Public GETs are CDN-cached but browsers revalidate:**
- Problem: `publicCacheHeaders` sets `max-age=0, must-revalidate` for browsers (`lib/portia-cdn.ts`), so every desktop load revalidates content and employees.
- Files: `lib/portia-cdn.ts`, `app/api/content/route.ts`, `app/api/employees/route.ts`
- Cause: Deliberate, so edits show up immediately.
- Improvement path: Acceptable for now. Consider a short browser `max-age` if traffic grows.

**Employee load fans out to external APIs on the request path:**
- Problem: `loadEmployees` calls the Google Sheets CSV and then the Roblox user, headshot and avatar APIs (`lib/portia-employees.ts`, `fetch` calls at lines ~207, 219, 220, 380). Each has a 5-8 s timeout, so a slow chain delays the response. The response is `degraded` when incomplete.
- Files: `lib/portia-employees.ts`, `app/api/employees/route.ts`, `app/api/employees/editor/route.ts`
- Cause: Synchronous enrichment on the request path.
- Improvement path: Keep the complete-response cache. Run the Roblox lookups in parallel with the sheet read where possible.

## Fragile Areas

**Pointer-based drag reordering:**
- Files: `components/portia-editor.tsx` (`elementsFromPoint` and `data-sort-index` logic, lines ~241-301; rows at lines ~613, 1327, 1604, 1701)
- Why fragile: Relies on `document.elementsFromPoint` and on `data-sort-index` on the row element. A second `[data-sort-index]` ancestor, or a list that re-renders with changing keys, moves items to the wrong index. Recommendation keys are built from value plus occurrence count, which breaks when duplicates are edited.
- Safe modification: Keep the `data-sort-index` contract on the row element only. Test a reorder with duplicate entries before shipping.
- Test coverage: None for components.

**Save conflict handling:**
- Files: `app/api/content/route.ts` (lines ~49-80), `components/portia-editor.tsx` (save flow)
- Why fragile: Optimistic concurrency depends on `revision`. The first save (`baseRevision === 0`) inserts, and a unique-constraint error (`23505`) maps to 409. The update path uses `.eq("revision", baseRevision)`, and zero matched rows also maps to 409. A change to either branch can silently overwrite another editor's work.
- Safe modification: Keep the revision check and the `.eq("revision", baseRevision)` filter together. Add a test for the 409 path.
- Test coverage: Partial. The `tabs` refusal path is covered in `lib/editor-tabs.test.ts`; the revision path is not.

**Tab-restricted saves are enforced in application code:**
- Files: `app/api/content/route.ts` (lines ~54-68, `closedSectionsOf`, `contentRefusal`), `lib/editor-tabs.ts`, `lib/editor-access.ts`
- Why fragile: The database does not check sections (the code comment cites an accepted risk in `PROJECT.md`, "D-11"). A restricted editor is checked only in the route, which reads the stored payload and compares sections. A new write path that skips this read would let a restricted editor change closed sections.
- Safe modification: Route every content write through `PUT /api/content`. Do not add a second writer.
- Test coverage: Partial, through `lib/editor-tabs.test.ts`.

**Embedded document viewer:**
- Files: `components/portia-desktop.tsx` (`EmbeddedDocument`, line 1781; iframe with `loading="lazy"`, line 1824), `app/portia.css` (`.document-app`, `.document-app-viewport`)
- Why fragile: The iframe sizes itself from percentage heights and a scale transform. If an ancestor lacks a definite height, the view is cut off. `loading="lazy"` can keep a hidden or minimised window from loading. This was inferred from the code and not confirmed in a running browser.
- Safe modification: Test in a browser at 900px and at narrow widths after any change to these rules.
- Test coverage: None.

**Global window and keyboard listeners in the embedded viewer:**
- Files: `components/portia-desktop.tsx` (`EmbeddedDocument`, around lines 1790-1830)
- Why fragile: `keydown`, `keyup`, `blur` and `wheel` listeners are on `window` and the frame. A missed `keyup` can leave the Ctrl layer covering the document. The `blur` handler mitigates this.
- Safe modification: Keep each cleanup paired with its `addEventListener`.

**Layout depends on fixed pixel widths:**
- Files: `app/portia.css` (order-drag handle, line 557: `width: 34px`; mobile override at line 1711: `44px`)
- Why fragile: Fixed widths for the drag handle depend on the label-free glyph. Adding text to the handle reintroduces the overflow fixed in this revision.
- Safe modification: Keep the handle label-free, and keep the `aria-label` for accessibility.

## Scaling Limits

**Single content row:**
- Current capacity: One `portia_content` row with `id = 'main'` holds the entire payload. The request body cap is `MAX_CONTENT_BODY_BYTES = 5_000_000` bytes (`lib/content-limits.ts`, line 19), checked in `app/api/content/route.ts` by UTF-8 byte count.
- Limit: Payload size and write contention. Every save writes the whole payload, and the 5 MB cap sits close to the Netlify request limit noted in the code comment.
- Scaling path: Split records (viruses, employees, archive) into their own rows or tables, keeping the revision check per record.

**Employee and access sheet ranges are fixed:**
- Current capacity: Staff rows up to 35 (`lib/portia-employees.ts`). Access roster rows `B2:B35` (`lib/portia-promotion-sheet.ts`). Promotion rows `A61:E85`.
- Limit: Entries beyond these ranges are silently ignored.
- Scaling path: Read to the end of the populated range, and validate the count.

## Dependencies at Risk

**Netlify-specific cache APIs:**
- Package: `@netlify/functions` (`purgeCache`), plus Netlify response headers in `lib/portia-cdn.ts`
- Risk: Cache invalidation and `Netlify-CDN-Cache-Control` only work on Netlify. On another host the purge fails, and the code only logs it (`purgeCacheTag`).
- Impact: Stale content until `s-maxage` expires (300 s for content), with no alert.
- Migration plan: Keep the `purgeCacheTag` abstraction. Add a host check, or a fallback TTL when not on Netlify.

**Google Sheets CSV endpoint:**
- Package: Google `gviz` CSV export (`lib/portia-employees.ts`, `lib/portia-promotion-sheet.ts`)
- Risk: An endpoint with no stability promise. Sheet permission changes or range edits break it. Promotion access and status depend on it.
- Impact: The staff list falls back to stored profiles and reports `degraded`. Promotion access returns `sheet-unavailable` and blocks new requests.
- Migration plan: Move the staff roster and promotion rosters into Supabase, with the sheet as an import step.

**Roblox public APIs:**
- Package: `users.roblox.com`, `thumbnails.roblox.com` (`lib/portia-employees.ts`)
- Risk: Third-party availability and rate limits.
- Impact: Missing avatars. The code tolerates failure.
- Migration plan: Cache results in `portia_employee_profiles`, which the code already does in part.

## Missing Critical Features

**No error reporting or monitoring:**
- Problem: Errors go to `console.error` only (for example `app/api/content/route.ts`, `app/api/uploads/route.ts`, `app/api/promotion/*`). There is no tracked error service, uptime check or alert for failed saves, uploads, promotion submissions or sheet syncs.
- Blocks: Detecting failed saves, upload failures and promotion outages in production.

**No undo for destructive editor actions beyond the recycle list:**
- Problem: Deleting an info section or a recommendation removes it from the draft immediately. Only files and viruses have a recycle step.
- Blocks: Recovering an accidentally removed section without reloading the last saved revision.

## Test Coverage Gaps

**Embedded document viewer:**
- What's not tested: Sizing and zoom of the iframe, Ctrl+wheel behaviour, behaviour when the window is minimised or lazy-loaded.
- Files: `components/portia-desktop.tsx` (`EmbeddedDocument`), `app/portia.css` (`.document-app`, `.document-app-viewport`)
- Risk: The cropped-window issue can return after unrelated CSS changes.
- Priority: High

**Drag-to-reorder lists:**
- What's not tested: Reordering in recycle, recommendation, virus and section lists; duplicate-value keys; pointer cancel.
- Files: `components/portia-editor.tsx` (`elementsFromPoint` logic and its callers)
- Risk: Wrong item order saved, or handle layout breaking at narrow widths.
- Priority: High

**Content API save and conflict paths:**
- What's not tested: `PUT /api/content` for the first save (`baseRevision === 0`), a stale revision (409), an invalid body (400), and the size limit (413).
- Files: `app/api/content/route.ts`
- Risk: Silent overwrites of other editors' work.
- Priority: High

**Upload route status codes:**
- What's not tested: The end-to-end route with the access gate, the 415 signature mismatch, and the 4 MB check. The signature helper itself is covered by `lib/image-upload.test.ts`.
- Files: `app/api/uploads/route.ts`, `lib/image-upload.ts`
- Risk: A regression in the gate or in the `file.slice(0, 16)` read goes unnoticed.
- Priority: Medium

**Promotion reviewer and test routes:**
- What's not tested: Missing-secret behaviour (the unhandled throw described under Tech Debt), and the owner-only checks in the route.
- Files: `app/api/promotion/reviewer/route.ts`, `app/api/promotion/test/route.ts`
- Risk: 500 responses on configuration gaps, and an owner-only action that a future change exposes.
- Priority: High

**Proxy and auth session refresh:**
- What's not tested: `proxy.ts` matcher behaviour and `lib/supabase/proxy.ts` cookie handling.
- Files: `proxy.ts`, `lib/supabase/proxy.ts`
- Risk: Auth cookies set on public GET responses (the matcher excludes them on purpose; a regression would break CDN caching).
- Priority: Medium

---

*Concerns audit: 2026-11-01*
