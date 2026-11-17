---
phase: quick-261109-brj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/milestones/v1.3-phases/PORTIA-15-baseline/
  - .planning/milestones/v1.3-phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/
  - .planning/milestones/v1.3-phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/
  - .planning/milestones/v1.3-phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/
  - .planning/milestones/v1.3-phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/
  - .planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/
  - .planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-POST-ARCHIVE-PATHS.md
  - scripts/phase20-release-gate.mjs
  - lib/phase20-release-gate.test.ts
  - scripts/phase15-visual-manifest.mjs
  - lib/phase15-visual-manifest.test.ts
  - tests/e2e/visual-candidates/support.ts
  - lib/phase20-uat.test.ts
  - lib/phase20-requirements-ledger.test.ts
  - lib/phase20-release-notes.test.ts
  - lib/phase20-hints-inventory.test.ts
  - lib/security-matrix.test.ts
  - lib/editor-image-framing.test.ts
  - scripts/phase20-audit-check.mjs
  - scripts/phase19-matrix-data.mjs
  - scripts/phase19-acceptance.mjs
  - scripts/phase16-staging.mjs
autonomous: true
requirements: [QUICK-261109-brj]

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "`.planning/phases/` contains no v1.3 phase directory; the six PORTIA-15..20 directories live under `.planning/milestones/v1.3-phases/` as pure 100% renames (412 tracked files), the GSD archive convention"
    - "`node --experimental-strip-types --test lib/*.test.ts` reports 0 fail and reads REQUIREMENTS/ROADMAP/phase evidence only from the archived v1.3 copies"
    - "After the commit, `scripts/phase20-release-gate.mjs` --verify-docs, --verify-reconciliation, --verify-lineage, --verify-evidence and --verify-independent all succeed"
    - "`node scripts/phase15-visual-manifest.mjs --verify-promotion` verifies the 65 owner-approved snapshots with tests/e2e/visual/phase20-baselines.json byte-identical"
    - "No signed or owner-approved evidence is rewritten: phase20-baselines.json, PORTIA-15-baseline/evidence/*, summaries, VERIFICATION.md frontmatter, 20-RECONCILIATION.md and 20-SECURITY-MATRIX.md are unchanged apart from the rename"
    - "GSD queries init.manager, roadmap.analyze and init.new-milestone exit 0 after the move, so /gsd-new-milestone can run next"
  artifacts:
    - path: "scripts/phase20-release-gate.mjs"
      provides: "V13_PHASES / LEGACY_PHASES / PHASE_DIR / LEGACY_PHASE_DIR / PLAN_BASE_REQUIREMENTS_MD constants, phaseDirIn() for commit-bound reads, POST_FRC_PATHS with the 11 repointed files"
      contains: ".planning/milestones/v1.3-phases"
    - path: "scripts/phase15-visual-manifest.mjs"
      provides: "Phase 15 evidence paths under the archive; phase20VerdictFile read location; phase20VerdictSource kept as the register's signed identity"
      contains: "v1.3-phases"
    - path: ".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-POST-ARCHIVE-PATHS.md"
      provides: "Dated record of the post-FRC path-only change and of the frozen identities that keep pre-archive paths"
  key_links:
    - from: "scripts/phase20-release-gate.mjs verifyDocs"
      to: "git show <plan_base>:.planning/REQUIREMENTS.md"
      via: "PLAN_BASE_REQUIREMENTS_MD (history read keeps the pre-archive path)"
      pattern: "PLAN_BASE_REQUIREMENTS_MD"
    - from: "scripts/phase15-visual-manifest.mjs validatePhase20Register"
      to: "tests/e2e/visual/phase20-baselines.json ownerVerdict.source"
      via: "verbatim equality with phase20VerdictSource (legacy literal, untouched)"
      pattern: "phase20VerdictSource"
    - from: "scripts/phase20-release-gate.mjs verifyReconciliation"
      to: "git diff --name-only a05a6019e867 HEAD"
      via: "POST_FRC_PATHS exact entries"
      pattern: "POST_FRC_PATHS"
---

