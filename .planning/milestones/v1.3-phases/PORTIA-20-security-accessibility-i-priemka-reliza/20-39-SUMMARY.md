---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 39
subsystem: ui
tags: [template-builder, editor-shared-components, rich-text, local-images, e2e-spec, a11y, gap-closure, tdd]
status: complete

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: 20-38 модель TemplateDossier и экспорт HTML/PNG; 20-36 правки спека доступности; решение владельца D-52
provides:
  - components/portia-template-builder.tsx - конструктор из общих компонентов редактора (вкладки, группы, Field, FormattedTextarea, панель ОФОРМЛЕНИЕ), без записей учёных, без пути записи
  - локальные слоты изображений и предпросмотр 01-05 с оформлением, классификацией и мутациями
  - tests/e2e/specs/template-builder.spec.ts, часть tests/e2e/specs/accessibility.spec.ts, tests/e2e/visual-candidates/template-builder.spec.ts - готовы к прогону в 20-37 Task 2
  - 20-UI-SPEC.md описывает конструктор по D-52
affects: [20-37, 20-12]

actuals:
  tokens: 22000
  tasks: 3
  commits: 4

plan_head_before: d2b50fba8dede1085327fd28cc1814b0006f7cf5
plan_head_after: 42706e673221cf82e79c0942f11015b0db412fdf

tech-stack:
  added: []
  patterns:
    - "Общие компоненты редактора получают только необязательные свойства с прежним значением по умолчанию; components/portia-editor.tsx и lib/editor-items.ts не менялись"
    - "Статическая проверка исходника конструктора (импорты, отсутствие сети и хранилищ) с fail-first фикстурой через GSD_PROHIB_SUBJECT"
    - "Спек UI-контракта подменяет одно чтение статуса участника и ловит любую запись трекером запросов"

key-files:
  created:
    - lib/portia-template-builder.test.ts
    - lib/fixtures/template-builder-violation.txt
    - tests/e2e/visual-candidates/template-builder.spec.ts
  modified:
    - components/portia-template-builder.tsx
    - components/portia-editor-dossier.tsx
    - components/portia-editor-rich-text.tsx
    - lib/portia-template-export.ts
    - lib/portia-template-export.test.ts
    - app/portia.css
    - tests/e2e/specs/template-builder.spec.ts
    - tests/e2e/specs/accessibility.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md

key-decisions:
  - "Конструктор не импортирует модули редактора, рабочего стола и записи; панель оформления получает positionStorageKey={null}, поэтому не читает и не пишет ключ редактора."
  - "intendedSnapshot кадров записан точным путём tests/e2e/visual/__screenshots__/phase20-template-builder-<состояние>--<проект>.png без пояснения в скобках: манифест сравнивает его со строкой ledger строго, как у phase20-art; пометка 20-12/20-37 вынесена в state кадра."
  - "Кадры используют requirement STAB-BASE-03 (иного support.ts не принимает), доказательство относится к STAB-TMPL-01."

requirements-completed: []

coverage:
  - id: D1
    description: "Конструктор собран из общих компонентов редактора без записей учёных; нет пути записи на сайт"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-builder.test.ts (12 тестов; fail-first на фикстуре: 5 pass, 7 fail, код выхода 1)"
  - id: D2
    description: "Браузерный UI-контракт, полоса доступности и кадры-кандидаты написаны"
    requirement: STAB-TMPL-01
    verification:
      - kind: static
        ref: "npm exec tsc -- --noEmit (код 0) и eslint по трём спекам (код 0). Браузерный прогон отсутствует: BLOCKED до 20-37 Task 2"
---

# Phase 20 Plan 39: Конструктор шаблона по D-52 Summary

Конструктор «Создать шаблон» теперь правит карточку тем же набором компонентов, что редактор сайта (вкладки «Основное», «Описание», «Мутации» без «Записи учёных», форматированный текст и панель «ОФОРМЛЕНИЕ», локальные слоты изображений, предпросмотр 01–05), хранит черновик только у себя и не имеет пути записи на сайт; спеки и кадры для 20-37 готовы.

Playwright не запускался — прогон в 20-37 Task 2. Ни один браузерный сценарий не записан как PASS.

Исполнение разделено между двумя исполнителями в определённой точке возобновления: первый выполнил RED, Task 1 и Task 2 (коммиты fd3333a, 608602b, 3064835), второй — Task 3 и закрытие плана (коммит 42706e6 и документы).

## Что сделано

