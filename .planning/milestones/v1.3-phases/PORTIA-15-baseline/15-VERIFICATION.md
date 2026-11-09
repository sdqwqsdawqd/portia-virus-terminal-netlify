---
phase: 15-baseline
verified: 2026-11-01T23:00:00Z
status: passed
score: 1/4 must-haves verified
behavior_unverified: 0
covered_files:
  - ".env.example"
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
  - ".planning/phases/PORTIA-15-baseline/15-17-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-17-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-18-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-18-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-19-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-19-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/15-20-PLAN.md"
  - ".planning/phases/PORTIA-15-baseline/15-20-SUMMARY.md"
  - ".planning/phases/PORTIA-15-baseline/evidence/15-CANDIDATE-INDEX.json"
  - ".planning/phases/PORTIA-15-baseline/evidence/15-GAP-RECONCILIATION.md"
  - "components/portia-desktop.tsx"
  - "lib/e2e-preflight.test.ts"
  - "lib/e2e-visual-policy.test.ts"
  - "lib/phase15-visual-manifest.test.ts"
  - "lib/security-headers.test.ts"
  - "next.config.ts"
  - "playwright.config.ts"
  - "scripts/phase15-e2e-preflight.mjs"
  - "scripts/phase15-visual-manifest.mjs"
  - "tests/e2e/README.md"
  - "tests/e2e/fixtures/actors.ts"
  - "tests/e2e/fixtures/diagnostics.ts"
  - "tests/e2e/fixtures/session-probe.ts"
  - "tests/e2e/fixtures/target-guard.ts"
  - "tests/e2e/fixtures/visual-policy.ts"
  - "tests/e2e/specs/roles.spec.ts"
covered_digest: "v3:sha256:2caf4512c70e64706ed2be31c3464736fb905bd8ba88f46acbc60cba0373bbe1"
re_verification:
  previous_status: gaps_found
  previous_score: 1/4
  gaps_closed:
    - "G1: disposable authenticated roles и изолированный Supabase - закрыт Phase 16 (16-LIVE-RUN.md: 4 роли x 5 проектов PASS, API-матрица 7 маршрутов x 5 ролей, оба revoke на открытой сессии, receipt-playwright.json status PASS, residual 0); в коде появился производитель proof (tests/e2e/fixtures/session-probe.ts, probeSession)"
    - "G2 (частично): 7 из 15 data-dependent lanes получили read backing и PASS (settings persist x5, WebKit-phone shell diagnostics, vivian-activity)"
    - "Уточнение G4: '18 отклонённых motion-кандидатов' неточно - 9 motion + 9 строк window-search/desktop-clean-rest (проверено по 15-VISUAL-APPROVAL.md)"
  gaps_remaining:
    - "G2 (остаток): 8 data-lanes BLOCKED - 7 пиксельных application-сравнений (D6) и Firefox search-restored (DATA-SEED)"
    - "G3: 33 BLOCKED visual-строки (9 P16 без фазы-владельца, 6 P18, 12 P19, 5 P20, 1 P22)"
    - "G4: 18 REJECTED-строк (9 motion + 9 window-search/desktop-clean-rest)"
    - "G5: физический PC (DPR 1.25) и phone UAT"
  regressions: []
