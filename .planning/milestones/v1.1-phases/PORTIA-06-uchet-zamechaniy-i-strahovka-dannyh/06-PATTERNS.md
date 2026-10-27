# Phase 6: Учёт замечаний и страховка данных - Pattern Map

**Mapped:** 2026-10-19
**Files analyzed:** 9 (all docs/markdown; no source files except the D-07 exception)
**Analogs found:** 9 / 9

Base dir for review records: `.planning/milestones/v1.0-phases/` (call it `$V1`). All analogs are git-tracked docs.

## File Classification

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `$V1/PORTIA-01-ispravlenie-bagov/01-REVIEW-DISPOSITION.md` (edit) | disposition record | in-place edit | `$V1/PORTIA-05-oformlenie-teksta/05-REVIEW-DISPOSITION.md` | exact |
| `$V1/PORTIA-03.1-stabilizatsiya/03.1-REVIEW-DISPOSITION.md` (edit) | disposition record | in-place edit | same 05 file | exact |
| `$V1/PORTIA-05-oformlenie-teksta/05-REVIEW-DISPOSITION.md` (edit) | disposition record | in-place edit | itself (rows WR-05, CR-01) | exact |
| `$V1/PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW-DISPOSITION.md` (NEW) | disposition record | create | `05-REVIEW-DISPOSITION.md` | exact |
| `.planning/PROJECT.md` (edit) | project doc | insert section | `## Constraints` bullets (lines 81-87) | role-match |
| `.planning/STATE.md` (edit) | state doc | append line + close blocker | Blockers list (lines 61-68) | role-match |
| Backup instructions + checkpoint (in PLAN) | plan task | human-action | none in codebase | no analog |
| `C:\Users\User\backups\portia\*.json` | owner export | outside repo | none | no analog |
| Source fix per D-07 (conditional) | code | own commit | n/a | none |

## Pattern Assignments

### DISPOSITION files (01, 03.1, 05 edits)

**Analog:** `05-REVIEW-DISPOSITION.md`. Edit three places per finding so they stay consistent: the frontmatter `findings[]` entry, the table row, and the `open:`/`total:` counts (`open` = number of rows with disposition `open`).

Frontmatter entry (05 lines 6-9, 26-29):
```yaml
  - id: IN-01
    severity: info
    disposition: open
    title: "The `event order:` tests drive a hand-written event list, not the component wiring"
```
Table row (05 lines 65-79):
```
| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | open | - |
| WR-05 | warning | deferred | cleanup, no user-visible defect in the phase goal (not in the current review) |
```
Counts (05 lines 58-60): `open: 8`, `total: 13`, `recorded: ...`. Closing IN-01, IN-02, IN-04, IN-05 and deferring WR-05 on 05 changes open 8 to 3. Bump `recorded:` only if desired. Note IN-03 stays open.

New-state row templates (D-02, D-04):
```
| CR-01 | critical | fixed | fixed in abc1234; grep -n darkreader-lock app/layout.tsx → 1 match |
| IN-02 | info | skipped | obsolete: <reason>; <command> → <result> |
| WR-05 | warning | deferred | accepted risk: duplicate matchMedia listeners, no user-visible defect; roadmap-accepted, not re-checked |
```
Existing 05 WR-05 row is already `deferred` with a non-"accepted risk" source: rewrite the Source to start with `accepted risk:`.

Footer (verbatim, keep unchanged at file end, 05 lines 81-83): status vocabulary `open`, `fixed`, `skipped`, `deferred`; a `|` in a reason is escaped on the next run, so avoid `|` in Source cells (grep pipes!). Write commands without pipes.

Sources: 01 has CR-01 (open, frontmatter line 5-8) and WR-01 (to `deferred`). 03.1 has IN-10 (to `deferred`). Read each file's current rows before editing; 01 shows rows `WR-03`, `IN-01..03` still open at the tail.

### `03.2-REVIEW-DISPOSITION.md` (NEW)

