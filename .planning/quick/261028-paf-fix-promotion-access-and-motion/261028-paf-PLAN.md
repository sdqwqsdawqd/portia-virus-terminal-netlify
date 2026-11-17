---
quick_id: 261028-paf
description: Исправить недоступность «Повышения», тексты Roblox-ника и названия, анимации фонового паука и ярлыка «Повышение»
date: 2026-10-28
status: planned
---

# Quick Task 261028-paf Plan

## Task 1: Restore the participant promotion lookup and clarify entry copy

**Files:** promotion API/server helpers, `components/portia-promotion.tsx`, related tests

**Action:** Reproduce the generic temporary-unavailable response, fix its actual server-side cause without weakening roster or database checks, rename `КАДРОВЫЙ КОНТУР` to `ПОВЫШЕНИЕ`, and replace the fictional `Portia_User` example with explicit wording that asks for the Roblox nickname recorded in the table.

**Verify:** Focused promotion API and UI tests, then a local HTTP request reaches a specific safe result instead of the generic availability error.

**Done:** A valid lookup reaches the normal result path and entry copy uses the requested terminology.

## Task 2: Refine the wallpaper spider and Promotion shortcut motion

**Files:** `components/portia-wallpaper-spider.tsx`, `components/portia-desktop.tsx`, `app/portia.css`, animation tests

**Action:** Replace the disliked mechanical background-spider movement with calmer, less distracting motion that still follows the web and obeys both animation and spider settings. Make the Promotion shortcut animation quicker, clearer and more energetic while staying subtle and respecting reduced motion.

**Verify:** Animation contract tests, scoped lint, typecheck and visual inspection in the local application.

**Done:** Both motions feel intentional, remain independently controllable, and introduce no layout or accessibility regression.

## Task 3: Full regression and GSD closeout

**Files:** test artifacts, quick summary, `.planning/STATE.md`

**Action:** Run the full test/type/build checks, record known unrelated lint debt separately, create the quick summary and append the completed quick task to project state.

**Verify:** All Phase 14 and animation tests pass; production build succeeds.

**Done:** Code and documentation are committed atomically with no unrelated working-tree files staged.