<objective>
Move the six v1.3 phase directories into `.planning/milestones/v1.3-phases/` (the location GSD `phases.clear --archive-version v1.3` uses) and repoint every script and test that reads them, `.planning/REQUIREMENTS.md` or `.planning/ROADMAP.md` to the frozen archived copies. Signed evidence stays as it is.

Purpose: `/gsd-new-milestone` will overwrite REQUIREMENTS.md and ROADMAP.md for v1.4 and clear `.planning/phases/`. The v1.3 release-evidence tests and the release gate must keep checking the frozen v1.3 artifacts.
Output: one commit with 412 renames, 15 path-only edits and one dated note. The full local check stays green.

Convention confirmed at planning time: `archivePhaseDirectories` in `~/.claude/gsd-core/bin/lib/milestone.cjs` moves each phase dir to `.planning/milestones/<version>-phases/<dir>`. The existing `.planning/milestones/v1.1-phases/PORTIA-06-...` is laid out the same way.

Planning-time baseline at HEAD fe34639 on Node 22.13.1:
- `lib/*.test.ts`: 1716 pass, 0 fail, 3 skipped.
- `--verify-promotion`: "Verified 65 exact owner-approved snapshot bytes".
- All five gate verify modes: OK.
- tsc: exit 0.
- eslint on `scripts lib tests/e2e/visual-candidates`: 0 errors, 3 warnings, all in the gitignored `.runs/`.
- `git diff --name-only a05a6019e867 HEAD` outside `.planning/`: exactly the four existing POST_FRC files.

Archived docs checked by diff: `.planning/milestones/v1.3-REQUIREMENTS.md` is the live file plus a 9-line archive header, which the line-anchored parsers ignore. `.planning/milestones/v1.3-ROADMAP.md` is byte-identical to the live file.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

Authorized file list. It comes from a live grep at planning time (`\.planning/phases/PORTIA-(1[5-9]|20)-`, `"phases", "PORTIA-` and `\.planning/(REQUIREMENTS|ROADMAP)\.md` over scripts/ lib/ tests/). It records 32 legacy phase-path lines in 16 files, plus 8 REQUIREMENTS/ROADMAP lines.
- Edit: scripts/phase20-release-gate.mjs, lib/phase20-release-gate.test.ts, scripts/phase15-visual-manifest.mjs, lib/phase15-visual-manifest.test.ts, tests/e2e/visual-candidates/support.ts, lib/phase20-uat.test.ts, lib/phase20-requirements-ledger.test.ts, lib/phase20-release-notes.test.ts, lib/phase20-hints-inventory.test.ts, lib/security-matrix.test.ts, lib/editor-image-framing.test.ts, scripts/phase20-audit-check.mjs, scripts/phase19-matrix-data.mjs, scripts/phase19-acceptance.mjs, scripts/phase16-staging.mjs. That is 15 files.
- Create: `.planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-POST-ARCHIVE-PATHS.md`.
- Move with git mv: the six `.planning/phases/PORTIA-1[5-9]-*` and `PORTIA-20-*` directories. All 412 files are tracked; no untracked or ignored files exist there.
- Deliberately NOT edited:
  - tests/e2e/visual/phase20-baselines.json: owner-approved D-68 register. Its `ownerVerdict.source` keeps the pre-archive path.
  - lib/phase16-guard-boundary.test.ts:48: a fake `.planning/phases/x` argument for the guard wrapper pattern.
  - Every markdown/json file inside the moved directories, apart from the new note.
  - .planning/milestones/v1.3-REQUIREMENTS.md and v1.3-ROADMAP.md.
  - Owner paths from CLAUDE.md, .planning/milestone.lock, .planning/state.json and .planning/STATE.md. The orchestrator owns STATE.

Node: `N=C:/Users/User/AppData/Local/Temp/portia-node-v22.13.1/node-v22.13.1-win-x64/node.exe`. npm is broken here, so call node directly. If that folder is gone, use the default `node` and say so in the SUMMARY.

