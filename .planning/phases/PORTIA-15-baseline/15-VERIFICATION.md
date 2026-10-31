---
phase: 15-baseline
verified: 2026-11-01T12:00:00Z
status: gaps_found
score: 1/4 must-haves verified
behavior_unverified: 0
covered_files:
  - ".planning/phases/PORTIA-15-baseline/15-01-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-01-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-02-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-02-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-03-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-03-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-04-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-04-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-05-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-05-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-06-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-06-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-07-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-07-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-08-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-08-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-09-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-09-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-10-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-10-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-11-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-11-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-12-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-12-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-13-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-13-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-14-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-14-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-15-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-15-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-16-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-16-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/evidence/15-CANDIDATE-INDEX.json"
  - "components/portia-desktop.tsx"
  - "lib/phase15-visual-manifest.test.ts"
  - "next.config.ts"
  - "playwright.config.ts"
  - "scripts/phase15-visual-manifest.mjs"
  - "tests/e2e/fixtures/actors.ts"
  - "tests/e2e/fixtures/diagnostics.ts"
  - "tests/e2e/fixtures/target-guard.ts"
  - "tests/e2e/specs/roles.spec.ts"
covered_digest: "v3:sha256:a408d038a00f5163d66f221d774b3c4e2f4fc490897fe6f881425de37ada273c"
re_verification:
  previous_status: gaps_found
  previous_score: 1/4
  gaps_closed:
    - "G6: UI-map / approval verification не воспроизводились из tracked-файлов"
  gaps_remaining:
    - "G1: disposable authenticated roles и изолированный Supabase"
    - "G2: read backing для 15 data-dependent Playwright-дорожек в чистом checkout"
    - "G3: 33 BLOCKED visual-строки"
    - "G4: 18 отклонённых motion-кандидатов"
    - "G5: физический PC/phone UAT"
  regressions: []
gaps:
  - truth: "Из чистого checkout запускается committed Playwright/axe suite для visitor, participant, editor, promo reviewer и owner на PC/phone с фиксированными данными и без мутаций production (SC2)"
    status: failed
    reason: "G1+G2: все четыре привилегированные роли заблокированы (нет ни одного производителя server-probe sessionProof, нет изолированной цели), а 15 data-backed тестов требуют read backing; блокеры записаны как BLOCKED/skip, не как pass."
    artifacts:
      - path: "tests/e2e/fixtures/actors.ts"
        issue: "READY возможен только при sessionProof source=server-probe; производителя proof в репозитории нет (grep: единственное упоминание в самом типе)"
      - path: "tests/e2e/specs/roles.spec.ts"
        issue: "participant/editor/promo-reviewer/owner дорожки всегда skip"
    missing:
      - "Изолированный Supabase и одноразовые identities (Phase 16/19)"
      - "Server-derived session proof, положительные и отрицательные решения авторизации, cleanup receipt"
      - "Read-only источник данных для data-dependent lanes"
  - truth: "Одобренные visual baselines воспроизводят desktop, окна, Повышение, редактор, паука, паутину, Вивьян и phone layout (SC3)"
    status: failed
    reason: "G3+G4: утверждено 33 состояния; 18 motion-кандидатов REJECTED (паук/паутина/ярлык), 33 состояния BLOCKED (привилегированные актёры, representative phone/DPR, semantic states). Паук и паутина не покрыты утверждённым baseline."
    artifacts:
      - path: "tests/e2e/visual/__screenshots__/"
        issue: "33 PNG; нет утверждённых кадров паука/паутины/motion-shortcut; нет phone/DPR-эталонов для BLOCKED-строк"
    missing:
      - "Замена 18 отклонённых motion-кандидатов (Phase 18)"
      - "33 BLOCKED-состояния (Phases 16/18/19/22)"
  - truth: "Владелец может сравнить captures с текущим сайтом и явно одобрить UI/motion-контракт (SC1)"
    status: partial
    reason: "Подписано только по 51 захваченному хэшу (33 APPROVED, 18 REJECTED); 33 строки не захвачены (BLOCKED). Контракт утверждён не полностью."
    artifacts:
      - path: ".planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-APPROVAL.md"
        issue: "18 REJECTED; 33 BLOCKED вне ledger"
    missing:
      - "Решение владельца по отклонённым и незахваченным состояниям (Phase 18 и далее)"
  - truth: "Физическая проверка владельца на PC (DPR 1.25) и телефоне"
    status: failed
    reason: "G5: физические устройства не доказаны; остаётся BLOCKED до Phase 22."
    artifacts: []
    missing:
      - "Owner UAT на физических PC и phone (Phase 22)"
