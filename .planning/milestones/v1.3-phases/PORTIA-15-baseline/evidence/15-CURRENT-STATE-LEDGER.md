# Phase 15 Current-State Ledger

**Status:** CAPTURED  
**Schema:** `portia-phase15-current-state-v1`  
**Snapshot SHA-256:** `2219470e563f86a2ed8a47f5e427e339589fe598254514844bd50bc74028e367`  
**Source commit:** `dc02013ae6dec3996a4548138fc9e15218912ccd`  
**Source commit time:** 2026-10-30T10:44:04+05:00

## Git Identity

| Field | Value |
|---|---|
| Branch | `design/stage-1-desktop` |
| Upstream | `origin/design/stage-1-desktop` |
| Behind / ahead | `0	178` |

## Stable Dirty Inventory

| Path | State | HEAD blob | Worktree SHA-256 | Bytes |
|---|---|---|---|---:|
| `.planning/forensics/report-20261029-192309.md` | untracked | — | ba13da6d8de1baacee70e9c3d4b146d7bcea6bf84cde9bbe0b529ef9b83baf41 | 8816 |
| `.planning/HANDOFF.json` | modified+deleted | 42e0351d9c49767181fab87b826dbcbee7578783 | — | — |
| `.planning/milestone.lock` | modified | 8447e70586a15fe11d4d0b2a9a70577e5098d484 | e8be2a252e09a22e730c02e0edf2253a266d16d89c5f81e0c0f049f40075f578 | 150 |
| `.planning/milestones/v1.2-incomplete-research/ARCHITECTURE.md` | untracked | — | 136bb47563e46181af910197e058276d7b17d2595b05697fe6c81d3528244914 | 5518 |
| `.planning/milestones/v1.2-incomplete-research/FEATURES.md` | untracked | — | 5eef3551687c6970abcfefbfcf27e9b4d8e73f39f5e7d64547678f3850fb40f0 | 5904 |
| `.planning/milestones/v1.2-incomplete-research/PITFALLS.md` | untracked | — | bdceab98274fdb49e9d1114174af389f1fb59f7bd88a4cc7c0db1dbd23ecd76d | 5816 |
| `.planning/milestones/v1.2-incomplete-research/STACK.md` | untracked | — | 8e5e438fcc3fbaaf4ed4c81d00f3d2e2b4af0daacc2b2283a3c39ca7dd5d308b | 4023 |
| `.planning/milestones/v1.2-incomplete-research/SUMMARY.md` | untracked | — | f9d5158c42443515c8c956ccfc120252f62c155e1305d707a9ad688f8771dd3d | 3429 |
| `.planning/quick/261028-c9g-portia-promotion-1-8/261028-c9g-PLAN.md` | untracked | — | 8ca96780d5a8ad713c30cd6a92a145f1c2f5cf05339774f9ee5ae9ca96bacc49 | 21675 |
| `.planning/ui-reviews/.gitignore` | untracked | — | 261b4df156d6b62d4e5c2c62ce80a50a419873953033e79b1269c63eefd88f21 | 95 |
| `package-lock.json` | modified | 9d79bbdb6c44625b7f3b6ed8ddd7214fea333730 | 35e357099ca2d28bea1127bf83c9a9fdddd9719629df68a9ea0d3069b9db846e | 240567 |
| `package.json` | modified | ba33044b4de33e903a07baa423764e990de2451e | 13b457d5e0ae23a4ad8d50d0fd081c74b57d219a583b19427b9325dc57f01038 | 1046 |

## Porcelain v2

```text
# branch.oid dc02013ae6dec3996a4548138fc9e15218912ccd
# branch.head design/stage-1-desktop
# branch.upstream origin/design/stage-1-desktop
# branch.ab +178 -0
1 .D N... 100644 100644 000000 42e0351d9c49767181fab87b826dbcbee7578783 42e0351d9c49767181fab87b826dbcbee7578783 .planning/HANDOFF.json
1 .M N... 100644 100644 100644 8447e70586a15fe11d4d0b2a9a70577e5098d484 8447e70586a15fe11d4d0b2a9a70577e5098d484 .planning/milestone.lock
1 .M N... 100644 100644 100644 9d79bbdb6c44625b7f3b6ed8ddd7214fea333730 9d79bbdb6c44625b7f3b6ed8ddd7214fea333730 package-lock.json
1 .M N... 100644 100644 100644 ba33044b4de33e903a07baa423764e990de2451e ba33044b4de33e903a07baa423764e990de2451e package.json
? .planning/forensics/report-20261029-192309.md
? .planning/milestones/v1.2-incomplete-research/ARCHITECTURE.md
? .planning/milestones/v1.2-incomplete-research/FEATURES.md
? .planning/milestones/v1.2-incomplete-research/PITFALLS.md
? .planning/milestones/v1.2-incomplete-research/STACK.md
? .planning/milestones/v1.2-incomplete-research/SUMMARY.md
? .planning/quick/261028-c9g-portia-promotion-1-8/261028-c9g-PLAN.md
? .planning/ui-reviews/.gitignore
```

## Tracked Diff Metadata

Unstaged `git diff --numstat`:

```text
0	36	.planning/HANDOFF.json
4	4	.planning/milestone.lock
61	0	package-lock.json
1	0	package.json
```

Staged `git diff --cached --numstat`:

```text
# none
```

Binary paths: none.

## Capture Boundary

The inventory excludes only Phase 15 generated evidence/script paths and GSD-owned tracking files: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json`. This prevents the capture process itself from changing the snapshot. No reset, checkout, clean, stash, move or delete command is used.
