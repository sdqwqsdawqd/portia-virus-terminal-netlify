---
last_mapped_commit: e3941d4a097005a1674d3e9bc4d1e638aeda0846
last_mapped_at: 2026-10-12
---
# Codebase Concerns

**Analysis Date:** 2026-10-12

## Known User-Reported Issues (verified in code)

**Drag handle "ТЯНИТЕ" overflows its row (editor recommendation and recycle lists):**
- Issue: `OrderDragHandle` renders a `≡` glyph plus a `<small>ТЯНИТЕ</small>` label inside a fixed 34px-wide grid column. The label is wider than 34px, so it spills out of the handle and past the row edge. The recommendation rows use a 40px column and have `overflow: hidden` only on the text span, not on the handle.
- Files: `components/portia-editor.tsx` (`OrderDragHandle`, line ~153; used at lines ~592, 681, 724, 815), `app/portia.css` (`.order-drag-handle` line 406, `.order-drag-handle small` line 409, `.editor-record-row` line 404, `.recommendation-order-row` line 435)
- Impact: Visible layout break in the editor; the label collides with neighbouring controls or is clipped by the row.
- Fix approach: Drop the text label from the handle (keep `aria-label` for accessibility) or allow it to wrap vertically inside 34px. Add `overflow: hidden` to `.order-drag-handle` and `min-width: 0` on its grid parent. Verify in both recycle and recommendation lists.

**Embedded charter window renders cropped (`EmbeddedDocument`):**
- Issue: `EmbeddedDocument` sizes the iframe as `width/height: 100/zoom %` and applies `transform: scale(zoom)` with `transform-origin: 0 0`. The iframe height depends on a chain of percentage heights: `.document-app` uses `height: calc(100% - 46px)`, and `.document-app-viewport` uses `height: 100%`. If any ancestor in the app-window body lacks a definite height, the iframe collapses or is cut off. The viewport also has `overflow: hidden`, so anything outside the box is clipped. The iframe is `loading="lazy"`, so it may not load in a window that starts minimized or hidden.
- Files: `components/portia-desktop.tsx` (`EmbeddedDocument`, line ~1104; `AppWindow` body), `app/portia.css` (`.document-app` line 1059, `.document-app-viewport` and iframe lines 1098-1100)
- Impact: The document window shows a partial page; the user cannot read the full charter without "Открыть отдельно".
- Fix approach: Give the window body an explicit height (`height: 100%` on the chain, or flex column with `flex: 1 1 auto; min-height: 0`). Replace percentage sizing with `position: absolute; inset: 0` on the iframe and scale it from a wrapper of known size. Confirm the behaviour at the 900px breakpoint, where the height changes to `calc(100svh - 150px)`. This was not confirmed in a running browser; it is inferred from the CSS.

**Editor rich-text fields still use Georgia:**
- Issue: The serif stack is hard-coded in four places, not taken from a variable. `.formatted-rich-input` sets `font: 17px/1.65 Georgia, ...` (line 465), and the focus state re-sets `font-family: Georgia` (line 468). `.scientist-rich-text` (line 519) and `.archive-document-section p` (line 772) also use it.
- Files: `app/portia.css` lines 465, 468, 519, 772
- Impact: Editor fields do not match the sans/mono type system used elsewhere in the editor (`--sans`, `--mono`), and the user has reported this as wrong.
- Fix approach: Replace the Georgia literals with the project font variable chosen for the editor (for example `var(--sans)`), and remove the duplicate declaration at line 468 so focus does not change the family. Decide separately whether `.scientist-rich-text` and `.archive-document-section` should keep serif for document previews.

**Assistant image and spider logo do not follow accent themes:**
- Issue: The accent themes change `--teal`, `--teal-dim` and `--teal-soft` (lines 828-830), but the assistant and logo are fixed PNG files. `portia-assistant.png` is shown with a hard-coded `filter: brightness(.7)` (line 626), and its hover shadow uses a hard-coded teal `rgba(0,188,166,.2)` (line 627). The logo `portia-logo.png` appears unfiltered in six places in `components/portia-desktop.tsx` (lines 814, 978, 986, 999, 1004, 1383) and in `components/portia-editor.tsx` (line 939). No CSS applies the accent to either image.
- Files: `public/assets/portia-assistant.png`, `public/assets/portia-logo.png`, `components/portia-desktop.tsx` (lines 814, 973, 978, 986, 999, 1383), `components/portia-editor.tsx` (line 939), `app/portia.css` (lines 626-630, 828-830)
- Impact: On the "amber" and "red" themes the assistant and spider remain teal-tinted or uncoloured, so the theme looks inconsistent.
- Fix approach: Ship monochrome (alpha-mask) versions of the two PNGs and render them with CSS `mask-image` filled with `var(--teal)`. Alternatively, apply a `filter` chain derived from the accent. The mask approach is preferred because the filter approach cannot map an arbitrary hue cleanly. Use `var(--teal)` in the hover shadow instead of the hard-coded RGB.

