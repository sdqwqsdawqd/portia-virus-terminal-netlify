---
schema_version: 1
open_count: 16
waived_count: 0
fixed_count: 2
total_count: 18
last_updated: 2026-11-16T17:11:41.533Z
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
| 8 | PORTIA-22 | lint-warning | components/portia-editor.tsx | 300 | Three pre-existing no-img-element warnings remain outside plan 22-01 | open |  | 2026-11-10T07:39:20.893Z |  |
| 9 | 22 | unrun-verify | tests/e2e/specs/users-tab.spec.ts |  | Playwright users-tab responsive lane BLOCKED (ENV): production-target preflight stopped before test discovery | open |  | 2026-11-11T17:44:45.043Z |  |
| 10 | 22 | unrun-verify | tests/e2e/specs/editor-ui-contract.spec.ts |  | Playwright editor UI-contract lane BLOCKED (ENV): missing-environment preflight stopped before test discovery | open |  | 2026-11-11T17:44:46.360Z |  |
| 11 | 22 | unrun-verify | .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-MIGRATION-APPLY.md |  | Next build BLOCKED (ENV): prohibited .env.local read in plan 22-09 execution | fixed | Isolated clean worktree, Node 22.13.1, no real .env file, Next build exit 0 (22-MIGRATION-APPLY.md) | 2026-11-12T07:03:01.066Z | 2026-11-12T07:09:29.000Z |
| 12 | 26 | unrun-verify | .planning/phases/PORTIA-26-edinyy-stil-sayta/26-MAXIMIZED-AUDIT.md |  | 26-05 maximized windows: no horizontal overflow / no empty band at 1366x768, 1920x1080, 2560x1440 not rendered - BLOCKED (ENV), Playwright lane without preflight | open |  | 2026-11-16T09:11:55.234Z |  |
| 13 | 26 | unrun-verify | components/portia-desktop-shortcuts.tsx |  | 26-11 shortcuts at 521-900px: render at 521/600/768/900px x compact/default/large, drag/Alt+Arrow, page scroll from a shortcut and 2-line label not checked in a browser or on a device - BLOCKED (ENV)/(DEVICE) until Phase 27; unit test of placeShortcuts only | open |  | 2026-11-16T12:55:38.075Z |  |
| 14 | 26 | unrun-verify | components/portia-icons.tsx |  | 26-12: 18 знаков классификации (раунд 5) не проверены в браузере и на физическом экране в 16/18/24px — BLOCKED (ENV)/(DEVICE) до Phase 27 | open |  | 2026-11-16T13:04:25.140Z |  |
| 15 | 26 | unrun-verify | tests/e2e/specs/editor-ui-contract.spec.ts |  | 26-13: линия axe (editor-ui-contract, допуски nested-editor-toggle/eyebrow/подсказка/small сняты) не запускалась — BLOCKED (ENV)/(DATA), не PASS | open |  | 2026-11-16T17:00:21.137Z |  |
| 16 | 26 | unrun-verify | lib/card-toggle-name.ts |  | 26-13: A11Y-SR-01 — имя кнопки раскрытия карточки скринридером не проверено — BLOCKED (DEVICE), не PASS | open |  | 2026-11-16T17:00:21.660Z |  |
| 17 | 26 | unrun-verify | lib/window-geometry.ts |  | 26-14: п. 9 (клэмп окна слева/справа) на физическом ПК и DPR 1.25 не проверен — BLOCKED (DEVICE), Phase 27; исходный тест NOT REPRODUCED не заменяет устройство | open |  | 2026-11-16T17:11:41.019Z |  |
| 18 | 26 | unrun-verify | app/portia.css |  | 26-14: п. 10 (резкость/масштаб ярлыка в конце анимации) на DPR 1.25 и телефоне не проверен — BLOCKED (DEVICE), Phase 27; исходный тест NOT REPRODUCED не заменяет устройство | open |  | 2026-11-16T17:11:41.533Z |  |

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
  },
  {
    "id": 8,
    "kind": "lint-warning",
    "phase": "PORTIA-22",
    "file": "components/portia-editor.tsx",
    "line": 300,
    "description": "Three pre-existing no-img-element warnings remain outside plan 22-01",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-10T07:39:20.893Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "22",
    "file": "tests/e2e/specs/users-tab.spec.ts",
    "line": null,
    "description": "Playwright users-tab responsive lane BLOCKED (ENV): production-target preflight stopped before test discovery",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-11T17:44:45.043Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 10,
    "kind": "unrun-verify",
    "phase": "22",
    "file": "tests/e2e/specs/editor-ui-contract.spec.ts",
    "line": null,
    "description": "Playwright editor UI-contract lane BLOCKED (ENV): missing-environment preflight stopped before test discovery",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-11T17:44:46.360Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 11,
    "kind": "unrun-verify",
    "phase": "22",
    "file": ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-MIGRATION-APPLY.md",
    "line": null,
    "description": "Next build BLOCKED (ENV): prohibited .env.local read in plan 22-09 execution",
    "status": "fixed",
    "reason": "Isolated clean worktree, Node 22.13.1, no real .env file, Next build exit 0 (22-MIGRATION-APPLY.md)",
    "recorded_at": "2026-11-12T07:03:01.066Z",
    "resolved_at": "2026-11-12T07:09:29.000Z",
    "milestone": "v1.4"
  },
  {
    "id": 12,
    "kind": "unrun-verify",
    "phase": "26",
    "file": ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-MAXIMIZED-AUDIT.md",
    "line": null,
    "description": "26-05 maximized windows: no horizontal overflow / no empty band at 1366x768, 1920x1080, 2560x1440 not rendered - BLOCKED (ENV), Playwright lane without preflight",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-16T09:11:55.234Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 13,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "components/portia-desktop-shortcuts.tsx",
    "line": null,
    "description": "26-11 shortcuts at 521-900px: render at 521/600/768/900px x compact/default/large, drag/Alt+Arrow, page scroll from a shortcut and 2-line label not checked in a browser or on a device - BLOCKED (ENV)/(DEVICE) until Phase 27; unit test of placeShortcuts only",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-16T12:55:38.075Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 14,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "components/portia-icons.tsx",
    "line": null,
    "description": "26-12: 18 знаков классификации (раунд 5) не проверены в браузере и на физическом экране в 16/18/24px — BLOCKED (ENV)/(DEVICE) до Phase 27",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-16T13:04:25.140Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 15,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "tests/e2e/specs/editor-ui-contract.spec.ts",
    "line": null,
    "description": "26-13: линия axe (editor-ui-contract, допуски nested-editor-toggle/eyebrow/подсказка/small сняты) не запускалась — BLOCKED (ENV)/(DATA), не PASS",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-16T17:00:21.137Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 16,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "lib/card-toggle-name.ts",
    "line": null,
    "description": "26-13: A11Y-SR-01 — имя кнопки раскрытия карточки скринридером не проверено — BLOCKED (DEVICE), не PASS",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-16T17:00:21.660Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 17,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "lib/window-geometry.ts",
    "line": null,
    "description": "26-14: п. 9 (клэмп окна слева/справа) на физическом ПК и DPR 1.25 не проверен — BLOCKED (DEVICE), Phase 27; исходный тест NOT REPRODUCED не заменяет устройство",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-16T17:11:41.019Z",
    "resolved_at": null,
    "milestone": "v1.4"
  },
  {
    "id": 18,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "app/portia.css",
    "line": null,
    "description": "26-14: п. 10 (резкость/масштаб ярлыка в конце анимации) на DPR 1.25 и телефоне не проверен — BLOCKED (DEVICE), Phase 27; исходный тест NOT REPRODUCED не заменяет устройство",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-16T17:11:41.533Z",
    "resolved_at": null,
    "milestone": "v1.4"
  }
]
````