Guard (.claude/hooks/guard.mjs): staging keys are loaded in this environment.
- Any Bash command whose text names the staging wrapper script must be a single unchained `git add|diff|show|status|log` command, with no `cd`, `&&`, `;`, `|`, `>` or `$(`. Run it from the default cwd, which is the repo root.
- Read and edit that file only with Read/Edit/Grep.
- Lint it through the directory form `scripts`.
- `echo "$…` is also blocked; use printf.
- Never run `scripts/phase15-visual-manifest.mjs --verify` (the default mode): it rewrites signed evidence. Only `--verify-promotion` is allowed.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Archive the v1.3 phases and repoint the release gate end-to-end</name>
  <files>.planning/phases/PORTIA-15-baseline -> .planning/milestones/v1.3-phases/ (and PORTIA-16..20, git mv), scripts/phase20-release-gate.mjs, lib/phase20-release-gate.test.ts</files>
  <precondition>`git diff --cached --name-only` prints nothing, `.planning/milestones/v1.3-phases` does not exist, and `git ls-files .planning/milestones/v1.3-REQUIREMENTS.md .planning/milestones/v1.3-ROADMAP.md` lists both files.</precondition>
  <action>
1. Move. Run `mkdir -p .planning/milestones/v1.3-phases`. Then run ONE `git mv` with the six sources and the destination `.planning/milestones/v1.3-phases/`:
   - .planning/phases/PORTIA-15-baseline
   - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina
   - .planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
   - .planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii
   - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media
   - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza

   Afterwards `ls -A .planning/phases` must be empty. Leave the empty directory on disk. Do not commit yet: the move without the repoint is a broken tree, so this plan makes a single commit in Task 3.

2. scripts/phase20-release-gate.mjs, line 21. Replace the literal with these constants:
   - exported `V13_PHASES = ".planning/milestones/v1.3-phases"`
   - exported `LEGACY_PHASES = ".planning/phases"`
   - module const `PHASE_NAME = "PORTIA-20-security-accessibility-i-priemka-reliza"`
   - `PHASE_DIR` = V13_PHASES + "/" + PHASE_NAME
   - exported `LEGACY_PHASE_DIR` = LEGACY_PHASES + "/" + PHASE_NAME

   Every derived constant follows automatically (EVIDENCE_MD, WAIVERS_MD, MATRIX_MD, OWNER_SUMMARY_MD, UAT_MD, CONTEXT_MD, RECONCILIATION_MD, RELEASE_*). Lines 1628-1632 become:
   - REQUIREMENTS_MD = ".planning/milestones/v1.3-REQUIREMENTS.md"
   - ROADMAP_MD = ".planning/milestones/v1.3-ROADMAP.md"
   - PHASE18_VERIFICATION_MD under V13_PHASES (PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-VERIFICATION.md)
   - PHASE19_VERIFICATION_MD under V13_PHASES (PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-VERIFICATION.md)

3. History read. Add exported `PLAN_BASE_REQUIREMENTS_MD = ".planning/REQUIREMENTS.md"` with a one-line comment: this is the path REQUIREMENTS.md had in commit plan_base, before the v1.3 archive, and `git show` reads history. In verifyDocs (about line 1776), change the `git show` argument to plan_base + ":" + PLAN_BASE_REQUIREMENTS_MD. This is the only place that must keep the pre-archive path. The archived file does not exist at plan_base, so repointing this read would make --verify-docs fail with «REQUIREMENTS.md на plan_base … не прочитан».

4. Commit-bound reads. `--run --commit <sha>` reads from a worktree of that commit. For the FRC a05a6019e867, and for every commit before this one, the phase sits at the legacy path.
   - Add exported `phaseDirIn(fs, root)`. It returns PHASE_DIR unless `path.join(root, PHASE_DIR)` is absent AND `path.join(root, LEGACY_PHASE_DIR)` exists; in that case it returns LEGACY_PHASE_DIR.
   - Use it only in readEffectiveOwnerVerdict and in the waiver read of the run orchestration (about line 2185, now `path.join(created.path, WAIVERS_MD)`; use the phaseDirIn directory plus `path.posix.basename(WAIVERS_MD)`).
   - In readEffectiveOwnerVerdict, use it for the 20-58 summary read, the readdirSync and the link reads (`dir` = phaseDirIn(deps.fs, root)).
   - The --verify-* modes read the HEAD tree, which has only the archive, so they keep the constants.
   - Defaulting to PHASE_DIR keeps fake-fs tests, which answer false for directories, on the archive path.

