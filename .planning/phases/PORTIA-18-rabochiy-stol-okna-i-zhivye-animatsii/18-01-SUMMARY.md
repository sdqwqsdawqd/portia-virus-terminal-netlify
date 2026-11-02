---
phase: 18-rabochiy-stol-okna-i-zhivye-animatsii
plan: 01
subsystem: desktop-motion
tags: [motion, settings, localStorage, css, owner-approval]
requires: []
provides:
  - "Три режима «Анимации»: on / reduced / off от хранилища до CSS (data-motion full / reduced / off)"
  - "18-MOTION-APPROVAL.md: вердикт владельца по [PROPOSED]-значениям (approve-all, 7=A, 8=A)"
  - "18-PERF-TRACES.md: инструкция D-17 для owner PC/phone trace и таблица BLOCKED"
affects: [18-02, 18-03, 18-04, 18-05, 18-06, 18-07]
tech-stack:
  added: []
  patterns: ["системная prefers-reduced-motion не читается (D-10)", "безопасное состояние до гидрации = data-motion=full из SSR"]
key-files:
  created:
    - .planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-PERF-TRACES.md
    - .planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-MOTION-APPROVAL.md
  modified:
    - lib/accent-boot.ts
    - components/portia-desktop.tsx
    - app/portia.css
    - app/layout.tsx
    - lib/accent-theme.test.ts
    - tests/e2e/specs/visitor.spec.ts
key-decisions:
  - "Ключ portia-desktop-settings-v1 не менялся; неизвестные и устаревшие значения motion читаются как on"
  - "Владелец утвердил все [PROPOSED]-значения: цикл ярлыка 560ms, кивок окна ≤240ms/~2px, обводка паука 1px teal 38%, карточки форм 340px, drag с отступом 8px (A), Вивьян скрыта на phone при открытом окне (A)"
  - "STAB-MEDIA-06 остаётся BLOCKED: owner trace «до/после» поступят к 18-07"
requirements-completed: [STAB-MOTION-01, STAB-DESK-05, STAB-MOTION-08]
requirements-pending: [STAB-MEDIA-06]
duration: not measured
completed: 2026-11-02
status: complete
actuals:
  tokens: 9000
  tasks: 3
  commits: 4
plan_head_before: 78c24e1fc95d4a2bccfe22e6b6852262ef93e32f
plan_head_after: 857fb2ec0ae160aa965fa650e1a530d68061d9e8
---

# Phase 18 Plan 01: Три режима анимаций и утверждение motion-контракта Summary

Режим «Анимации» теперь on / reduced / off сквозь head script, клиентский эффект и CSS (системное «уменьшить движение» не читается), а владелец письменно утвердил все [PROPOSED]-значения motion-контракта.

## Задачи

| Задача | Коммит | Результат |
|--------|--------|-----------|
| 1 RED | c33ab47 | Тесты трёхрежимного motion-контракта (падали) |
| 1 GREEN | 7b31bdd | accent-boot.ts, portia-desktop.tsx, portia.css, layout.tsx: on→full, reduced→reduced, off→off; остальное → full |
| 2 | 3ffe754 | 18-PERF-TRACES.md: воспроизводимая инструкция D-17 для PC/phone, BASE 78c24e1, таблица BLOCKED |
| 3 (checkpoint, решение владельца) | 857fb2ec | 18-MOTION-APPROVAL.md: 9 строк, цитата «Утверджаю» (опечатка «Утверждаю»), пп. 7 и 8 = вариант A |

## Верификация (план-уровень, Node 22.13.1)

- `npm run build`: успешно (exit 0).
- `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts`: 37/37 pass.
- `node scripts/phase15-visual-manifest.mjs --verify-promotion`: exit 0, «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» (режим `--verify` не запускался).
- `npx playwright test --list`: 200 tests in 12 files (только перечисление).
- `git diff --name-only 78c24e1..HEAD -- tests/e2e/visual .planning/phases/PORTIA-15-baseline`: пусто (подписанные эталоны не тронуты).
- Дополнительно: `npm test` 828 тестов, 825 pass, 0 fail, 3 skipped (ранее существовавшие); `tsc --noEmit` чисто.
- E2E-прогон (Playwright) НЕ выполнялся: нужны read data source и preflight env; это BLOCKED, не pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ожидание в e2e-спеке переведено с `data-motion="reduce"` на `"off"`**
- **Found during:** Задача 1 GREEN
- **Issue:** `tests/e2e/specs/visitor.spec.ts` ожидал старое значение `reduce` для режима «Выключены»; после перехода на `off` ожидание неверно. Файл вне списка `files_modified` плана.
- **Fix:** замена в двух местах на `"off"`.
- **Files modified:** tests/e2e/specs/visitor.spec.ts
- **Commit:** 7b31bdd
- **Проверка:** спека не запускалась (нет data source) — подтвердить в 18-07.

Прочее: план выполнен как написан. Задача 3 — checkpoint:decision; вердикт получен, файл записан после ответа.

## Known Stubs

None.

## Владельцу / перенесено

- 18-PERF-TRACES.md: trace «до» можно снять на BASE 78c24e1 в любой момент; STAB-MEDIA-06 не закрыт до получения trace (18-07).
- Видимое изменение паука (п. 3) меняет пиксели кадров Phase 15; подписанные PNG не заменены, новые кандидаты пойдут на review в 18-07 (п. 9 принят к сведению).

## Threat Flags

None.

## Self-Check: PASSED

- Файлы: 18-MOTION-APPROVAL.md, 18-PERF-TRACES.md, lib/accent-boot.ts, components/portia-desktop.tsx, app/portia.css, app/layout.tsx, lib/accent-theme.test.ts, tests/e2e/specs/visitor.spec.ts существуют.
- Коммиты c33ab47, 7b31bdd, 3ffe754, 857fb2e в истории ветки; `git rev-list --count 78c24e1..HEAD` = 4.