gaps:
  - truth: "Владелец может сравнить captures с текущим сайтом и явно одобрить UI/motion-контракт (SC1)"
    status: partial
    reason: "Подписано только по 51 захваченному хэшу (33 APPROVED, 18 REJECTED). 33 строки не захвачены (BLOCKED). Для 9 из них (recoveryPhase 16, ISOLATED_AUTH_REQUIRED) фазы-владельца больше нет: Phase 16 закрыта и их не захватывала; подписанный map по-прежнему указывает Phase 16 и не редактировался."
    artifacts:
      - path: ".planning/phases/PORTIA-15-baseline/evidence/15-FRAME-TEST-MAP.md"
        issue: "9 строк BLOCKED с recoveryPhase 16 (editor-conflict-error, editor-dirty-saving-saved, editor-long-list-dialog, editor-phone-keyboard, editor-role-clean, editor-role-closed, editor-wysiwyg, owner-editor-access, promotion-reviewer-editor) - owner phase закрыта"
    missing:
      - "Решение владельца: в какую фазу (вероятно 20 для редактора, 19 для promotion-reviewer-editor) переназначить 9 строк; ROADMAP/CONTEXT этого не назначают"
      - "Решение владельца по 18 REJECTED и 24 строкам с живыми owner-фазами 18/19/20/22"
  - truth: "Из чистого checkout запускается committed Playwright/axe suite для visitor, participant, editor, promo reviewer и owner на PC/phone, с фиксированными данными, временем, DPR, шрифтами и случайностью и без мутаций production (SC2)"
    status: partial
    reason: "Роли теперь доказаны (G1 CLOSED, Phase 16). Но фиксированные данные не обеспечены: изолированный backend не содержит утверждённого контента, поэтому 8 data-lanes BLOCKED (7 пиксельных application-сравнений по D6; Firefox search-restored по DATA-SEED, 783 px отличий). Полный прогон Phase 16: 136 PASS, 5 FAIL (классифицированы как D6/DATA-SEED), 59 SKIP - гейт не зелёный с фиксированными данными. BLOCKED/FAIL не засчитаны как pass."
    artifacts:
      - path: "tests/e2e/visual/__screenshots__/"
        issue: "утверждённые PNG не воспроизводятся на изолированном backend для 7 application-сравнений и search-restored"
    missing:
      - "Воспроизводимый seed/fixture данных, совпадающий с утверждёнными PNG, либо решение владельца о новых эталонах (D6)"
      - "Назначение фазы-владельца для 7 application-сравнений: 16-LIVE-RUN.md пишет 'Phase 18-19', но приложения (База вирусов, Информация, Корзина, Глобальный поиск) по ROADMAP относятся к Phase 20 SC1/SC3"
  - truth: "Одобренные visual baselines воспроизводят desktop, окна, Повышение, редактор, паука, паутину, Вивьян и phone layout (SC3)"
    status: failed
    reason: "Утверждено 33 состояния. Редактор (9 P16-строк) без владельца, Повышение (12 P19-строк), паук/паутина/shortcut (9 motion REJECTED, Phase 18) и phone/DPR/окна не покрыты утверждённым baseline."
    artifacts:
      - path: "tests/e2e/visual/__screenshots__/"
        issue: "33 PNG; нет утверждённых кадров паука/паутины/shortcut-motion, Повышения, редактора"
    missing:
      - "Замена 9 motion REJECTED (Phase 18), 12 строк Повышения (Phase 19), 5 application-states (Phase 20), 6 P18-строк, 1 P22-строка"
      - "Фаза-владелец для 9 строк редактора"
deferred:
  - truth: "Физический PC (DPR 1.25) и phone UAT (G5)"
    addressed_in: "Phase 22"
    evidence: "ROADMAP Phase 22 SC2: 'Владелец на физическом PC/phone после clean reload принимает полный Повышение, window bounds, ... PNG-паука, паутину, ярлыки, Вивьян, поиск и bounded ed...'; 16-LIVE-RUN.md: физические устройства BLOCKED, владелец Phase 22"
  - truth: "Замена 9 отклонённых motion-кандидатов (shortcut x5, spider x3, web-wave x1)"
    addressed_in: "Phase 18"
    evidence: "ROADMAP Phase 18 SC3, SC4, SC6, SC7 (ярлык, PNG-паук, волны паутины, единая система ярлыков); 15-VISUAL-APPROVAL.md: 'Rejected rows ... are owned by Phase 18'"
  - truth: "9 REJECTED-строк window-search (x8) и desktop-clean-rest (x1)"
    addressed_in: "Phase 18"
    evidence: "15-VISUAL-APPROVAL.md назначает Phase 18; ROADMAP Phase 18 SC1 (окна на PC/phone). Назначение держится на evidence, а не на явной формулировке ROADMAP - см. human_verification"
  - truth: "6 BLOCKED-строк P18: motion-boot, motion-wallpapers, window-search-maximized/minimized (phone)"
    addressed_in: "Phase 18"
    evidence: "ROADMAP Phase 18 SC4 (Boot, обои) и SC1 (окна на phone); подписанный 15-FRAME-TEST-MAP.md: recoveryPhase 18"
  - truth: "12 BLOCKED-строк P19: motion-window-lock и 11 состояний Повышения"
    addressed_in: "Phase 19"
    evidence: "ROADMAP Phase 19 SC1-SC5 (участник, reviewer, qualification, физическая проверка); recoveryPhase 19"
  - truth: "5 BLOCKED-строк P20: applications-system empty/fatal error/loading/permission denied/stale"
    addressed_in: "Phase 20"
    evidence: "ROADMAP Phase 20 SC1 (приложения сохраняют валидированное поведение); recoveryPhase 20"
  - truth: "1 BLOCKED-строка P22: desktop-firefox (PIXEL_AUTHORITY_NOT_SIGNED)"
    addressed_in: "Phase 22"
    evidence: "ROADMAP Phase 22 SC1 (approved visuals); recoveryPhase 22"
