---
phase: "PORTIA-12"
slug: "prava-redaktorov-i-bezopasnost-dostupa"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-26"
---

# Phase PORTIA-12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → Next.js API | Editor saves, employee writes, uploads, tab-list PATCH | Content JSON, employee profiles, media, tab lists (authenticated) |
| Next.js API → Supabase (RLS) | rpc `portia_can_edit` / `portia_is_owner`, table reads/writes under the user's JWT | Access decisions, editor rows, employee rows |
| Supabase Auth | Sign-in, `email_confirmed_at` | Identity (email confirmation) |
| Owner → Supabase SQL Editor | Manual apply of `supabase/phase12_apply.sql` | Schema, functions, policies |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-12-01 | Spoofing | lib/editor-access.ts | high | mitigate | Unconfirmed email → noAccess before any rpc, owner included | closed |
| T-12-02 | Elevation of Privilege | lib/editor-access.ts | high | mitigate | Only missing-column codes open all tabs; other errors → unavailable | closed |
| T-12-03 | Denial of Service | app/api/access | medium | mitigate | 503 on auth blip / lookup failure; desktop ignores non-OK (CR-01 fix e0f89ef) | closed |
| T-12-04 | Information Disclosure | app/api/access | medium | mitigate | Per-user answers are no-store | closed |
| T-12-05 | Spoofing | app/owner-login | medium | mitigate | Unconfirmed session signed out, `?error=unconfirmed` | closed |
| T-12-06 | Tampering | lib/editor-changes.ts | high | mitigate | `info-block:` prefix classified; unclassifiedTextKeys | closed |
| T-12-07 | Tampering | lib/editor-changes.ts | high | mitigate | movedVirusIds strict conditions | closed |
| T-12-08 | Tampering (data loss) | lib/editor-changes.ts | medium | mitigate | Repair step + property test over all closed sets | closed |
| T-12-09 | Information Disclosure | lib/media-url.ts + SQL CHECK | medium | mitigate | isLocalMediaPath; SQL CHECK validated in production | closed |
| T-12-10 | Denial of Service | supabase/phase12_apply.sql | high | mitigate | Owner-confirmed guard first in transaction; preflight; rollback | closed |
| T-12-11 | Spoofing | SQL functions | high | mitigate | portia_is_owner / portia_can_edit require portia_email_confirmed(); «Confirm email» ON | closed |
| T-12-12 | Elevation of Privilege | portia_editors grants/policies | high | mitigate | Column-level update grant + owner-only UPDATE policy | closed |
| T-12-13 | Tampering | employee table policies | high | mitigate | Five write policies use portia_can_edit_tab('employees') | closed |
| T-12-14 | Tampering | portia_content / storage | medium | accept | D-11 accepted risk (see log) | closed |
| T-12-15 | Denial of Service | photo CHECK | medium | mitigate | NOT VALID + preflight (b) + separate validate | closed |
| T-12-16 | Tampering | app/api/content PUT | high | mitigate | Server-side contentRefusal before write and purge | closed |
| T-12-17 | Tampering | app/api/content PUT | medium | mitigate | Revision check + CAS write | closed |
| T-12-18 | Tampering | lib/editor-tabs.ts | high | mitigate | 400 on unclassified formatting keys | closed |
| T-12-19 | Tampering | app/api/employees | high | mitigate | PATCH/POST/DELETE require employees tab | closed |
| T-12-20 | Information Disclosure | app/api/employees/editor | low | mitigate | Roster gated on employees tab | closed |
| T-12-21 | Elevation of Privilege | app/api/editors | high | mitigate | requireOwner on every handler + DB owner-only policy | closed |
| T-12-22 | Tampering | lib/editor-tabs.ts parseTabLists | low | mitigate | Registry/type validation, 400 | closed |
| T-12-23 | Information Disclosure | components/portia-editor.tsx | medium | mitigate | Strip filtered by openTabs; closed sections hidden | closed |
| T-12-24 | Tampering (data loss) | components/portia-editor.tsx | medium | mitigate | restrict + revertSections; closed sections sent as stored | closed |
| T-12-25 | Denial of Service | components/portia-desktop.tsx | low | mitigate | Access poll only while canEdit | closed |
| T-12-26 | Tampering | 12-editor-check.mjs | high | mitigate | Harness blocks every non-GET; fakes answered locally | closed |
| T-12-27 | Tampering | EditorAccessManager | medium | mitigate | One PATCH in flight per row, full lists, resend latest | closed |
| T-12-28 | Repudiation | EditorAccessManager | low | mitigate | Per-row status, rollback on error | closed |
| T-12-29 | Tampering | 12-editor-check.mjs | high | mitigate | PATCH fulfilled in-browser, never forwarded | closed |
| T-12-30 | Denial of Service | owner SQL apply (12-08) | high | mitigate | Preflight confirmed; STEP 3 9/9; owner login after apply | closed |
| T-12-31 | Tampering | live test saves | medium | mitigate | Owner's hand saves undone by second save; no scripted writes | closed |
| T-12-32 | Information Disclosure | local prod server | low | mitigate | Bound to 127.0.0.1, stopped after 12-08 | closed |
| T-12-SC | Tampering | supply chain | low | accept | Phase installs no packages (see log) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| D-11 | T-12-14 | An approved editor can write closed content sections directly through PostgREST with their own JWT; the database does not check sections for portia_content/storage. Documented in .planning/PROJECT.md Known Limitations. | owner (phase 12 discussion) | 2026-10-26 |
| SC | T-12-SC | Phase adds no dependencies. Note: an unrelated uncommitted `motion` dependency exists in package.json, outside phase 12 commits; not audited here. | owner (phase 12 plans) | 2026-10-26 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-26 | 33 | 33 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

Not verified by the auditor directly: live database state (rests on the owner's STEP 3 output in 12-08-SUMMARY) and the «Confirm email» dashboard setting (owner-confirmed).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-26
