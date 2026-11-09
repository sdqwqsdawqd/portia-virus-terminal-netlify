---
phase: 15-baseline
plan: 20
subsystem: testing
tags: [gap-closure, reconciliation, evidence, documentation]
requires:
  - phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
    provides: 16-LIVE-RUN.md, receipt-playwright.json (доказательства G1/G2)
provides:
  - evidence/15-GAP-RECONCILIATION.md (G1-G5: прежний и текущий статус, доказательство, коммит, владелец)
  - указатели на сверку в 15-TRACEABILITY.md, 15-BASELINE-RESULTS.md, 15-ROLE-GATE.md
affects: [phase-15-reverification, phase-18, phase-19, phase-20, phase-22]
tech-stack:
  added: []
  patterns: [append-only evidence pointers, counts computed from signed JSONL]
key-files:
  created:
    - .planning/phases/PORTIA-15-baseline/evidence/15-GAP-RECONCILIATION.md
  modified:
    - .planning/phases/PORTIA-15-baseline/evidence/15-TRACEABILITY.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-BASELINE-RESULTS.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-ROLE-GATE.md
key-decisions:
  - "G1 CLOSED, G2 PARTIAL (7 PASS / 8 BLOCKED), G3/G4/G5 OPEN с владельцами; статусы STAB-BASE не менялись"
requirements-completed: []
duration: 15min
completed: 2026-11-01
status: complete
actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: 8bbd708bdbf60e65c493efa57963f39bb9b4011b
plan_head_after: 946c380d1e49018d2f79afad2b639cf5cf8d3905
---

# Phase 15 Plan 20: Сверка G1-G5 после Phase 16 Summary

Документальная сверка пробелов G1-G5 с доказательствами Phase 16: G1 CLOSED, G2 PARTIAL (7 PASS, 8 BLOCKED), G3-G5 OPEN с владельцами; код, подписанные артефакты и статусы требований не тронуты.

## Что сделано

- **Task 1** (`bddd442`): создан `evidence/15-GAP-RECONCILIATION.md`. Таблицы G1-G5, 15 data-lanes (L1-L5), 33 BLOCKED-строки по recoveryPhase (P16/P18/P19/P20/P22), раздел «Влияние на требования». Счётчики G3 посчитаны кодом по JSONL подписанного `15-FRAME-TEST-MAP.md`, G4 по ledger `15-VISUAL-APPROVAL.md`. Автоматический verify из плана: `reconciliation ok: G1-G5, 15 lanes, 33 blocked rows, 18 rejected`.
- **Task 2** (`946c380`): в конец `15-TRACEABILITY.md`, `15-BASELINE-RESULTS.md`, `15-ROLE-GATE.md` дописаны разделы-указатели (`git diff --numstat`: 14/0, 14/0, 6/0, удалённых строк нет). Для CRLF-файла `15-BASELINE-RESULTS.md` добавление сделано в CRLF.

## Проверки

- `git diff --quiet cea3644` по подписанным файлам, PNG, `15-VERIFICATION.md`, `REQUIREMENTS.md`, `scripts/phase15-visual-manifest.mjs`: чисто.
- `lib/phase15-visual-manifest.test.ts`: 37 pass, 0 fail.
- `--verify-promotion`: «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» (режим `--verify` не запускался).
- Идентификатор цели Phase 16 в файлах Phase 15: 0 вхождений.
- Node 22.13.1 (reference) был на PATH.

## Deviations from Plan

None - plan executed exactly as written. Расхождений между фактами из `<context>` и исходными файлами нет (проверено: 9/6/12/5/1 BLOCKED, 18 REJECTED = 9 motion + 9 прочих, коммиты `cac51e1`, `504cefa`, `4f3dd87` существуют).

Замечание: `git diff cea3644 HEAD` показывает также `ROADMAP.md`, `STATE.md`, `15-20-PLAN.md`; они изменены коммитом создания плана `8bbd708` (до этого исполнения), не этим планом.

## Открытые вопросы владельцу (Qloxz)

1. Переназначение 9 строк G3 с recoveryPhase 16 (ISOLATED_AUTH_REQUIRED: editor-conflict-error, editor-dirty-saving-saved, editor-long-list-dialog, editor-phone-keyboard, editor-role-clean, editor-role-closed, editor-wysiwyg, owner-editor-access, promotion-reviewer-editor). Phase 16 закрыта и их не сняла; предпосылка (изолированная цель, server-derived proof) теперь есть. Подписанный map не редактировался, фазу-владельца выбирает владелец.
2. Формулировка «18 rejected motion candidates» неточна: на деле 9 motion (shortcut ×5, spider ×3, web-wave ×1) и 9 строк окна поиска или покоя рабочего стола (window-search ×8, desktop-clean-rest ×1).

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: `.planning/phases/PORTIA-15-baseline/evidence/15-GAP-RECONCILIATION.md`
- FOUND commits `bddd442`, `946c380` (ancestors of HEAD)