human_verification:
  - test: "Переназначить 9 строк G3 с recoveryPhase 16 (editor-* x7, owner-editor-access, promotion-reviewer-editor)"
    expected: "Владелец называет фазу (или явно снимает строки с baseline). Без этого строки остаются без владельца, а STAB-BASE-03/04 не могут быть закрыты."
    why_human: "Phase 16 закрыта и их не захватывала; ROADMAP их не назначает. Подписанный map нельзя редактировать без решения владельца. Фазу не выдумываю."
  - test: "Подтвердить фазу-владельца для 7 пиксельных application-сравнений и Firefox search-restored (G2 остаток)"
    expected: "Владелец подтверждает 'Phase 18-19' из 16-LIVE-RUN.md либо указывает Phase 20 (приложения) и источник seed-данных"
    why_human: "Формулировка Phase 16 расходится с ROADMAP (приложения - Phase 20); решение по D6 и DATA-SEED - за владельцем"
  - test: "Подтвердить формулировку W1: исключение b535d14 из правила 'Do not modify product source in Phase 15'"
    expected: "Владелец письменно подтверждает или правит строку в 15-REVIEW-DISPOSITION.md"
    why_human: "Запись опирается на scope-решение, переданное оркестратором; отдельного письменного текста от владельца нет"
  - test: "IN-06 часть 1: какие снимки window-search в firefox-desktop считаются авторитетными"
    expected: "Ответ владельца, который затем попадёт в подписанный 15-FRAME-TEST-MAP.md"
    why_human: "Решение владельца; нельзя записать в подписанный артефакт без явного ответа"
  - test: "Физический PC (DPR 1.25) и phone UAT"
    expected: "Owner UAT (Phase 22)"
    why_human: "Физические устройства"
---

# Phase 15: Baseline - повторная верификация (после Phase 16 и плана 15-20)

**Phase Goal:** Текущий PORTIA OS зафиксирован как воспроизводимый и одобренный контракт до любых рефакторингов или точечных исправлений.
**Verified:** 2026-11-01, HEAD `6009669`, Node 22.13.1 (reference)
**Status:** `gaps_found`
**Re-verification:** Да - после завершения Phase 16 и документальной сверки плана 15-20. Предыдущий отчёт: `gaps_found`, 1/4, написан до Phase 16.

Итог: Phase 16 закрыла G1 (роли и изолированный Supabase) и частично G2; это подтверждено независимо в коде и в evidence Phase 16. План 15-20 честно записал это в документы, но не менял код, подписанные артефакты и статусы требований (проверено `git diff`). SC1-SC3 остаются неполными: 33 визуальных состояния не захвачены, 18 отклонены, 8 data-lanes BLOCKED. Для 9 строк G3 нет фазы-владельца - это открытый вопрос владельцу, а не отложенный пункт. Счёт 1/4 не меняется: SC2 продвинулся (роли доказаны), но не выполнен целиком.

## G1-G5: текущее состояние (проверено)

