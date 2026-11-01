---
phase: PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
verified: 2026-11-01T12:30:00Z
status: human_needed
score: 8/10 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-01-PLAN.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-01-SUMMARY.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-02-PLAN.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-02-SUMMARY.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-03-PLAN.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-03-SUMMARY.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-04-PLAN.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-04-SUMMARY.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-05-PLAN.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-05-SUMMARY.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-06-PLAN.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-06-SUMMARY.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-07-PLAN.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-07-SUMMARY.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-08-PLAN.md"
  - ".planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-08-SUMMARY.md"
  - "components/portia-desktop-documents.tsx"
  - "components/portia-desktop-dossier.tsx"
  - "components/portia-desktop-shortcuts.tsx"
  - "components/portia-desktop-window.tsx"
  - "components/portia-desktop.tsx"
  - "components/portia-editor-dossier.tsx"
  - "components/portia-editor-rich-text.tsx"
  - "components/portia-editor.tsx"
  - "lib/accent-theme.test.ts"
  - "lib/component-source.ts"
  - "lib/dossier-parts.test.ts"
  - "lib/editor-items.ts"
  - "lib/phase17-move-parity.test.ts"
  - "lib/portia-desktop.test.ts"
  - "lib/window-open.test.ts"
  - "lib/window-open.ts"
  - "scripts/phase17-move-parity.mjs"
  - "tests/e2e/specs/window-reopen.spec.ts"
covered_digest: "v3:sha256:eababec7688a2246ecdbb3d2d2544d97c120d7edd72335a8cdee1fee7e0cc6d9"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/10
  gaps_closed:
    - "CR-01: шаг (d) window-reopen.spec.ts кликал по кнопке окна, перекрытого окном «Настройки» (закрыто в 17-08, c278a29; по коду, не по браузеру)"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "tests/e2e/specs/window-reopen.spec.ts даёт браузерное доказательство STAB-DESK-01 для ярлыка, start panel, taskbar и search (17-05 must_have)"
    test: "npm exec playwright -- test tests/e2e/specs/window-reopen.spec.ts --project=chromium-desktop --retries=0 (при наличии безопасного preflight-окружения NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    expected: "1 passed: один app id = одно активное окно из ярлыка, start panel, taskbar и search; запрос «Настройки» сохранён после закрытия и повторного открытия"
    why_human: "BLOCKED (ENV): playwright.config.ts падает на phase15-e2e-preflight.mjs, спек ни разу не исполнялся в браузере. Исправление CR-01 подтверждено чтением кода и порядка действий, но не прогоном"
  - truth: "Утверждённые desktop/phone snapshots не дрейфуют после каждого increment (ROADMAP SC2)"
    test: "При наличии preflight-окружения: npm exec playwright -- test tests/e2e/visual --retries=0 --update-snapshots=none на chromium-desktop, chromium-dpr125, firefox-desktop, webkit-phone, chromium-phone, на HEAD и на 55f51d6, сравнить с 17-PARITY-BASELINE.md; затем git status --porcelain -- tests/e2e/visual/__screenshots__ должен быть пуст"
    expected: "Исход каждого теста не хуже эталона; ни один baseline PNG не изменён"
    why_human: "Пиксельное сравнение возможно только в браузере; все Playwright-дорожки BLOCKED (ENV). Построчный перенос кода доказан, визуальный результат браузером не наблюдался"
human_verification:
  - test: "tests/e2e/specs/window-reopen.spec.ts --project=chromium-desktop --retries=0"
    expected: "1 passed; в частности шаг (d): после клика по taskbar-кнопке поиска окно «Глобальный поиск» получает is-active, кнопка «Закрыть Глобальный поиск» не перехватывается окном «Настройки»"
    why_human: "BLOCKED (ENV); нужен безопасный read-источник данных и preflight-окружение, значения лежат только в .env.local, который по правилам проекта не читается"
  - test: "Визуальная дорожка tests/e2e/visual на chromium-desktop, chromium-dpr125, firefox-desktop, webkit-phone, chromium-phone с --update-snapshots=none"
    expected: "Исходы не хуже 17-PARITY-BASELINE.md (там все ячейки BLOCKED (ENV)); baseline PNG не изменены"
    why_human: "BLOCKED (ENV): то же окружение"
  - test: "Ручной обход PORTIA OS на PC и phone: открыть каждое из 12 приложений из ярлыка, start panel, taskbar, search; свернуть/закрыть/открыть снова; открыть редактор и карточку досье"
    expected: "Тот же PORTIA OS, что до Phase 17: одно окно на приложение, те же тексты, классы, порядок; редактор в роли владельца выглядит и работает как раньше"
    why_human: "Тело редактора в роли владельца BLOCKED (ROLE) с Phase 15; визуальный и интерактивный результат не наблюдался"
---