| Задача | Коммит | Содержание |
|--------|--------|-----------|
| RED | fd3333a | `lib/portia-template-builder.test.ts` и `lib/fixtures/template-builder-violation.txt`; в теле `PLAN_BASE: d2b50fba8dede1085327fd28cc1814b0006f7cf5` |
| 1 | 608602b | Конструктор на общих компонентах редактора (D-52) |
| 2 | 3064835 | Локальные слоты изображений, предпросмотр 01–05, CSS, удаление плоского экспортного API |
| 3 | 42706e6 | Спеки UI-контракта и доступности, кадры-кандидаты, 20-UI-SPEC по D-52 |

### Task 3

- `tests/e2e/specs/template-builder.spec.ts`: все прежние сценарии перенесены на новую форму (вкладки как кнопки навигации «Разделы досье», `Field` по подписи, форматированные поля как role textbox по имени, длинный текст вставкой события paste). Добавлены сценарии: форма и отсутствие вкладки «Записи учёных»; оформление (слово в «Внешние характеристики», «ОФОРМЛЕНИЕ», пресет «Заголовок» - тот же стиль в span предпросмотра и в скачанном HTML); мутации (две, оформление описания второй, удаление первой - в предпросмотре и HTML одна M-01 с текстом, оформлением и картинкой бывшей второй); классификация («УРОВЕНЬ n» в предпросмотре и HTML). Каждый заголовок начинается с «[STAB-TMPL-01]», каждый сценарий завершается проверкой пустого `trackWrites`. Заголовок о заглушке одного чтения сохранён.
- `tests/e2e/specs/accessibility.spec.ts`: изменена только полоса шаблона; тест называется «template builder (UI-contract stub): …». На каждой из трёх вкладок (на «Мутации» после добавления одной мутации) у каждого видимого input, select, textarea и `[role=textbox]` проверено `toHaveAccessibleName(/\S/)` и axe без critical/serious; длинное кириллическое значение вводится в «Название»; ловушка диалога и возврат фокуса прежние.
- `tests/e2e/visual-candidates/template-builder.spec.ts` (новый): кадры `template-builder-main`, `-text`, `-mutations`, `-preview` на chromium-desktop и chromium-phone, остальные проекты пропускаются. Перед каждым кадром: окончание анимаций окна, нет горизонтальной прокрутки страницы и окна; на телефоне цели вкладок, кнопки оформления и кнопок скачивания не меньше 44×44. Трекер запросов роняет тест (`test.afterEach`) при любом не-GET к своему `/api`, любом запросе к Supabase и любом запросе к `/api/uploads`. PNG для слотов генерируется в спеке детерминированно. Заголовок: UI-контракт, подменено одно чтение, не доказательство ролей; строки participant остаются BLOCKED (DATA).
- `20-UI-SPEC.md`: пункт «[ВЛАДЕЛЕЦ, D-52, обновление 2026-11-06]», фраза о классификации помечена как заменённая D-52 (записи архива, публикация, права, серверное сохранение по-прежнему запрещены; запрет подключения к `PortiaEditor` сохранён), строки E7 (empty, populated), таблица текстов («ОФОРМЛЕНИЕ», «+ ДОБАВИТЬ МУТАЦИЮ», вкладки, подпись слота изображения «ВЫБРАТЬ ФАЙЛ С КОМПЬЮТЕРА»).

## Проверки (команды выполнены на Node v22.13.1 из `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`)

Ничего не устанавливалось; сборка, сервер и Playwright не запускались.

- RED (Task 1): 12 тестов, 3 прошли (охранные), 9 упали с ERR_ASSERTION. `gsd-tools check tdd-red-evidence` не запускался, вердикт опирается на смысловое чтение.
- GREEN: тесты конструктора, dossier-parts и template-dossier - 34 pass, 0 fail.
- Fail-first: `GSD_PROHIB_SUBJECT=lib/fixtures/template-builder-violation.txt node --experimental-strip-types --test lib/portia-template-builder.test.ts` - код выхода 1, 5 pass, 7 fail (повторено при закрытии).
- Закрытие: `npm test` - 1508 тестов, 1504 pass, 0 fail, 4 skipped; `lib/security-matrix.test.ts` - 45 из 45; `npm exec tsc -- --noEmit` - код 0; `npm run lint` - 0 errors, 17 warnings (как на базе).
- `git diff --exit-code d2b50fb..HEAD -- components/portia-editor.tsx lib/editor-items.ts` - код 0 (файлы редактора не менялись).
- Охранная проверка селекторов живого редактора (команда из плана) ничего не напечатала.
- Приёмка Task 3: `grep -c 'Название вируса'` в template-builder.spec.ts - 0; `toHaveAccessibleName` в accessibility.spec.ts - 1; `D-52` в 20-UI-SPEC.md - 7; `template-builder-(main|text|mutations|preview)` в кадровом спеке - 8; `git status --porcelain -- tests/e2e/visual/__screenshots__ components lib app` пуст.
- Acceptance Task 2: joinFormatTarget export 1, `positionStorageKey={null}` 1, импорт dossier 1, `export const templateFields` 0, `^\.template-field` 0, `image-editor-field` 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CRLF в app/portia.css и components/portia-editor-dossier.tsx**
- Найдено при Task 2: правки должны сохранять существующие окончания строк. В статические читатели исходников теста добавлен нормализатор `lf()`; правки сохраняют прежний EOL.