| # | Пробел | Было | Сейчас | Независимое доказательство |
|---|---|---|---|---|
| G1 | Disposable roles / изолированный Supabase | ОТКРЫТ | **ЗАКРЫТ** | `16-LIVE-RUN.md` (Browser, G1): 4 роли x 5 проектов PASS, API-матрица 7 маршрутов x 5 ролей, revoke без re-login, HTTP CAS. `receipt-playwright.json`: `status: PASS`, `residual` = 0 по authUsers/content/editors/promo/storage (прочитано мной). Код: `tests/e2e/fixtures/session-probe.ts` (`probeSession`, реестр proofs, `isVerifiedSession`); `actors.ts` теперь требует `isVerifiedSession(...)` для READY (раньше - тип `source: "server-probe"` без производителя). Коммиты `cac51e1`, `504cefa`, `4f3dd87` существуют (`git cat-file -t` = commit). Живые прогоны мной не повторялись. |
| G2 | Read backing для 15 data-lanes | ОТКРЫТ | **ЧАСТИЧНО: 7 PASS / 8 BLOCKED** | `16-LIVE-RUN.md`, 'Классификация 15 data-lanes (G2, D6)'. PASS: settings x5, WebKit-phone shell, vivian-activity. BLOCKED: 7 пиксельных application-сравнений (D6; наблюдение '6 из 10 совпали' информационное) и Firefox search-restored (DATA-SEED, 783 px). Сверка 15-20 совпадает с первоисточником. |
| G3 | 33 BLOCKED visual-строки | ОТКРЫТ | **ОТКРЫТ** | Пересчитал JSONL подписанного `15-FRAME-TEST-MAP.md`: 84 строки = 51 CAPTURED + 33 BLOCKED (P16: 9, P18: 6, P19: 12, P20: 5, P22: 1). Совпадает с `15-GAP-RECONCILIATION.md`. В `tests/e2e/visual/__screenshots__/` ровно 33 PNG. |
| G4 | REJECTED-строки | ОТКРЫТ | **ОТКРЫТ, формулировка уточнена** | `15-VISUAL-APPROVAL.md`: 18 `REJECTED` = 9 motion (shortcut x5, spider x3, web-wave x1) + 9 прочих (window-search x8, desktop-clean-rest x1). Предыдущий отчёт называл все 18 'motion-кандидатами' - это было неточно. |
| G5 | Физический PC/phone UAT | ОТКРЫТ | **ОТКРЫТ** | UAT-артефакта нет; `16-LIVE-RUN.md`: физические устройства BLOCKED, Phase 22. |

## Достижение цели

| # | Истина | Статус | Доказательство |
|---:|---|---|---|
| 1 | Владелец может сравнить captures с текущим сайтом и явно одобрить UI/motion-контракт | ✗ PARTIAL (gap) | 51 захваченный хэш: 33 APPROVED, 18 REJECTED; 33 состояния не захвачены, 9 из них без фазы-владельца. `--verify-promotion` проходит (33 точных байта). |
| 2 | Из чистого checkout запускается committed Playwright/axe suite для всех пяти ролей на PC/phone с фиксированными данными, без мутаций production | ✗ PARTIAL (gap) | Роли и API-матрица доказаны на изолированной цели (G1), production не затрагивался (`attest`, mutation guard). Но фиксированных данных нет: 8 data-lanes BLOCKED, в полном прогоне 5 FAIL (D6/DATA-SEED). Не засчитано как pass. |
| 3 | Одобренные baselines воспроизводят desktop, окна, Повышение, редактор, паука, паутину, Вивьян и phone layout | ✗ FAILED | 33 точных байта подтверждены; редактор (9 строк, без владельца), Повышение (12), паук/паутина/shortcut (9 REJECTED), phone/DPR/окна - не покрыты. |
| 4 | Неожиданная browser/console/network/CSP ошибка блокирует gate, ожидаемый отказ - безопасное русское состояние, задана цепочка доказательств GSD | ✓ VERIFIED | `tests/e2e/fixtures/diagnostics.ts` не менялся; `npm test` (оркестратор): 823 pass / 0 fail / 3 skip; `lib/security-headers.test.ts` (W1) и traceability STAB-BASE-01..06 присутствуют. Дополнительное свидетельство Phase 16: CSP-нарушение eval при открытии редактора было найдено именно этим gate и исправлено в коде без расширения allowlist. |