# Phase 17: Обратимая декомпозиция рабочего стола и редактора, отчёт верификации (повторная проверка после 17-08)

**Цель фазы:** Рабочий стол и редактор разделены на проверяемые seams, оставаясь для пользователя тем же PORTIA OS.
**Проверено:** 2026-11-01
**Статус:** human_needed
**Повторная верификация:** Да, после плана 17-08 (закрытие CR-01). Предыдущий статус `gaps_found`, проверен `HEAD` = `31bf5fc`.

## Вердикт

Автоматически проверяемых провалов не осталось. CR-01 закрыт по коду: спек теперь выводит окно поиска на передний план перед закрытием. Но браузерный прогон этого спека и вся визуальная parity остаются BLOCKED (ENV/ROLE) и по правилам проекта не засчитываются как pass. Поэтому фаза не `passed`, а `human_needed`: нужны браузерные проверки, когда владелец даст безопасное preflight-окружение.

## Закрытие CR-01

| Что проверено | Как | Результат |
|---------------|-----|-----------|
| Правка в спеке | `git show c278a29`: ровно +3 строки в `tests/e2e/specs/window-reopen.spec.ts` (строки 51-53), 0 удалений | ✓ |
| Порядок шага (d) | после (c) активно «Настройки» (клик по результату поиска вызывает `openApp(settings)` и фокус); теперь `taskbarSearch.click()` затем `expect(search).toHaveClass(/is-active/)` и только потом клик «Закрыть Глобальный поиск» (строки 52-54) | ✓ порядок верный |
| Семантика taskbar-клика | `components/portia-desktop.tsx:1434-1440`: окно поиска не свёрнуто, не `exiting` и не активно (активно «Настройки»), значит ветка `focusApp(app)`, а не `minimizeApp`; `focusApp` (`:746`) поднимает `z` и делает `setActiveApp`. Тот же приём уже применён в шаге (c) строка 44 | ✓ клик не свернёт окно |
| Продуктовый код не тронут | `git diff 4c94114..HEAD --stat -- components lib app scripts` пуст | ✓ правка только в тесте |
| Disposition | `17-REVIEW-DISPOSITION.md`: CR-01 `fixed`, `open: 6`, `total: 7`; WR-01..03 и IN-01..03 остаются `open` | ✓ |
| Типы / lint (факты исполнителя 17-08, мной не перезапускались) | `tsc` exit 0; lint 0 errors, 18 warnings (база) | принято как факт оркестратора |
| Браузерный прогон | `window-reopen.spec.ts` на `chromium-desktop` | **BLOCKED (ENV)**, не pass |

Вывод: дефект CR-01 устранён в коде спека, gap закрыт. Подтверждение поведением (спек реально проходит) невозможно без ENV, поэтому истина 10 переведена из FAILED в PRESENT_BEHAVIOR_UNVERIFIED.

## Достижение цели

### Наблюдаемые истины

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | SC1 / STAB-DESK-01: один app id из ярлыка, start panel, taskbar, search даёт одно восстановленное и сфокусированное окно (логика) | ✓ VERIFIED | `openApp` объявлен один раз, первая инструкция `if (qualificationLocked && appId !== "promotion") return;`; решение вынесено в `lib/window-open.ts`; продуктовый код после предыдущей верификации не менялся (diff `4c94114..HEAD` пуст). `lib/window-open.test.ts` + 4 соседних файла: 81 tests, 81 pass, 0 fail (Node 22.13.1, мой запуск). Логика и структура, не браузер |
| 2 | SC2 / STAB-DESK-07: app ids, DOM semantics, CSS hooks, storage keys, API shapes, порядок, данные совместимы (код) | ✓ VERIFIED | Результаты предыдущей проверки не затронуты (код не менялся): storage keys 9/9 и 4/4, `/api/` 3/3 и 4/4, className 218/218 и 103/103, aria-label 14/14 и 16/16, потерь и добавлений 0; `phase17-move-parity.mjs --ref 55f51d6` exit 0 для редактора (912 строк) и 4 seam-ов рабочего стола (489 строк) |
| 3 | SC2: утверждённые desktop/phone snapshots не дрейфуют | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `git diff 55f51d6..HEAD -- tests/e2e/visual app/portia.css components/portia-wallpaper*.tsx` пуст; все Playwright-дорожки BLOCKED (ENV), пиксели не наблюдались. Не засчитывается в score |
| 4 | SC3: каждый increment откатывается отдельно, нового generic app shell нет | ✓ VERIFIED | 10 refactor-коммитов, каждый трогает один seam-модуль и родительский файл; порядок отката в 17-07-SUMMARY. Плюс 17-08 затрагивает только один тестовый файл и disposition |
| 5 | D-02/D-03/D-07: части для Phase 17.1 вынесены отдельно и не знают сервер | ✓ VERIFIED | grep на `fetch(`, `/api/`, `supabase`, `createClient`, `revision` в `portia-editor-dossier.tsx`, `portia-editor-rich-text.tsx`, `portia-desktop-dossier.tsx` пуст (предыдущая проверка, файлы не менялись) |
| 6 | 17-01: `phase17-move-parity.mjs` доказывает чистый перенос | ✓ VERIFIED (с оговорками WR-01..03) | Скрипт работает, `lib/phase17-move-parity.test.ts` зелёный; слабости ревью реальны (open), компенсированы независимой блок-проверкой |
| 7 | D-04/D-05: поведение `openApp` закреплено, «кивка» нет | ✓ VERIFIED | Тест «a visible window behind others only keeps its origin» зелёный; новых анимаций нет |
| 8 | D-06/D-08/D-09: инвентаризация, журнал багов, фон/паук не тронуты | ✓ VERIFIED | `17-WINDOW-REOPEN.md`, `17-FOUND-BUGS.md` на месте; diff по wallpaper/`app/portia.css`/`tests/e2e/visual` пуст |
| 9 | Source-тесты читают семейство файлов; STAB-DESK-07 закреплён | ✓ VERIFIED | `lib/component-source.ts: componentFamily`; `portia-desktop.test.ts`, `accent-theme.test.ts`, `dossier-parts.test.ts` зелёные (в составе 81/81). Оговорка IN-02/IN-03 |
| 10 | 17-05: `window-reopen.spec.ts` доказывает STAB-DESK-01 в браузере | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | CR-01 исправлен в коде (см. выше); спек корректен по чтению, но не исполнялся: BLOCKED (ENV). Было FAILED. Не засчитывается в score, идёт в human_verification |