5. POST_FRC_PATHS (line 1854). Keep the five entries and their existing comment. Append exactly these 11 file entries, with no new prefix and no wildcard:
   - scripts/phase15-visual-manifest.mjs
   - scripts/phase16-staging.mjs
   - scripts/phase19-acceptance.mjs
   - scripts/phase19-matrix-data.mjs
   - scripts/phase20-audit-check.mjs
   - lib/editor-image-framing.test.ts
   - lib/phase15-visual-manifest.test.ts
   - lib/phase20-hints-inventory.test.ts
   - lib/phase20-requirements-ledger.test.ts
   - lib/security-matrix.test.ts
   - tests/e2e/visual-candidates/support.ts

   Add a comment above the list: quick 261109-brj (2026-11-09) archived the v1.3 phase directories to .planning/milestones/v1.3-phases and changed only the path constants of these scripts and tests; no product code; the record is 20-POST-ARCHIVE-PATHS.md in the phase directory.

   Constraints on comment text, enforced by the existing source tests at lib/phase20-release-gate.test.ts:153-159 and 1268-1274. The gate source must not contain:
   - the file-name token of the Phase 15 owner approval ledger
   - the privileged Supabase key name
   - a quoted clean or stash word
   - the hard-reset flag

6. lib/phase20-release-gate.test.ts:
   - Line 165: read through `new URL("../" + gate.WAIVERS_MD, import.meta.url)`.
   - Lines 2259-2262: V18, V19, REQ_MD and ROADMAP_MD become gate.PHASE18_VERIFICATION_MD, gate.PHASE19_VERIFICATION_MD, gate.REQUIREMENTS_MD and gate.ROADMAP_MD. No literals.
   - docsRepo's fake git (about line 2335) answers `show` with baseText only when args[1] equals the fixture plan_base ("1" repeated 40 times) + ":" + gate.PLAN_BASE_REQUIREMENTS_MD. Anything else returns `{ status: 128, stdout: "", stderr: "fatal" }`. That way the existing plan_base tests catch a repointed history read.
   - Line 2533: add the 11 new entries to the allowed `changes` array. Add a negative: `mentions(reconErrors({ changes: ["lib/portia-content.test.ts"] }), /после FRC.*lib\/portia-content\.test\.ts/)`, which shows the allowlist stays exact.
   - New test "v1.3 archive layout". Assert:
     - gate.V13_PHASES === ".planning/milestones/v1.3-phases"
     - gate.PHASE_DIR starts with gate.V13_PHASES + "/"
     - gate.REQUIREMENTS_MD === ".planning/milestones/v1.3-REQUIREMENTS.md"
     - gate.ROADMAP_MD === ".planning/milestones/v1.3-ROADMAP.md"
     - gate.PLAN_BASE_REQUIREMENTS_MD === ".planning/REQUIREMENTS.md"
     - gate.LEGACY_PHASES === ".planning/phases"
     - gate.LEGACY_PHASE_DIR === gate.LEGACY_PHASES + "/" + path.posix.basename(gate.PHASE_DIR)

     Do not spell the legacy PORTIA-20 path as one literal here; that keeps the grep gate in Task 3 exact.
   - New test for phaseDirIn and readEffectiveOwnerVerdict. Use a real temp dir and follow writeOwnerFiles and the chain tests near lines 1468-1517. Cases:
     - legacy-only layout: `readEffectiveOwnerVerdict(deps, base)` returns verdict "accepted"
     - both layouts, with different verdicts in the two 20-58 summaries: the archive copy wins
     - empty dir: phaseDirIn returns gate.PHASE_DIR
  </action>
  <verify>
    <automated>N=C:/Users/User/AppData/Local/Temp/portia-node-v22.13.1/node-v22.13.1-win-x64/node.exe; $N --experimental-strip-types --test lib/phase20-release-gate.test.ts 2>&1 | grep -E "^# (pass|fail)"; for m in --verify-docs --verify-lineage --verify-evidence --verify-independent --verify-reconciliation; do $N scripts/phase20-release-gate.mjs $m; done; ls -A .planning/phases | wc -l</automated>
  </verify>
  <done>
- The gate test file reports `# fail 0`.
- The five modes print "docs verified", "lineage verified", "release evidence verified", "independent verification passed" and "reconciliation verified".
- `.planning/phases` lists 0 entries.
- `git diff --cached -M --name-status | grep -c '^R100'` = 412.

