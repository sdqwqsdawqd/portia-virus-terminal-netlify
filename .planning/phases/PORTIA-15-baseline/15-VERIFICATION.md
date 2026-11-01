---
phase: 15-baseline
verified: 2026-11-01T18:00:00Z
status: gaps_found
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
  - ".planning/phases/PORTIA-15-baseline/evidence/15-CANDIDATE-INDEX.json"
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
  - "tests/e2e/fixtures/target-guard.ts"
  - "tests/e2e/fixtures/visual-policy.ts"
  - "tests/e2e/specs/roles.spec.ts"
covered_digest: "v3:sha256:4bb7da1a4618419fdd87a6054f55463f873c5a9f2edc8970e4e7946b2ee756df"
re_verification:
  previous_status: gaps_found
  previous_score: 1/4
  gaps_closed:
    - "W1: PORTIA_E2E_ALLOW_HTTP не может снять upgrade-insecure-requests в сборке Netlify (NETLIFY=true или любой CONTEXT); доказано поведенческим тестом"
    - "W2: 12 находок 15-REVIEW.md получили диспозицию; WR-03/04/05/06 и IN-05 исправлены в коде, IN-01 исправлен частично"
  gaps_remaining:
    - "G1: disposable authenticated roles и изолированный Supabase"
    - "G2: read backing для 15 data-dependent Playwright-дорожек"
    - "G3: 33 BLOCKED visual-строки"
    - "G4: 18 отклонённых motion-кандидатов"
    - "G5: физический PC/phone UAT"
  regressions: []
gaps:
  - truth: "Из чистого checkout запускается committed Playwright/axe suite для visitor, participant, editor, promo reviewer и owner на PC/phone с фиксированными данными и без мутаций production (SC2)"
    status: failed
    reason: "G1+G2: четыре привилегированные роли заблокированы (в репозитории нет производителя server-probe sessionProof, нет изолированной цели); 15 data-backed тестов требуют read backing. BLOCKED/skip не засчитаны как pass."
    artifacts:
      - path: "tests/e2e/fixtures/actors.ts"
        issue: "READY возможен только при sessionProof source=server-probe; единственное упоминание server-probe - сам тип и проверка (строки 25, 89)"
      - path: "tests/e2e/specs/roles.spec.ts"
        issue: "participant/editor/promo-reviewer/owner дорожки всегда skip"
    missing:
      - "Изолированный Supabase и одноразовые identities (Phase 16/19)"
      - "Server-derived session proof, положительные и отрицательные решения авторизации, cleanup receipt"
      - "Read-only источник данных для data-dependent lanes"
  - truth: "Одобренные visual baselines воспроизводят desktop, окна, Повышение, редактор, паука, паутину, Вивьян и phone layout (SC3)"
    status: failed
    reason: "G3+G4: утверждено 33 состояния; 18 motion-кандидатов REJECTED (паук/паутина/ярлык), 33 состояния BLOCKED. Паук и паутина не покрыты утверждённым baseline."
    artifacts:
      - path: "tests/e2e/visual/__screenshots__/"
        issue: "33 PNG; нет утверждённых кадров паука/паутины/motion-shortcut; нет phone/DPR-эталонов для BLOCKED-строк"
    missing:
      - "Замена 18 отклонённых motion-кандидатов (Phase 18)"
      - "33 BLOCKED-состояния (Phases 16/18/19/22)"
  - truth: "Владелец может сравнить captures с текущим сайтом и явно одобрить UI/motion-контракт (SC1)"
    status: partial
    reason: "Подписано только по 51 захваченному хэшу (33 APPROVED, 18 REJECTED); 33 строки не захвачены (BLOCKED)."
    artifacts:
      - path: ".planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-APPROVAL.md"
        issue: "18 REJECTED; 33 BLOCKED вне ledger"
    missing:
      - "Решение владельца по отклонённым и незахваченным состояниям (Phase 18 и далее)"
  - truth: "Физическая проверка владельца на PC (DPR 1.25) и телефоне"
    status: failed
    reason: "G5: физические устройства не доказаны; BLOCKED до Phase 22."
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
human_verification:
  - test: "Подтвердить формулировку W1: исключение b535d14 из правила «Do not modify product source in Phase 15»"
    expected: "Владелец письменно подтверждает или правит строку в 15-REVIEW-DISPOSITION.md"
    why_human: "Запись опирается на scope-решение, переданное оркестратором; отдельного письменного текста от владельца нет"
  - test: "IN-06 часть 1: какие снимки window-search в firefox-desktop считаются авторитетными"
    expected: "Ответ владельца, который затем попадёт в подписанный 15-FRAME-TEST-MAP.md"
    why_human: "Решение владельца; нельзя записать в подписанный артефакт без явного ответа"
  - test: "Физический PC (DPR 1.25) и phone UAT"
    expected: "Owner UAT (Phase 22)"
    why_human: "Физические устройства"
