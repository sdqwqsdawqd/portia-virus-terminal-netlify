---
phase: PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
verified: 2026-11-01T09:30:00Z
status: gaps_found
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
covered_digest: "v3:sha256:6707849049202f2d2added9212b2f4f563c46977316ed463002469176b260e2b"
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "tests/e2e/specs/window-reopen.spec.ts даёт браузерное доказательство STAB-DESK-01 для ярлыка, start panel, taskbar и search (17-05 must_have)"
    status: failed
    reason: "CR-01 из 17-REVIEW.md подтверждён независимым расчётом геометрии: к шагу (d) активно окно «Настройки» (820x650, x=282, y=81), которое полностью накрывает окно «Глобальный поиск» (760x590, x=284, y=83) на viewport 1440x900. Клик по «Закрыть Глобальный поиск» перехватывается другим окном, и спек упадёт по таймауту на шаге (d) даже после снятия ENV-блокировки. Disposition в 17-REVIEW-DISPOSITION.md остаётся open."
    artifacts:
      - path: "tests/e2e/specs/window-reopen.spec.ts"
        issue: "строки 50-52: перед закрытием окна поиска оно не возвращено на передний план"
    missing:
      - "Перед шагом (d) вывести поиск вперёд: await taskbarSearch.click(); await expect(search).toHaveClass(/is-active/); и только затем клик по «Закрыть Глобальный поиск»"
      - "Запустить спек на chromium-desktop, когда появится preflight-окружение (NEXT_PUBLIC_SUPABASE_*)"
behavior_unverified_items:
  - truth: "Утверждённые desktop/phone snapshots не дрейфуют после каждого increment (ROADMAP SC2)"
    test: "При наличии preflight-окружения: npm exec playwright -- test tests/e2e/visual --retries=0 --update-snapshots=none на chromium-desktop (и остальных проектах) на HEAD и на 55f51d6, сравнить с 17-PARITY-BASELINE.md; затем git status --porcelain -- tests/e2e/visual/__screenshots__ должен быть пуст"
    expected: "Исход каждого теста не хуже эталона; ни один baseline PNG не изменён"
    why_human: "Пиксельное сравнение возможно только в браузере; все Playwright-дорожки BLOCKED (ENV): playwright.config.ts падает на phase15-e2e-preflight.mjs без NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Построчный перенос кода доказан, но визуальный результат браузером не наблюдался."
human_verification:
  - test: "Визуальная дорожка tests/e2e/visual на chromium-desktop, chromium-dpr125, firefox-desktop, webkit-phone, chromium-phone с --update-snapshots=none"
    expected: "Исходы не хуже 17-PARITY-BASELINE.md (там все ячейки BLOCKED (ENV)); baseline PNG не изменены"
    why_human: "BLOCKED (ENV): нужен безопасный read-источник данных и preflight-окружение; значения лежат только в .env.local, который по правилам проекта не читается"
  - test: "После исправления CR-01 запустить tests/e2e/specs/window-reopen.spec.ts --project=chromium-desktop --retries=0"
    expected: "Один app id = одно активное окно из ярлыка, start panel, taskbar и search; введённый запрос «Настройки» сохранён"
    why_human: "BLOCKED (ENV); спек ни разу не исполнялся"
  - test: "Ручной обход PORTIA OS на PC и phone: открыть каждое из 12 приложений из ярлыка, start panel, taskbar, search; свернуть/закрыть/открыть снова; открыть редактор и карточку досье"
    expected: "Тот же PORTIA OS, что до Phase 17: одно окно на приложение, те же тексты, классы, порядок; редактор в роли владельца выглядит и работает как раньше"
    why_human: "Тело редактора в роли владельца BLOCKED (ROLE) с Phase 15; визуальный и интерактивный результат не наблюдался"
---

# Phase 17: Обратимая декомпозиция рабочего стола и редактора, отчёт верификации

**Цель фазы:** Рабочий стол и редактор разделены на проверяемые seams, оставаясь для пользователя тем же PORTIA OS.
**Проверено:** 2026-11-01
**Статус:** gaps_found
**Повторная верификация:** Нет, первичная проверка (базовый коммит фазы `55f51d6`, проверен `HEAD` = `4c94114`)

