---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
reviewed: 2026-11-15T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - components/portia-access-gate.tsx
  - lib/access-gate.ts
  - lib/access-gate-view.ts
  - lib/access-gate.test.ts
  - lib/access-closure.test.ts
  - lib/phase23-evidence.test.ts
  - lib/portia-canonical-parity.test.ts
  - lib/portia-migration-fingerprint.test.ts
  - supabase/migrations/20261114000000_portia_access_closure_default_on.sql
  - supabase/fingerprint/expected/portia.fingerprint.json
  - tests/e2e/fixtures/data/expected-authz.json
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 23: Code Review Report (round 2, gap closure 23-09..23-11)

**Reviewed:** 2026-11-15
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Scope: the diff `9a7b0db..HEAD` for the gap-closure plans 23-09..23-11 (G-PORTIA-23-4): fail-closed gate on a missing closure function, editor hidden from the visitor form (WR-04), honest submit failure text (WR-03), the forward-only migration that makes closure ON by default.

No structural (fallow) findings were provided. The migration was not re-reviewed for RLS (round 2 in `23-RLS-REVIEW.md` passed it); I checked it only for correctness against the frozen foundation (`20261109000000`): the `alter ... set default`, the `insert ... on conflict do nothing`, the guarded `update` and the `create or replace` body are consistent, the grants match the foundation, the `notify` is the last statement, and the golden fingerprint (`default: "true"`, new `src_sha256`) and `expected-authz.json` (line 38 is the `grant ... to anon, authenticated`) agree with it.

I ran the five phase-23 test files plus `phase16-expected-authz` and `access-rls-round2` locally (node 22.13.1, no database): 53 + 20 tests, 0 failures.