---

# Phase 15: Baseline — повторная верификация (после планов 15-17..15-19)

**Phase Goal:** Текущий PORTIA OS зафиксирован как воспроизводимый и одобренный контракт до любых рефакторингов или точечных исправлений.
**Verified:** 2026-11-01, HEAD `38b85bf`, Node 22.13.1 (из `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`; машинный дефолт - 24.21.0)
**Status:** `gaps_found`
**Re-verification:** Да - после gap closure 15-17, 15-18, 15-19. Предыдущий отчёт: `gaps_found`, 1/4.

Итог: владелец ограничил планы 15-17..15-19 исправимыми в репозитории находками (WR-03/05/06, IN-05, IN-01 часть 1, W1, W2). Это закрыто и подтверждено кодом и независимым прогоном. G1-G5 намеренно не планировались; проверено, что они честно остаются открытыми: ни один BLOCKED не записан как pass, утверждённые PNG, `playwright.config.ts`, `target-guard.ts`, `package.json`, `REQUIREMENTS.md` и evidence-каталог не менялись относительно `769c3d1`. Счёт 1/4 не меняется, потому что Success Criteria 1-3 зависят от G1-G5.

## G1-G5: остаются открытыми (проверено)

| # | Пробел | Статус | Независимое доказательство |
|---|---|---|---|
| G1 | Disposable roles / изолированный Supabase | **ОТКРЫТ** | `grep server-probe` по `tests/ lib/ scripts/`: только `tests/e2e/fixtures/actors.ts:25,89` (тип и проверка); производителя proof нет. `15-ROLE-GATE.md`: participant/editor/promo-reviewer/owner = BLOCKED `TARGET_NOT_ISOLATED`. WR-01 отложен на Phase 16. |
| G2 | Read backing для 15 data-dependent lanes | **ОТКРЫТ** | Не изменялось; браузерные прогоны не запускались (нет данных). Записано как BLOCKED (DATA) в `15-BASELINE-RESULTS.md`. |
| G3 | 33 BLOCKED visual-строки | **ОТКРЫТ** | `15-CANDIDATE-INDEX.json`: 84 строки; в `tests/e2e/visual/__screenshots__/` ровно 33 PNG; `git diff 769c3d1 HEAD` по каталогу PNG пуст. |
| G4 | 18 отклонённых motion-кандидатов | **ОТКРЫТ** | `15-VISUAL-APPROVAL.md`: 18 `REJECTED`; evidence-каталог не менялся с `769c3d1`. |
| G5 | Физический PC/phone UAT | **ОТКРЫТ** | UAT-артефакта в каталоге фазы нет; DPR 1.25 и phone BLOCKED (Phase 22). |

## Достижение цели

| # | Истина | Статус | Доказательство |
|---:|---|---|---|
| 1 | Владелец может сравнить captures с текущим сайтом и явно одобрить UI/motion-контракт | ✗ PARTIAL (gap) | 51 захваченный хэш: 33 APPROVED, 18 REJECTED; 33 состояния не захвачены. `--verify-promotion` проходит. |
| 2 | Из чистого checkout запускается committed Playwright/axe suite для всех пяти ролей на PC/phone без мутаций production | ✗ FAILED / BLOCKED (G1, G2) | Четыре привилегированные роли всегда skip; 15 data-backed тестов требуют read backing. Skip не засчитан как pass. |
| 3 | Одобренные baselines воспроизводят desktop, окна, Повышение, редактор, паука, паутину, Вивьян и phone layout | ✗ FAILED / PARTIAL (G3, G4) | 33 точных байта подтверждены; паук/паутина/shortcut-motion отклонены; phone/DPR/privileged BLOCKED. |
| 4 | Неожиданная browser/console/network/CSP ошибка блокирует gate, ожидаемый отказ - безопасное русское состояние, задана цепочка доказательств GSD | ✓ VERIFIED | `tests/e2e/fixtures/diagnostics.ts` не менялся; `npm test` 684/685 pass (1 skip) включая `lib/e2e-diagnostics.test.ts`; traceability STAB-BASE-01..06 и `15-SECURITY.md` присутствуют. Браузерные diagnostics/axe взяты из записанного evidence, не перезапускались. |

**Score:** 1/4 истин подтверждено (0 present-but-behavior-unverified).

## Закрытие W1, W2 и находок ревью (проверено по коду)