## Tech Debt

**Oversized component and stylesheet files:**
- Issue: `components/portia-desktop.tsx` (1392 lines, 30 top-level functions) and `components/portia-editor.tsx` (1360 lines) each hold many unrelated components. `app/portia.css` (1108 lines) is a single file with more than 1000 rules and inline colours repeated across sections.
- Files: `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `app/portia.css`
- Impact: Hard to review and to change safely. The known layout bugs above are in the same files as unrelated code.
- Fix approach: Split by feature: window chrome, document viewer, editor tabs, recycle list, and the drag-order handle (shared, so it should live in its own module). Move colour literals to CSS custom properties.

**Hard-coded colours and fonts instead of theme tokens:**
- Issue: Many colours are literals (for example `#08110f`, `#304942`, `#0b7568`, `#f3f1e9`) and there are literal teal RGB values, which bypass the accent system (`html[data-accent]`, lines 828-830).
- Files: `app/portia.css` (throughout, e.g. lines 465-470)
- Impact: Themes are incomplete, as the assistant and rich-text issues show.
- Fix approach: Route every accent-related colour through `--teal`, `--teal-dim` and `--teal-soft`, and add fonts as variables.

**Duplicated order-drag logic:**
- Issue: The drag-to-reorder logic for virus, info section, recycle and recommendation lists is repeated with slightly different `onMove` handlers (`moveArrayItem` called inline at lines ~592, 681, 724, 815). `recycleKeys` in `components/portia-editor.tsx` (line 87) reconstructs order from several sources.
- Files: `components/portia-editor.tsx`
- Impact: Fixes such as the ТЯНИТЕ overflow must be repeated; order can drift if one list forgets to normalise its keys.
- Fix approach: Use one hook or component for sorted lists that owns the pointer logic and the `data-sort-index` contract.

**Hard-coded external data source:**
- Issue: The staff spreadsheet URL is a literal in source (`lib/portia-employees.ts` line 28) and the row range is fixed (`staffRowsEnd = 35`, line 30).
- Files: `lib/portia-employees.ts`
- Impact: Changing the sheet or extending the roster requires a code change and redeploy.
- Fix approach: Move the sheet id and range to environment config (non-secret, so `NEXT_PUBLIC_` or a plain server variable is acceptable), and derive the row range from the data.

**Test coverage limited to `lib/`:**
- Issue: The `test` script runs only `lib/*.test.ts` (three test files: normalise, employees, window geometry). No tests cover API routes (`app/api/*`), `proxy.ts`, the upload validation, or any component.
- Files: `package.json` (test script), `lib/*.test.ts`, `app/api/content/route.ts`, `app/api/uploads/route.ts`, `components/portia-editor.tsx`, `components/portia-desktop.tsx`
- Impact: The save conflict (409) path, upload validation, and the layout issues above can regress unnoticed.
- Fix approach: Add route-level tests for PUT `/api/content` (revision conflict, invalid body) and POST `/api/uploads` (type and size limits), and a visual check for the embedded viewer and drag handle.

**Committed build artifact:**
- Issue: `tsconfig.tsbuildinfo` sits at the project root. `.gitignore` line 59 ignores `*.tsbuildinfo`, so the file is presumably not tracked, but its presence in the working tree can mislead tooling.
- Files: `tsconfig.tsbuildinfo`, `.gitignore`
- Impact: Low.
- Fix approach: Delete it from the working tree and confirm it is not tracked.

## Security Considerations

**Public content and employee data with server-side write checks:**
- Risk: `GET /api/content` and `GET /api/employees` are public and CDN-cached. Anyone can read the full content payload and staff profiles (from `public.portia_content` and `portia_employee_profiles` with `using (true)` select policies in `supabase/portia_setup.sql`). This is probably intended for a public desktop, but any field added later becomes public automatically.
- Files: `app/api/content/route.ts`, `app/api/employees/route.ts`, `supabase/portia_setup.sql` (lines 119-123, 147-151)
- Current mitigation: The owner email is kept out of the API (`revoke` at lines 79-81 of `portia_setup.sql`). Writes are gated by `getEditorAccess` and RLS policies that depend on `portia_can_edit()`.
- Recommendations: Document which fields are public. Keep private data out of `payload`. Add a test that the public GET does not return editor-only fields.