**Score:** 8/10 истин проверено; 2 present, behavior-unverified (истины 3 и 10); FAILED: 0.

### Блокированные доказательства (не засчитаны как pass)

- `window-reopen.spec.ts` на `chromium-desktop`: BLOCKED (ENV), `[PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY` (17-08-SUMMARY). Я не запускал Playwright и не читал `.env*`.
- Визуальная дорожка `tests/e2e/visual` (6 specs x 5 проектов): BLOCKED (ENV).
- Тело редактора в роли владельца: BLOCKED (ROLE) с Phase 15.

### Покрытие требований

| Requirement | Планы | Статус | Доказательство |
|-------------|-------|--------|----------------|
| STAB-DESK-07 | 17-01..17-07 | ⚠️ ЧАСТИЧНО: код ✓, браузерные snapshots BLOCKED | Истины 2, 3, 4, 8, 9 |
| STAB-DESK-01 | 17-05, 17-06, 17-08 | ⚠️ ЧАСТИЧНО: логика/структура ✓, дефект спека CR-01 исправлен, браузерный прогон BLOCKED | Истины 1, 10 |

Оба ID присутствуют в REQUIREMENTS.md (строки 19 и 25) и в таблице трассировки (134, 140); ORPHANED нет. В REQUIREMENTS.md оба остаются `Pending`/`[ ]`: отмечать выполненными преждевременно, пока браузерные пункты не закрыты. Примечание: `requirements-completed: [STAB-DESK-01]` в 17-08-SUMMARY заявляет больше, чем доказано; это утверждение исполнителя, не доказательство.

### Анти-паттерны

| Файл | Паттерн | Серьёзность | Влияние |
|------|---------|-------------|---------|
| `tests/e2e/specs/window-reopen.spec.ts` | CR-01 | закрыт | Исправлено в c278a29 |
| `scripts/phase17-move-parity.mjs` | WR-01..03 (симлинк no-op, нет проверки потерь/порядка, `gitShow` скрывает ошибки) | WARNING, open | Компенсировано независимой проверкой; можно в Phase 21 или quick-фикс |
| `components/portia-desktop-dossier.tsx` | IN-01 лишний `export` | INFO, open | Не блокирует |
| `lib/portia-desktop.test.ts`, `lib/window-open.test.ts` | IN-02, IN-03 узкие границы, хрупкие числа | INFO, open | Не блокирует |

Блокирующих анти-паттернов нет. Новых `TBD`/`FIXME`/`XXX` после предыдущей проверки не появилось (изменён только тест на +3 строки).

### Deferred

Нет.

### Требуется решение человека

1. Провести `window-reopen.spec.ts` на `chromium-desktop`, когда владелец даст безопасное preflight-окружение (ожидается `1 passed`). До этого STAB-DESK-01 в браузере не доказан.
2. Провести визуальную дорожку и ручной обход PORTIA OS (см. `human_verification`).
3. Решить, принимать ли фазу без браузерной parity; WR-01..03 и IN-01..03 перенести или оставить `open`.

---

_Проверено: 2026-11-01_
_Верификатор: Claude (gsd-verifier)_