| Находка | Вердикт | Доказательство |
|---|---|---|
| W1 CSP guard | ✓ ЗАКРЫТО | `next.config.ts:7`: `allowHttpForE2E = PORTIA_E2E_ALLOW_HTTP === "1" && NETLIFY !== "true" && !CONTEXT`. Единственное изменение product source с `769c3d1` (diff: 3 строки). Поведенческий тест `lib/security-headers.test.ts` импортирует настоящий `next.config.ts` с уникальным query и проверяет 7 комбинаций (prod без флага - есть директива; prod+флаг - нет; +NETLIFY=true, +CONTEXT=production, +CONTEXT=deploy-preview, флаг `"true"` - есть; development - нет и `unsafe-eval`). Ошибка guard ведёт только в безопасную сторону. Остаток (не-Netlify хостинг) записан как T-15-50/SEC-L5 и пункт release checklist Phase 22. |
| W2 диспозиция | ✓ ЗАКРЫТО | `15-REVIEW-DISPOSITION.md`: 12 строк, fixed 5 (WR-03/04/05/06, IN-05), partial 1 (IN-01), deferred 5 (WR-01, WR-02, IN-02, IN-03, IN-04), open 1 (IN-06); у fixed указаны план, SHA, тест. |
| WR-03 | ✓ ИСПРАВЛЕНО | `scripts/phase15-e2e-preflight.mjs`: `shellEnvironment = {...process.env}` до `loadEnvConfig`; mutation-guard судит этот снимок. Тест `mutation preflight ignores mutation config that exists only in an env file` на одноразовом каталоге с контролем (те же значения в shell принимаются). `.env.example` переведён на shell-only. |
| WR-04 | ✓ ИСПРАВЛЕНО (с оговоркой) | Commit `30faeab` (до 15-17): `production-target`, если ref из URL есть в `PORTIA_E2E_PRODUCTION_PROJECT_IDS`; тест `refuses a Supabase project listed as production`. Оговорка: пустой/незаданный список не блокирует (fail-open на конфигурацию оператора); раскрыто как допущение в IN-06 п.2, удалённая проверка отнесена в Phase 16. Это заявленное, а не скрытое ограничение. |
| WR-05 | ✓ ИСПРАВЛЕНО (документация и тест) | Пин `^22\.13\.\d+$` сохранён намеренно (комментарий над regex); тест закрепляет 22.13.0/22.13.1 и отклонение 22.12/22.14/23/24; `engines` не менялся. |
| WR-06 | ✓ ИСПРАВЛЕНО | `PUBLIC_KEY_VARIABLES`: publishable имеет приоритет, anon - fallback (по truthiness, как `||` в `lib/supabase/env.ts`); `missing-environment` называет оба имени; `public-key-shape` называет фактически использованное имя; `.env.example` содержит только плейсхолдеры. |
| IN-05 | ✓ ИСПРАВЛЕНО | `lib/e2e-visual-policy.test.ts` исполняет настоящий `visualPolicy` на фиктивном Page для 26 состояний; мёртвая `assertVisualDiffAllowed` удалена (diff `visual-policy.ts` содержит только удаление функции и проверку компаратора; `declarations`/константы/`maskLocator` не тронуты). |
| IN-01 (часть 1) | ✓ ЧАСТИЧНО, как заявлено | Явный `PORTIA_VISUAL_COMPARATOR_MISSING` + тест на наличие компаратора и точный пин 1.64.1. Прикрепление diff при падении отложено в Phase 18 (требует браузерного прогона). |
| WR-01, WR-02, IN-02, IN-03, IN-04 | отложены, честно | Не затронуты; WR-02 (допуск до 2 300 px, маска `.personnel-app`) остаётся ослаблением SC3 до Phase 18. IN-06 открыта. |

## Требования (REQUIREMENTS.md)

Все шесть ID (`STAB-BASE-01..06`) заявлены в планах (15-17, 15-18, 15-19 заявляют STAB-BASE-05/06) и присутствуют в REQUIREMENTS.md; orphaned нет. `REQUIREMENTS.md` не менялся с `769c3d1`, статусы согласуются с кодом.