**Upload MIME check trusts the client:**
- Risk: `POST /api/uploads` decides the type from `file.type`, which the browser sets from the filename. A file with a spoofed type can be stored with an image extension.
- Files: `app/api/uploads/route.ts` (lines 24-38)
- Current mitigation: Only PNG, JPEG, WEBP and GIF are accepted (no SVG or HTML), size is capped at 4 MB, the path is a random UUID, and access requires an editor.
- Recommendations: Check the magic bytes of the first few bytes of the file before upload. The storage bucket `portia-media` should serve these with `Content-Type` set from the allow-list, never from the client.

**Upload path is not scoped to the uploader:**
- Risk: Any editor can upload to `recycle/` and other prefixes, and there is no record of who uploaded what. Storage cleanup depends on content references that are not tracked.
- Files: `app/api/uploads/route.ts` (line 42)
- Current mitigation: UUID names prevent collisions and guessing.
- Recommendations: Store uploader id in metadata, and add a periodic sweep for unreferenced objects.

**Error details are logged, not returned:**
- Status: Routes return generic Russian messages and log the raw error with `console.error` (`app/api/*/route.ts`, `lib/editor-access.ts`). This is good practice. Note that `console.error` output goes to the Netlify function logs, so Supabase error objects should not contain secrets.

**Environment file present:**
- `.env.local` exists in the project root. Its contents were not read. It is ignored by `.gitignore`. Confirm it is never committed and that `.env.example` lists only variable names.

## Performance Bottlenecks

**Oversized assistant image:**
- Problem: `public/assets/portia-assistant.png` is 854 KB at 1536x1024 and is rendered at roughly 220px wide (`.assistant-button img`, `app/portia.css` line 626). The desktop loads it on every visit.
- Files: `public/assets/portia-assistant.png`, `components/portia-desktop.tsx` (line 973)
- Cause: Full-resolution RGBA PNG for a small on-screen element.
- Improvement path: Export a WebP or resized PNG at 2x of the displayed size (about 500px). The monochrome mask version proposed above will be smaller too. Add `loading`/`decoding` hints.

**Logo PNG reused at several sizes:**
- Problem: `public/assets/portia-logo.png` (650x768, 73 KB) is used in six places, from 26px to 112px.
- Files: `components/portia-desktop.tsx` (lines 814, 978, 986, 999, 1383), `components/portia-editor.tsx` (line 939)
- Cause: Single large raster for small icons.
- Improvement path: Use an SVG or a 2x raster sized to the largest use (112px).

**Public GETs are CDN-cached but browsers revalidate:**
- Problem: `publicCacheHeaders` sets `max-age=0, must-revalidate` for browsers (`lib/portia-cdn.ts` line 9), so every desktop load revalidates content and employees.
- Files: `lib/portia-cdn.ts`, `app/api/content/route.ts`, `app/api/employees/route.ts`
- Cause: Deliberate, to keep edits fresh.
- Improvement path: Acceptable for now. Consider a short browser `max-age` if traffic grows.

**Employee load fans out to external APIs:**
- Problem: `loadEmployees` calls the Google Sheets CSV and then the Roblox user, headshot and avatar APIs (`lib/portia-employees.ts` lines 81-94, 183). Each call has a timeout (5-8 s), but a slow chain delays the response. The response is `degraded` when incomplete.
- Files: `lib/portia-employees.ts`, `app/api/employees/route.ts`
- Cause: Synchronous enrichment on the request path.
- Improvement path: Keep the 600 s cache for complete responses (already done) and run the Roblox lookups in parallel with the sheet read where possible.

## Fragile Areas

**Pointer-based drag reordering:**
- Files: `components/portia-editor.tsx` (`OrderDragHandle`, lines 115-155)
- Why fragile: Relies on `document.elementsFromPoint` and `data-sort-index` attributes. Any wrapper that adds a second `[data-sort-index]` ancestor, or a list that re-renders with changing keys, will move items to the wrong index. The `key` for recommendations (line 815) is built from value plus occurrence count, which is brittle when duplicates are edited.
- Safe modification: Keep the `data-sort-index` contract on the row element only. Test a reorder with duplicate entries before shipping.
- Test coverage: None. No component tests exist.

**Save conflict handling:**
- Files: `app/api/content/route.ts` (lines 55-72), `components/portia-editor.tsx` (save flow)
- Why fragile: Optimistic concurrency depends on `revision`. The `baseRevision === 0` insert branch handles the first save; a unique-constraint error (`23505`) is mapped to 409. A change to the revision logic can silently overwrite another editor's work.
- Safe modification: Keep the revision check and the `.eq("revision", baseRevision)` filter together. Add a test for the 409 path.
- Test coverage: None for the route.

**Layout depends on fixed pixel breakpoints and percentage heights:**
- Files: `app/portia.css` (lines 948-949, 987-989, 1059-1061), `components/portia-desktop.tsx` (`EmbeddedDocument`)
- Why fragile: The embedded viewer and the editor rows rely on definite parent heights and fixed widths (34px, 40px). Text labels and content length change the layout.
- Safe modification: Test at 900px and at narrow widths after any change to these rules.

