---
phase: "PORTIA-07"
slug: "server-sohranenie-sotrudnikov-i-bezopasnyy-json"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-20"
---

# Phase PORTIA-07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → /api/employees, /api/editors, /api/content | editor/owner requests with a JSON body | untrusted request bodies; session cookie (Supabase auth) |
| server → Supabase | profile, manual-employee and content writes under the editor's session and RLS | employee profile fields, manual details, site content |
| server → Google Sheet CSV, Roblox API | read-only lookups (sheet for newcomers, Roblox name on add) | public roster rows, public Roblox user name/id |
| owner's browser session → live Supabase (07-04 check) | real writes during the owner's verification | one temporary manual employee only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Denial of Service | five mutating handlers (bad body) | medium | mitigate | `parseJsonObject` (lib/request-json.ts:2-9) → fixed 400 before property access in employees PATCH/POST/DELETE, editors POST, content PUT; test lib/request-json.test.ts:5-9; live 07-04 step 10 | closed |
| T-07-02 | Information Disclosure | 400/403 answers | low | mitigate | literal Russian texts + constant `code: "sheet-employee"`; catch blocks log only | closed |
| T-07-03 | Elevation of Privilege | handler order | medium | mitigate | access check precedes every body read; lib/editor-access.ts fails closed | closed |
| T-07-04 | Tampering | Roblox name stored in portia_manual_employees | low | accept | see Accepted Risks Log AR-07-01 | closed |
| T-07-05 | Tampering | existing manual rows | low | mitigate | D-11 read-time only (lib/portia-employees.ts:302); no new update query; SQL grants update on title, rank, callsign only | closed |
| T-07-06 | Tampering | PATCH body → profile/manual columns (mass assignment) | high | mitigate | allow-lists in sanitizeEmployeeUpdate / sanitizeManualDetails; fixed-key upsert row; updated_by from session; knowledge_rating never written; tests pin upserted keys | closed |
| T-07-07 | Tampering | stale/partial client wiping stored fields | high | mitigate | absent = unchanged in sanitizer and upsert; legacy nick- seed; owner live check of upsert conflict branch passed (07-04 steps 4-8) | closed |
| T-07-08 | Tampering | client id/nickname on newcomer path | medium | mitigate | editor-only + RLS; sheet nickname required; id `roblox-<digits>` or that nickname's nick- id; length caps; residual see AR-07-03 | closed |
| T-07-09 | Tampering | half-saved manual employee | medium | mitigate | details first, restore only changed keys, distinct errors; residual see AR-07-04 | closed |
| T-07-10 | Denial of Service | sheet fetch on save path | low | mitigate | only for ids the DB does not know; editor-only; 8 s timeout; known ids never fetch (tested) | closed |
| T-07-11 | Tampering | live data during the 07-04 check | high | mitigate | one temporary manual employee, no sheet id, no PUT /api/content, deleted at end; Claude sent only one anonymous PATCH, refused 403 before parsing | closed |
| T-07-12 | Information Disclosure | owner pasting session data into chat | low | mitigate | resume signal only "verified"/step numbers; no secrets found in phase artifacts | closed |
| T-07-SC | Tampering | package installs | low | accept | see Accepted Risks Log AR-07-02 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-04 | Roblox name comes over HTTPS from the same lookup that supplies the stored id; editors only; DB check keeps it 3-20 characters; React renders it as text | owner (07-02 plan threat model) | 2026-10-20 |
| AR-07-02 | T-07-SC | No packages were installed in this phase (package.json and package-lock.json unchanged since f17be45) | owner (plan threat models) | 2026-10-20 |
| AR-07-03 | T-07-08 | Residual A2: a `roblox-<digits>` id is not tied to the newcomer's nickname (also 07-REVIEW WR-01, tracked open as hardening); editors can already write any profile row through RLS, so it does not widen editor power | owner (07-03 plan threat model) | 2026-10-20 |
| AR-07-04 | T-07-09 | A failed restore of manual details is only logged: no RPC without new SQL, last write wins (D-02) | owner (07-03 plan threat model) | 2026-10-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-20 | 13 | 13 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-20
