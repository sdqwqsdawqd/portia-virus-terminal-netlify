---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 07
subsystem: editor
tags: [level-picker, editor, lvl-02, lvl-06, lvl-07, d-13, d-14, d-16]
requires:
  - phase: PORTIA-24-01
    provides: levelCopy (pickerLegend, pickerOption, parentHint, parentTitle, logsEmptyEditor, appsGroup, appLabels)
  - phase: PORTIA-24-02
    provides: размеченный блок access-levels в app/portia.css и охрана блока в style-tokens
  - phase: PORTIA-24-03
    provides: LEVELED_APP_IDS, appLevels в черновике, нормализатор уровня
provides:
  - components/portia-level-picker.tsx - LevelPicker, один выбор уровня 1-5 (fieldset, legend, пять нативных радио, min, подсказка, notice)
  - выбор уровня у вируса, у каждой записи учёного (вместо II-IV) и у «Устава» в обоих редакторах
  - blankVirus без записей учёных; новая запись учёного с уровнем 1; строка про пустой список
affects: [PORTIA-24-08, PORTIA-24-11]
requirements-completed: []
actuals:
  tokens: 7000
  tasks: 2
  commits: 2
plan_head_before: 2fdfaa8043df0a528fab864e74b91e30e4e41dd0
plan_head_after: b26abac100f8f10d1e73e0e114f33c89bff0f2f9
tech-stack:
  added: []
  patterns: [один компонент с общим name по id записи, шкала читается только внутри компонента, правила picker внутри размеченного блока access-levels, охрана файла редактора расширена реестром одобренной правки]
key-files:
  created:
    - components/portia-level-picker.tsx
    - lib/level-editor.test.ts
  modified:
    - components/portia-editor.tsx
    - components/portia-editor-dossier.tsx
    - app/portia.css
    - lib/access-foundation.test.ts
    - lib/format-launch.test.ts
    - lib/level-ui.test.ts
    - lib/portia-desktop.test.ts
key-decisions:
  - "Показываемое значение плашки - max(requiredLevelOf(value), min): запись без level показывает «1», мусорное значение показывается как 5, пустого выбора нет."
  - "Плашки ниже min неактивны (disabled), с title и видимой строкой «Не ниже раздела: N», связанной через aria-describedby; в этом плане min нигде не передаётся (иерархия - план 24-08), механика готова."
  - "Группа «Приложения» с «Уставом» стоит первым элементом формы вкладки «Информация» (O-2 по умолчанию) и перебирает LEVELED_APP_IDS (O-1); редактор не знает слова charter."
  - "Защитные тесты, которые закрепляли прежний вид редактора, обновлены вместе с правкой, а не обойдены: реестр D-64 получил запись PORTIA-24 с побайтной заменой образца."
duration: 40min
completed: 2026-11-15
status: complete
---

# Phase 24 Plan 07: общий выбор уровня «1 2 3 4 5» в редакторе Summary

Редактор ставит нужный уровень вирусу, каждой записи учёного (шкала 1-5 вместо II-IV) и приложению «Устав» одним общим элементом `LevelPicker`; новая карточка вируса создаётся без заготовок записей и сохраняется без них, новая запись учёного начинается с уровня 1.

## Что сделано

**Задача 1, коммит `184ef04`: компонент и стили.** `components/portia-level-picker.tsx`: `fieldset.access-level-picker`, `legend` «Нужен допуск», пять `input[type=radio]` с общим `name`, плашки строятся через `ACCESS_LEVELS.map`, доступное имя «Допуск N», цифра внутри плашки скрыта от скринридера. Ниже `min` плашка `disabled` с `title`, под группой видимая строка `access-level-hint`, связь через `aria-describedby` только при `min > 1`; `notice` выводится в `p role="status"`. Собственных обработчиков клавиатуры нет, Tab и стрелки нативные. В `app/portia.css` 18 строк внутри блока `access-levels` (перед `access-levels:end`, `users-tab` остаётся последним): плашка 40x40, на телефоне 44x44, `flex-wrap: wrap` и промежуток 4px (пять плашек и четыре промежутка = 236px на телефоне), выбранная - рамка `--teal-dim`, заливка `--teal-soft`, внутренняя рамка 1px, цифра `--teal`; фокус - существующая обводка 2px на плашке; неактивная - `opacity: .4`, `cursor: not-allowed`. Без `border-radius`, анимаций, hex. `components/portia-level-picker.tsx` добавлен в список разрешённых `lib/access-foundation.test.ts` (правило для редактора и запреты `portia_access_`, `access-store`, `access-session` не менялись). `lib/level-editor.test.ts` проверяет исходник компонента и блок CSS.