Other lib tests may be red until Task 2. Do not commit.
  </done>
</task>

<task type="auto">
  <name>Task 2: Repoint the visual manifest pipeline and the Phase 20 document tests</name>
  <files>scripts/phase15-visual-manifest.mjs, lib/phase15-visual-manifest.test.ts, tests/e2e/visual-candidates/support.ts, lib/phase20-uat.test.ts, lib/phase20-requirements-ledger.test.ts, lib/phase20-release-notes.test.ts, lib/phase20-hints-inventory.test.ts, lib/security-matrix.test.ts, lib/editor-image-framing.test.ts</files>
  <action>
Every edit here is a path-constant edit; nothing else changes.

1. scripts/phase15-visual-manifest.mjs. Add one const `v13Phases = ".planning/milestones/v1.3-phases"` and `phase15Evidence = path.resolve(workspace, v13Phases, "PORTIA-15-baseline", "evidence")`. Lines 11-16 become `path.join(phase15Evidence, <same file name>)`.

   Line 375, `phase20VerdictSource`: KEEP its exact current value. It is the identity that the owner-approved register tests/e2e/visual/phase20-baselines.json carries in `ownerVerdict.source` (D-68), and validatePhase20Register compares it verbatim. Changing either side would mean rewriting signed evidence, which is a STOP condition.

   Add `phase20VerdictFile = path.resolve(workspace, v13Phases, "PORTIA-20-security-accessibility-i-priemka-reliza", "20-58-SUMMARY.md")`. Use it where verifyPromotion reads the summary (about line 457, now `path.resolve(workspace, phase20VerdictSource)`). Put a two-line comment above phase20VerdictSource: the register names the verdict by its pre-archive path (its signed identity, compared verbatim); the file is read from the v1.3 archive.

   Nothing else changes. Planning confirmed that the authority tuple hashes contents (Local contract SHA-256), and that the Phase 15 approval ledger, index and inventory contain no `.planning` paths. The move therefore invalidates no digest.

2. lib/phase15-visual-manifest.test.ts:
   - Add a module-level `phase20VerdictSource` equal to the current legacy 20-58 path literal, with a comment that this is the register's recorded identity. Use it at line 370 and in writeRegister (`ownerVerdict: { source: phase20VerdictSource, commit }`).
   - `evidenceDir` at lines 147 and 437 becomes ".planning/milestones/v1.3-phases/PORTIA-15-baseline/evidence".
   - `summaryPath` at line 439 becomes ".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-58-SUMMARY.md". The fixture summary is written there and the script reads it there.
   - Next to line 433, add one assertion: a register whose ownerVerdict.source is that archived path gives ["PORTIA_PHASE20_REGISTER_INVALID"]. The register keeps its signed identity.

3. tests/e2e/visual-candidates/support.ts, line 49: change to ".planning/milestones/v1.3-phases/PORTIA-15-baseline/evidence/15-DIRTY-OWNERSHIP.md". dirtyLedgerId hashes the bytes, so its value does not change.

4. Phase 20 document tests. Each file gets one constant for ".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza":
   - lib/phase20-uat.test.ts: lines 11, 12 and 929. Use one top-level constant; the inner phaseDir at 929 reuses it through path.join(root, …).
   - lib/phase20-requirements-ledger.test.ts: line 9. Lines 259, 265 and 269 read ".planning/milestones/v1.3-ROADMAP.md" and ".planning/milestones/v1.3-REQUIREMENTS.md" through two constants. Test titles may keep "REQUIREMENTS.md".
   - lib/phase20-release-notes.test.ts: line 9.
   - lib/phase20-hints-inventory.test.ts: line 12.
   - lib/editor-image-framing.test.ts: line 15.
   - lib/security-matrix.test.ts: add `V13 = ".planning/milestones/v1.3-phases"`. Line 11 `phaseDir` and line 522 `disposition19Path` move under V13.

     The real matrix is frozen Phase 20 evidence. It records the SEC20-11 Source as the pre-archive path of 16-PRODUCTION-POSTFLIGHT.md under PORTIA-16, so "every source path exists" (line 116) would fail. Do NOT edit 20-SECURITY-MATRIX.md. Instead add `archived(recorded)`: it rewrites a leading `.planning/phases/` that is followed by `PORTIA-(15..20)-` to V13 + "/". Use it only inside the existence predicate passed at line 116.

