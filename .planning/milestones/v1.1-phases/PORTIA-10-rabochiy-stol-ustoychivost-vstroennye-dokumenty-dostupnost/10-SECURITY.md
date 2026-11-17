---
phase: "PORTIA-10"
slug: "rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-26"
---

# Phase PORTIA-10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| localStorage → CSS custom properties | A stored «Свой» colour is restored at boot and on settings apply | Untrusted string; only a strict `#rrggbb` passes, only number-built tokens reach `style.setProperty` |
| PORTIA tab ↔ embedded iframes | YouTube and embedded documents render inside the desktop | Third-party page content, sandboxed |
| Check harness ↔ live content API | Edge harness runs against a running site | Read-only GETs; every non-GET to /api/content is failed |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Tampering | accentBootScript custom branch | high | mitigate | `lib/accent-custom.ts:7` strict `/^#[0-9a-f]{6}$/i` guard; boot-check hostile case | closed |
| T-10-02 | Denial of Service | deriveAccentTokens | low | mitigate | fixed loop bounds `lib/accent-custom.ts:85-93`, input-independent | closed |
| T-10-03 | Denial of Service | assistant bubble / FormattedText | high | mitigate | derived `assistantSpeaking` `components/portia-desktop.tsx:1203`; harness `--check assistant` | closed |
| T-10-04 | Tampering | 10-desktop-check.mjs | high | mitigate | harness fails every non-GET request (`10-desktop-check.mjs:53`) | closed |
| T-10-05 | Tampering | desktop settings restore / apply effect | medium | mitigate | restore goes through deriveAccentTokens strict check; harness step (e) feeds markup | closed |
| T-10-06 | Denial of Service | readability after a bad pick | medium | mitigate | contrast >= 4.5 asserted in `lib/accent-theme.test.ts:317,357` | closed |
| T-10-07 | Information Disclosure | saved custom colour | low | mitigate | stored in device settings only; no fetch/API use of customAccent; cleared by factory reset | closed |
| T-10-08 | Elevation of Privilege | embedded iframes | high | mitigate | shared `embedSandbox` (`components/portia-desktop.tsx:31`) without allow-top-navigation; pinned by `lib/portia-desktop.test.ts:36-39` | closed |
| T-10-09 | Denial of Service | zoom layer | medium | mitigate | cleared on keyup/blur/visibilitychange (`components/portia-desktop.tsx:1607-1609`); harness `--check zoom` | closed |
| T-10-10 | Denial of Service | QuestToast Escape listener | low | mitigate | skips defaultPrevented, text inputs, contenteditable (`components/portia-desktop.tsx:1875-1877`); harness `--check toast` | closed |
| T-10-11 | Tampering | live content during the check | high | mitigate | harness non-GET block; read-only GETs only | closed |
| T-10-12 | Elevation of Privilege | embedSandbox widened after a device failure | medium | mitigate | sandbox unchanged; no allow-top-navigation anywhere in app/components/lib | closed |
| T-10-13 | Tampering | deriveAccentTokens output → style.setProperty | medium | mitigate | strict hex check unchanged; new `--accent-chroma` is `String()` of a `toFixed` number; tampered-colour test green | closed |
| T-10-14 | Denial of Service | deriveAccentTokens on every picker move | low | accept | fixed loop bounds; ~1.7 ms per call | closed |
| T-10-15 | Tampering | live content during the owner check | high | mitigate | no editor saves; harness non-GET block; server stopped after owner answered | closed |
| T-10-SC | Tampering | npm/pip/cargo installs | low | accept | no packages installed in any plan | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-14 | Bounded, input-independent cost (~1.7 ms) per picker move | plan 10-08 threat model | 2026-10-26 |
| AR-10-02 | T-10-SC | No dependencies added in phase 10 | plan threat models 10-01..10-09 | 2026-10-26 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-26 | 16 | 16 | 0 | gsd-secure-phase (orchestrator, ASVS L1 grep-depth short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-26
