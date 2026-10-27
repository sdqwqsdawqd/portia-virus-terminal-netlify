---
phase: PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh
reviewed: 2026-10-19T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - lib/broadcasts.ts
  - lib/broadcasts.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-10-19
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the diff `ff4ea79..HEAD` for `lib/broadcasts.ts` and `lib/broadcasts.test.ts`. `markQuestsSeen` no longer prunes by the tab's list and now caps the result at `SEEN_QUEST_LIMIT = 200`, dropping the oldest non-active ids first. I traced the new logic by hand and by running `node --test lib/broadcasts.test.ts` (16/16 pass).

Logic check:
- `all` is deduped with insertion order preserved (stored first, new active ids last).
- `drop = all.length - 200`. The filter keeps every active id. For non-active ids it drops the first `drop` of them in order and keeps the rest. The result is exactly 200 whenever enough non-active ids exist.
- A negative `drop` keeps everything. If active ids exceed 200, every non-active id is dropped and the result is allowed to exceed the cap. This is documented by the `shortcut:` comment.
- No off-by-one: `drop-- <= 0` evaluates before the decrement, so with `drop = 0` the id is kept.

Callers: the only production callers are in `components/portia-desktop.tsx`, lines 512 (`rememberActiveQuests`) and 826 (the dismissal path, via `rememberActiveQuests`). The only storage writer is line 513.
- Both callers already pass `storage ∪ ref`, so the removal of list-based pruning is consistent with them. A stale tab can no longer erase an id seen elsewhere.
- The union order (stored first, then ref-only ids) treats ref-only ids as newest. That is acceptable for the "oldest first" eviction.
- Behavior change: ids of deleted quests now stay in storage until evicted by the cap. This is harmless, because `questPopup` only consults ids of currently active quests.

No bugs or security issues found. Two robustness/maintainability warnings and two info items follow.

## Warnings

### WR-01: Cap is silently exceeded with no test and no guard for the over-limit case

**File:** `lib/broadcasts.ts:60-67`, `lib/broadcasts.test.ts:121-128`
**Issue:** When active quests exceed `SEEN_QUEST_LIMIT`, the function returns more than 200 ids. The `shortcut:` comment documents this, but no test pins the behavior. The new cap test covers only the 250-stored-ids case and the 199 boundary. It never covers the "all non-active ids are dropped, result > cap" branch (`drop` stays positive after the loop), or the exact boundaries 200 and 201. A future refactor (for example to `slice(-LIMIT)`) could change the documented contract unnoticed. An editor publishing many quests would also persist an unbounded list in a visitor's `localStorage`.
**Fix:** Add a test for the over-cap branch and the exact boundaries:
```ts
test("markQuestsSeen never drops an active quest even past the cap", () => {
  const many = Array.from({ length: 205 }, (_, i) => item(`q${i}`, "quest"));
  const marked = markQuestsSeen(many, ["old"], TODAY);
  assert.equal(marked.length, 205);
  assert.ok(!marked.includes("old"));
  assert.equal(markQuestsSeen([], Array.from({ length: 200 }, (_, i) => `o${i}`), TODAY).length, 200);
  assert.equal(markQuestsSeen([], Array.from({ length: 201 }, (_, i) => `o${i}`), TODAY)[0], "o1");
});
```

### WR-02: Side-effecting predicate inside `Array.prototype.filter`

**File:** `lib/broadcasts.ts:66`
**Issue:** `all.filter((id) => active.has(id) || drop-- <= 0)` mutates the outer `let drop` from inside the predicate, and the short-circuit on `active.has(id)` is what keeps the counter correct. It works only because `filter` runs sequentially and in order. It is easy to misread, and a harmless-looking reorder of the operands (`drop-- <= 0 || active.has(id)`) would decrement `drop` for active ids and silently over-evict non-active ones.
**Fix:** Use an explicit, non-mutating form:
```ts
const evictable = all.filter((id) => !active.has(id));
const evicted = new Set(evictable.slice(0, Math.max(0, all.length - SEEN_QUEST_LIMIT)));
return all.filter((id) => !evicted.has(id));
```

## Info

### IN-01: Stale test title

**File:** `lib/broadcasts.test.ts:108`
**Issue:** The test is titled "marking seen against a list keeps every stored id that is still in it". After this change, ids are kept whether or not they are in the list, so the title (and the previous list-based semantics it implies) is misleading. The sibling test at line 101 was renamed but this one was not.
**Fix:** Rename it to "marking seen keeps every stored id, in order, and appends new active ids".

### IN-02: `parseSeenQuestIds` is uncapped, so the cap applies only on write

**File:** `lib/broadcasts.ts:37-45`
**Issue:** The stored array is visitor-editable. An oversized array is read unchanged by the toast effect (`portia-desktop.tsx:526-532`, which runs `questPopup`'s `seen.includes` per active quest). It is trimmed only on the next `rememberActiveQuests` write. This is not a correctness issue, because the next write trims it. The `SEEN_QUEST_LIMIT` invariant is not enforced at the read boundary, though.
**Fix:** Optional. Apply `.slice(-SEEN_QUEST_LIMIT)` in `parseSeenQuestIds` if the cap should hold at the trust boundary. Move the constant above that function first.

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
