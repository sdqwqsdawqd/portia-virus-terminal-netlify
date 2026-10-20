# Phase 6: Учёт замечаний и страховка данных - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Bookkeeping phase. Delivers:
1. Closure marks with proof for findings that are already fixed or obsolete: 01-CR-01, 05-IN-01, 05-IN-02, 05-IN-04, 05-IN-05, 03.2-IN-02, 03.2-IN-03 (partial), old 03.2 WR-03 (`markQuestsSeen`). (TRIAGE-01)
2. Accepted risks recorded in the review records and in PROJECT.md: 01-WR-01, 03.1-IN-10, 05-WR-05. (TRIAGE-02)
3. Owner backup of `portia_employee_profiles` and `portia_content` taken before Phases 7–9 touch saves, plus closing the STATE item about the project move (the project now lives in `C:\Users\User\code\portia-site`). (TRIAGE-03)

There is no new behaviour. Code is touched only under the narrow exception in D-07.

</domain>

<decisions>
## Implementation Decisions

### Where closures are recorded
- **D-01:** Edit the archived v1.0 `*-REVIEW-DISPOSITION.md` files in `.planning/milestones/v1.0-phases/<phase>/` in place, so each finding keeps a single record. Phase 03.2 has no disposition file, so create `PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW-DISPOSITION.md` in the same format: YAML frontmatter `findings[]` with `id/severity/disposition/title`, `open`/`total` counts, and the `| Finding | Severity | Disposition | Source |` table. List every finding in 03.2-REVIEW.md, not only the ones closed here. Keep the frontmatter counts consistent with the rows.
- **D-02:** Use only the existing statuses (`open`, `fixed`, `skipped`, `deferred`); invent no new ones.
  - Fixed in code → `fixed`
  - Obsolete (the code is gone or the finding no longer applies) → `skipped`, with the reason
  - Accepted risk → `deferred`, with a Source cell that starts `accepted risk: …` and gives the reason
- **D-03:** "Old 03.2 WR-03" (`markQuestsSeen` pruning) is the WR-03 from the earlier 03.2 review pass, which 03.2-REVIEW.md mentions as "previous WR-03". The current WR-03 in that file is a different finding (edits lost during an in-flight save, which v1.1 fixes later). Don't mix them up. Record the old one under a distinct row id (e.g. `WR-03-prev`) or as a clearly labelled note. Never overwrite the current WR-03 row.

### Proof per finding
- **D-04:** Proof = the commit hash that fixed it, plus one re-runnable command and its result (a grep, test name or `git show`), e.g. `fixed in abc1234; grep -n darkreader-lock app/layout.tsx → 1 match`.
- **D-05:** The proof goes in the table's Source cell in short form. If the output is long, quote only the meaningful line.
- **D-06:** Check source or tests only. Don't start a server or check the live page (this includes CR-01).
- **D-07:** Exception to "no code changes" (owner's choice, which overrides roadmap success criterion 1's "без правок кода" for this case only): if a finding on the D-list above turns out to be NOT fixed when checked, fix it in Phase 6. Keep the fix to the smallest diff, give it its own commit, and close the finding as `fixed` with that commit. This applies only to findings on the Phase 6 closure list, never to other open findings.

### Owner data export
- **D-08:** The owner exports the data in the Supabase dashboard, not Claude. The plan includes step-by-step instructions and a `checkpoint:human-action` to confirm. Claude doesn't run SELECTs against the production tables for the backup.
- **D-09:** Format is JSON for both tables. The dashboard's table export is CSV-only, so the instructions should use the SQL editor, e.g. `select json_agg(t) from public.portia_content t;`, then copy or download the result. JSON feeds Phase 9's normalizer dry-run.
- **D-10:** Location: `C:\Users\User\backups\portia\`, outside the repo. Names: `portia_employee_profiles_2026-MM-DD.json` and `portia_content_2026-MM-DD.json` (use the actual export date). Nothing goes into git and no `.gitignore` change is needed.
- **D-11:** Record it as one line in STATE.md: the date, the two file names, row counts and the absolute folder. No data content goes in the record.
- **D-12:** In the same pass, close the STATE.md Blockers item about moving the project (it now lives in `C:\Users\User\code\portia-site`).

### Accepted risks in PROJECT.md
- **D-13:** Add a new `## Known Limitations` section to PROJECT.md right after `## Constraints`, one bullet per risk: what it is, why it's accepted, and the review ID.
  - 01-WR-01: Ctrl+wheel over a cross-origin document (iframe) can't be caught. It's a browser limitation, and the +/− buttons exist.
  - 03.1-IN-10: column rights, the owner's email, and the anonymous approval check. The bullet says which parts Phase 12 (PERM + confirmed-email SQL) changes, so it doesn't go stale after v1.1.
  - 05-WR-05: duplicate `matchMedia` listeners. Accepted as the roadmap says, with no re-check.
- **D-14:** The same three get `deferred` + `accepted risk: …` rows in their DISPOSITION files (D-02).

### Claude's Discretion
- 03.2-IN-03 "partially": read the finding, then either split it (the resolved part `fixed` with proof, the rest `open` with a note naming the later phase or requirement) or keep it `open` with a progress note, whichever records it more honestly in the table format.
- The exact wording of Source cells and of the PROJECT.md bullets.
- Plan split and ordering. The export checkpoint is independent of the closure work and can be its own plan or task.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope
- `.planning/ROADMAP.md` § Phase 6: goal and success criteria
- `.planning/REQUIREMENTS.md`: TRIAGE-01, TRIAGE-02, TRIAGE-03 (exact finding lists)
- `.planning/STATE.md`: Blockers/Concerns (project-move item, data safety rules)
- `.planning/PROJECT.md`: Constraints and Key Decisions (where Known Limitations goes)

### Review records (edited in place)
- `.planning/milestones/v1.0-phases/PORTIA-01-ispravlenie-bagov/01-REVIEW.md` + `01-REVIEW-DISPOSITION.md`: CR-01, WR-01
- `.planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW.md` + `03.1-REVIEW-DISPOSITION.md`: IN-10
- `.planning/milestones/v1.0-phases/PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW.md`: IN-02, IN-03, previous WR-03 (no DISPOSITION file yet, so create one)
- `.planning/milestones/v1.0-phases/PORTIA-05-oformlenie-teksta/05-REVIEW.md` + `05-REVIEW-DISPOSITION.md`: IN-01, IN-02, IN-04, IN-05, WR-05
- `01-REVIEW-DISPOSITION.md` footer: the status vocabulary and the rule that recorded decisions are preserved

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The existing DISPOSITION file format (frontmatter + table) is the template for the new 03.2 file.

### Established Patterns
- The gsd-tools review gate keeps any row that isn't `open` on re-run and flags rows the review no longer reports. Using the existing statuses keeps closures safe across later gate runs.

### Integration Points
- Supabase tables `portia_employee_profiles` and `portia_content` are read-only for this phase (the owner exports them).
- From STATE: never call `PUT /api/content` from scripts. Test saves only on a temporary employee outside the table.

</code_context>

<specifics>
## Specific Ideas

- Proof must be re-checkable by anyone later: a commit plus a command, not prose.
- The backup is insurance before Phases 7–9 change save logic. It must exist before any of those phases execute.

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

</deferred>

---

*Phase: 06-Учёт замечаний и страховка данных*
*Context gathered: 2026-10-19*