**Analog:** `05-REVIEW-DISPOSITION.md` (whole file). Copy header shape:
```yaml
---
phase: 03.2
review: 03.2-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "..."
open: N
total: 9 (+ extra rows)
recorded: 2026-10-19T..Z
---

# Phase 03.2: Code Review Disposition
```
Rows to list (all of 03.2-REVIEW.md; frontmatter says critical 0, warning 4, info 5, total 9): WR-01..WR-04, IN-01..IN-05 (IN-01 Esc handler, IN-02 poll freshness/CDN purge, IN-03 toast placement, IN-04 undo/redo tab, IN-05 read from file). Titles are `###` headings in the review (lines 48, 64, 70, 76, 84, 90, 96, 105; IN-05 further down).

Extra row for D-03: the previous-pass WR-03 (`markQuestsSeen` pruning), mentioned at 03.2-REVIEW.md line 44. Use a distinct id, e.g. `WR-03-prev`, severity warning, never touch the current WR-03 row (line 70: edits lost during in-flight save, stays `open`). Total then = 10 (and `total` must equal the row count; decide whether `WR-03-prev` counts, and keep frontmatter and table equal). Note: line 44 also names previous WR-02 and IN-02 (date validation) as not re-reviewed; D-list closes only `markQuestsSeen`.

IN-02 and IN-03 on the D-list: current IN-02 is "poll only as fresh as CDN purge" and IN-03 is "toast placement and scope". Verify which finding the roadmap IDs mean before closing (the D-list says 03.2-IN-02, IN-03 partial). IN-03 partial: split or keep `open` with a progress note (Claude's discretion).

### `PROJECT.md` Known Limitations (D-13)

**Analog:** Constraints section, lines 81-87: Russian bullets, plain `- ` list.
```markdown
## Constraints

- Только русский интерфейс; шрифты обязаны поддерживать кириллицу.
...
- Ponytail: минимальный полный дифф.

## Key Decisions
```
Insert `## Known Limitations` between the last Constraints bullet (line 87) and `## Key Decisions` (line 89). One bullet each, in Russian: what / why accepted / review ID (01-WR-01, 03.1-IN-10 with which parts Phase 12 changes, 05-WR-05). Key Decisions entries use the style `- [v1.0 → v1.1]: ... (AR-03.2-01)` for ID references.

### `STATE.md` (D-11, D-12)

**Analog:** Blockers/Concerns lines 61-68, format `- ⚠️ [Tag] text`. Remove or mark done line 63:
```
- ⚠️ [Project] Пункт о переносе проекта из временной папки закрывается в Phase 6 (TRIAGE-03): проект в `C:\Users\User\code\portia-site`.
```
Keep line 64 (data safety rule) as is, or update to say export done. Add one line with date, two file names, row counts, `C:\Users\User\backups\portia\`; no data content. Do not touch the Phase 7-12 concerns.

## Shared Patterns

### Proof format (D-04/D-05/D-06)
`fixed in <hash>; <re-runnable grep/test/git show> → <meaningful result line>`. Static checks only; no server. Find hashes with `git log -S'<symbol>' --oneline -- <file>`.

### Preserve recorded decisions
Rows not `open` are kept by the gsd-tools gate on re-run; use only the four statuses. Never edit the footer text. Never overwrite an existing row's decision for findings outside the Phase 6 list.

### Backup export (D-08 to D-10)
Owner-run in the Supabase SQL editor: `select json_agg(t) from public.portia_content t;` and the same for `public.portia_employee_profiles`. Save as `portia_<table>_2026-MM-DD.json` in `C:\Users\User\backups\portia\`. Plan task type `checkpoint:human-action`; Claude does not query production.

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| Backup instructions / checkpoint | human-action | No scripts or SQL export exist in repo; use CONTEXT D-08..D-10 |
| D-07 code fix (conditional) | code | Only if a list finding is found NOT fixed; smallest diff, own commit |

## Metadata

**Analog search scope:** `.planning/milestones/v1.0-phases/*`, `.planning/PROJECT.md`, `.planning/STATE.md`
**Files read:** CONTEXT, 05-REVIEW-DISPOSITION (full), excerpts of 01 disposition, 03.2-REVIEW, PROJECT, STATE
**Pattern extraction date:** 2026-10-19