5. If another test fails because a frozen document records a pre-archive path, map it inside that test's predicate in the same way.

   STOP and report instead of editing if the fix would require changing any of these:
   - tests/e2e/visual/phase20-baselines.json
   - any file under PORTIA-15-baseline/evidence
   - an owner or 20-58 summary
   - a VERIFICATION.md
   - 20-RECONCILIATION.md
   - 20-SECURITY-MATRIX.md
  </action>
  <verify>
    <automated>N=C:/Users/User/AppData/Local/Temp/portia-node-v22.13.1/node-v22.13.1-win-x64/node.exe; $N --experimental-strip-types --test lib/phase20-uat.test.ts lib/phase20-requirements-ledger.test.ts lib/phase20-release-notes.test.ts lib/phase20-hints-inventory.test.ts lib/security-matrix.test.ts lib/editor-image-framing.test.ts 2>&1 | grep -E "^# (pass|fail)"; $N --experimental-strip-types --test lib/phase15-visual-manifest.test.ts 2>&1 | grep -E "^# (pass|fail)"; $N scripts/phase15-visual-manifest.mjs --verify-promotion; B=$(git diff --name-only -- tests/e2e/visual/phase20-baselines.json) && printf 'baselines changes=[%s]\n' "$B"</automated>
  </verify>
  <done>
- Both test runs report `# fail 0`.
- --verify-promotion prints "Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded."
- The check prints `baselines changes=[]`: phase20-baselines.json has no working-tree changes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Repoint the operational scripts, record the change, verify everything, single commit</name>
  <files>scripts/phase20-audit-check.mjs, scripts/phase19-matrix-data.mjs, scripts/phase19-acceptance.mjs, scripts/phase16-staging.mjs, .planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-POST-ARCHIVE-PATHS.md</files>
  <action>
1. Operational scripts. Relevance was decided at planning:
   - phase19-acceptance.mjs and phase19-matrix-data.mjs READ their recorded run manifests (manifestFileOf / readManifest, used for teardown and restore).
   - phase20-audit-check.mjs --verify reads 20-DEPENDENCY-AUDIT.json and 20-DEPENDENCY-AUDIT.md.
   - phase16-staging.mjs `fingerprint` writes evidence with mkdirSync recursive. Left alone, it would silently recreate the PORTIA-16 directory under `.planning/phases/`, and GSD would then list it as a v1.4 phase.

   Their unit tests inject deps.manifestFile or deps.evidenceDir, so no test changes. Each file changes one constant:
   - scripts/phase20-audit-check.mjs, line 13: PHASE_DIR = ".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza".
   - scripts/phase19-matrix-data.mjs, line 12: MANIFEST = path.join(ROOT, ".planning/milestones/v1.3-phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/19-MATRIX-DATA-RUN.json").
   - scripts/phase19-acceptance.mjs, lines 20-22: path.join(REPO_ROOT, ".planning", "milestones", "v1.3-phases", "PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media", "evidence", "19-ACCEPTANCE-RUN.json").
   - scripts/phase16-staging.mjs, line 169: EVIDENCE_DIR = path.join(REPO_ROOT, ".planning", "milestones", "v1.3-phases", "PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina", "evidence"). Edit this file with the Edit tool only, and follow the guard rules in context.

2. Write the note with the Write tool: `.planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-POST-ARCHIVE-PATHS.md`. Write it in short Russian, with no PASS or Complete wording. It must say:
   - date 2026-11-09, quick 261109-brj
   - the six directories moved to .planning/milestones/v1.3-phases
   - the 11 files added to POST_FRC_PATHS, which carry path constants only (no product code, no evidence edits)
   - frozen identities that keep the pre-archive path and are resolved to the archive at read time: `ownerVerdict.source` in phase20-baselines.json, and the SEC20-11 Source in 20-SECURITY-MATRIX.md
   - the sentence «После FRC менялись только …» in 20-RECONCILIATION.md is the 20-15 record; this note extends it and does not edit it
   - `git show <plan_base>` keeps reading .planning/REQUIREMENTS.md from history
   - `--run` on a commit made before the archive reads the legacy location through phaseDirIn

   The file name must not match `20-NN-PLAN.md` or `20-NN-SUMMARY.md`, which the gate lists.

