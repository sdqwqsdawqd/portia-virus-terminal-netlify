---
phase: PORTIA-09-tselostnost-kontenta
reviewed: 2026-10-25T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - app/api/content/route.ts
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - components/portia-wallpaper-spider.tsx
  - components/portia-wallpaper.tsx
  - lib/broadcasts.test.ts
  - lib/broadcasts.ts
  - lib/content-limits.test.ts
  - lib/content-limits.ts
  - lib/content-sync.test.ts
  - lib/content-sync.ts
  - lib/editor-changes.test.ts
  - lib/editor-changes.ts
  - lib/editor-items.test.ts
  - lib/editor-items.ts
  - lib/portia-content-normalize.test.ts
  - lib/portia-content-normalize.ts
  - lib/wallpaper-web.test.ts
  - lib/wallpaper-web.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-25
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the phase diff (9c9e784..HEAD) for the 20 files. `npm test` passes (284/284) and `tsc --noEmit` is clean. The content-integrity work (normalizer no longer cutting, byte-based 413 guard, strict `>` revision check, category-change reveal, bin deletion cleanup) is coherent and I found no data-loss or security defect in it. The one real defect is in the new wave simulation for the spider wallpaper: pulses can sustain themselves forever, which silently disables the footfall waves after enough walking. The remaining items are robustness and cleanliness issues.

## Critical Issues

### CR-01: Wave pulses on the web never die out, so the 8-slot pool can fill with invisible pulses and stop new footfall waves

**File:** `lib/wallpaper-web.ts:228-240` (consumer: `components/portia-wallpaper-spider.tsx:123-128`)
**Issue:** `stepPulses` makes a pulse that reaches a crossing spawn children at half strength with a fresh `born = now`, and there is no floor on `peak`. A child lives 1.2 s from its own birth and reaches the next crossing in under 1.2 s on almost every thread (pulse speed 260 u/s, most threads are under 300 units long). So a lineage re-seeds itself generation after generation, with peak halving each time and never reaching zero. The existing test "a pulse dies by 1.2 s" only checks the first-generation slot, so it does not catch this.

I ran the module directly. One pair of pulses emitted at the middle of a thread, no further input:
- Of 174 sampled threads, 3 (about 2%) were still alive after 60 simulated seconds (edges 324, 360, 402). Their peaks had fallen to about 1e-28, so they are invisible, and the pool held 3 to 8 live slots.
- A pair emitted on edge 500 still had live slots after 120 simulated seconds, with the weakest peak near 1e-56.

While a lineage like this lives, `emitPulse` returns `false` whenever the pool is full. Each footfall (every 0.35 s while walking) is then silently dropped, and `stepPulses` plus `pulseShape` keep running for those invisible pulses on every frame. Each walk emits many footfalls on many threads, so sooner or later one lands on a sustaining loop and the waves go quiet for the rest of the session. This breaks the stated D-05 contract that waves fade and the pool has a ceiling.

**Fix:** Stop spawning once a pulse is too faint to see, for example in `stepPulses`:
```ts
const MIN_PEAK = 0.04; // below this a pulse is invisible; do not pass it on
...
pulse.spawned = true;
if (pulse.peak / 2 < MIN_PEAK) continue;
emitAtCrossing(pool, pulse.dir === 1 ? thread.b : thread.a, pulse.peak / 2, now, pulse.edge);
```
Add a test that emits a pair on every edge (or on edges 324, 360, 402 and 500), steps 10 s, and asserts that no slot is alive.

## Warnings

### WR-01: Normalizer's id guarantees are incomplete (duplicate ids, scientist log ids, recycle file ids)

**File:** `lib/portia-content-normalize.ts:97-116, 126-135, 20-40, 240-250`
**Issue:** `claimIds` / `deriveIds` fill blank ids for broadcasts and viruses only. The code and its comments present this as the single place that makes ids stable and usable as keys (D-21), but:
- Two items with the same real id (for example a hand-edited or imported payload) pass through unchanged. `updateById` then edits only the first, `removeBroadcast` removes both, the React `key` collides, and both items share one `formattedText` entry.
- Scientist logs get `id: textOf(log.id)`, which stays `""` when blank. The editor uses `formatKey={`scientist:${log.id}`}`, so every blank-id log of a virus shares one formatting entry.
- `normalizeRecycleFiles` accepts `id: ""` (any string) and builds the `file:` key and `recycle:` formatting key from it.

**Fix:** In `claimIds` / `deriveIds`, treat a repeated real id as blank (derive a new one for the second occurrence). Run scientist logs through `deriveIds(logs, "log", new Set())`. In `normalizeRecycleFiles`, derive ids for blank file ids the same way. Add one test for each.

### WR-02: Derived ids are not "position only", which contradicts the comment and weakens the stability claim

**File:** `lib/portia-content-normalize.ts:101-114` (test: `lib/portia-content-normalize.test.ts`, "a broadcast with a missing or blank id gets a stable position id")
**Issue:** The comment says the derived id "depends on position only". It does not: `deriveIds` skips any candidate already in `taken`, and `taken` holds every real id from every item. The test itself shows `["broadcast-0-2", "broadcast-1", "broadcast-0"]`, where the first item gets `-2` only because a later sibling owns `broadcast-0`. Changing, deleting or reordering any sibling can therefore change a derived id between two polls. The formatted text saved under the old derived id is then orphaned.
**Fix:** Either correct the comment to say the id is stable only while the other items' ids are unchanged, or reserve the derived namespace by always using a suffix that real ids cannot take (for example `broadcast-0~`).

## Info

### IN-01: `!today` guards in `portia-desktop.tsx` are now dead code

**File:** `components/portia-desktop.tsx:530, 535`
**Issue:** `today` is now initialised with `localDateKey(new Date())`, so it is never an empty string. The `questsViewed && today` and `!today` checks can no longer be false. They hide the fact that the first render now always has a date.
**Fix:** Remove the `today` conditions from both guards.

### IN-02: The request body is fully read before the size limit is applied

**File:** `app/api/content/route.ts:44-46`
**Issue:** `request.text()` buffers the whole body and only then calls `utf8Bytes(raw)`. The route is behind the editor-access check and the platform enforces its own limit, so exposure is small. A cheap early reject would still avoid buffering and encoding multi-megabyte bodies.
**Fix:** Before `request.text()`, add `if (Number(request.headers.get("content-length")) > MAX_CONTENT_BODY_BYTES) return Response.json({ error: "Данные слишком большие." }, { status: 413 });` and keep the byte check as the authoritative one.

### IN-03: Error colour is hardcoded and duplicated; `contentBodyBytes` comment overstates the bound

**File:** `app/portia.css` (`.editor-savebar-fix`, `.editor-field-error`, both use `#e07d74`); `lib/content-limits.ts:70-73`
**Issue:** The same literal colour is repeated in two new rules while neighbouring rules use `var(--danger)` / `var(--warning)`. Separately, the comment on `contentBodyBytes` calls it an upper bound of what `saveContent` sends, but `save()` in the editor adds `formattedText` entries for the idle and activity phrases (and trims lists) after the check. A draft within a few hundred bytes of 5,000,000 can pass the editor guard and still get a 413.
**Fix:** Use a CSS variable for the colour. Soften the comment, or leave a small margin in the editor check (for example compare against `MAX_CONTENT_BODY_BYTES - 1024`).

---

_Reviewed: 2026-10-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
