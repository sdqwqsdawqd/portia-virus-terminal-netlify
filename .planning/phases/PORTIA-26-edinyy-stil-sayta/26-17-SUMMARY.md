---
phase: PORTIA-26-edinyy-stil-sayta
plan: 17
subsystem: ui
tags: [css, maximized-window, promotion, settings, uat-gap-closure]
status: complete
gap_closure: true

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "UAT 2026-11-16 (26-UAT.md Gaps 3 и 8), блок ui-unify в app/portia.css, 26-15 (поиск), 26-16 (рамка, диалоги)"
provides:
  - "Абзацы входа «Повышения» (.promotion-gate > p) на всю ширину сетки, а не в колонку знака 72px"
  - "Развёрнутое окно: «Повышение» (вход и статус), «Настройки», «Справочник», «База вирусов» используют площадь"
  - "26-MAXIMIZED-AUDIT.md с исходами «fixed (UAT 2026-11-16)»"
affects: [PORTIA-26 gap-closure 26-18..26-20, PORTIA-27]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 6b691573d4a9aa090f29f22ccded189d514f7363
plan_head_after: 10ead9b55dc7b201cd929f8287123d3045561647

tech-stack:
  added: []
  patterns:
    - "Правила развёрнутого окна — только под .app-window.is-maximized в @media (width > 900px); R3 (1281px) остался только у плоских форм"
    - "Раскладку входа «Повышения» разводит :has(> form) / :not(:has(> form)) — форма и пояснения рядом, без формы пояснения на всю ширину"

key-files:
  created: []
  modified:
    - app/portia.css
    - lib/ui-unify.test.ts
    - .planning/phases/PORTIA-26-edinyy-stil-sayta/26-MAXIMIZED-AUDIT.md

key-decisions:
  - "Gap 8: правило .promotion-gate > p { grid-column: 1 / -1 } стоит рядом с .promotion-gate вне блока ui-unify (общая семья не затронута); в развёрнутом окне абзацы получают колонку 3 (при форме) или 2 / -1 (без формы)."
  - "«Настройки» перенесены из R3 (1281px, 2 × 648px) в общий блок развёрнутого окна (900px): до 3 колонок minmax(max(var(--card-min), (100% - 48px) / 3), 1fr); тест D-19 по-прежнему видит R3 только у профиля сотрудника и формы вируса."
  - "Единственное снятие потолка ширины под хуком — .guide-page { max-width: none }; тест D-02 допускает none только для этого селектора."
  - "Запись базы вирусов привязана к .archive-grid .record-document; тест запрещает template-card-preview в селекторах с is-maximized (T-26-36)."

requirements-completed: [UI-06, UI-03]

duration: 15 min
completed: 2026-11-17
---

# Phase PORTIA-26 Plan 17: «Повышение», «Настройки», «Справочник», «База вирусов» на всю площадь Summary

Абзацы входа «Повышения» больше не сжимаются в колонку знака 72px (`.promotion-gate > p { grid-column: 1 / -1 }`), а развёрнутые окна «Повышение», «Настройки», «Справочник» и «База вирусов» занимают всю панель правилами под единственным хуком `.app-window.is-maximized`.

## Для владельца (текстом, без галерей)

- **Повышение, вход.** Сообщение «Заявка ожидает решения…» теперь обычный абзац на всю ширину, а не столбик по слову. То же для «Для участия нужна одобренная заявка…», «Заявка отклонена…», «Доступ отозван…», ошибки и «Проверяем доступ к повышению…». В развёрнутом окне вход занимает окно: знак слева (72px), шапка справа, форма (колонка 2) и пояснения (колонка 3) рядом; без формы пояснения идут на колонки 2–3. Поле ника по-прежнему не шире 640px. В обычном окне и на телефоне — прежняя колонка 680px.
- **Повышение, статус заявки (развёрнутое окно).** Колонка 680px по центру снята: шапка участника и карточки заявок идут на всю ширину, карточки — в 2 колонки с зазором 24px (минимум колонки 360px, на узком окне — одна).
- **Настройки.** Группы идут сеткой до 3 колонок на всю ширину панели (колонка не уже 360px, зазор 24px) вместо 2 × 648px; заголовок, «Содержимое сайта» и подвал — на все колонки. Фон и полоса прокрутки доходят до края окна.
- **Справочник.** Открытая статья занимает всю панель (было 820px). Плитки не менялись.
- **База вирусов.** Запись (`.record-document` внутри `.archive-grid`) — на всю ширину правой панели (было 1060px по центру), документ учёного — на всю панель за вычетом 42px (было 820px). Колонка списка 270–340px прежняя. Карточка записи в шаблоне «Повышения» (1060px, D-55) не менялась.
- **Без изменений:** «Информация», «Сводка», «Сотрудники», «Корзина», «Таблица», «Устав» (жалобы не было, D-10), обычное окно и телефон; «Глобальный поиск» закрыт в 26-15.
- Пиксельный вид в браузере (1366×768, 1920×1080, 2560×1440) не снимался: BLOCKED (ENV), физический ПК — Phase 27. Это не PASS.