## Вердикт

Структурная цель достигнута и подтверждена кодом: 2317 + 3033 строк разрезаны на 6 seam-модулей плюс `lib/window-open.ts`; перенос чистый (проверен независимо, см. ниже); app ids, ключи storage, `/api/`-адреса, `className` и `aria-label` совпадают с базой; каждый increment лежит в отдельных коммитах. Но:

1. Единственное браузерное доказательство STAB-DESK-01 (`window-reopen.spec.ts`) содержит подтверждённый дефект CR-01 и не пройдёт, даже когда ENV разблокируется. Это gap.
2. Весь браузерный parity (снимки desktop/phone, owner-редактор) BLOCKED (ENV/ROLE) и не может считаться пройденным. Это human-verification, не pass.

## Достижение цели

### Наблюдаемые истины

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | SC1 / STAB-DESK-01: один app id из ярлыка, start panel, taskbar, search даёт одно восстановленное и сфокусированное окно (логика) | ✓ VERIFIED | `openApp` объявлен один раз (`components/portia-desktop.tsx:839`), первая инструкция `if (qualificationLocked && appId !== "promotion") return;`. Решение вынесено в `lib/window-open.ts` (`windowAppears`, `visibleWindowCount`, `openedWindow`, `exitedWindow`). Мной сверено тело с `55f51d6`: условия, поля и порядок эквивалентны. 12 app ids = 12 `AppWindow` (11 вхождений, `sheet`/`charter` через `map`). `lib/window-open.test.ts`: 18 тестов, все проходят (81/81 в связке с 4 соседними файлами, Node 22.13.1). Это логика и структура, не браузер |
| 2 | SC2 / STAB-DESK-07: app ids, DOM semantics, CSS hooks, storage keys, API shapes, порядок, данные остаются совместимыми (код) | ✓ VERIFIED | Мой скрипт сравнения семейств `portia-desktop*` и `portia-editor*` с `55f51d6`: storage keys 9/9 и 4/4, `/api/`-адреса 3/3 и 4/4, className-токены 218/218 и 103/103, aria-label 14/14 и 16/16; потерь и добавлений 0. Чистый перенос: `phase17-move-parity.mjs --ref 55f51d6` для редактора exit 0 (912 строк); для рабочего стола 4 seam-а exit 0 (489 строк после 17-05), единственные расхождения целиком в `openApp`/`finishExit`/`lib/window-open.ts` (задокументированный не-перенос 17-05) |
| 3 | SC2: утверждённые desktop/phone snapshots не дрейфуют | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Код доказан построчно; `git diff 55f51d6..HEAD -- tests/e2e/visual app/portia.css components/portia-wallpaper*.tsx` пуст, `--verify-promotion` в эталоне зелёный. Но все 6 Playwright-дорожек BLOCKED (ENV), пиксели не наблюдались. Не засчитывается в score |
| 4 | SC3: каждый increment откатывается отдельно, нового generic app shell нет | ✓ VERIFIED | 10 refactor-коммитов (`52ece89`, `ef6912d`, `17fe02c`, `47085c5`, `abf03d6`, `e8c2f2a`, `d647dcb`, `cb2792e`, `b9a9728`, `440d411`) трогают только один seam-модуль + родительский файл (+ тест). Интерфейсы и места вызова не менялись; `AppWindow`/`DesktopIcon` перенесены байт-в-байт. Порядок отката записан в 17-07-SUMMARY |
| 5 | D-02/D-03/D-07: части для Phase 17.1 вынесены отдельными планами и не знают сервер | ✓ VERIFIED | `portia-editor-dossier.tsx`, `portia-editor-rich-text.tsx`, `portia-desktop-dossier.tsx`: grep на `fetch(`, `/api/`, `supabase`, `createClient`, `revision` пуст. `ImageEditorField` с `onUpload?` необязателен, зона загрузки рендерится только при `onUpload` (`portia-editor-dossier.tsx:350,363`). Ровно один `createContext` (`ActiveFormatContext`, `portia-editor-rich-text.tsx:41`). Рабочий стол редактор статически не импортирует (только `next/dynamic`, `portia-desktop.tsx:25`). Планы 17-02, 17-03, 17-04 отдельные |
| 6 | Плана 17-01: `phase17-move-parity.mjs` доказывает чистый перенос | ✓ VERIFIED (с оговорками WR-01..03) | Работает (exit 0/1 корректны, `lib/phase17-move-parity.test.ts` зелёный). Слабости из ревью реальны (мультимножество, не порядок; нет проверки потерь в target; тихий no-op через симлинк). Я компенсировал независимой проверкой: каждый top-level блок всех 6 seam-модулей найден в базе как непрерывная подстрока (расхождения только в `export`-префиксе и моём разбиении), так что вывод "перенос чистый" подтверждён вне инструмента |
| 7 | D-04/D-05: поведение `openApp` закреплено, «кивка» нет | ✓ VERIFIED | Диф тела `openApp` против базы: те же условия появления, `exitTimers`, `focusApp`, `setStartOpen(false)`, ветка `broadcasts`. Тест «a visible window behind others only keeps its origin» зелёный. Новых анимаций/классов нет |
| 8 | D-06/D-08/D-09: инвентаризация, журнал багов, фон/паук не тронуты | ✓ VERIFIED | `17-WINDOW-REOPEN.md` и `17-FOUND-BUGS.md` существуют (баг `accentPickerOpen`/`accentDraft` записан, не исправлен). `git diff 55f51d6..HEAD` по `components/portia-wallpaper.tsx`, `components/portia-wallpaper-spider.tsx`, `app/portia.css`, `tests/e2e/visual` пуст |
| 9 | Source-тесты читают семейство файлов; STAB-DESK-07 закреплён | ✓ VERIFIED | `lib/component-source.ts: componentFamily`; `lib/portia-desktop.test.ts`, `lib/accent-theme.test.ts`, `lib/dossier-parts.test.ts` проходят. Оговорка IN-02/IN-03: проверка границ импортов узкая (только `"@/components/…"`), счётчики хрупкие; не блокер |
| 10 | 17-05: `window-reopen.spec.ts` доказывает STAB-DESK-01 в браузере | ✗ FAILED | CR-01 (см. gap). Плюс спек не исполнялся (BLOCKED ENV) |