| Requirement | REQUIREMENTS.md | Статус | Основание |
|---|---|---|---|
| `STAB-BASE-01` | `[x]` Complete | ✓ SATISFIED | Ledger, UI-контракт, 33 утверждённых PNG. |
| `STAB-BASE-02` | `[ ]` Pending | ✗ BLOCKED | Роли не доказаны (G1); data-lanes без backing (G2). |
| `STAB-BASE-03` | `[ ]` Pending | ✗ BLOCKED | 33 из 84 состояний; паук/паутина отклонены (G3, G4). |
| `STAB-BASE-04` | `[ ]` Pending | ✗ BLOCKED | Подписано 51 хэша, 18 REJECTED, 33 не захвачены. |
| `STAB-BASE-05` | `[x]` Complete | ✓ SATISFIED | Диагностика, a11y, локальный security review; W1 дополнительно закрыт тестом. |
| `STAB-BASE-06` | `[ ]` Pending | ✗ BLOCKED | Цепочка полна локально, нет staging role proof, data-lanes и физического UAT. 15-17..15-19 усилили tooling, но требование не закрывают. |

**Покрытие:** 2/6 удовлетворено.

## Поведенческие проверки (мной, Node 22.13.1)

| Проверка | Результат |
|---|---|
| `npm test` | ✓ 685 тестов, 684 pass, 0 fail, 1 skip |
| `npm exec tsc -- --noEmit` | ✓ exit 0 |
| `npm run lint` | ✓ 0 errors, 18 warnings (baseline) |
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | ✓ 37/37 |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | ✓ «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» |
| `git diff 769c3d1 HEAD` по PNG, `playwright.config.ts`, `package.json`, `package-lock.json`, `target-guard.ts`, `app/`, `components/`, `lib/supabase/` | ✓ пусто |
| Playwright / `npm run build` / режим `--verify` | Не запускались (данные/секреты; `--verify` переписывает подписанное evidence) |

## Anti-patterns и предупреждения

Блокирующих debt-маркеров и стабов в изменённых файлах не найдено. `.env*` реальные файлы не читались.

| # | Находка | Серьёзность | Влияние |
|---|---|---|---|
| W1 | Закрыто (см. выше). Остаётся вопрос формулировки: `15-REVIEW-DISPOSITION.md` пишет «принято решением владельца Qloxz в рамках scope-решения 2026-11-01» и сам оговаривает, что отдельного письменного подтверждения текста исключения нет; 15-19-SUMMARY повторяет это. Формулировка честная: уверенность не завышена, цитаты владельца не выдумано. Но заголовок «Фиксация владельцем» сильнее, чем есть: scope-решение «закрывать только исправимые в репозитории находки» само по себе не равно одобрению ретроспективного исключения b535d14; опора - пересказ оркестратора. | Warning | Человеческий пункт: владельцу подтвердить или поправить строку. На статус не влияет. |
| W2 | `15-SECURITY.md` (`reviewed_commit: d6fe7e3`, PASS-LOCAL-SCOPE) не содержит угроз T-15-41..T-15-52 из планов 15-17..15-19: в файле вообще нет идентификаторов `T-15-*` (используются `SEC-L*`), обновлена только строка SEC-L5. Область ревью (preflight, visual-policy, `.env.example`) после `d6fe7e3` не пересматривалась. Угрозы существуют только в `<threat_model>` планов. | Warning | Реестр угроз неполон; для пересмотра запустить `/gsd-secure-phase 15`. Не меняет статус. |
| W3 | `.planning/ROADMAP.md` показывает «16/19 plans executed» и неотмеченные чекбоксы 15-17..15-19, хотя планы выполнены и закоммичены. | Info | Рассинхрон документации прогресса; обновить при закрытии фазы. |
| W4 | WR-04 помечена `fixed`, но guard работает только при заданном `PORTIA_E2E_PRODUCTION_PROJECT_IDS` (при пустом списке production-ref пропускается). | Info | Раскрыто в IN-06 п.2; смягчается правилом CLAUDE.md и Phase 16. |
| W5 | В клоне без `.runs/` хэши PNG кандидатов не пересчитываются (прежний W3). | Info | Допустимое, помеченное ограничение. |

## Требуется участие человека

1. Подтвердить или поправить формулировку исключения b535d14 (W1) в `15-REVIEW-DISPOSITION.md`.
2. IN-06 п.1: authority снимков window-search в firefox-desktop.
3. Физический PC (DPR 1.25) и phone UAT - Phase 22.
4. Решение владельца: read-only источник данных для 15 data-dependent дорожек либо перенос в Phase 16.

## Итог

Phase 15 остаётся `gaps_found`, 1/4. Работа 15-17..15-19 выполнена в заявленных границах и подтверждена независимо: W1 закрыт поведенческим тестом на настоящем `next.config.ts`, W2 закрыт полной диспозицией 12 находок, WR-03/05/06 и IN-05 исправлены в коде с тестами, IN-01 исправлен частично, как заявлено. G1-G5 честно открыты, ни один BLOCKED не записан как pass, утверждённые байты не менялись. Фаза не должна помечаться завершённой; закрытие G1-G5 - в фазах 16/18/19/22.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