deferred:
  - truth: "Disposable authenticated roles, isolated Supabase, RLS/RPC execution"
    addressed_in: "Phase 16 / 19"
    evidence: "15-ROLE-GATE.md: Phase 16 может вернуть строки только при attestation, server-derived proof, authz-решениях и cleanup receipt"
  - truth: "Замена 18 отклонённых motion-кандидатов"
    addressed_in: "Phase 18"
    evidence: "15-VISUAL-APPROVAL.md / 15-TRACEABILITY.md закрепляют owner phase 18"
  - truth: "Физический PC/phone UAT"
    addressed_in: "Phase 22"
    evidence: "15-BASELINE-RESULTS.md: Physical PC DPR 1.25 and representative phone UAT BLOCKED, Phase 22 owner UAT"
---

# Phase 15: Baseline — повторная верификация (после плана 15-16)

**Phase Goal:** Текущий PORTIA OS зафиксирован как воспроизводимый и одобренный контракт до любых рефакторингов или точечных исправлений.
**Verified:** 2026-11-01, HEAD `5e8087b`, Node 22.13.1 (из `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`; машинный дефолт — 24)
**Status:** `gaps_found`
**Re-verification:** Да — после gap closure 15-16. Предыдущий отчёт: `gaps_found`, 1/4.

Итог: G6 закрыт и подтверждён независимо (в одноразовом клоне HEAD без `.runs/`). G1–G5 остаются открытыми и подтверждены повторно по коду и evidence. Счёт 1/4 не меняется: план 15-16 касался только воспроизводимости инструментов. Ни один BLOCKED не записан как pass.

## Повторная проверка пробелов G1–G6

| # | Пробел | Статус | Независимое доказательство |
|---|---|---|---|
| G1 | Disposable roles / изолированный Supabase | **ОТКРЫТ** | `tests/e2e/fixtures/actors.ts:25,89` — `READY` только при `source === "server-probe"`; других производителей proof в `tests/` и `lib/` нет. `15-ROLE-GATE.md`: participant/editor/promo-reviewer/owner = BLOCKED `TARGET_NOT_ISOLATED`, 0 privileged lanes passed. Совпадает с 20 skip в baseline-результатах. |
| G2 | Read backing для 15 data-dependent lanes | **ОТКРЫТ** | В чистом клоне нет ни backing, ни `.env`; по `15-BASELINE-RESULTS.md` дорожки падают `ENOTFOUND` и записаны BLOCKED (DATA). Я браузерный suite повторно не запускал (нет данных, сборка потребует локальные секреты) — полагаюсь на recorded evidence и пометку. |
| G3 | 33 BLOCKED visual-строки | **ОТКРЫТ** | Из `15-CANDIDATE-INDEX.json`: 84 строки = 51 CAPTURED + 33 BLOCKED (visitor 7+2+1+2, editor 7, participant 10, promo-reviewer 3, owner 1). В `tests/e2e/visual/__screenshots__/` ровно 33 PNG. |
| G4 | 18 отклонённых motion-кандидатов | **ОТКРЫТ** | `15-VISUAL-APPROVAL.md`: 18 строк `REJECTED` (в т.ч. `motion-shortcut-*`), 33 `APPROVED`. Утверждённого baseline для паука/паутины нет. |
| G5 | Физический PC/phone UAT | **ОТКРЫТ** | UAT-артефакта в каталоге фазы нет; `15-BASELINE-RESULTS.md` помечает DPR 1.25 и phone UAT как BLOCKED (Phase 22). |
| G6 | UI-map/approval не воспроизводимы из tracked-файлов | **ЗАКРЫТ (подтверждено)** | Одноразовый клон `5e8087b`, `.runs/` отсутствует: `--verify-promotion` -> 33 exact bytes; `--verify-ui-map` -> `84 rows (51 captured, 33 blocked). Source: tracked index`; `--verify-approval` -> `51 captured rows; 33 blocked rows excluded. Source: tracked index`; все exit 0. Tamper (хэш одной строки индекса обнулён): `--verify-ui-map` -> `PORTIA_UI_MAP_HASH_MISMATCH`, `--verify-approval` -> `PORTIA_APPROVAL_VERDICT_MISSING`, оба exit 1. Индекс не содержит абсолютных путей/имён (0 совпадений), `.runs/` в `.gitignore`. Основное дерево: `Source: capture`. Тесты манифеста 37/37. Ограничение: в клоне байты PNG кандидатов не пересчитываются (утверждённые байты покрыты `--verify-promotion`). Это честно помечено в выводе. |

## Достижение цели