3. Full pre-commit check, all from the repo root with $N. Each item must be green:
   - `$N --experimental-strip-types --test lib/*.test.ts`: 0 fail
   - `$N --experimental-strip-types --test lib/phase15-visual-manifest.test.ts`
   - `$N scripts/phase15-visual-manifest.mjs --verify-promotion`
   - `$N node_modules/typescript/bin/tsc --noEmit`: exit 0
   - `$N node_modules/eslint/bin/eslint.js scripts lib tests/e2e/visual-candidates`: 0 errors. The 3 baseline warnings in the gitignored .runs/ are fine.
   - the five gate modes

4. GSD tooling. `$N ~/.claude/gsd-core/bin/gsd-tools.cjs query init.manager`, `query roadmap.analyze` and `query init.new-milestone` must each exit 0. Missing v1.3 phase directories are fine.

5. Grep gates on the working tree. Exclude `/.runs/`.
   - Gate A: `grep -rnE '\.planning/phases/PORTIA-(1[5-9]|20)-|"phases", "PORTIA-' scripts lib tests --include=*.mjs --include=*.ts --include=*.json`. It must show exactly 3 lines, against 32 at baseline:
     - the phase20VerdictSource line in scripts/phase15-visual-manifest.mjs
     - the phase20VerdictSource constant in lib/phase15-visual-manifest.test.ts
     - the "source" line in tests/e2e/visual/phase20-baselines.json
   - Gate B: `grep -rnE '\.planning/(REQUIREMENTS|ROADMAP)\.md' scripts lib tests --include=*.mjs --include=*.ts`. It must show exactly 3 lines, against 8 at baseline:
     - PLAN_BASE_REQUIREMENTS_MD in the gate
     - its assertion in the gate test
     - the fake `.planning/ROADMAP.md` change entry of the POST_FRC positive case

   Investigate any other line before you commit.

