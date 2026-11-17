# Phase 14 — Existing Pattern Map

## New domain modules

| New file | Role | Closest existing analogue | Pattern to preserve |
|----------|------|---------------------------|---------------------|
| `lib/portia-promotion.ts` | Pure ranks, cooldowns, statuses and DTOs | `lib/portia-employees.ts`, `lib/broadcasts.ts` | Pure exported helpers with Node tests; normalize every untrusted value. |
| `lib/portia-promotion-sheet.ts` | Read `Portia!A61:E85` | `lib/portia-employees.ts` | Plain `fetch`, `cache: no-store`, timeout, strict headers, explicit unavailable vs not-found. |
| `lib/portia-device-binding.ts` | Opaque device cookie and throttling signals | `lib/supabase/server.ts`, `lib/request-json.ts` | Server-only secrets/tokens; never return raw identifiers. |
| `app/api/promotion/**/route.ts` | Public and reviewer boundaries | `app/api/employees/route.ts`, `app/api/editors/route.ts` | `force-dynamic`, parsed JSON, explicit DTOs, no-store, status-specific errors. |
| `components/portia-promotion.tsx` | Participant application | public applications in `portia-desktop.tsx` | Window receives state/callback integration but owns focused feature UI. |
| `components/portia-promotion-editor.tsx` | Trusted reviewer workspace | employee/editor sub-editors | Separate component to avoid further inflating `portia-editor.tsx`; parent supplies access shell. |
| `supabase/phase14_apply.sql` | Owner-run live migration gate | `supabase/phase12_apply.sql` | Preflight, transaction, verification, rollback guidance; never automated against production. |

## Reusable code

- `parseCsv`, normalization and timeout behavior from `lib/portia-employees.ts`; extract shared CSV parsing only if both callers remain covered by tests.
- `getEditorAccess` plus `openTabs`; add trusted tab `promo` to `tabRegistry`, and require `portia_has_tab_grant('promo')` in every reviewer operation.
- `parseJsonObject`, `noStoreHeaders`, `isAuthRetryableFetchError` and current API error conventions.
- Window registry/geometry/focus behavior and `QuestToast` presentation from `components/portia-desktop.tsx`.
- `.editor-tabs`, `ConfirmDialog`, primary/secondary/danger controls, focus rules and phone breakpoints from the current editor.
- Idempotent SQL style, explicit grants, RLS enablement and pinned `search_path` from `supabase/portia_setup.sql`.

## Non-negotiable boundaries

- Public APIs never use `select('*')` for promotion data and never return answer keys, future questions, reviewer IDs, internal notes, raw IP/device signals or other nicknames.
- All multi-row/irreversible transitions are RPC transactions with explicit execute grants; browser state is never authoritative.
- Ordinary assignments and qualification attempts have separate tables, statuses, APIs and UI nouns.
- `portia_setup.sql` records canonical idempotent schema. Applying SQL is a final owner checkpoint, not an automated task.
- Local/browser checks must not create production requests or attempts. Use pure fakes/fixtures until the owner checkpoint.

## Hot files and sequencing

- `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `app/portia.css`, `supabase/portia_setup.sql` are shared hot files. Plans touching them are intentionally sequenced.
- Domain/API plans precede UI plans so UI components consume stable DTO contracts.
- The live SQL checkpoint follows code that tolerates schema absence and precedes owner UAT.
