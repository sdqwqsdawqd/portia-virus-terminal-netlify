---
gsd_state_version: "1.0"
milestone: v1.1
milestone_name: Закрытие замечаний
status: planning
last_updated: "2026-10-19T09:34:18.718Z"
last_activity: 2026-10-19
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** Участник сразу находит нужную запись; редактор правит её без потерь — в цельной «PORTIA OS».
**Current focus:** Planning next milestone

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-10-19 — Milestone v1.1 started

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
- [Phase 01]: IBM Plex Serif loaded with weights 400/600/700, no italic: editor offers weight 400/600/800 and the family tops out at 700
- [Phase PORTIA-01]: Handle column 34px in recommendation and record rows; anchor portrait gets its own overflow/background rule
- [Phase 01]: 01-03: darkreader-lock meta uses content "true" (Next 16 drops empty-content metas)
- [Phase PORTIA-01]: 01-04: editor field font follows its site area via typed area prop + shared CSS rule per area; --assistant-font token; preview toggle no longer sets font
- [Phase 02]: 02-06: gel-a / cells-b rejected on the real desktop and redrawn in the web/DNA wallpaper language; badges extended to all seven classification lines; restore from the trash stays in the editor and no longer uses confirm() — User feedback at the 02-06 checkpoint; confirm() is answered 'no' without a dialog in embedded browsers
- [Phase 03]: 03-01: ConfirmDialog is a native dialog opened with showModal() (top layer), default focus forced onto the safe button
- [Phase 03]: 03-01: edit history ends at a successful save; edits typed during the save request keep draft and history
- [Phase PORTIA-03]: 03-02: shortcut effect reads save/step through a ref (actionsRef); СОХРАНИТЬ in the close dialog closes only when save() resolved true
- [Phase 03]: 03-03: phone format panel hides the keyboard by blurring the field and paints the stored selection with the CSS Custom Highlight API (no inputmode toggle); highlight rebuilt on document change
- [Phase 03]: 03-04: dossier tab state lives per editor (live in PortiaEditor, bin in ArchivedVirusEditor); live tab switch closes the format panel
- [Phase 03]: 03-04: one drag is one undo step via drag:<id> editKeyFor key; autoscroll runs a rAF loop only while a handle is held
- [Phase PORTIA-03.2]: 03.2-01: new ratings are nullable 1-10 («—» until rated); reads use select * and writes retry without rating columns on PGRST204/42703 until the migration. SQL recorded in portia_setup.sql, not applied.
- [Phase PORTIA-03.2]: 03.2-02: unsaved employee drafts are guarded with ConfirmDialog (save / discard / cancel) on employee switch, tab switch and ×; the employee question comes before the content close dialog
- [Phase PORTIA-03.2]: 03.2-03: tasks live under «Квесты»; important news are pinned first and enlarged
- [Phase PORTIA-03.2]: 03.2-03: normalizeBroadcasts runs in normalizePortiaContent and on the desktop's fetched/cached content
- [Phase PORTIA-03.2]: 03.2-04: quest dates are inclusive local YYYY-MM-DD; undated quests count as active
- [Phase PORTIA-03.2]: 03.2-04: conditions are plain text (formatting is phase 5)
- [Phase PORTIA-03.2]: 03.2-05: one window at a time shows the first unseen active quest; closing it marks all active quests seen
- [Phase PORTIA-03.2]: 03.2-05: no popup over the boot screen, while the editor is open, or when storage is unreadable
- [Phase PORTIA-03.2]: 03.2-07: the new-quest notice is a non-modal corner toast (owner UAT), replacing the 03.2-05 modal window
- [Phase PORTIA-03.2]: 03.2-07: the toast also shows while the editor is open and is recomputed on every content change (supersedes the 03.2-05 rule about the open editor)
- [Phase PORTIA-03.2]: 03.2-07: content sync is a 10 s visibility-aware poll of the CDN copy, not Realtime
- [Phase 03.2]: 03.2-08: the editor «Сводка» tab shows one category at a time (Новости / Квесты, tasks under Квесты), add button on top, new items blank and first
- [Phase 03.2]: 03.2-08: switching categories or adding an item closes the format panel
- [Phase PORTIA-03.3]: 03.3-01: manual employees live in public.portia_manual_employees keyed by roblox-<userId>; the sheet wins on the same account
- [Phase PORTIA-03.3]: 03.3-01: removing a manual employee keeps the profile row; title/rank/callsign change by remove and re-add
- [Phase PORTIA-03.3]: 03.3-01: SQL recorded in supabase/portia_setup.sql, not applied; production apply is 03.3-04 behind the owner gate
- [Phase PORTIA-03.3]: 03.3-02: guides are InfoSection.subsections[].blocks[] (text | table | photo | video) in the content payload, normalized by normalizeInfoSections on save, read and the desktop's cached copies
- [Phase PORTIA-03.3]: 03.3-02: OrderDragHandle only swaps rows that share a parent
- [Phase PORTIA-03.3]: 03.3-03: YouTube blocks store only the 11-character id and render through youtube-nocookie.com with the default referrer policy; photo blocks reuse uploadImage with placement guide
- [Phase PORTIA-05]: 05-01: style helpers live in lib/rich-text-style.ts with explicit ranges; an empty range is a no-op (D-04)
- [Phase PORTIA-05]: 05-01: row styles toggle by removing only their own keys (D-02)
- [Phase PORTIA-05]: 05-01: Основной removes the colour property (D-18)
- [Phase PORTIA-05]: 05-01: Жирный is not in the style row (owner amendment to D-01); weight is changed only by the manual weight buttons, which act on the resolved range
- [Phase PORTIA-05]: 05-02: a missing or untouched collapsed selection never replaces the stored one (nextFieldSelection, D-05)
- [Phase PORTIA-05]: 05-02: phone panel tabs Цвет / Размер (size + weight) / Фон (background, opacity, preview surface) (D-12)
- [Phase PORTIA-05]: 05-03: field ink and surface are per area on the area's native surface via --field-ink/--field-bg; lib/editor-field-look.test.ts keeps them equal to the site (D-09, D-17)
- [Phase PORTIA-05]: 05-03: preview surface defaults to each field's own area (nativeSurface), not the editor tab
- [Phase PORTIA-05]: 05-04: the PC format panel position is { right, bottom } from the editor window's bottom-right in localStorage portia-format-panel-v1, clamped below the title bar and above the save bar (D-10, D-11)
- [Phase PORTIA-05]: 05-05: windows open and close with opacity + scale .97 around their centre; the icon zoom is removed (D-14)
- [Phase PORTIA-05]: 05-06: a field's selection follows own input (pointerdown or keydown until 400 ms after release, closed on blur); a reading never ends it (fieldSelectionStep, CR-01)
- [Phase PORTIA-05]: 05-06: an unknown selection is null and disables the panel controls (WR-03)
- [Phase PORTIA-05]: 05-06: panel taps prevent the mousedown default too; the portia-format highlight paints at every width (WR-04)