**Score:** 8/10 истин проверено (1 present, behavior-unverified: истина 3; 1 FAILED: истина 10).

### Проверенные факты (независимо от SUMMARY)

| Проверка | Команда / способ | Результат |
|----------|------------------|-----------|
| Типы | `npm exec tsc -- --noEmit` (Node 22.13.1) | exit 0 |
| Lint | `npm run lint` | 0 errors, 18 warnings (ровно как в эталоне 17-PARITY-BASELINE) |
| Целевые тесты | `node --test lib/window-open.test.ts lib/phase17-move-parity.test.ts lib/dossier-parts.test.ts lib/portia-desktop.test.ts lib/accent-theme.test.ts` | 81 tests, 81 pass, 0 fail |
| Полный `npm test`, `npm run build` | факты оркестратора (Node 22.13.1) | 680 tests, 679 pass, 0 fail, 1 skipped; build exit 0. Мной повторно не запускались |
| Чистый перенос, редактор | `phase17-move-parity.mjs --ref 55f51d6 --from components/portia-editor.tsx --to …-dossier.tsx --to …-rich-text.tsx --to lib/editor-items.ts` | pure move: 912 lines, exit 0 |
| Чистый перенос, рабочий стол (4 seam-а) | `--ref 76a5d7a --from components/portia-desktop.tsx --to …-window.tsx --to …-shortcuts.tsx --to …-documents.tsx` | pure move: 489 lines, exit 0 |
| Рабочий стол целиком от 55f51d6 | то же с `…-dossier.tsx`, `lib/window-open.ts` | exit 1; расхождения только `openApp`/`finishExit` и новые функции `lib/window-open.ts` (ожидаемо, 17-05) |
| Размеры | `wc -l` | `portia-desktop.tsx` 2317 → 1567; `portia-editor.tsx` 3033 → 2052 |

### Покрытие требований

