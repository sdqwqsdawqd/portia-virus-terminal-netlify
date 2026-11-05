---
schema_version: 1
open_count: 6
waived_count: 0
fixed_count: 1
total_count: 7
last_updated: 2026-11-05T08:52:41.501Z
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
| 4 | 20 | deviation | tests/e2e/specs/accessibility.spec.ts |  | Medium a11y defect (FAIL until owner verdict D-10): axe color-contrast serious on small muted labels in Archive (.browser-labels, .row-index, .row-main small, .browser-footer), Global search (.global-result-mark 4.46:1) and Trash (.trash-list-head); pinned in accessibility.spec.ts, not fixed to keep approved window baselines | fixed |  | 2026-11-04T09:58:58.426Z | 2026-11-05T08:52:41.501Z |
| 5 | 20 | unmet-truth | tests/e2e/specs/accessibility.spec.ts |  | 20-07 role lanes BLOCKED (ENV): Promotion reviewer queue/editors, content editor dialogs and drag handles, owner access manager, live qualification dialog trap/focus restore are not exercised; no authenticated identity on isolated staging | open |  | 2026-11-04T09:58:58.903Z |  |
| 6 | 20 | unmet-truth | tests/e2e/specs/accessibility.spec.ts |  | 20-07 not proven without a device: screen-reader announcements (nested aria-live/alert in Promotion shell), hardware keyboard and virtual-keyboard occlusion on a physical phone, physical reduced/off motion verdict (STAB-A11Y-04) belong to 20-14 | open |  | 2026-11-04T09:58:59.402Z |  |
| 7 | PORTIA-20 | unrun-verify | tests/e2e/specs/editor-layout.spec.ts |  | 20-22 editor columns, keyboard/pointer move across columns, pinned add bar and private note: staging scenarios BLOCKED (ENV); notes steps BLOCKED (OWNER, migration 20261104000100 not applied) | open |  | 2026-11-04T10:35:01.351Z |  |

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
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "20",
    "file": "tests/e2e/specs/accessibility.spec.ts",
    "line": null,
    "description": "Medium a11y defect (FAIL until owner verdict D-10): axe color-contrast serious on small muted labels in Archive (.browser-labels, .row-index, .row-main small, .browser-footer), Global search (.global-result-mark 4.46:1) and Trash (.trash-list-head); pinned in accessibility.spec.ts, not fixed to keep approved window baselines",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-04T09:58:58.426Z",
    "resolved_at": "2026-11-05T08:52:41.501Z",
    "milestone": "v1.3"
  },
  {
    "id": 5,
    "kind": "unmet-truth",
    "phase": "20",
    "file": "tests/e2e/specs/accessibility.spec.ts",
    "line": null,
    "description": "20-07 role lanes BLOCKED (ENV): Promotion reviewer queue/editors, content editor dialogs and drag handles, owner access manager, live qualification dialog trap/focus restore are not exercised; no authenticated identity on isolated staging",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-04T09:58:58.903Z",
    "resolved_at": null,
    "milestone": "v1.3"
  },
  {
    "id": 6,
    "kind": "unmet-truth",
    "phase": "20",
    "file": "tests/e2e/specs/accessibility.spec.ts",
    "line": null,
    "description": "20-07 not proven without a device: screen-reader announcements (nested aria-live/alert in Promotion shell), hardware keyboard and virtual-keyboard occlusion on a physical phone, physical reduced/off motion verdict (STAB-A11Y-04) belong to 20-14",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-04T09:58:59.402Z",
    "resolved_at": null,
    "milestone": "v1.3"
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "PORTIA-20",
    "file": "tests/e2e/specs/editor-layout.spec.ts",
    "line": null,
    "description": "20-22 editor columns, keyboard/pointer move across columns, pinned add bar and private note: staging scenarios BLOCKED (ENV); notes steps BLOCKED (OWNER, migration 20261104000100 not applied)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-04T10:35:01.351Z",
    "resolved_at": null,
    "milestone": "v1.3"
  }
]
````