### Pending Todos

None — незакоммиченная работа закоммичена в Phase 1 (ecaf6a4).

### Blockers/Concerns

- ✅ [Phase 1] (закрыто в 05-03) `.assistant-bubble > span` перекрывает корень текста помощника (межбуквенный интервал/интерлиньяж пузыря чуть отличаются от поля редактора) — поле помощника теперь берёт интервал и интерлиньяж пузыря (lib/editor-field-look.test.ts).
- ⚠️ [Phase 1] Пресеты размера панели оформления (13/17/22/30) не совпадают с базовыми размерами большинства областей — фаза 5 (TEXT-01).
- ⚠️ [Project] Проект лежит только во временной папке сессии Claude — перенести в постоянную папку.
- ⚠️ [Phase 03.2] WR-01: опрос контента раз в 10 с подменяет content одинаковой копией и сбрасывает историю отмены в чистом редакторе (`components/portia-desktop.tsx` ~358-366) — см. 03.2-REVIEW.
- ⚠️ [Phase 03.2] WR-02/03/04 сохранения сотрудников: устаревший кэш может очистить оценки, правки во время сохранения теряются, все шесть оценок пишутся каждый раз — см. 03.2-REVIEW.
- ⚠️ [Phase 03.1] Ревью 03.1-REVIEW (22 открыто): WR-01 неполный список сотрудников затирает биографии и оценки; WR-02 PATCH без biography/photoUrl стирает их; WR-07 normalizePortiaContent молча обрезает текст и пропускает нестроковые поля; WR-11 SQL доверяет неподтверждённой почте — см. 03.1-REVIEW-DISPOSITION.