Контролирующие must-haves — Success Criteria из ROADMAP.

| # | Истина | Статус | Доказательство |
|---:|---|---|---|
| 1 | Владелец может сравнить captures с текущим сайтом и явно одобрить UI/motion-контракт; предлагаемые изменения отмечены отдельно | ✗ PARTIAL (gap) | `Qloxz` вынес вердикт по всем 51 захваченным хэшам: 33 APPROVED, 18 REJECTED. 33 состояния не захвачены (BLOCKED). Authority (candidate set / source commit / contract digest) проверяется `verifyAuthority()`; `--verify-approval` проходит. Контракт одобрен не полностью. |
| 2 | Из чистого checkout запускается committed Playwright/axe suite для всех пяти ролей на PC/phone с фиксированными условиями и без мутаций production | ✗ FAILED / BLOCKED (G1, G2) | Visitor и tooling/a11y/diagnostics дорожки есть и исполняются; четыре привилегированные роли всегда skip (нет производителя server proof); 15 data-backed тестов требуют read backing. Skip не засчитан как pass. Production не мутировался. |
| 3 | Одобренные baselines воспроизводят desktop, окна, Повышение, редактор, паука, паутину, Вивьян и phone layout | ✗ FAILED / PARTIAL (G3, G4) | `--verify-promotion` подтверждает 33 exact bytes; паук/паутина/shortcut-motion отклонены, phone/DPR/privileged строки BLOCKED. |
| 4 | Неожиданная browser/console/network/CSP ошибка блокирует gate, ожидаемый отказ виден как безопасное русское состояние, для следующих фаз задана цепочка доказательств GSD | ✓ VERIFIED | `tests/e2e/fixtures/diagnostics.ts` перехватывает `pageerror`, `requestfailed`, hydration, CSP и console error через редактирующий путь; allowlist истекает по реальному времени (`new Date()`); `npm test` (включая `lib/e2e-diagnostics.test.ts`) 648/649 pass, 0 fail. Traceability `STAB-BASE-01..06` и локальный `15-SECURITY.md` присутствуют. Браузерные 15/15 diagnostics и 10/10 axe взяты из записанного evidence, мною не перезапускались. |

**Score:** 1/4 истин подтверждено (0 present-but-behavior-unverified).

## Deferred Items

| # | Пункт | Phase | Основание |
|---|---|---|---|
| 1 | Roles / isolated Supabase / RLS-RPC | 16 / 19 | `15-ROLE-GATE.md`, `15-TRACEABILITY.md` |
| 2 | Замена 18 motion-кандидатов | 18 | `15-VISUAL-APPROVAL.md` |
| 3 | Физический UAT | 22 | `15-BASELINE-RESULTS.md` |

Эти элементы не меняют статус: они остаются gaps, потому что они же — часть Success Criteria фазы 15.

## Требования (REQUIREMENTS.md)

Все шесть ID (`STAB-BASE-01..06`) заявлены в планах и присутствуют в REQUIREMENTS.md; orphaned нет. Статусы в REQUIREMENTS.md согласуются с кодом и evidence.

| Requirement | REQUIREMENTS.md | Статус | Основание |
|---|---|---|---|
| `STAB-BASE-01` | `[x]` Complete | ✓ SATISFIED | Текущие экраны/контракты/состояния записаны (ledger, UI-контракт, 33 утверждённых PNG). |
| `STAB-BASE-02` | `[ ]` Pending | ✗ BLOCKED | Роли participant/editor/reviewer/owner не доказаны (G1); data-lanes без backing (G2). |
| `STAB-BASE-03` | `[ ]` Pending | ✗ BLOCKED | Покрыто 33 из 84 состояний; паук/паутина отклонены (G3, G4). |
| `STAB-BASE-04` | `[ ]` Pending | ✗ BLOCKED | Контракт подписан для 51 захваченного хэша, из них 18 REJECTED; 33 не захвачены. План 15-16 (G6) требований не продвигает. |
| `STAB-BASE-05` | `[x]` Complete | ✓ SATISFIED | Диагностика, a11y 0 critical/serious, локальный security review PASS по repository-local scope. |
| `STAB-BASE-06` | `[ ]` Pending | ✗ BLOCKED | Цепочка полна локально, но нет staging role proof, data-lanes и физического UAT. |

**Покрытие:** 2/6 удовлетворено.

## Артефакты и связи (уровни 1-3)