**Global window and keyboard listeners in the embedded viewer:**
- Files: `components/portia-desktop.tsx` (`EmbeddedDocument`, lines ~1113-1138)
- Why fragile: Listeners for `keydown`, `keyup`, `blur` and `wheel` are attached to `window` and the frame. The Ctrl layer blocks wheel events while Ctrl is held. A missed `keyup` (for example when focus leaves the window) can leave the layer covering the document. The `blur` handler mitigates this.
- Safe modification: Keep the cleanup functions paired with each `addEventListener`.

## Scaling Limits

**Single content row:**
- Current capacity: One `portia_content` row with `id = 'main'` holds the entire payload, capped at 2,000,000 characters per save (`app/api/content/route.ts` line 39).
- Limit: Payload size and write contention. Large media stored as data is not the issue (media goes to `portia-media`), but the JSON grows with every record.
- Scaling path: Split records (viruses, employees, archive) into their own rows or tables, keeping the revision check per record.

**Employee sheet range is fixed:**
- Current capacity: Rows up to `staffRowsEnd = 35` (`lib/portia-employees.ts` line 30).
- Limit: Staff beyond row 35 are silently ignored.
- Scaling path: Read to the end of the sheet and validate the count.

## Dependencies at Risk

**Netlify-specific cache APIs:**
- Package: `@netlify/functions` (`purgeCache`), plus Netlify response headers in `lib/portia-cdn.ts`
- Risk: Cache invalidation and `Netlify-CDN-Cache-Control` only work on Netlify. Other hosts ignore these headers, and the purge call fails silently (logged only).
- Impact: Stale content on other hosts until `s-maxage` expires; no alert.
- Migration plan: Keep the `purgeCacheTag` abstraction, and add a host check or a fallback TTL when not on Netlify.

**Google Sheets CSV endpoint:**
- Package: Google `gviz` CSV export (`lib/portia-employees.ts` line 28)
- Risk: An undocumented-stability endpoint with no SLA. Sheet permission changes break it.
- Impact: Staff list falls back to the stored `portia_employee_profiles` data and reports `degraded`.
- Migration plan: Move the staff roster into Supabase, with the sheet as an import step.

**Roblox public APIs:**
- Package: `users.roblox.com`, `thumbnails.roblox.com`
- Risk: Third-party availability and rate limits.
- Impact: Missing avatars (the code tolerates failure).
- Migration plan: Cache results in `portia_employee_profiles`; the code already does this partly.

## Missing Critical Features

**No error reporting or monitoring:**
- Problem: Errors go to `console.error` only. There is no tracked error service, uptime check or alert for failed saves, uploads or syncs.
- Blocks: Detecting failed saves or upload failures in production.

**No undo for destructive editor actions beyond the recycle list:**
- Problem: Deleting an info section (`components/portia-editor.tsx` line 681) or a recommendation removes it from the draft immediately. Only files and viruses have a recycle step.
- Blocks: Recovering an accidentally removed section without reloading the last saved revision.

## Test Coverage Gaps

**Embedded document viewer:**
- What's not tested: Sizing and zoom of the iframe, Ctrl+wheel behaviour, behaviour when the window is minimised or lazy-loaded.
- Files: `components/portia-desktop.tsx` (`EmbeddedDocument`), `app/portia.css` (lines 1059-1100)
- Risk: The cropped-window bug recurs after unrelated CSS changes.
- Priority: High

**Drag-to-reorder lists:**
- What's not tested: Reordering in recycle, recommendation, virus and section lists; duplicate-value keys; pointer cancel.
- Files: `components/portia-editor.tsx` (`OrderDragHandle` and its callers)
- Risk: Wrong item order saved, or handle layout breaking at narrow widths.
- Priority: High

**Content API save and conflict paths:**
- What's not tested: `PUT /api/content` for the first save (`baseRevision === 0`), a stale revision (409), an invalid body (400), and the 2 MB limit (413).
- Files: `app/api/content/route.ts`
- Risk: Silent overwrites of other editors' work.
- Priority: High

**Upload validation:**
- What's not tested: Type and size checks in `app/api/uploads/route.ts`, and the access gate.
- Files: `app/api/uploads/route.ts`
- Risk: Non-image or oversized files accepted.
- Priority: Medium

**Proxy and auth session refresh:**
- What's not tested: `proxy.ts` matcher behaviour and `lib/supabase/proxy.ts` cookie handling.
- Files: `proxy.ts`, `lib/supabase/proxy.ts`
- Risk: Auth cookies set on public GET responses (the matcher excludes them on purpose; a regression would break CDN caching).
- Priority: Medium

---

*Concerns audit: 2026-10-12*