**Задача 2, коммит `b26abac`: места в редакторах.**
- `portia-editor.tsx`: `LevelPicker` вируса сразу под «Название» во вкладке «Основное»; у каждой записи учёного вместо нативного списка II/III/IV (`name` по id записи); кнопка «+ ДОБАВИТЬ ЗАПИСЬ» создаёт запись с `lockedLevel: 1`; `blankVirus` с `scientistLogs: []`; при пустом списке `p.editor-guidance` «Записей учёных нет. Карточку можно сохранить без них.»; группа «Приложения» первым элементом вкладки «Информация». Подсказки реестра D-58 (h-37, h-38) не тронуты.
- `portia-editor-dossier.tsx` (`ArchivedVirusEditor`): те же вирус и записи, уровень новой записи 1, та же строка при пустом списке.
- Меток уровня в списках редактора нет (D-18); точка несохранённой правки работает через существующее разнесение `changedDossierTabs` («Основное» / «Записи учёных») и ключ `appLevels` во вкладке «Информация». Конструктор шаблонов не импортирует `LevelPicker` (тест).

## Проверка

- `node --experimental-strip-types --test lib/level-editor.test.ts lib/style-tokens.test.ts lib/access-foundation.test.ts lib/phase20-hints-inventory.test.ts` - 36 pass, 0 fail (после задачи 1).
- Те же плюс `dossier-parts`, `portia-template-builder`, `portia-template-dossier`, `editor-changes` - 122 pass, 0 fail.
- Окно красного (`--test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts`) - 2066 tests, 2063 pass, 0 fail, 3 skipped. Пропуск именованного теста «matrix freshness» - ожидаемый красный до плана 24-11, не засчитан как PASS.
- `node node_modules/typescript/bin/tsc --noEmit` - 0 ошибок. ESLint (прямой бинарь) по тронутым файлам - 0 ошибок, 5 предупреждений `<img>`/`exhaustive-deps` в строках, которых план не касался.
- Критерии приёмки: `export function LevelPicker` найден; правила `access-level-option` только внутри блока `access-levels`; слова «заблокирована» и «ЗАПИСЬ 01» в обоих редакторах нет; `<LevelPicker` в `portia-editor.tsx` 3 раза, в `portia-editor-dossier.tsx` 2 раза; тест «D-58» зелёный.

## Не доказано (BLOCKED)

- Размер 44x44 и видимая подсказка на телефоне, отсутствие горизонтального скролла на 320px, фокус и стрелки в живом браузере - BLOCKED до плана 24-11 (проверено исходником и CSS, не браузером). Галерей и журнала хэшей нет (решение владельца 2026-11-08).
- Физические устройства, аутентифицированные роли, Postgres/RLS - BLOCKED до своих фаз.

## Требования

LVL-06 и LVL-07 не отмечены выполненными, остаются Pending: редакторская часть (карточка без записей, шкала 1-5 у записи) готова здесь, но скрытие пустого блока записей у посетителя и показ по реальному уровню посетителя приходят в планах для посетителя. LVL-02 в REQUIREMENTS.md уже отмечен ранее; этот план его не менял, подъём иерархии и уровни разделов «Информации» и «Справочника» - план 24-08.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Охрана файла редактора закрепляла прежний вид**
- **Found during:** Task 2, окно красного
- **Issue:** `lib/format-launch.test.ts` (D-64 побайтное сравнение с образцом 449c756 и D-58 по набору русских строк) падал на одобренной правке; `lib/portia-desktop.test.ts` (импорты семейства редактора и начало формы «Информация», D-15) ждал прежнюю разметку; `lib/level-ui.test.ts` (D-09) запрещал `:hover` и `cursor: pointer` во всём блоке `access-levels`, а не только у `.access-redacted`.
- **Fix:** в реестр D-64 добавлена запись `PORTIA-24` (`applyLevelPickerHunk`, побайтные замены образца, плюс проверка, что без неё файл отличается); `portia-level-picker` добавлен в разрешённые общие компоненты семейства редактора; начало формы «Информация» допускает группу «Приложения»; правило «статичность» в D-09 сужено до селекторов `.access-redacted` (как и сформулировано в UI-SPEC и плане). Новых русских строк в редакторе не появилось, строки выбора - в `lib/level-copy.ts`.
- **Files modified:** lib/format-launch.test.ts, lib/portia-desktop.test.ts, lib/level-ui.test.ts
- **Commit:** b26abac

**2. [Рабочая заметка] Подпись коммитов**
- Коммиты подписаны «Claude Sonnet 5.5» по системному указанию среды (задание оркестратора называло Opus 5.5; предыдущие коммиты фазы подписаны Opus 5.5). Первый коммит задачи 1 пересобран (`--amend`) до отправки, чтобы подпись в обоих коммитах плана была одинаковой.

**Порядок TDD:** в задаче 1 (`tdd="true"`) компонент и CSS были написаны до теста, отдельного красного коммита нет; тест написан и пройден до коммита. Отмечено для честности, поведенческие проверки в тесте идут по исходнику, не по поведению в браузере.

## Known Stubs

None.

## Threat Flags

None - новых сетевых точек, путей аутентификации и границ доверия план не вводит; значение уровня идёт в черновик и дальше в PUT, где сервер нормализует (T-24-25, 24-03 и 24-06). T-24-26: в список разрешённых добавлен только компонент выбора, запреты `portia_access_`, `access-store`, `access-session` и правило для `portia-editor.tsx` не менялись (тест).

## Self-Check: PASSED
