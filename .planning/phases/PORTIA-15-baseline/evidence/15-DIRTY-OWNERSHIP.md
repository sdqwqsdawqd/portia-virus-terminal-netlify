# Phase 15 Dirty Ownership Ledger

**Status:** OWNER DECISION RECORDED  
**Inventory source:** `15-CURRENT-STATE-LEDGER.md` snapshot `2219470e563f86a2ed8a47f5e427e339589fe598254514844bd50bc74028e367`  
**Immutable source commit:** `dc02013ae6dec3996a4548138fc9e15218912ccd`

This table records the repository owner's explicit Task 3 disposition. Only the exact Motion dependency experiment in `package.json` and `package-lock.json` is authorized for agent removal; every other classified path remains preserved and withheld from Phase 15.

| Path / group | Status | Hash / blob evidence | First seen | Likely origin | Proposed owner | Disposition | Phase 15 touch | Recovery artifact | Blocker |
|---|---|---|---|---|---|---|---|---|---|
<!-- inventory-key: .planning/HANDOFF.json -->
| `.planning/HANDOFF.json` | tracked deletion | HEAD blob `42e0351d9c49767181fab87b826dbcbee7578783` | forensics report `2026-10-29T19:23:09+05:00`; recaptured 2026-10-30 | stale Phase 13/14 handoff cleanup | repository owner — confirmed | KEEP | WITHHOLD | `git show dc02013ae6dec3996a4548138fc9e15218912ccd:.planning/HANDOFF.json` | Preserve the deletion exactly as found; Phase 15 must not restore or commit it. |
<!-- inventory-key: .planning/milestone.lock -->
| `.planning/milestone.lock` | tracked modification | HEAD blob `8447e70586a15fe11d4d0b2a9a70577e5098d484`; worktree SHA-256 `e8be2a252e09a22e730c02e0edf2253a266d16d89c5f81e0c0f049f40075f578` | forensics report `2026-10-29T19:23:09+05:00`; recaptured 2026-10-30 | prior GSD session/lock lifecycle | repository owner / GSD session owner — confirmed | KEEP | WITHHOLD | HEAD blob plus captured worktree SHA in current-state ledger | Preserve the lock exactly as found; Phase 15 must not overwrite or commit it. |
<!-- inventory-key: package-lock.json -->
| `package-lock.json` | tracked modification | HEAD blob `9d79bbdb6c44625b7f3b6ed8ddd7214fea333730`; worktree SHA-256 `35e357099ca2d28bea1127bf83c9a9fdddd9719629df68a9ea0d3069b9db846e` | forensics report `2026-10-29T19:23:09+05:00`; recaptured 2026-10-30 | uncommitted Motion/Framer Motion dependency experiment | repository owner / prior animation work owner — confirmed | DISCARD-BY-OWNER (agent removal authorized) | ALLOW after exact Motion-only removal | HEAD blob plus captured worktree SHA; companion `package.json` row | Remove only the captured Motion dependency blocks before Playwright package work. |
<!-- inventory-key: package.json -->
| `package.json` | tracked modification | HEAD blob `ba33044b4de33e903a07baa423764e990de2451e`; worktree SHA-256 `13b457d5e0ae23a4ad8d50d0fd081c74b57d219a583b19427b9325dc57f01038` | forensics report `2026-10-29T19:23:09+05:00`; recaptured 2026-10-30 | uncommitted `motion@^14.6.0` dependency experiment | repository owner / prior animation work owner — confirmed | DISCARD-BY-OWNER (agent removal authorized) | ALLOW after exact Motion-only removal | HEAD blob plus captured worktree SHA; companion lockfile row | Remove only `motion@^14.6.0`; later Phase 15 package work is allowed. |
<!-- inventory-key: .planning/forensics/ -->
| `.planning/forensics/` | untracked group (1 file) | `report-20261029-192309.md` SHA-256 `ba13da6d8de1baacee70e9c3d4b146d7bcea6bf84cde9bbe0b529ef9b83baf41` | 2026-10-29 report timestamp; recaptured 2026-10-30 | requested repository forensics evidence | repository owner — confirmed | KEEP | WITHHOLD | original untracked file plus current-state hash | Preserve as external evidence; Phase 15 must not claim or commit it. |
<!-- inventory-key: .planning/milestones/v1.2-incomplete-research/ -->
| `.planning/milestones/v1.2-incomplete-research/` | untracked group (5 files) | SHA-256 values: `136bb475…4914`, `5eef3551…40f0`, `bdceab98…76d`, `8e5e438f…d308`, `f9d5158c…dd3d` (full values in current-state ledger) | v1.2 archive work; recaptured 2026-10-30 | incomplete-milestone research archive | repository owner / v1.2 archive owner — confirmed | KEEP | WITHHOLD | five original files with full per-file SHA-256 in current-state ledger | Preserve for separate archive handling; Phase 15 must not claim or commit it. |
<!-- inventory-key: .planning/quick/261028-c9g-portia-promotion-1-8/ -->
| `.planning/quick/261028-c9g-portia-promotion-1-8/` | untracked group (1 file) | `261028-c9g-PLAN.md` SHA-256 `8ca96780d5a8ad713c30cd6a92a145f1c2f5cf05339774f9ee5ae9ca96bacc49` | quick-plan date 2026-10-28; recaptured 2026-10-30 | prior Promotion 1.8 quick plan | repository owner / Promotion work owner — confirmed | KEEP | WITHHOLD | original untracked plan plus current-state hash | Preserve for separate Promotion history; Phase 15 must not claim or commit it. |
<!-- inventory-key: .planning/ui-reviews/ -->
| `.planning/ui-reviews/` | untracked group (1 file) | `.gitignore` SHA-256 `261b4df156d6b62d4e5c2c62ce80a50a419873953033e79b1269c63eefd88f21` | prior UI-review setup; recaptured 2026-10-30 | unfinished UI-review workspace | repository owner / UI review owner — confirmed | KEEP | WITHHOLD | original untracked file plus current-state hash | Preserve for separate UI-review handling; Phase 15 must not absorb it. |

## Owner Decision Record

- Recorded at: `2026-10-30T10:50:22.7211383+05:00`.
- Proposal presented: remove only the captured uncommitted `motion@14.6.0` experiment from `package.json` and `package-lock.json`; preserve every other classified dirty path and withhold it from Phase 15; allow later Playwright package work.
- Owner response, verbatim: `разрешаю`.
- Authorized agent action: remove exactly the captured Motion-only additions from the two package files. No reset, checkout, stash, clean, or alteration of any other classified path is authorized.

## Owner Decision Vocabulary

- `KEEP`: preserve the current worktree state; still requires an explicit touch permission.
- `COMMIT-SEPARATELY`: owner authorizes a separate, scope-specific commit before Phase 15 touches related files.
- `DISCARD-BY-OWNER`: owner will remove the change or separately authorize that destructive action; Phase 15 does not perform it from this table alone.
- `DEFER`: preserve and withhold the path; dependent Phase 15 work remains blocked.
- `ALLOW` / `WITHHOLD`: independent Phase 15 touch permission recorded after the disposition.

## Coverage

The eight `inventory-key` markers cover all 12 dirty files from the immutable current-state ledger: four tracked paths and four untracked groups containing eight files. The capture script verifies zero missing, duplicate or unexpected ownership keys.