| Артефакт / связь | Статус | Детали |
|---|---|---|
| `scripts/phase15-visual-manifest.mjs` | ✓ VERIFIED / WIRED | Режимы `--verify-promotion/--verify-ui-map/--verify-approval/--write-candidate-index`; индекс используется только вызовами с `allowIndex`. |
| `evidence/15-CANDIDATE-INDEX.json` | ✓ VERIFIED | Tracked, схема/setId/sourceCommit/84 строки; tamper даёт exit 1. |
| `lib/phase15-visual-manifest.test.ts` | ✓ VERIFIED | 37/37 pass (основное дерево и клон). |
| `tests/e2e/visual/__screenshots__/` | ✓ VERIFIED | 33 PNG, `--verify-promotion` проходит в обоих деревьях. |
| Actor fixture -> реальный серверный контекст | ✗ NOT WIRED | Нет производителя server-probe proof. |
| Playwright data-lanes -> источник данных | ✗ NOT WIRED | Нет read backing. |

## Поведенческие проверки (мной, Node 22.13.1)

| Проверка | Результат |
|---|---|
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | ✓ 37/37 |
| `--verify-promotion`, `--verify-ui-map`, `--verify-approval` (основное дерево) | ✓ exit 0, `Source: capture` |
| То же в одноразовом клоне `5e8087b` без `.runs/` | ✓ exit 0, `Source: tracked index` |
| Tamper индекса в клоне | ✓ exit 1, стабильные коды `PORTIA_*` |
| `npm test` | ✓ 649 тестов, 648 pass, 0 fail, 1 skip |
| `npm exec tsc -- --noEmit` | ✓ exit 0 |
| `npm run lint` | ✓ 0 errors, 18 warnings |
| Playwright / `npm run build` / `npm audit` | Не запускались (нужны данные/секреты, сеть); ранее записано в evidence |
| Режим `--verify` (по умолчанию) | Не запускался (перезаписывает подписанное evidence) |

## Anti-patterns и предупреждения

Блокирующих debt-маркеров и стабов не найдено. Предупреждения:

| # | Находка | Серьёзность | Влияние |
|---|---|---|---|
| W1 | ROADMAP: «Do not modify product source in Phase 15». Коммит `b535d14` (план 15-03) изменил `components/portia-desktop.tsx` (`role="toolbar"`, a11y-фикс) и `next.config.ts` (`upgrade-insecure-requests` отключается при `PORTIA_E2E_ALLOW_HTTP=1`). Это раскрыто в `15-03-SUMMARY.md`, но прежнее утверждение отчёта «No product-source change was made in Phase 15» неточно (оно было верно только для плана 15-14). | Warning | Нарушение кросс-плановой границы; визуально нейтрально. Если `PORTIA_E2E_ALLOW_HTTP=1` попадёт в production-окружение, ослабляется CSP. Нужна фиксация владельцем. |
| W2 | `15-REVIEW.md` (0 critical, 6 warning), все диспозиции `open` в `15-REVIEW-DISPOSITION.md`. Существенные: WR-01 (подделываемый `sessionProof`, относится к G1), WR-02 (допуск до 2 300 px, маска всего `.personnel-app`), WR-04 (visitor-preflight принимает любой `*.supabase.co`, deny-list не применяется), WR-05/06 (Node-пин строже `engines`; ANON vs PUBLISHABLE key). | Warning | Влияют на силу, но не на достоверность pass-результатов; WR-02 ослабляет SC3, WR-04 — безопасность visitor-дорожки (читает, но может смотреть на production). |
| W3 | Клон без `.runs/` не пересчитывает хэши PNG кандидатов (помечено в выводе `Source: tracked index`). | Info | Допустимое, честно помеченное ограничение. |

## Требуется участие человека

1. Физический PC (DPR 1.25) и phone UAT владельца — Phase 22.
2. Решение владельца: предоставить read-only источник данных для 15 data-dependent дорожек, либо отнести их в Phase 16.
3. Диспозиция 12 находок `15-REVIEW.md` (все `open`) и фиксация W1.

## Итог

Phase 15 остаётся `gaps_found`. Выполнено и подтверждено независимо: G6 (воспроизводимая проверка UI-map/approval из tracked-файлов с fail-closed tamper-защитой), 33 точных утверждённых baseline-байта, диагностический gate, 2 из 6 требований. Остаются открытыми по конкретным причинам с названными владельцами: G1 (роли), G2 (данные), G3 (33 BLOCKED состояния), G4 (18 отклонённых motion-кандидатов), G5 (физический UAT). Фаза не должна помечаться завершённой и не должна автоматически переходить дальше. Рекомендация: закрывать G1-G5 в фазах 16/18/19/22; не повторять планирование gap closure для фазы 15, пока не появятся изолированная цель или read backing.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