Fail-closed logic in `resolveGate` is correct: the editor is decided before the closure read, a missing function (exact PGRST202/42883 plus the identifier match) gives `closed/none`, and an unavailable editor check still throws on that branch (the warning is emitted first, the throw second). The new `layout.editor` exclusion cannot hide the form from a non-editor. No critical issues. One warning and five info items. Necessity (#4100) was not assessed separately; no necessity findings were raised.

IDs below continue the numbering of the earlier review (WR-07, IN-06) so they do not collide with the carried-forward IDs.

## Warnings

### WR-07: an approved or pending visitor is offered "ПОДАТЬ ЗАЯВКУ" (submit a request) and the status card never closes on its own

**File:** `lib/access-gate-view.ts:35` (also `components/portia-access-gate.tsx:106`, `:34`)
**Issue:** `showReopen: desktop && !editor && !cardOpen` ignores the request status. When a visitor is approved, the decision is `closed/allowed`, so `desktop` is true. `cardOpen` starts `true` and is only ever set to `false` by the "×" button. The result is that an approved visitor lands on the desktop under a floating card that says "Доступ подтверждён. Открываем рабочий стол." (the desktop is already open), and after pressing "×" the only control left is a button labelled "ПОДАТЬ ЗАЯВКУ", although the form is hidden for that status (`showForm` is false). The updated layout test pins this behaviour (`approved ... showReopen: true`). Before the 23-10 migration this path was rare (the site was open by default); with closure ON by default, every approved visitor takes it. The same applies to a pending visitor if the desktop is shown (open mode with a pending token): the button promises a form that never appears.
**Fix:** Tie the reopen button to a state where the form exists, or give it a status-neutral label, and close the card when the status first becomes approved:
```ts
// access-gate-view.ts
showReopen: desktop && !editor && !cardOpen && (showForm || status !== null),
// label chosen in the component: showForm ? "ПОДАТЬ ЗАЯВКУ" : "СТАТУС ЗАЯВКИ"
```
```tsx
// component, inside refresh() after the approved check
if (decision.mode === "closed" && decision.allowed && !approved.current) setCardOpen(false);
```
Update the layout test expectation for the approved case accordingly.

## Info

### IN-06: `isMissingClosureFunction` is a type predicate that is false for some real `AccessStoreError` values

**File:** `lib/access-gate.ts:26`
**Issue:** The signature `error is AccessStoreError` was added so the caller can read `error.sqlState` without a cast. A type predicate that returns `false` for an `AccessStoreError` (any other closure failure) is unsound: in a union-typed caller TypeScript narrows an `AccessStoreError` out of the `else` branch. Today the caller passes `unknown` and rethrows, so nothing breaks, but it is a trap for the next caller.
**Fix:** Keep the boolean return and read the field through a small narrow instead, e.g. `if (!isMissingClosureFunction(error)) throw error; const sqlState = error instanceof AccessStoreError ? error.sqlState : null;`, or name the predicate honestly (`isMissingClosureFunctionError`) and document that `false` is not a negation of the class.

### IN-07: the submit failure text can still say "check your connection" for a server-side refusal

**File:** `lib/access-gate-view.ts:41-52`, `components/portia-access-gate.tsx:13-22`
**Issue:** WR-03 is fixed for raw exceptions, but the "honest text" goal is only partly met. `app/api/access/request/route.ts` returns `{ code: "invalid" }` with HTTP 400 for an RPC-level `invalid` reply and `{ code: <other> }` with 503 for unknown codes, both without an `error` field; these fall to `kind: "default"` and the user is told "Проверьте соединение и повторите", which is wrong for a refusal (retrying will not help). Separately, the `kind: "server"` branch shows any upstream JSON `error` string of 1..300 characters; 300 is an unexplained magic number, and a proxy or CDN error body in English would be shown verbatim.
**Fix:** Add an `invalid` entry to `knownFailureCodes` with its own text ("Проверьте ник и выбор: заявка не принята."), and name the limit (`const maxServerTextLength = 300`). Optionally restrict the server branch to `response.status === 400` where the route owns the text.

### IN-08: the status-route callback is copied into the test and nothing guards the copy

**File:** `lib/access-gate.test.ts:127-135`
**Issue:** `routeEditorAccess` is documented as a "verbatim copy" of the callback in `app/api/access/status/route.ts`, but no assertion ties the two together. If the route changes (for example another retryable-error check), the network-budget and tracer tests keep passing against the stale copy.
**Fix:** Read `app/api/access/status/route.ts` in the test (the "status route keeps a missing session secret..." test already does) and assert that it contains the same three statements, or extract the callback into a shared module that both import.

### IN-09: the alter-column replay does not fail on forms it claims to catch

**File:** `lib/portia-migration-fingerprint.test.ts:219-234`
**Issue:** The comment says "Any other alter column form on these tables fails loudly". The matcher `^alter table public\.(portia_access_\w+) alter column (\w+) .*$` only sees a single-line statement that starts the line and is written exactly that way. A later migration that writes `alter table only public.portia_access_x`, `alter table if exists ...`, splits `alter column` onto the next line, or chains `alter column a ..., alter column b ...` is silently skipped, and the golden default would then drift without a failing test.
**Fix:** Scan the comment-stripped migration text for any `alter table\b[^;]*portia_access_` statement (multi-line, `[^;]*`) and fail when it is not exactly the supported single `set default` form.

### IN-10: brittle constants and unescaped file names in the evidence test

**File:** `lib/phase23-evidence.test.ts:106-113, 117-119`
**Issue:** `versions.length >= 8` and the `"20261101000200"` cut-off are magic numbers that must be edited by hand with each migration; the migration file names are interpolated into `new RegExp(...)` with an unescaped `.`; and the whole test depends on 14 Russian section headings and on the literal `"Агент не применил ничего"`. A harmless edit of the record fails the suite, while a real regression (for example the record listing the right names in the wrong text) would not.
**Fix:** Derive the lower bound from the Phase 16 postflight record or drop the `>= 8` check (the `deepEqual(listed, versions)` already covers it), escape the file names (`file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`), and keep only the headings that carry a machine-checked value.

## Prior review (carried forward, outside this diff, not re-reviewed)

Still open per `23-REVIEW-DISPOSITION.md` (WR-02, WR-03, WR-04 are fixed and verified above):

- WR-01: `app/api/promotion/test/route.ts` has GET and POST without `try/catch`.
- WR-05: `editor-request` silently replaces the guest device cookie.
- WR-06: `portia-promotion.tsx` "Проверяем доступ…" can stick, plus a sentinel in `checkedNickname`.
- IN-01: `device-busy`, `unauthorized`, `unavailable` are returned as HTTP 503 (relevant to IN-07 above).
- IN-02: the editor request form loses the reason for `cooldown` / `throttled`.
- IN-03: `import` in the middle and at the end of a file.
- IN-04: `AccessStoreError.code` holds the message while `sqlState` holds the PostgREST code.
- IN-05: duplicate CSS rule and a renamed hash "pin".

---

_Reviewed: 2026-11-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
