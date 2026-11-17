# Phase 17: Pattern Map (декомпозиция стола и редактора)

**Mapped:** 2026-11-01
**Метод:** это pure-move рефакторинг, поэтому "аналог" = уже вынесенный в `lib/` модуль + его `*.test.ts`, плюс сам исходный фрагмент (источник переноса).

## File Classification

| Новый/изменяемый файл | Role | Data Flow | Аналог | Match |
|---|---|---|---|---|
| `components/dossier-editor-parts/*` (FormattedTextarea, FloatingTextFormatPanel, ActiveFormatContext) | component | event-driven (selection/format) | исходник `portia-editor.tsx:103,2320,2443` | move |
| поле картинки (`ImageEditorField`, `mediaUrlFromText`, `ImagePlacement`) | component | request-response через колбэк | `portia-editor.tsx:82,105,3001` | move |
| классификация + мутации (`ClassificationField`, `OrderDragHandle`) | component | CRUD через props | `portia-editor.tsx:227,2296` | move |
| просмотр досье (`VirusRecord`, `DossierSection`, `FormattedText`) | component | read-only render | `portia-desktop.tsx:2101,2237,2297` | move |
| новая логика окон (если выносится: например `lib/window-open.ts`) | utility | transform (pure) | `lib/window-geometry.ts` + `lib/window-geometry.test.ts` | exact |
| тест reopen (STAB-DESK-01) | test | - | `lib/portia-desktop.test.ts` | exact |
| правки существующих source-тестов | test | - | см. ниже | - |

Имена/границы модулей — на усмотрение планировщика (D-07). Каждый increment = отдельный план/коммит; плёнки 17.1 (D-02/D-03) — отдельные планы.

## Pattern Assignments

### Вынос в pure-модуль (окна)
**Аналог:** `lib/window-geometry.ts` (tracked). Чистые функции без React, `export type`, однострочные JSDoc, константа `margin`; импорт в desktop одной строкой:
```ts
import { dragGeometry, fitGeometry, resizeGeometry, type ResizeEdge, type WindowGeometry } from "@/lib/window-geometry";
```
Парный тест `lib/window-geometry.test.ts` (node:test + assert/strict).

### Закрепление `openApp` (`portia-desktop.tsx:960-990`, D-04)
Эталонное поведение для теста: bounce при open/minimized/exiting; `clearTimeout(exitTimers.current[appId])`; functional `setWindows` с
```ts
const appears = !state[appId].open || state[appId].minimized || Boolean(state[appId].exiting);
... openOrigin: appears ? origin : state[appId].openOrigin,
geometry: state[appId].geometry ? fitGeometry(state[appId].geometry, workspaceBounds(), minimumWindowSize(appId)) : createWindowGeometry(appId, openCount),
```
затем `focusApp(appId)` (z только если `windows[appId].z !== topZ.current`), `setStartOpen(false)`, особый случай `broadcasts` (localStorage `broadcastReadStorageKey` в try/catch). Тестовый стиль: `lib/portia-desktop.test.ts` читает исходник через `readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url))` и проверяет регулярками/`closingBrace()`. Если логику выносить в чистую функцию (`appears`, выбор geometry), тестировать её напрямую по образцу `window-geometry.test.ts`. Единственная точка входа для ярлыка/start/taskbar/search — `openApp`; в нарезке её не дублировать.

### Вынос компонентов редактора (D-02/D-03)
Шапка файла-источника (`"use client"`, `@/` алиасы, `import type` для типов контента):
```ts
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { classificationOptions, type RichTextDocument, type RichTextStyle, type Virus } from "@/lib/portia-content";
```
Паттерн server-agnostic props уже есть в `ImageEditorField` (`portia-editor.tsx:3001`): `onUpload?: (file: File) => void` опционален, dropzone рендерится только `{onUpload && <label className="editor-dropzone">...}`, `uploadState` по умолчанию `"idle"`. Копировать этот подход к остальным частям: никакого Supabase/`/api/uploads`/ревизий внутри; основной редактор передаёт колбэки. `ClassificationField` (2296) уже чистый: `options = classificationOptions[classificationKey]`, `onChange(value)`.
`FormattedTextarea` читает `useContext(ActiveFormatContext)` (2330); контекст (строка 103, Provider на 1284/1869) надо выносить вместе с обоими компонентами в один модуль, иначе Provider/Consumer разойдутся. Зависимость `mediaUrlFromText`/`ImagePlacement` вынести вместе с полем картинки. `ConfirmDialog`/`Field`/`EditorGroup` — по необходимости, при переносе сохранять className байт-в-байт (CSS hooks, STAB-DESK-07).
Паттерн динамической загрузки: `PortiaEditor` через `next/dynamic` (`portia-desktop.tsx:20`, `ssr:false`) — не менять.

## Shared Patterns / Риски

### Source-regex тесты ломаются при переносе (главный риск)
Эти тесты читают исходник напрямую; при выносе кода обновить путь/источник в том же increment:
- `lib/portia-desktop.test.ts` (desktop: стр.5; editor: стр.88, 95)
- `lib/accent-theme.test.ts` (desktop стр.10; обход файлов, `portia-editor.tsx` исключение для hex-цветов, стр.183 - новые файлы с hex-цветами попадут под сканер)
- `lib/portia-promotion-editor.test.ts:8`, `lib/portia-promotion-notifications.test.ts:11`, `lib/portia-qualification-ui.test.ts:84`
- также читают исходники: `editor-field-look`, `editor-tabs`, `editor-access`, `layout-hydration`, `security-headers`, `e2e-import-boundary`, `wallpaper-web` (проверить grep перед каждым increment).
Хороший приём: тест читает объединённый текст (старый файл + новый модуль) либо новый путь; не ослаблять регулярки.

### Parity gate после каждого increment
`npm test`, `npm exec tsc -- --noEmit`, `npm run lint`, `npm run build`, затем `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` и `node scripts/phase15-visual-manifest.mjs --verify-promotion` (НЕ `--verify`). E2E/Playwright visual — BLOCKED без data source, не записывать как pass.

### Прочее
- D-08: найденные баги не чинить, записывать в todo.
- Не трогать `portia-wallpaper*.tsx`, owner paths из CLAUDE.md.
- Все аналоги — tracked source (`components/`, `lib/`); mirror-путей нет.

## No Analog Found
| Файл | Причина |
|---|---|
| Тест reopen с React-рендером | в репо нет component-render тестов (только source-regex и pure `lib/*.test.ts`); использовать pure-функцию + regex, либо Playwright (BLOCKED без данных) |

## Metadata
**Scope:** `components/`, `lib/`, `tests/e2e/` (листинг). **Не проверено:** тела `VirusRecord`/`DossierTabs`/`ArchivedVirusEditor`, содержимое `tests/e2e/specs` для reopen.
