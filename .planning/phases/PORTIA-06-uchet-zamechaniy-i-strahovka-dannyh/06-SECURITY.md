---
phase: "06"
slug: "uchet-zamechaniy-i-strahovka-dannyh"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-20"
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repo ↔ owner's machine | Owner data exports live in C:\Users\User\backups\portia\, outside git | employee profiles and site content (sensitive; never committed) |
| owner ↔ production Supabase | Owner runs read-only selects under their own dashboard login | production rows (Claude never queries production) |
| chat ↔ owner | Owner pastes only row counts into chat | two integers; no data, keys or connection strings |
| visitor localStorage ↔ app | Seen-quest ids read back from the visitor's own browser | untrusted JSON array of ids |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Repudiation | 01/05 REVIEW-DISPOSITION rows | low | mitigate | every closure carries a commit hash and a re-runnable command; `06-check-disposition.cjs` OK on 01 (open=5/7) and 05 (open=4/13) | closed |
| T-06-02 | Tampering | Source cells vs the review gate | low | mitigate | `06-check-disposition.cjs` OK on all four ledgers (01, 05, 03.1, 03.2) — fails on extra columns and count drift | closed |
| T-06-03 | Information disclosure | PROJECT.md Known Limitations, IN-10 Source | low | mitigate | `@` count in `## Known Limitations` is 0; no address, key or URL added | closed |
| T-06-04 | Repudiation | 03.1 IN-10 row | low | mitigate | only accepted parts are `deferred`; storage listing kept `open` as IN-10-storage (03.1-REVIEW-DISPOSITION.md:129) | closed |
| T-06-05 | Denial of service | markQuestsSeen without pruning | low | mitigate | `SEEN_QUEST_LIMIT = 200` cap (lib/broadcasts.ts:58) with cap test; residual: >200 simultaneously active quests exceed the cap (documented `shortcut:` at lib/broadcasts.ts:61, 06-REVIEW WR-01) | closed |
| T-06-06 | Tampering | stored seen ids | low | accept | see Accepted Risks Log AR-06-01 | closed |
| T-06-07 | Information disclosure | backup JSON files | medium | mitigate | files outside repo; `git ls-files` matches 0 export files; STATE.md:75 records names and counts only; checker prints counts only | closed |
| T-06-08 | Elevation of privilege | production tables | medium | mitigate | owner ran read-only selects under own login; no production query, Supabase tool or `PUT /api/content` call made during the phase | closed |
| T-06-09 | Information disclosure | credentials | medium | mitigate | owner pasted only `exported 18 1` into chat; no key or connection string used by any task | closed |
| T-06-SC | Tampering | npm/pip/cargo installs | low | accept | see Accepted Risks Log AR-06-02 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-06 | `parseSeenQuestIds` drops non-strings and bad JSON; a tampered list only hides or shows a popup on the visitor's own device | plan 06-03 threat model | 2026-10-19 |
| AR-06-02 | T-06-SC | no plan in this phase installs packages | plans 06-01..06-04 threat models | 2026-10-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-20 | 10 | 10 | 0 | gsd-secure-phase (orchestrator, L1 grep-depth short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-20
