---
phase: "PORTIA-01"
slug: "ispravlenie-bagov"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-13"
---

# Phase PORTIA-01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| PORTIA page → embedded «Устав»/«Таблица» (cross-origin iframe) | Third-party document rendered inside the desktop window | None from PORTIA; referrer suppressed |
| PORTIA page → roblox.com (new-tab link) | Portrait link opens an external profile | Numeric `robloxUserId` in URL path only |
| PORTIA page HTML → visitor's browser extensions | `darkreader-lock` meta read by Dark Reader | Static constant, no user data |
| Editor fields → saved rich text (Supabase) | Editor presentation vs. stored content | Unchanged by this phase (presentation only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Information disclosure | EmbeddedDocument iframe (components/portia-desktop.tsx) | low | accept | CSS positioning only; iframe keeps `referrerPolicy="no-referrer"`, no `allow`/`sandbox` relaxed (verified: 1 iframe, no-referrer, no allow/sandbox attrs) | closed |
| T-01-02 | Tampering | IBM Plex Serif font files (app/layout.tsx) | low | mitigate | Loaded via existing `next/font/google` (self-hosted at build), `IBM_Plex_Serif` import at app/layout.tsx:2,11; no new package (package.json / lock untouched in phase range) | closed |
| T-01-03 | Tampering | `a.personnel-portrait` new-tab link (components/portia-desktop.tsx) | low | mitigate | `target="_blank" rel="noreferrer"` present on the portrait anchor (grep evidence) | closed |
| T-01-04 | Tampering | Portrait href from `robloxUserId` | low | accept | `number \| null` typed, fixed `https://www.roblox.com/users/` origin | closed |
| T-01-05 | Information disclosure | Корзина viewer layout (`.trash-app.is-viewing`) | low | accept | CSS/className-only change | closed |
| T-01-06 | Tampering | `darkreader-lock` meta (app/layout.tsx `metadata.other`) | low | accept | Static constant meta, no script/request/user input | closed |
| T-01-07 | Tampering | `data-area` attribute / `.formatted-rich-input[data-area=…]` | low | accept | Compile-time `DisplayArea` literal at 13 call sites; never from stored content, URL or user input; not persisted | closed |
| T-01-08 | Tampering | Saved rich text (formatKey, RichTextDocument, save path) | low | mitigate | 01-04 diff in components/portia-editor.tsx touches only `DisplayArea` type, `area` prop, `data-area`, `area=` call-site args; `lib/` unchanged in phase range; tsc 0, `npm test` 13/13 | closed |
| T-01-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in any phase plan; `git log 39c56f8..HEAD -- package.json package-lock.json` = 0 commits | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-01 | Positioning-only change to an already-embedded cross-origin document; referrer suppressed | planner (01-01 threat model) | 2026-10-13 |
| AR-02 | T-01-04 | Typed numeric id after fixed origin; no injection surface | planner (01-02 threat model) | 2026-10-13 |
| AR-03 | T-01-05 | Layout-only change, data flow untouched | planner (01-02 threat model) | 2026-10-13 |
| AR-04 | T-01-06 | Static meta asking one extension to skip restyling; no colour-mode override | planner (01-03 threat model) | 2026-10-13 |
| AR-05 | T-01-07 | Presentation-only attribute from a compile-time union | planner (01-04 threat model) | 2026-10-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-13 | 9 | 9 | 0 | gsd-secure-phase (orchestrator, ASVS L1 grep-depth; register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-13
