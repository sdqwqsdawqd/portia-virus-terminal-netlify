# Phase 6: Учёт замечаний и страховка данных - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 6-Учёт замечаний и страховка данных
**Areas discussed:** Where closures are recorded, Proof per finding, Owner data export, Accepted risks in PROJECT.md

---

## Where closures are recorded

| Option | Description | Selected |
|--------|-------------|----------|
| Edit archived files | Update v1.0 DISPOSITION files in place, create 03.2 one | ✓ |
| One v1.1 ledger | New 06-TRIAGE.md, archive frozen | |
| Both | Ledger + pointer in archived files | |

| Option (accepted-risk status) | Description | Selected |
|--------|-------------|----------|
| deferred + reason | Existing status, "accepted risk: …" in Source | ✓ |
| New 'accepted' status | Clearer, but unknown to the gate tooling | |

| Option (fixed vs obsolete) | Description | Selected |
|--------|-------------|----------|
| fixed / skipped | Fixed → fixed+commit; obsolete → skipped+reason | ✓ |
| fixed for all | Simpler, blurs meaning | |

**03.2-IN-03 partial:** "You decide".

---

## Proof per finding

| Option | Description | Selected |
|--------|-------------|----------|
| Commit + command | Hash + re-runnable command/output | ✓ |
| Commit only | Hash + sentence | |
| Command only | Current state only | |

| Option (CR-01 live check) | Description | Selected |
|--------|-------------|----------|
| Source/test only | grep/test is enough | ✓ |
| Also curl localhost | Run the server and check the HTML | |

| Option (finding not actually fixed) | Description | Selected |
|--------|-------------|----------|
| Leave open, flag it | No code in Phase 6 | |
| Fix it here | Small fixes allowed in Phase 6 | ✓ |

**Notes:** Goes against roadmap success criterion 1 ("без правок кода"). Recorded as a narrow exception (D-07): only findings on the Phase 6 list, smallest fix, own commit.

| Option (proof location) | Description | Selected |
|--------|-------------|----------|
| Source cell | Short form in the table | ✓ |
| Notes section | Full output under the table | |

---

## Owner data export

| Option | Description | Selected |
|--------|-------------|----------|
| Owner, Supabase dashboard | Instructions + checkpoint | ✓ |
| Claude, read-only SELECT | Via Supabase tool | |

| Option (format) | Description | Selected |
|--------|-------------|----------|
| JSON | Nested JSON safe; feeds Phase 9 | ✓ |
| CSV | One-click, clumsy for content | |
| Both | | |

| Option (location) | Description | Selected |
|--------|-------------|----------|
| C:\Users\User\backups\portia\ | Outside the repo | ✓ |
| Repo folder + .gitignore | Risk of leaking data | |

| Option (record) | Description | Selected |
|--------|-------------|----------|
| STATE.md note | Date, names, counts, folder | ✓ |
| 06-SUMMARY only | | |

---

## Accepted risks in PROJECT.md

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Known limitations' section | After Constraints | ✓ |
| Key Decisions rows | Precedent AR-03.2-01 | |

| Option (03.1-IN-10 depth) | Description | Selected |
|--------|-------------|----------|
| Note what Phase 12 changes | Forward link to PERM/SQL | ✓ |
| Plain accepted | | |

| Option (05-WR-05) | Description | Selected |
|--------|-------------|----------|
| Accept as roadmap says | | ✓ |
| Re-check during plan | | |

---

## Claude's Discretion

- How 03.2-IN-03 "partially" is recorded (split vs open with note)
- Wording of Source cells and PROJECT.md bullets
- Plan split and ordering

## Deferred Ideas

None
