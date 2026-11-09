# Phase 15 Accepted Limitations and Scope Fences

SOURCE-COMMIT: dc02013ae6dec3996a4548138fc9e15218912ccd

**Status:** CAPTURED, NOT EXPANDED  
**Canonical sources:** `.planning/PROJECT.md` and `.planning/REQUIREMENTS.md`

Phase 15 records these constraints so a baseline does not silently turn them into fixes or broaden them. A listed acceptance is not permission to expand the risk.

## Existing Accepted Limitations

| Limitation | Canonical reference | Phase 15 treatment |
|---|---|---|
| Ctrl+wheel cannot reach the parent while focus is inside a cross-origin «Устав»/«Таблица» iframe; `+/-` remains the fallback. | `.planning/PROJECT.md` → `Known Limitations` item 1; `.planning/REQUIREMENTS.md` → `STAB-APP-06` and `Out of Scope` final item | Capture the current shell, sandbox and controls; do not attempt a browser-impossible event bridge. |
| Public profile reads retain `updated_by`/`nickname`; owner email is present in setup SQL; anonymous approval lookup remains, while access still requires confirmed-email server checks. The open media listing is explicitly not accepted by this waiver. | `.planning/PROJECT.md` → `Known Limitations` item 2; `.planning/REQUIREMENTS.md` → `STAB-SEC-01`, `STAB-SEC-04`, `STAB-SEC-05` | Preserve as a named carried risk; do not describe the open media listing as accepted. |
| Repeated editor `max-width`, imperfect panel clamping with blocked storage and drag starting from any mouse button were accepted without rework because of mobile-regression risk. | `.planning/PROJECT.md` → `Known Limitations` item 3 (`05-WR-05`); `.planning/REQUIREMENTS.md` → `STAB-APP-07`, `STAB-APP-08` | Record current behavior in baseline; later requirements may replace the acceptance only with browser/phone evidence. |
| Closed content sections are enforced by the site API but not by database RLS for direct `portia_content` writes; owner accepted the known direct-write risk. | `.planning/PROJECT.md` → `Known Limitations` item 4 (`12-CONTEXT D-11`, `03.1-REVIEW-DISPOSITION WR-11`); `.planning/REQUIREMENTS.md` → `STAB-SEC-01`, `STAB-SEC-04` | Do not claim database enforcement in Phase 15; Phase 16/21 evidence must report the real boundary. |

## Product and Milestone Scope Fences

| Fence | Canonical reference | Phase 15 treatment |
|---|---|---|
| Preserve the existing PORTIA OS artistic identity; no full redesign, new generic/schema-driven app shell or architecture rewrite. | `.planning/REQUIREMENTS.md` → `Out of Scope` items 1-2; `.planning/PROJECT.md` → `Current Milestone` goal | CURRENT evidence and PROPOSED ideas stay physically separate. |
| Do not adopt Motion/Framer Motion, another test runner/package manager/BaaS/database/hosting platform. | `.planning/REQUIREMENTS.md` → `Out of Scope` item 3 | Existing uncommitted `motion@^14.6.0` remains an ownership blocker, not a Phase 15 dependency. |
| Keep the PNG spider; no SVG spider, new font/icon system or mass SVG replacement without a separate owner decision. | `.planning/REQUIREMENTS.md` → `Out of Scope` item 4; `.planning/PROJECT.md` → `Out of Scope` items 2 and 5 | Baseline the current PNG and identity; proposed changes cannot enter approved CURRENT frames. |
| No desktop «Сводка» widget and no free global shortcut arrangement. | `.planning/REQUIREMENTS.md` → `Out of Scope` item 5; `.planning/PROJECT.md` → `Out of Scope` items 1 and 5 | Do not add either behavior while building the baseline. |
| Promotion proof uploads, automatic percentage-based pass/fail and disclosure of specific errors/answers/notes/reviewer identity remain excluded. | `.planning/REQUIREMENTS.md` → `Out of Scope` items 6-7; `.planning/PROJECT.md` → `Out of Scope` items 8-10 | Candidate fixtures and screenshots must contain no private qualification payload. |
| Device binding is not hardware attestation and cannot promise resistance to spoofing, VPN use or cookie clearing. | `.planning/REQUIREMENTS.md` → `Out of Scope` item 8 and `STAB-SEC-06` | Tests use the actual documented boundary and release evidence preserves this limitation. |
| No mutation testing on production and no `npm audit fix --force`. | `.planning/REQUIREMENTS.md` → `Out of Scope` item 9; `STAB-BASE-02`, `STAB-REL-04` | Fail closed without isolated staging; dependency changes stay exact and separately reviewable. |

## Older Product Decisions Preserved

- Keep the `РЕВИЗИЯ N` label (`.planning/PROJECT.md` → `Out of Scope` item 3).
- Netlify Blobs remains removed because it hung in the Next runtime (`.planning/PROJECT.md` → `Out of Scope` item 4).
- Formatting-panel size presets remain unselected (`.planning/PROJECT.md` → `Out of Scope` item 6).
- The earlier “unified application system” idea is not silently reintroduced (`.planning/PROJECT.md` → `Out of Scope` item 7; current v1.3 fence against a generic shell in `.planning/REQUIREMENTS.md`).

## Closure Rule

Any future change to these limitations requires its mapped roadmap phase, deterministic/browser evidence and explicit owner approval. Phase 15 may identify a limitation in CURRENT evidence but cannot mark it fixed or approved beyond the exact canonical wording above.
