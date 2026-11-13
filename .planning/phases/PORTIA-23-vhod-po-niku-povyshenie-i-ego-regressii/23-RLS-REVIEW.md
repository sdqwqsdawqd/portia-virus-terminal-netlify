# 23 — RLS/RPC review

- Reviewer: `supabase-rls-reviewer` agent, final read-only run 2026-11-13 08:21 UTC.
- Reviewed commit: `0046f80ca35c01bb87e1475a0d316c2870484eb8`.
- Scope: `supabase/migrations/20261113000000_portia_access_promotion.sql`, `app/api/access/editor-request/route.ts`, `app/api/promotion/{status,requests,test}/route.ts`, `lib/promotion-participant.ts`, `lib/portia-promotion-api.ts`.
- Open critical: **0**. Open high: **0**. Verdict: **static review passed with a medium note**.

## Findings and fixes

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| RLS23-01 | high | Earlier direct `secure_submit` and test RPCs could bypass server-only checks. | Fixed before `465a1b9`: signed submit/test proof and old direct grants revoked; reviewer rechecked. |
| RLS23-02 | medium | An authenticated non-editor was offered guest approved status by the route helper, while SQL requires editor ownership for authenticated callers. | Fixed in `6db7d24`: helper returns unapproved for signed-in non-editors. |
| RLS23-03 | medium | Qualification start/current could invoke mutating legacy RPCs for a stale title before the route checked the title. | Fixed in `213d99b`: current roster title is passed to SQL; start/current check request title before old RPC. |
| RLS23-04 | medium | Test action HMAC does not bind `p_title_id`, answer, nonce, failure reason, or client mode. A leaked signature could be replayed within the five-minute window with altered fields. | Open defense-in-depth item. Signature stays server-only and is never returned to browser; no high authorization bypass found. |

The reviewer checked `SECURITY DEFINER` functions, narrow grants and revoked legacy participant functions, current access proof, editor `requested_by=auth.uid()` ownership, signature parity, and title checks. This was static inspection only. Migration application, live Postgres/RLS roles, and concurrent revocation remain **BLOCKED** until an explicitly isolated test project is available.