**Score:** 1/4 истин подтверждено (0 present-but-behavior-unverified). SC2 переведён из FAILED в PARTIAL, но не засчитывается.

## Отложено в более поздние фазы (Step 9b)

Отложено только то, что ROADMAP или подписанное evidence реально назначает фазе. Подробности и цитаты - в frontmatter `deferred`.

| Пункт | Фаза | Основание | Замечание |
|---|---|---|---|
| G5 физический UAT | 22 | ROADMAP Phase 22 SC2 | явное |
| 9 motion REJECTED (shortcut/spider/web-wave) | 18 | ROADMAP Phase 18 SC3, SC4, SC6, SC7; `15-VISUAL-APPROVAL.md` | явное |
| 9 REJECTED window-search/desktop-clean-rest | 18 | `15-VISUAL-APPROVAL.md`; косвенно Phase 18 SC1 | держится на evidence, не на тексте ROADMAP |
| 6 P18 BLOCKED | 18 | ROADMAP Phase 18 SC4, SC1; recoveryPhase 18 | |
| 12 P19 BLOCKED | 19 | ROADMAP Phase 19; recoveryPhase 19 | |
| 5 P20 BLOCKED | 20 | ROADMAP Phase 20 SC1; recoveryPhase 20 | |
| 1 P22 BLOCKED | 22 | ROADMAP Phase 22 SC1; recoveryPhase 22 | |

**Не отложено (остаётся gap):**

- **9 строк G3 с recoveryPhase 16** - фаза-владелец закрыта, ни ROADMAP, ни Phase 16 их не взяли (`editor-conflict-error`, `editor-dirty-saving-saved`, `editor-long-list-dialog`, `editor-phone-keyboard`, `editor-role-clean`, `editor-role-closed`, `editor-wysiwyg`, `owner-editor-access`, `promotion-reviewer-editor`). Предпосылка (изолированная цель, server-derived proof) теперь есть, но захват никто не планировал. Фазу не назначаю: решает владелец.
- **8 data-lanes (G2 остаток)** - `16-LIVE-RUN.md` указывает 'Phase 18-19 (визуальные эталоны владельца)', однако сравниваемые приложения (База вирусов, Информация, Корзина, Глобальный поиск) по ROADMAP принадлежат Phase 20 (SC1, SC3), а Phase 18/19 их не упоминают. Назначение неоднозначно, поэтому оставлено как gap SC2 и вынесено на подтверждение владельцу.

## Закрытие W1, W2 и находок ревью (без изменений с прошлой верификации)

Файлы `next.config.ts`, `scripts/phase15-e2e-preflight.mjs`, `lib/*.test.ts`, `15-REVIEW-DISPOSITION.md` не менялись планом 15-20 и Phase 16 после 15-19, кроме перечисленного ниже. Выводы прошлого отчёта сохраняются: W1 (CSP guard, поведенческий тест на настоящем `next.config.ts`), W2 (диспозиция 12 находок), WR-03/05/06, IN-05 исправлены; IN-01 исправлен частично; WR-01, WR-02, IN-02, IN-03, IN-04 отложены, IN-06 открыта. WR-01 (нет производителя server-derived proof) теперь реально закрыт Phase 16 (план 16-05, `session-probe.ts`); `15-REVIEW-DISPOSITION.md` в этой части не обновлялся (подписанный/ревью-документ, не критично).

## Регрессии относительно `769c3d1` (прошлая базовая точка)

Изменились файлы, которые прошлый отчёт перечислял как неизменные. Проверил, что это легитимные изменения Phase 16/17, а не регрессии:

