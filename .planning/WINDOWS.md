---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-11-04T03:54:18.881Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 19 | deviation | .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/deferred-items.md |  | Full npm run lint fails on pre-existing .agents and .claude skill scripts; scoped source lint passes. | open |  | 2026-11-03T19:20:24.508Z |  |
| 2 | 19 | unmet-truth | .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-EVIDENCE.md | 208 | Сотрудники empty на desktop и phone остаются BLOCKED (DATA) по вердикту B | open |  | 2026-11-04T03:54:18.462Z |  |
| 3 | 19 | unmet-truth | .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-EVIDENCE.md | 210 | Сотрудники desktop stale остаётся BLOCKED (DATA) без управляемого источника | open |  | 2026-11-04T03:54:18.881Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "19",
    "file": ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/deferred-items.md",
    "line": null,
    "description": "Full npm run lint fails on pre-existing .agents and .claude skill scripts; scoped source lint passes.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-03T19:20:24.508Z",
    "resolved_at": null,
    "milestone": "v1.3"
  },
  {
    "id": 2,
    "kind": "unmet-truth",
    "phase": "19",
    "file": ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-EVIDENCE.md",
    "line": 208,
    "description": "Сотрудники empty на desktop и phone остаются BLOCKED (DATA) по вердикту B",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-04T03:54:18.462Z",
    "resolved_at": null,
    "milestone": "v1.3"
  },
  {
    "id": 3,
    "kind": "unmet-truth",
    "phase": "19",
    "file": ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-EVIDENCE.md",
    "line": 210,
    "description": "Сотрудники desktop stale остаётся BLOCKED (DATA) без управляемого источника",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-04T03:54:18.881Z",
    "resolved_at": null,
    "milestone": "v1.3"
  }
]
````
