---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 08
subsystem: editor
tags: [level-picker, hierarchy, editor, lvl-02, lvl-03, lvl-08, d-05, d-16, d-17]
requires:
  - phase: PORTIA-24-03
    provides: level у раздела, подраздела и карточки в содержимом, нормализатор
  - phase: PORTIA-24-06
    provides: серверный отказ PUT для копии «для зрителя» и подъём иерархии при сохранении
  - phase: PORTIA-24-07
    provides: LevelPicker (min, notice), levelCopy, реестр D-64 с записью PORTIA-24
provides:
  - выбор уровня у раздела и подраздела «Информации», у раздела и карточки «Справочника» (после поля заголовка)
  - иерархия в черновике: плашки ниже раздела неактивны, подъём раздела поднимает детей и сообщает число
  - защита редактора от копии «для зрителя» (contentIncomplete): нет sync, rebase и сохранения, вместо форм блок с role=alert
  - строка saveNotice рядом с чипом сохранения
affects: [PORTIA-24-10, PORTIA-24-11]
requirements-completed: []
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: b5deb68931d1eba44ece30498e11ba7aaedef6e6
plan_head_after: 06fa4b28266afcb9c680ebb151c44da58fe7b326
tech-stack:
  added: []
  patterns: [производный сброс состояния в render (как у popover), подсчёт k по тому же правилу, что raiseChildren, одобренная правка файла редактора внесена в реестр D-64]
key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - lib/level-copy.ts
    - lib/level-editor.test.ts
    - lib/format-launch.test.ts
    - lib/portia-desktop.test.ts
key-decisions:
  - "Строка об автоподъёме принадлежит разделу (parentId) и сбрасывается при смене выбранного раздела производным сбросом в render и при любом следующем изменении уровня; при k = 0 её нет."
  - "Число k считается по черновику до изменения тем же условием, что raiseChildren (effectiveLevel(child.level, 1) < level), поэтому строка и результат не расходятся."
  - "Блок contentIncomplete стоит после ветки accessFailed, поэтому сбой проверки прав сохраняет приоритет; диалог закрытия собран из существующих строк и levelCopy.editorIncomplete.heading, новых длинных литералов в компоненте нет."
  - "saveNotice выводится внутри контейнера чипа перед кнопкой, вне всплывающего окна; чип виден и при пустом черновике, пока есть строка."
duration: 35min
completed: 2026-11-15
status: complete
---

# Phase 24 Plan 08: иерархия уровней и защита от копии «для зрителя» в редакторе Summary

Редактор ставит уровень разделу и подразделу «Информации» и разделу и карточке «Справочника», не даёт опустить ребёнка ниже раздела, поднимает детей при повышении раздела и сообщает число; при неполной (скрытой) копии содержимого он не синхронизирует и не сохраняет, а показывает блок «Содержимое загружено не полностью».

## Что сделано

**Задача 1, коммит `9323a4b`: выбор уровня с иерархией.**
- `LevelPicker` стоит сразу после «Заголовок» раздела «Информации» (`level-info-<id>`), «Заголовок подраздела» (`level-sub-<id>`), «Заголовок раздела» «Справочника» (`level-guide-<id>`), «Заголовок карточки» (`level-card-<id>`).
- У подраздела и карточки `min={effectiveLevel(section.level, 1)}`, значение пишется через `findInfo(...).subsection` и `findGuide(...).card`. Плашки ниже раздела неактивны, подсказка и `title` уже есть в `LevelPicker`.
- У раздела `onChange` считает k по текущему списку детей, затем внутри `changeDraft` пишет `item.level` и вызывает `raiseChildren(item.subsections | item.cards, level)`, затем ставит `raisedNotice` (k > 0) или сбрасывает его. Строка выводится как `notice` группы своего раздела.
- Меток уровня в `SectionTabs`, `EditorToc` и заголовках `CollapsibleCard` нет (D-18, тест).
- Реестр D-64 в `lib/format-launch.test.ts` получил запись `PORTIA-24-08` (`applyLevelHierarchyHunk`, побайтные вставки, плюс проверка, что без неё файл отличается). Новых русских литералов в редакторе нет, строки лежат в `lib/level-copy.ts`.

**Задача 2, коммит `06fa4b2`: защита от неполной копии и строка статуса.**
- `Props`: необязательные `contentIncomplete` и `saveNotice`.
- Эффект синхронизации: первая строка внутри таймера `if (contentIncomplete) return;`, `contentIncomplete` в зависимостях. Неполная копия не становится ни базой, ни черновиком, ни целью rebase; следующая полная копия синхронизируется по прежним правилам D-11.
- `save`: `if (accessFailed || contentIncomplete) return false;`.
- Ранний блок после ветки `accessFailed`: `header`, `div.empty-state.app-fatal-panel` с `div.app-state-reason[role=alert]` (`levelCopy.editorIncomplete.heading` и `.body`), кнопки сохранения нет; диалог «Закрыть редактор?» с несохранённым остаётся.
- `saveNotice` выводится как `span.editor-save-status.saved[role=status]` внутри чипа, чип виден, пока строка непустая.
- Реестр D-64 расширен под эти правки в той же записи `PORTIA-24-08`.

## Проверка

