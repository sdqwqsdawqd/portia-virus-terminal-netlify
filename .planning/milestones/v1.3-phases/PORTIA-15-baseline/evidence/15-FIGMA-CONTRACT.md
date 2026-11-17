# Phase 15 Figma Authority Contract

**Status:** EXACT CURRENT REVISION OWNER-APPROVED

**Owner signature:** `Qloxz`, 2026-10-30T16:12:03.2978944+05:00

**Candidate set:** `phase15-current-4ec66b7d693c`

## Authority

| Field | Recorded value |
|---|---|
| Figma file | [PORTIA OS — Phase 15 Baseline](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ) |
| File key | `GEf7NB9v2GZN80cMzRvUVQ` |
| Figma work revision | Initial file state created and validated on 2026-10-30 in MCP session `77cd90e1-9022-4a59-8906-de90227ad904`; the Starter connector exposes no immutable version ID, so node IDs plus this session are the exact reproducible revision locator |
| Named signer | `Qloxz` |
| Representative phone | Playwright `iPhone 13`, viewport `390×844`, DPR `3`; physical-device UAT remains a later gate |
| Repository authority | [`15-UI-SPEC.md`](../15-UI-SPEC.md) |
| Native `figma.spec` Plugin API | Not exposed by the current `use_figma` Plugin API surface |
| Plan `specs_enabled` | `true` |
| Baseline approval | **APPROVED** — all 23 captured CURRENT hashes were signed by `Qloxz`; exact-byte repository promotion is authorized |

The Figma file is the editable visual evidence surface. The committed UI-SPEC remains normative because the current Plugin API cannot author or verify a native spec revision. The owner signed the already validated revision locator above; no post-signature Figma mutation is implied.

## Starter Plan Layout Variance

Figma Starter rejected the requested nine pages with a hard three-page limit. The same authority structure is preserved without merging CURRENT and PROPOSED:

| Page | Contained authority areas |
|---|---|
| `00 CURRENT BASELINE` | Sections `00 Evidence`, `01 Foundations CURRENT`, `02 Desktop CURRENT`, `03 Applications CURRENT`, `04 Editor CURRENT`, `05 Promotion CURRENT`, `06 Motion CURRENT` |
| `01 PROPOSED` | Typography hierarchy, three-mode motion and deterministic-evidence proposals; visibly marked **NOT APPROVED** |
| `02 APPROVED FOR BASELINE` | Empty; zero child nodes at post-build validation |

This is the closest lossless representation available on Starter. Creating nine top-level pages requires a Figma plan upgrade.

## Validation Record

- CURRENT contains 58 editable `Evidence/Card` instances: 23 captured candidates and 35 explicit BLOCKED states.
- CURRENT and PROPOSED contain no image-filled node or flattened full-UI screenshot.
- Text uses only the product families `IBM Plex Mono` and `Golos Text`.
- The representative CURRENT composition and the complete PROPOSED composition were visually inspected after layout correction.
- All 35 BLOCKED status labels use the dedicated amber semantic token; CAPTURED remains green.
- `02 APPROVED FOR BASELINE` was read back with `childCount: 0`.
- The Starter MCP tool-call quota was reached only after the validated file state had been written; no later Figma mutation was attempted.

## Privacy and Portability Rules

- No local filesystem path, localhost URL, cookie, credential, employee row, nickname, reviewer note, private question or answer key is stored in Figma.
- CURRENT cards reference exact candidate hashes from `15-VISUAL-CANDIDATES.md`; candidate PNGs remain repository evidence and are not embedded as flattened deliverables.
- PROPOSED remains visibly separate from CURRENT.
- `02 APPROVED FOR BASELINE` was empty in the signed Figma revision. Named per-hash authority is recorded in `15-VISUAL-APPROVAL.md`; the page was not mutated after validation or after the Starter MCP quota was exhausted.