**2. [Rule 1 - Behavior] Лимиты длины на простых полях**
- `maxLength` 120/40/80/120 на «Название», «Код», «Статус» и названии мутации. У `FormattedTextarea` лимита нет, прежние 4000 символов сняты. Отказ «PNG слишком длинный» сохранён.

**3. [Rule 3 - Blocking] Константы предпросмотра экспортированы из lib/portia-template-export.ts**
- `classificationAxes`, `ppuFields`, `sectionTitles`, `photoCaption`, `mutationCaption`, `mutationLabel`, `classificationLevel`, чтобы предпросмотр и файлы брали подписи из одного места.

**4. [Rule 3 - Blocking] Надпись «ПОВЫШЕНИЕ // ЗАДАНИЕ»**
- Записана как `{"ПОВЫШЕНИЕ // ЗАДАНИЕ"}`: удалитель комментариев в тесте читал `//` как комментарий.

**5. [Task 3 - формулировка плана] intendedSnapshot без пояснения в скобках**
- План называет значение «tests/e2e/visual/__screenshots__/phase20-template-builder-<состояние>--<проект>.png (20-12, после одобрения 20-37)». `scripts/phase15-visual-manifest.mjs` сравнивает `intendedSnapshot` строки ledger с кандидатом строго, а 20-12 продвигает файл по точному пути, поэтому в поле записан чистый путь, как у `phase20-art.spec.ts`; пометка «UI-контракт, D-52, STAB-TMPL-01» вынесена в `state` кадра.

**6. [Task 3 - формулировка плана] Подпись слота изображения**
- UI-SPEC раньше называл действие «Добавить изображение»; у слота в конструкторе, как у `ImageEditorField` редактора, действие называется «ВЫБРАТЬ ФАЙЛ С КОМПЬЮТЕРА». UI-SPEC приведён к фактическому тексту.

Оболочка: многострочные `node -e` и heredoc теряли обратные слэши, поэтому вспомогательные скрипты писались в scratchpad инструментом Write и запускались через node.

## Допущения и риски для прогона в 20-37 (браузер не запускался)

- Спек полагается на: вставку текста событием `paste` в contenteditable (обработчик `onPaste` поля), выделение слова клавишами Shift+ArrowRight, имя панели «Форматирование: …», группу «Готовые стили». Если на телефоне панель свёрнута, сценарий раскрывает её кнопкой «Развернуть панель оформления».
- Сценарий «слишком длинный для PNG» рассчитывает, что 2 × 1999 строк по-прежнему превышают предел высоты PNG при новой раскладке карточки 20-38; не проверено в браузере.
- Цвета и размеры стиля проверяются через `toHaveCSS` (font-weight 800, font-size 22px; font-weight 600, color rgb(180, 54, 50)) по пресетам `stylePresets` в `lib/rich-text-style.ts`.
- Выбор опции классификации идёт по значению («Апейрон», «Тезей»); «УРОВЕНЬ 3» и «УРОВЕНЬ 2» следуют из `classificationOptions`.

## Threat Flags

Нет новых сетевых путей, путей авторизации или обращений к файлам. Трекер запросов в спеках только наблюдает.

## Known Stubs

Нет. Кадровый спек намеренно подменяет одно чтение `GET /api/promotion/status?nickname=`; это заявлено в его заголовке и не выдаётся за доказательство роли. Строки состояния участника (promotion-participant-cards и др.) остаются BLOCKED (DATA).

## Требования

`requirements.mark-complete` не вызывался: STAB-TMPL-01, STAB-VIS-04, STAB-A11Y-* зависят от вердикта владельца в 20-37, REQUIREMENTS.md не тронут.

## Self-Check: PASSED

Все перечисленные файлы существуют; коммиты fd3333a, 608602b, 3064835 и 42706e6 входят в историю ветки.
