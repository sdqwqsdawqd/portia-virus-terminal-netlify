---
phase: PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
reviewed: 2026-11-01T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - components/portia-desktop-documents.tsx
  - components/portia-desktop-dossier.tsx
  - components/portia-desktop-shortcuts.tsx
  - components/portia-desktop-window.tsx
  - components/portia-desktop.tsx
  - components/portia-editor-dossier.tsx
  - components/portia-editor-rich-text.tsx
  - components/portia-editor.tsx
  - lib/accent-theme.test.ts
  - lib/component-source.ts
  - lib/dossier-parts.test.ts
  - lib/editor-items.ts
  - lib/phase17-move-parity.test.ts
  - lib/portia-desktop.test.ts
  - lib/window-open.test.ts
  - lib/window-open.ts
  - scripts/phase17-move-parity.mjs
  - tests/e2e/specs/window-reopen.spec.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Проверены новые и переписанные части: `lib/window-open.ts` и его подключение (`openApp`, `finishExit`), `lib/component-source.ts`, `scripts/phase17-move-parity.mjs`, границы импортов между seam-модулями и новый e2e-спек.

Что подтверждено:
- `openApp` и `finishExit` после рефакторинга поведенчески эквивалентны версии на 55f51d6 (сверено с `git show 55f51d6:components/portia-desktop.tsx`): те же условия появления окна, те же поля, тот же порядок.
- Все seam-модули начинаются с `"use client"`. Циклов импорта нет: `window` <- `shortcuts`, `dossier` <- `documents`, `editor-rich-text` и `editor-dossier` не импортируют друг друга. Редактор остаётся за `next/dynamic`. Серверных утечек (fetch, `/api/`, supabase) в частях 17.1 нет.
- `tsc --noEmit` без ошибок. Юнит-тесты `window-open`, `phase17-move-parity`, `portia-desktop`, `dossier-parts`, `accent-theme`: 81 из 81 проходят (Node 24.21.0, не эталонный 22.13.1).

Главная проблема: новый e2e-спек ни разу не запускался (BLOCKED ENV по 17-05-SUMMARY), и шаг (d), судя по геометрии окон, не пройдёт. Остальное касается слабых мест инструмента проверки переноса (`phase17-move-parity.mjs`), который является единственным доказательством "чистого переноса".

## Critical Issues

### CR-01: шаг (d) e2e-спека кликает по кнопке окна, перекрытого окном «Настройки»

**File:** `tests/e2e/specs/window-reopen.spec.ts:50-52`
**Issue:** К шагу (d) активное окно: «Настройки» (на шаге (c) клик по результату поиска вернул ему фокус). Окно «Глобальный поиск» лежит под ним. Размеры берутся из `createWindowGeometry` (`components/portia-desktop.tsx:70-92`). Для проекта chromium-desktop (viewport 1440x900) поиск занимает x=284, y=83, 760x590. «Настройки» открывались при одном видимом окне, поэтому каскад +28: x=282, y=81, 820x650. Окно «Настройки» полностью накрывает окно поиска, включая заголовок с кнопкой «Закрыть Глобальный поиск». Playwright найдёт кнопку, но actionability-проверка увидит, что клик перехватывает другой элемент. Клик будет повторяться до таймаута, и спек упадёт на шаге (d). Спек не запускался (BLOCKED ENV, `17-05-SUMMARY.md`:90), так что это вывод из расчёта геометрии, а не из прогона. Он же объясняет, почему падение не заметили.
**Fix:** перед закрытием вернуть поиск на передний план, как в шагах (b) и (c):
```ts
// (d) ...
await taskbarSearch.click();          // окно поиска под «Настройками»: сначала вперёд
await expect(search).toHaveClass(/is-active/);
await page.getByRole("button", { name: "Закрыть Глобальный поиск" }).click();
```
Или использовать `desktop.closeApp("Глобальный поиск")` после того же шага. Затем запустить спек на chromium-desktop при первой возможности, как и записано в риске 17-05-SUMMARY.

## Warnings

### WR-01: CLI проверки переноса молча ничего не делает и завершается с кодом 0 при запуске через симлинк или junction

**File:** `scripts/phase17-move-parity.mjs:93-95`
**Issue:** Запуск CLI защищён условием `path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)`. Node по умолчанию резолвит символические ссылки для главного модуля, поэтому `import.meta.url` хранит realpath, а `process.argv[1]` остаётся таким, как набран. `path.resolve` realpath не делает. Если репозиторий открыт через junction/симлинк (на Windows это обычное дело), или различается регистр буквы диска, условие ложно, `runCli` не вызывается, процесс выходит с кодом 0 и без вывода. Для инструмента, чей смысл в том, чтобы ловить расхождения, тихий "успех" без проверки опасен: его можно принять за `pure move`.
**Fix:**
```js
import { readFileSync, realpathSync } from "node:fs";
...
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  runCli(process.argv.slice(2));
}
```