| Requirement | Планы | Описание | Статус | Доказательство |
|-------------|-------|----------|--------|----------------|
| STAB-DESK-07 | 17-01..17-07 (все семь) | Декомпозиция сохраняет app ids, DOM, CSS hooks, storage keys, API shapes, порядок, данные и snapshots | ⚠️ ЧАСТИЧНО: код ✓, браузерные snapshots BLOCKED | Истины 2, 3, 4, 8, 9 |
| STAB-DESK-01 | 17-05, 17-06 | Один app id = одна поверхность из любого входа; повторное открытие восстанавливает и фокусирует без дубликата и потери состояния | ⚠️ ЧАСТИЧНО: логика/структура ✓, браузерный спек FAILED (CR-01) и BLOCKED | Истины 1, 10 |

Оба ID из PLAN frontmatter найдены в REQUIREMENTS.md (строки 19 и 25) и в таблице трассировки (134, 140), на Phase 17 больше ничего не отображено: ORPHANED нет. В REQUIREMENTS.md оба ID остаются `Pending`/`[ ]`; отмечать выполненными преждевременно до закрытия gap и браузерных проверок.

### Анти-паттерны

| Файл | Паттерн | Серьёзность | Влияние |
|------|---------|-------------|---------|
| `tests/e2e/specs/window-reopen.spec.ts:50-52` | клик по кнопке окна, перекрытого другим окном (CR-01) | BLOCKER для истины 10 | Спек упадёт на (d) |
| `scripts/phase17-move-parity.mjs:93-95` | запуск через симлинк/junction молча exit 0 (WR-01) | WARNING | Ложный "pure move"; на этой машине инструмент отработал корректно |
| `scripts/phase17-move-parity.mjs:47-49` | не видит удалений из target и порядок строк (WR-02) | WARNING | Компенсировано моей независимой проверкой блоков |
| `scripts/phase17-move-parity.mjs:12-17,54-64` | `gitShow` скрывает ошибки; одинарные кавычки в import (WR-03) | WARNING | Возможен ложный результат при неверном `--ref` |
| `components/portia-desktop-dossier.tsx:189,198` | `export` у `DossierSection`/`MediaBlock` без потребителей (IN-01) | INFO | Лишняя поверхность |
| `lib/portia-desktop.test.ts`, `lib/window-open.test.ts` | узкая проверка границ импортов, хрупкие числа (IN-02, IN-03) | INFO | Не блокирует |

Маркеры `TBD`/`FIXME`/`XXX` в изменённых файлах фазы: не искались как блокер по каждому файлу отдельно; в перенесённом коде новых не добавлено (построчный перенос).

### Блокированные доказательства (не засчитаны как pass)

- Playwright `--list`, визуальная дорожка `tests/e2e/visual` (6 specs x 5 проектов), `window-reopen.spec.ts`: BLOCKED (ENV), `[PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY`. SUMMARY 17-05/06/07 и 17-PARITY-BASELINE честно записывают их как BLOCKED, не как pass.
- Тело редактора в роли владельца: BLOCKED (ROLE) с Phase 15.

### Deferred

Нет. Фазы 18+ (паук, фон, «кивок», сброс `accentPickerOpen`) не покрывают CR-01 и браузерную parity Phase 17.

### Требуется решение человека

1. **Исправить CR-01** (две строки в спеке, см. gap) и закрыть disposition. Это единственный gap, блокирующий статус; остальное, WR-01..03 и IN-01..03, остаётся `open` и допустимо перенести в Phase 21 или отдельный quick-фикс инструмента.
2. **Принять или отклонить фазу без браузерной parity.** Пока preflight-окружение недоступно, SC1 (браузер) и SC2 (снимки) нельзя закрыть автоматически; нужны пункты из `human_verification` выше.

### Сводка gaps

Декомпозиция выполнена и обратима, пользовательский контракт по коду не изменился. Не доведено до конца одно: браузерное доказательство STAB-DESK-01 написано с ошибкой (CR-01) и не исполнялось. Это дёшево исправить, но до исправления must-have 17-05 про e2e-спек не выполнен. Параллельно остаётся незакрытой визуальная parity (BLOCKED ENV): её надо провести, когда владелец даст безопасное окружение.

---

_Проверено: 2026-11-01_
_Верификатор: Claude (gsd-verifier)_