## Deferred Items

| Category | Item | Status | Acknowledged at |
|----------|------|--------|-----------------|
| debug_sessions | editor-field-font-wysiwyg | diagnosed | v1.0 close (2026-10-19) |
| uat_gaps | PORTIA-05-oformlenie-teksta / 05-UAT.md | diagnosed, 0 pending | v1.0 close (2026-10-19) |

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: owner and external review bugs after phase 3 (URGENT)
- Phase 03.2 inserted after Phase 03.1: employee ratings and Svodka redesign
- Phase 03.3 inserted after Phase 3: Сотрудники вне таблицы (по нику Roblox, своё фото, удаляемые) и подкатегории с фото/YouTube в «Информации» (URGENT)

## Session Continuity

Last session: 2026-10-19T08:10:08.321Z
Stopped at: Phase PORTIA-05 complete — all phases complete
Resume file: None

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 5 min | 3 tasks | 3 files |
| Phase PORTIA-01 P02 | 7 min | 3 tasks | 3 files |
| Phase 01 P03 | 6min | 1 tasks | 1 files |
| Phase PORTIA-01 P04 | 15min | 3 tasks | 2 files |
| Phase PORTIA-02 P01 | 58 min | 3 tasks | 4 files |
| Phase PORTIA-02 P02 | 25 min | 2 tasks | 1 files |
| Phase PORTIA-02 P03 | 70 min | 2 tasks | 2 files |
| Phase PORTIA-02 P04 | 4 h | 4 tasks | 5 files |
| Phase PORTIA-02 P05 | 40 min | 3 tasks | 2 files |
| Phase 02 P06 | 90 min | 3 tasks | 5 files |
| Phase 03 P01 | 15 min | 3 tasks | 6 files |
| Phase PORTIA-03 P02 | 5 min | 2 tasks | 4 files |
| Phase 03 P03 | 21 min | 3 tasks | 2 files |
| Phase 03 P04 | 25min | 2 tasks | 4 files |
| Phase PORTIA-03.2 P03.2-01 | 25min | 3 tasks | 7 files |
| Phase PORTIA-03.2 P02 | 20min | 2 tasks | 3 files |
| Phase PORTIA-03.2 P03 | 15min | 2 tasks | 9 files |
| Phase PORTIA-03.2 P04 | 25min | 2 tasks | 9 files |
| Phase PORTIA-03.2 P05 | 20min | 2 tasks | 4 files |
| Phase PORTIA-03.2 P07 | 20min | 2 tasks | 3 files |
| Phase 03.2 P08 | 15min | 2 tasks | 4 files |
| Phase PORTIA-03.3 P01 | 35min | 3 tasks | 7 files |
| Phase PORTIA-03.3 P02 | 30min | 3 tasks | 7 files |
| Phase PORTIA-03.3 P03 | n/a | 2 tasks | 5 files |
| Phase PORTIA-05 P01 | n/a | 3 tasks | 4 files |
| Phase PORTIA-05 P02 | 30min | 2 tasks | 4 files |
| Phase PORTIA-05 P03 | 30min | 2 tasks | 3 files |
| Phase PORTIA-05 P04 | 20min | 2 tasks | 4 files |
| Phase PORTIA-05 P05 | 15min | 2 tasks | 2 files |
| Phase PORTIA-05 P06 | n/a | 3 tasks | 4 files |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