6. Commit, only when 3-5 are green.
   - `git diff --cached --name-only` must show only the renames. git mv already staged them.
   - Then run ONE plain `git add` with explicit paths: the 15 edited files and the note. No -A, no `.`, no chaining.
   - Never stage .planning/milestone.lock, .planning/state.json, .planning/STATE.md, this quick directory or owner paths.
   - Commit once with `git commit -m "chore(v1.3): archive the v1.3 phase directories and repoint release-evidence paths" -m "<body: six phase dirs moved to .planning/milestones/v1.3-phases (GSD archive layout); scripts and tests read the archived v1.3 REQUIREMENTS/ROADMAP/phase copies; POST_FRC_PATHS extended by the repointed files; signed evidence unchanged>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Do not name the staging-wrapper file in the message: with the trailer's `>` the guard would block the command.

7. Post-commit, against the commit:
   - Re-run all five gate modes. --verify-reconciliation only sees committed files in FRC..HEAD, so this run is the one that counts.
   - `git diff --name-only a05a6019e867 HEAD | grep -v '^\.planning/'` must list only POST_FRC_PATHS files.
   - `git show -M --name-status --format= HEAD`: `^R100` = 412, no other `^R`, exactly 15 `^M` lines (the authorized edit list), and exactly one `^A` line (the note).
   - tests/e2e/visual/phase20-baselines.json must not appear.
  </action>
  <verify>
    <automated>N=C:/Users/User/AppData/Local/Temp/portia-node-v22.13.1/node-v22.13.1-win-x64/node.exe; $N --experimental-strip-types --test lib/*.test.ts 2>&1 | grep -E "^# (pass|fail)"; $N scripts/phase15-visual-manifest.mjs --verify-promotion; $N node_modules/typescript/bin/tsc --noEmit; for m in --verify-docs --verify-reconciliation --verify-lineage --verify-evidence --verify-independent; do $N scripts/phase20-release-gate.mjs $m; done; S=$(git show -M --name-status --format= HEAD) && printf '%s\n' "$S" | cut -c1-4 | sort | uniq -c; D=$(git diff --name-only a05a6019e867 HEAD) && printf '%s\n' "$D" | grep -v '^\.planning/'</automated>
  </verify>
  <done>
- Post-commit: `lib/*.test.ts` reports `# fail 0`.
- --verify-promotion verifies 65 snapshots.
- tsc exits 0.
- All five gate modes succeed.
- HEAD shows 412 R100, 15 M and 1 A.
- Outside .planning/, FRC..HEAD lists only POST_FRC_PATHS entries.
- The GSD queries exit 0.
- Grep gates A and B match exactly 3 lines each.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| owner-signed evidence → agent edits | phase20-baselines.json (D-68), PORTIA-15-baseline/evidence/*, owner summaries: only the owner may change them |
| post-FRC allowlist → release verdict | POST_FRC_PATHS decides which changes after the FRC keep the v1.3 release lineage valid |
| agent shell → isolated staging | staging keys are loaded; .claude/hooks/guard.mjs restricts commands that name the staging wrapper |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-brj-01 | Tampering | tests/e2e/visual/phase20-baselines.json, Phase 15 approval evidence | high | mitigate | phase20VerdictSource keeps the legacy literal as the register identity and only the read location moves (Task 2). Signed files are on the do-not-edit list with a STOP rule. Post-commit: the register is absent from `git show --name-status HEAD`, and every moved file is R100. |
| T-brj-02 | Elevation of Privilege | POST_FRC_PATHS in scripts/phase20-release-gate.mjs | high | mitigate | Only 11 exact file entries are appended, with no new prefix or wildcard. The test keeps rejecting components/…, lib/portia-content.ts and package-lock.json, and gains a lib/portia-content.test.ts negative (Task 1). |
| T-brj-03 | Spoofing | phaseDirIn legacy fallback | medium | mitigate | It returns the archive unless the archive is absent AND the legacy dir exists. It is used only for commit-bound worktree reads, never by the --verify-* modes. Covered by a temp-dir test with both layouts (Task 1). |
| T-brj-04 | Repudiation | post-FRC change history | medium | mitigate | A dated note 20-POST-ARCHIVE-PATHS.md and a comment at POST_FRC_PATHS record exactly what changed and why. 20-RECONCILIATION.md is left as the 20-15 record (Task 3). |
| T-brj-05 | Information Disclosure | guarded staging wrapper (scripts/phase16-staging.mjs) | medium | mitigate | One constant is edited with the Edit tool. Bash commands that name the file are unchained git forms only. No .env reading, no secrets printed, no staging command run. |
| T-brj-06 | Tampering | git show plan_base history read | medium | mitigate | PLAN_BASE_REQUIREMENTS_MD keeps the pre-archive path. The fake git in docsRepo fails any other path, so a regression turns the plan_base tests red (Task 1). |
| T-brj-SC | Tampering | npm/pip/cargo installs | low | accept | No package is installed or upgraded in this plan; no package-legitimacy audit applies. |
</threat_model>

<verification>
Post-commit, on Node 22.13.1:
- `lib/*.test.ts`: 0 fail.
- `--verify-promotion`: 65 snapshots.
- tsc: exit 0.
- eslint on `scripts lib tests/e2e/visual-candidates`: 0 errors.
- All five release-gate modes succeed.
- GSD init.manager, roadmap.analyze and init.new-milestone exit 0.
- `.planning/phases/` is empty.
- HEAD has 412 R100 renames, 15 path-only edits and 1 new note.
- No signed evidence changed.
</verification>

<success_criteria>
- The v1.3 phase history sits in `.planning/milestones/v1.3-phases/`, the location GSD uses, so `/gsd-new-milestone` can overwrite REQUIREMENTS.md and ROADMAP.md and clear phases without breaking a single v1.3 release-evidence test.
- Every v1.3 reader resolves through one constant per file.
- The only remaining legacy literals are the documented frozen identities and the plan_base history path.
</success_criteria>

<output>
Create `.planning/quick/261109-brj-repoint-tests-and-scripts-to-the-v1-3-ar/261109-brj-SUMMARY.md` when done. Include:
- the commit SHA
- the post-commit check outputs (test counts, gate lines, rename count)
- which Node was used
- any STOP raised
</output>