## Accomplishments

- Трассер (Task 1): тесты «UI-03 (UAT 2026-11-16 gap 8): every paragraph of the promotion gate spans the whole grid» и «UI-06 (UAT 2026-11-16 gap 3): the promotion gate and status fill a maximized window» -> правила `.promotion-gate > p` и семь правил `.app-window.is-maximized .promotion-gate/.promotion-shell/.promotion-flow-list`. Проверка исходника: абзацы `promotion-binding-note` (для участника), `promotion-next-note`, `promotion-error` и абзац загрузки — прямые дети `.promotion-gate`.
- Task 2: тесты записей `settings`, `guide`, `archive` перенацелены (проверяют новые значения, а не прежние меры), тест D-02 допускает `max-width: none` только у `.guide-page`; правила в блоке `ui-unify`; аудит обновлён (5 строк «fixed (UAT 2026-11-16)», строка про пиксели — BLOCKED (ENV)).

## Task Commits

1. Task 1 RED `c103186` — `test(26-17)`. Целевые тесты: gap 8, gap 3 и перенацеленная запись `promotion`; итог `# tests 43 # pass 40 # fail 3`, падение на запланированных утверждениях (ожидалось `auto` у `width` и `1 / -1` у `grid-column`, получено `undefined`). Семантическая оценка: тесты выполнились и упали по нужной причине (правил ещё нет), не по загрузке/синтаксису — RED валиден.
2. Task 1 GREEN `8ea001a` — `feat(26-17)`: `ui-unify`, `portia-promotion`, `style-tokens`: 65/65. Трассер проверен насквозь, расширение разрешено.
3. Task 2 RED `c2c7eb0` — `test(26-17)`. Три записи аудита (`archive`, `guide`, `settings`) упали на запланированных утверждениях (`auto`, `none`, `grid`); `# tests 43 # pass 40 # fail 3`. RED валиден.
4. Task 2 GREEN `10ead9b` — `feat(26-17)`: правила блока `ui-unify`, аудит.

Классификатор `gsd_run check tdd-red-evidence` не запускался (проектный guard блокирует вызов шима); RED проверен по реальному выводу TAP и семантически, как выше.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1): `# tests 2372 # pass 2369 # fail 0 # skipped 3` (3 пропущенных были и до плана).
- `node node_modules/typescript/bin/tsc --noEmit`: без ошибок. ESLint по `lib/ui-unify.test.ts`: чисто.
- Acceptance: `\.promotion-gate > p` — 1; `is-maximized .promotion-gate` — 7 строк; `UAT 2026-11-16 gap 8` в тестах — 2; `is-maximized .archive-grid .record-document` — 1; `is-maximized .guide-page` — 1; `minmax(0, 648px)` — 0; `UAT 2026-11-16` в аудите — 9 строк; `BLOCKED (ENV)` в аудите — 2 строки.
- Владельческие пути из CLAUDE.md не менялись и не стейджились; стейдж только по явным путям (`.planning/state.json` и `.planning/milestone.lock` были изменены до плана, не затронуты).
- Браузерная раскладка: BLOCKED (ENV), не PASS.

## Deviations from Plan

None - plan executed exactly as written. (Мелочь: при первой RED-фиксации область коммита была `PORTIA-26-17`; исправлена на `26-17` через amend до продолжения, чтобы совпадать с шаблоном проверки TDD-ворот и прежних планов.)

## Known Stubs

None.

## Threat Flags

None. Правка только раскладки: данные заявки, тексты и запросы `PromotionIdentityGate`/`PromotionStatusCard` не менялись (T-26-37); правило записи привязано к `.archive-grid`, `template-card-preview` под `is-maximized` запрещён тестом, базовые ширины 1060px/820px закреплены (T-26-36).

## Issues Encountered

- Проектный guard заблокировал одну команду, где в одной строке были подстановка `$(…)` с чтением файла-ledger и git-вызовы; команда разнесена на простые.
- Пустой левый столбец 72px остаётся под абзацем «Проверяем доступ к повышению…» в развёрнутом окне (у загрузки нет знака); состояние кратковременное, правило плана не менялось.

## TDD Gate Compliance

RED (`test(26-17)`) -> GREEN (`feat(26-17)`) присутствуют для обеих задач (c103186 -> 8ea001a, c2c7eb0 -> 10ead9b), REFACTOR не потребовался.

## Self-Check: PASSED

- FOUND: app/portia.css, lib/ui-unify.test.ts, .planning/phases/PORTIA-26-edinyy-stil-sayta/26-MAXIMIZED-AUDIT.md
- FOUND commits: c103186, 8ea001a, c2c7eb0, 10ead9b