- `node --experimental-strip-types --test lib/level-editor.test.ts lib/level-hierarchy.test.ts lib/phase20-hints-inventory.test.ts lib/access-foundation.test.ts` и `lib/editor-save-status.test.ts`, `lib/format-launch.test.ts`, `lib/portia-desktop.test.ts` - 0 fail.
- Окно красного (`--test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts`) - 2076 tests, 2073 pass, 0 fail, 3 skipped. Именованный тест «matrix freshness» пропущен: ожидаемый красный до плана 24-11, не засчитан как PASS.
- `node node_modules/typescript/bin/tsc --noEmit` - 0 ошибок. ESLint (прямой бинарь) по тронутым файлам - 0 ошибок, 3 предупреждения `<img>` в строках, которых план не касался.
- Критерии приёмки: `raiseChildren(item.subsections`, `raiseChildren(item.cards`, `min={effectiveLevel(` (2 места), `if (accessFailed || contentIncomplete) return false;`, `levelCopy.editorIncomplete` - найдены.

## Не доказано (BLOCKED)

- Всё проверено исходником и тестами исходников, не браузером: фокус и стрелки группы, 44px плашки, видимая подсказка на телефоне, вид строки `saveNotice` в чипе (у `.editor-save-status` стоит `white-space: nowrap`, перенос длинной строки на 320px не проверен, CSS в этом плане не менялся), поведение `contentIncomplete` в живом окне - BLOCKED до браузерных проверок плана 24-11. Галерей и журнала хэшей нет (решение владельца 2026-11-08).
- Проводка `contentIncomplete` и `saveNotice` из рабочего стола - план 24-10; до него пропсы не передаются, значит в живом приложении защита и строка пока не включены.
- Аутентифицированные роли, Postgres/RLS, физические устройства - BLOCKED до своих фаз.

## Требования

LVL-02 уже отмечен выполненным. LVL-03 и LVL-08 не отмечены, остаются Pending: клиент редактора готов (подъём и защита), сервер (24-06) и очистка (24-05) готовы, но рабочий стол пока не передаёт `contentIncomplete`/`saveNotice` (24-10), а общая проверка и матрица - 24-11. Отмечать их выполненными честно только после этих планов.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Тексты автоподъёма в `levelCopy` расходились с UI-SPEC**
- **Found during:** Task 1
- **Issue:** `raisedSubsections`/`raisedCards` давали «Подразделы подняты до уровня N: k.» / «Карточки подняты до уровня N: k.», а UI-SPEC (Copywriting Contract, S3) и must_haves плана требуют «Уровень подразделов поднят до N: изменено k.» / «Уровень карточек поднят до N: изменено k.». Тесты старые тексты не закрепляли.
- **Fix:** строки в `lib/level-copy.ts` приведены к UI-SPEC; тест проверяет дословный вывод.
- **Files modified:** lib/level-copy.ts, lib/level-editor.test.ts
- **Commit:** 9323a4b

**2. [Rule 3 - Blocking] Охранные тесты закрепляли прежний вид редактора**
- **Found during:** Task 1 и Task 2
- **Issue:** `lib/format-launch.test.ts` (D-64 побайтное сравнение, D-58 набор русских строк) падал на одобренной правке; проверка «без хунка PORTIA-24 файл отличается» вычитала только одну запись и теперь ломала применение следующей; `lib/portia-desktop.test.ts` ждал точную строку `if (accessFailed) return false;`.
- **Fix:** добавлена запись реестра `PORTIA-24-08`; проверка отсутствия хунка вычитает записи с префиксом `PORTIA-24` и отдельно проверяет отсутствие `PORTIA-24-08`; в desktop-тесте регулярное выражение сужено до `if (accessFailed(?: \|\| contentIncomplete)?) return false;` с комментарием, первый операнд по-прежнему `accessFailed`. Других утверждений не ослабляли.
- **Files modified:** lib/format-launch.test.ts, lib/portia-desktop.test.ts
- **Commit:** 9323a4b, 06fa4b2

**3. [Рабочая заметка] Подпись коммитов**
- Коммиты подписаны «Claude Sonnet 5.5» по системному указанию среды (задание называло Opus 5.5; как и в плане 24-07).

### Замечание для плана 24-10

`levelCopy.savedRaised(k)` даёт «Сохранено. Поднято уровней: k.», тогда как UI-SPEC требует для строки после серверного подъёма «Уровни приведены к иерархии: изменено k.». В этом плане строка не используется (редактор получает готовый `saveNotice`), `levelCopy.savedRaised` не менялся; 24-10 должен либо привести его к UI-SPEC, либо передавать нужный текст.

**Порядок TDD:** задачи без `tdd="true"`; тесты исходников написаны вместе с правкой и проходят до коммита. Они проверяют исходник, не поведение в браузере.

## Known Stubs

None.

## Threat Flags

None - новых сетевых точек, путей аутентификации и границ доверия нет. T-24-27 (копия «для зрителя» в редакторе): клиентская линия готова (нет sync, rebase, сохранения), подключается в 24-10, сервер отказывает независимо (24-06). T-24-28 (ребёнок ниже раздела): неактивные плашки и автоподъём в черновике, сервер нормализует при сохранении (24-06).

## Self-Check: PASSED