### WR-02: проверка переноса не видит строки, удалённые из целевых файлов, и не проверяет порядок

**File:** `scripts/phase17-move-parity.mjs:47-49`
**Issue:**
1. `arrived` считается как `codeLines(target.after) - codeLines(target.before)`, то есть учитывается только прирост. Если в целевом файле, который уже существовал на `--ref`, одновременно удалили или изменили старый код и добавили перенесённые строки, расхождение остаётся незамеченным (тест "only the growth of a target that already had code counts" закрепляет это как норму). Цели вроде `portia-desktop-dossier.tsx` и `portia-editor-dossier.tsx` растут за несколько планов, значит случай реальный.
2. Сравнение идёт по мультимножеству строк. Перестановка строк, склейка или смена порядка JSX-потомков внутри перенесённого блока, где набор строк тот же, дают "pure move". Самые частые строки (`}`, `);`, `return (`) ничего не фиксируют.
Скрипт назван "line-identical proof", а доказывает только равенство мультимножеств.
**Fix:** добавить проверку потери в целевых файлах: `minus(codeLines(target.before), codeLines(target.after))` должна быть пустой (`problem: removed from target: ...`). Для порядка дополнительно сравнивать блоки целиком, например проверять, что перенесённые строки входят в target подряд, как фрагмент. Если порядок сознательно не проверяется, написать это в шапке скрипта и в `17-PARITY-BASELINE.md`.

### WR-03: `gitShow` скрывает все ошибки git, а разбор `import` может проглотить код

**File:** `scripts/phase17-move-parity.mjs:12-17, 54-64`
**Issue:**
- `gitShow` глушит stderr и любую ошибку превращает в `""`. Опечатка в `--ref`, неверный путь или запуск не из корня репозитория (`git show REF:path` считает путь от корня, а `readFileSync(from)` от cwd) выглядят как "файла не было". Результат может быть пустым `sourceBefore` и сообщение "nothing moved", которое ничего не говорит о причине. Для цели, отсутствующей на `--ref` по опечатке, весь файл считается "новым".
- `codeLines` завершает многострочный import только по подстроке `from "` или окончанию `";`. Импорт в одинарных кавычках (`from '...'`) никогда не закрывается, и весь остальной код файла молча отбрасывается из сравнения (в обеих версиях одинаково, поэтому расхождение не всплывёт).
- Абсолютный Windows-путь (`C:\...`) превращается в `REF:C:/...` и не работает.
**Fix:** различать "путь отсутствует на ref" (`git cat-file -e REF:path`, тогда допустимо `""` только для целей) и прочие ошибки (пробрасывать stderr, завершаться с кодом 2). Для окончания import использовать `/\bfrom\s+["'][^"']+["'];?$|^import\s+["'][^"']+["'];?$/`. Нормализовать пути через `path.relative(repoRoot, path.resolve(file))`.

## Info

### IN-01: `DossierSection` и `MediaBlock` экспортируются без внешних потребителей

**File:** `components/portia-desktop-dossier.tsx:189,198`
**Issue:** До переноса это были приватные функции. Теперь они экспортированы, хотя нигде вне файла не импортируются (`VirusRecord` и `LoadingState` и др. используются из `portia-desktop.tsx` и `documents`). Лишняя публичная поверхность seam-модуля.
**Fix:** убрать `export`, если 17.1 не требует их напрямую. Если требует, пометить это комментарием, как для списка в `dossier-parts.test.ts`.

### IN-02: тест границ импортов проверяет только двойные кавычки и только алиас `@/components/`

**File:** `lib/portia-desktop.test.ts` (тест "component families import only their own seams..."), регулярное выражение `/(from |import\()\s*"@\/components\/([a-z0-9-]+)"/g`
**Issue:** Относительный импорт (`./portia-editor-dossier`), одинарные кавычки или `require` обходят проверку, и статический импорт редактора в desktop-семействе (смысл ограничения: редактор только через `next/dynamic`) можно записать мимо теста.
**Fix:** расширить шаблон: `/(?:from\s*|import\()\s*["'](?:@\/components\/|\.\/)([a-z0-9-]+)["']/g`.

### IN-03: хрупкие source-тесты `window-open.test.ts`

**File:** `lib/window-open.test.ts:99-110, 127, 125`
**Issue:** `bodyAfter` считает фигурные скобки, не учитывая строки, шаблоны и JSX-тексты. Скобка в строковом литерале внутри `openApp` или `finishExit` сдвинет баланс, и тест ошибётся в любую сторону. Жёстко зашитые числа (`7` вызовов `openApp(` в `openSearchResult`, `11` иконок, `5` кнопок) падают при любом добавлении приложения, и это потребует правки без смысла для регрессий.
**Fix:** вынести ожидаемые числа в одну константу рядом с `appMeta` или проверять инвариант ("каждый `case`/ветка вызывает `openApp`") вместо счёта. Для `bodyAfter` игнорировать содержимое строк перед подсчётом скобок.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