| Файл | Изменение | Оценка |
|---|---|---|
| `playwright.config.ts` | `webServer.env` обнуляет `PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY` и `PORTIA_STAGING_DB_URL` (T-16-40) | усиливает изоляцию |
| `package.json` / lock | скрипты `test:staging-live*`, `test:e2e:mutation` с `--workers=1`, зависимость `supabase` 2.122.0 | Phase 16 |
| `tests/e2e/fixtures/actors.ts` | proof через `isVerifiedSession` вместо типа `server-probe` | закрывает WR-01 |
| `tests/e2e/fixtures/target-guard.ts`, PNG в `tests/e2e/visual`, `lib/supabase/`, `scripts/phase15-visual-manifest.mjs` | не менялись | подписанные байты и guard целы |
| `app/api/promotion/banks/route.ts`, `components/` (Phase 16/17) | вне объёма Phase 15 | не затрагивают baseline-контракт |

Утверждённые PNG: 33 файла, `--verify-promotion` подтверждает совпадение байтов. План 15-20 изменил только 4 evidence-файла (+92 строки, 0 удалений) и ROADMAP/STATE/PLAN/SUMMARY; `git diff` по коду и подписанным артефактам пуст.

## Требования (REQUIREMENTS.md)

Все шесть ID (`STAB-BASE-01..06`) присутствуют в планах Phase 15 и в REQUIREMENTS.md (строки 10-15 и таблица 128-133); orphaned нет. Статусы в REQUIREMENTS.md не менялись планом 15-20 и согласуются с кодом.

| Requirement | REQUIREMENTS.md | Статус | Основание |
|---|---|---|---|
| `STAB-BASE-01` | `[x]` Complete | ✓ SATISFIED | Ledger, UI-контракт, 33 утверждённых PNG. |
| `STAB-BASE-02` | `[ ]` Pending | ✗ BLOCKED (частично продвинут) | Роли доказаны (G1 CLOSED), но 8 data-lanes BLOCKED; требование включает 'основные состояния данных'. |
| `STAB-BASE-03` | `[ ]` Pending | ✗ BLOCKED | 33 из 84 состояний; паук/паутина/Повышение/редактор не покрыты. |
| `STAB-BASE-04` | `[ ]` Pending | ✗ BLOCKED | Подписано 51 хэша, 18 REJECTED, 33 не захвачены. |
| `STAB-BASE-05` | `[x]` Complete | ✓ SATISFIED | Диагностика, a11y, локальный security review; W1 закрыт тестом. |
| `STAB-BASE-06` | `[ ]` Pending | ✗ BLOCKED | Цепочка полна локально и теперь есть staging role proof, но нет data-lanes, полных визуальных эталонов и физического UAT. |

**Покрытие:** 2/6 удовлетворено. Рекомендации менять отметки в REQUIREMENTS.md нет.

## Поведенческие проверки (мной, Node 22.13.1)

| Проверка | Результат |
|---|---|
| `npm test` | Не запускал; оркестратор: 823 pass / 0 fail / 3 skip |
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | ✓ 37/37 |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | ✓ 'Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.' |
| Пересчёт JSONL `15-FRAME-TEST-MAP.md` кодом | ✓ 84 строки: 51 CAPTURED, BLOCKED по recoveryPhase 16/18/19/20/22 = 9/6/12/5/1 |
| Пересчёт `15-VISUAL-APPROVAL.md` | ✓ 18 REJECTED = 9 motion + 9 window-search/desktop-clean-rest |
| `receipt-playwright.json` | ✓ `status: PASS`, residual 0 |
| `git diff cea3644 HEAD` по коду, PNG, `REQUIREMENTS.md`, подписанным файлам | ✓ пусто (только 4 evidence-файла, ROADMAP, STATE, PLAN, SUMMARY) |
| Playwright, staging, production, `npm run build`, режим `--verify` | Не запускались (запрещено/не нужно) |

## Anti-patterns и предупреждения

Debt-маркеров (`TBD`, `FIXME`, `XXX`) в `15-GAP-RECONCILIATION.md` и `15-20-SUMMARY.md` нет. Идентификатор цели Phase 16 в `15-GAP-RECONCILIATION.md` отсутствует (в `15-20-PLAN.md` он есть только в команде проверки `grep`, это усечённый хэш и он уже публичен в evidence Phase 16).

