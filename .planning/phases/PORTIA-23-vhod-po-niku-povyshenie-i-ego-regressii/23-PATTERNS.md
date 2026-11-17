# Phase 23: Вход по нику, «Повышение» и его регрессии — Pattern Map

**Mapped:** 2026-11-12  
**Files analyzed:** 18  
**Analogs found:** 18 / 18

## File Classification

Пути новых файлов ниже — рабочие назначения для планировщика; точные имена можно уточнить при разбиении планов. Все пути в колонке «Образец» проверены через `git ls-files`.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/access-identity.ts` (new) | service | request-response | `lib/access-store.ts`, `lib/access-session.ts` | role-match |
| `lib/access-gate.ts` (new) | service | request-response | `lib/access-store.ts` | role-match |
| `app/page.tsx` | route | request-response | `app/api/access/route.ts` | flow-match |
| `components/portia-access-gate.tsx` (new) | component | event-driven | `components/portia-promotion.tsx` | role-match |
| `app/api/access/request/route.ts` (new) | route | request-response | `app/api/promotion/requests/route.ts` | exact |
| `app/api/access/status/route.ts` (new) | route | request-response | `app/api/promotion/status/route.ts` | exact |
| `lib/access-store.ts` | service | request-response | `lib/access-store.ts` | exact |
| `lib/access-session.ts` | utility | transform | `lib/access-session.ts` | exact |
| `app/api/promotion/status/route.ts` | route | request-response | `app/api/promotion/status/route.ts` | exact |
| `app/api/promotion/requests/route.ts` | route | request-response | `app/api/promotion/requests/route.ts` | exact |
| `lib/portia-promotion-api.ts` | service | request-response | `lib/portia-promotion-api.ts` | exact |
| `components/portia-promotion.tsx` | component | event-driven | `components/portia-promotion.tsx` | exact |
| `components/portia-promotion-ordinary-editor.tsx` / qualification editor | component | CRUD | `components/portia-promotion-ordinary-editor.tsx` | exact |
| `app/api/promotion/banks/route.ts` | route | CRUD | `app/api/promotion/banks/route.ts` | exact |
| `lib/portia-template-dossier.ts` | model | transform | `lib/portia-template-dossier.ts` | exact |
| `components/portia-template-builder.tsx` | component | file-I/O | `components/portia-template-builder.tsx`, `components/portia-image-framing.tsx` | exact |
| `supabase/migrations/<next>_portia_access_promotion.sql` (new) | migration | CRUD | `supabase/migrations/20261112000000_portia_access_decision_mark.sql` | exact |
| `lib/access-identity.test.ts`, existing access/promotion/template tests | test | request-response / transform | `lib/access-requests.test.ts`, `lib/portia-promotion-ui.test.ts`, `lib/image-framing-crop.test.ts` | role-match |

## Pattern Assignments

### Access identity, gate and visitor API

**Apply to:** `lib/access-identity.ts`, `lib/access-gate.ts`, `app/page.tsx`, `app/api/access/request/route.ts`, `app/api/access/status/route.ts`, plus `lib/access-store.ts` and `lib/access-session.ts` extensions.

**Server auth and unavailable response:** `app/api/access/route.ts:1-4,11-23`:

```ts
const supabase = await createServerSupabaseClient();
const { data, error } = await supabase.auth.getUser();
if (isAuthRetryableFetchError(error)) return Response.json(unavailableBody, { status: 503, headers: noStoreHeaders });
const access = await getEditorAccess(supabase, data.user);
if (access.unavailable) return Response.json(unavailableBody, { status: 503, headers: noStoreHeaders });
```

**Access token:** `lib/access-session.ts:11-27,78-91` uses `portia_access`, HMAC label `access:`, and `HttpOnly; Secure; SameSite=Lax`; `readAccessToken(headers)` returns `null` for absent or malformed cookie. Use the access digest only for access RPC. Never substitute the separate promotion device digest.

**Typed RPC contract:** `lib/access-store.ts:83-135,253-257`:

```ts
const { data, error } = await client.rpc(fn, args);
if (error) throw new AccessStoreError(error.message, error.code ?? null);
if (!isRecord(data)) throw unexpected();
// resolveAccess branches only on known state values and validates level/retryAt.
```

`submitAccessRequest` signs server fields before RPC (`lib/access-store.ts:90-115`); `isClosureEnabled` checks a bare boolean (`:250-257`). Extend the approved projection with server-owned `origin` only through a narrow typed RPC contract. `app/page.tsx:1-6` currently mounts `PortiaDesktop` immediately: make server access resolution the parent decision before desktop mount. The editor bypass must use `getUser()` and `getEditorAccess()`, not cookie presence.

**Route response:** `app/api/promotion/requests/route.ts:10-30` shows bounded parsing, typed input, `Set-Cookie` on successful creation, `noStoreHeaders`, and 503 catch. `app/api/promotion/status/route.ts:8-23` shows GET status and neutral 503. For new access routes, derive identity from access cookie and return only the current device's status; do not claim someone else's pending request as this device's.

**Client waiting pattern:** `components/portia-promotion.tsx:320-368` has per-state React values, no-store fetch, stale response handling, and safe network failure. Reuse its state/error shape for the waiting screen, but keep the closed desktop unmounted until server confirmation. Poll only while visible, and guard against stale responses after newer status.

### Promotion identity and request flows

**Apply to:** `app/api/promotion/status/route.ts`, `app/api/promotion/requests/route.ts`, `lib/portia-promotion-api.ts`, `components/portia-promotion.tsx`, and promotion UI/API tests.

`app/api/promotion/status/route.ts:8-16` currently reads `nickname` from query; `app/api/promotion/requests/route.ts:10-23` currently reads it from JSON body. Replace those identity sources with the shared server resolver. Keep body input only for request kind. `lib/portia-promotion-api.ts:191-245` already separates status and POST, returns typed `{status, body}`, loads roster, checks existing promotion token binding, and returns `423 device-denied` on mismatch. Preserve that conflict behavior and existing promotion cookie. `lib/portia-promotion-api.ts:302-343` wraps Supabase RPC errors with `unavailable` projection and logs code only; use that shape when narrowing the database contract.

`components/portia-promotion.tsx:413-437` has independent ordinary/qualification submit feedback, guards repeated submits with `submittingRef`, treats only a created server response as success, focuses feedback, and refetches status. Remove browser nickname from POST (`:418`) and from status query (`:344`); keep draft/submit feedback when refresh fails. For bank CRUD, `app/api/promotion/banks/route.ts:93-116` validates size and command, returns conflict/503 codes, and reads authoritative state after the write. The ordinary editor's existing component is the same-role analog for preserving local bank draft on errors.

### Template framing and export

**Apply to:** `lib/portia-template-dossier.ts`, `components/portia-template-builder.tsx`, image framing tests and template tests.

`lib/portia-template-dossier.ts:16-21,219-225` keeps images in local slot data and clones the dossier when setting a slot. Add normalized framing beside each image; replacement/deletion clears only that slot's framing. `:250-262` computes the export snapshot key from text and images; include framing there. Keep image data out of persisted `virus.infectedImage` and `mutation.image`.

`components/portia-image-framing.tsx:34-75` supplies the reusable `ImageFramingEditor`: `key={src}` resets on replacement; `onChange` applies a draft; dialog supports reset, cancel, and apply (`:250-257`). Use measured slot geometry before choosing `box`; the template slot need not match existing `tile` aspect.

`components/portia-template-builder.tsx:142-161,329-372,497-499` has one `TemplateCard` for preview and the hidden export frame. Export takes a single dossier snapshot, renders the same card to HTML or PNG, and reports failure without losing the draft. Apply framing inside that shared card path so preview, HTML and PNG agree. Keep the builder's local-only import graph and no-network rule (`lib/portia-template-builder.test.ts:135-158`).

### Forward-only SQL migration

**Analog:** `supabase/migrations/20261112000000_portia_access_decision_mark.sql:1-20,95-102`:

```sql
revoke all on function public.portia_access_decide(uuid, text, smallint) from public, anon, authenticated;
create or replace function public.portia_access_decide(p_request_id uuid, p_decision text, p_level smallint default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
-- fully qualified tables and typed server-owned result
end; $$;
grant execute on function public.portia_access_decide(uuid, text, smallint) to authenticated;
grant execute on function public.portia_access_decide(uuid, text, smallint) to service_role;
```

For new identity and promotion RPCs, close old callable overloads and review explicit grants; HTTP guards alone do not restrict direct anon RPC. Keep prior migration files unchanged. SQL execution and role proof remain BLOCKED until isolated Postgres evidence; run the required `supabase-rls-reviewer` on implementation changes.

### Regression tests

`lib/access-requests.test.ts:1-15,44,146-148` uses `node:test`, strict assert and SQL source inspection for static contract checks. `lib/portia-promotion-ui.test.ts:108-119,166-180` checks independent submit feedback and success only after server creation. `lib/image-framing-crop.test.ts:48-68,210-225` checks crop geometry across positions, zoom and frame kinds. Add targeted API/state tests for OFF/ON gate, same-device approval, editor bypass, чужой nickname, promotion cookie mismatch, POST/GET partial failure, bank draft preservation, and both image slots/exports. Static SQL inspection cannot be marked as live RLS proof.

## Shared Patterns

- **Auth:** request-scoped SSR client and `getUser()` from `app/api/access/route.ts:11-18`; access cookie digest from `lib/access-session.ts:24-27,82-91`; separate promotion cookie from `app/api/promotion/status/route.ts:11-14`.
- **Validation:** `lib/access-store.ts:83-87,118-135` validates every RPC reply; request handler `app/api/promotion/requests/route.ts:12-15` validates JSON. Reuse `lib/nickname.ts` for nickname syntax.
- **Errors and caching:** `app/api/access/route.ts:16-23` uses 503 and `noStoreHeaders` on unavailable auth; `app/api/promotion/requests/route.ts:21-29` uses the same headers for POST and catch.
- **Draft preservation:** `components/portia-template-builder.tsx:329-372` snapshots before export and keeps draft on failure; promotion submit state is per kind in `components/portia-promotion.tsx:413-437`.

## No Analog Found

No exact existing server-side visitor gate component or verified editor-to-approved-guest ownership RPC exists. The closest role and flow analogs above cover structure; the identity proof and SQL contract require new design plus isolated database verification.

## Metadata

**Analog search scope:** tracked `app/`, `components/`, `lib/`, `supabase/migrations/`.  
**Files scanned:** 15 primary tracked analogs, plus 4 tracked test/geometry references.  
**Pattern extraction date:** 2026-11-12.