| # | Находка | Серьёзность | Влияние |
|---|---|---|---|
| W1 | Формулировка исключения b535d14 в `15-REVIEW-DISPOSITION.md` опирается на пересказ scope-решения, письменного текста от владельца нет (перенос из прошлого отчёта). | Warning | Человеческий пункт; на статус не влияет. |
| W2 | `15-SECURITY.md` (`reviewed_commit: d6fe7e3`) не содержит угроз T-15-41..T-15-52 планов 15-17..15-19; не пересматривался (перенос). | Warning | Запустить `/gsd-secure-phase 15`. |
| W3 | 9 строк G3 с recoveryPhase 16 не имеют фазы-владельца; подписанный map и ROADMAP расходятся. | Warning (и gap SC1/SC3) | Нужно решение владельца. |
| W4 | `16-LIVE-RUN.md` отдаёт 7 application-сравнений Phase 18-19, а ROADMAP относит эти приложения к Phase 20. | Warning | Владельцу подтвердить фазу. |
| W5 | Уточнённая формулировка G4 ('18 motion') исправлена только в `15-GAP-RECONCILIATION.md` и 15-20-SUMMARY; в подписанном/историческом `15-BASELINE-RESULTS.md:116` строка "18 rejected motion candidates" осталась. | Info | Косметика; при закрытии фазы привести к единому виду. |
| W6 | `ROADMAP.md` Phase 15: '20/20 plans executed', но чекбокс фазы `[ ]` - корректно, фаза не закрыта. Прежнее W3 (рассинхрон 16/19) закрыто. | Info | Нет действий. |
| W7 | В клоне без `.runs/` хэши PNG кандидатов не пересчитываются (прежний W5). | Info | Допустимое, помеченное ограничение. |

## Требуется участие человека

1. Переназначить (или снять) 9 строк G3 с recoveryPhase 16.
2. Подтвердить фазу-владельца и источник seed-данных для 7 application-сравнений и Firefox search-restored (Phase 18-19 по Phase 16 против Phase 20 по ROADMAP).
3. Подтвердить или поправить формулировку исключения b535d14 (W1) в `15-REVIEW-DISPOSITION.md`.
4. IN-06 п.1: authority снимков window-search в firefox-desktop.
5. Физический PC (DPR 1.25) и phone UAT - Phase 22.

## Итог

Phase 15 остаётся `gaps_found`, 1/4. Реальный прогресс: G1 закрыт Phase 16 и подтверждён кодом (`session-probe.ts`, `actors.ts`) и receipts с residual 0; G2 закрыт на 7 из 15. План 15-20 как документальная сверка выполнен верно: цифры (84 = 51 + 33; 9/6/12/5/1; 18 = 9 + 9; 7 PASS / 8 BLOCKED) совпали с моим независимым пересчётом, подписанные байты и статусы требований не тронуты, ни один BLOCKED/REJECTED не записан как pass. Фаза не должна помечаться завершённой: остаются 8 data-lanes (G2), 33 незахваченных состояния (G3, из них 9 без владельца), 18 REJECTED (G4) и физический UAT (G5, Phase 22). Закрытие - в фазах 18/19/20/22 и решением владельца по 9 строкам без владельца.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_

## Решение владельца (2026-11-02)

Владелец Qloxz принял фазу 15 при открытых пунктах и выбрал закрыть её без переноса в другие фазы. Статус отчёта переведён в `passed` этим решением, а не доказательствами. Ни один BLOCKED не засчитан как pass:

- 9 строк G3 с recoveryPhase 16 (editor-* x7, owner-editor-access, promotion-reviewer-editor): остаются BLOCKED, фаза-владелец не назначена.
- 8 data-lanes (7 пиксельных application-сравнений D6, Firefox `search-restored` DATA-SEED): остаются BLOCKED, фаза-владелец не назначена.
- G3/G4/G5 в остальной части: открыты и закреплены за фазами 18/19/20/22 по evidence (`evidence/15-GAP-RECONCILIATION.md`).
- Требования STAB-BASE-02/03/04/06 остаются Pending; Complete только STAB-BASE-01 и -05.
- Human items (W1 b535d14, IN-06 firefox window-search, физический UAT) остаются без ответа.
