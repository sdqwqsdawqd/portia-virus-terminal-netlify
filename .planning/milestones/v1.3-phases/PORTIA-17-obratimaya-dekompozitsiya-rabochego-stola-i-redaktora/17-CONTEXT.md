# Phase 17: Обратимая декомпозиция рабочего стола и редактора - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning

<domain>
## Phase Boundary

`components/portia-desktop.tsx` (≈2317 строк) и `components/portia-editor.tsx` (≈3033 строки) нарезаются на проверяемые, по отдельности откатываемые части (seams). Для пользователя всё остаётся тем же PORTIA OS: app ids, DOM-семантика, CSS hooks, storage keys, формы API, порядок, данные и утверждённые снимки Phase 15 не меняются (STAB-DESK-07). Одно приложение — одно окно из любого входа (ярлык, start panel, taskbar, search), повторное открытие восстанавливает и фокусирует окно без дубликата и потери состояния (STAB-DESK-01).

Намеренные UX-изменения в фазу НЕ входят. Новое приложение «Создание шаблона» строится в отдельной вставленной фазе **17.1**; Phase 17 лишь готовит для него переиспользуемые части редактора.

</domain>

<decisions>
## Implementation Decisions

### Части редактора для Phase 17.1 (конструктор шаблона)
- **D-01:** «Шаблон из Датабазы вирусов» = **карточка досье вируса** в том же виде, что запись в приложении «Вирусы» (сейчас просмотр — `VirusRecord`/`DossierSection` в `portia-desktop.tsx`, редактирование — `ArchivedVirusEditor`/`DossierTabs` в `portia-editor.tsx`).
- **D-02:** Phase 17 выносит в отдельные модули то, что понадобится конструктору: **форматирование текста** (`FormattedTextarea`, `FloatingTextFormatPanel`, `ActiveFormatContext`), **поле картинки** (`ImageEditorField`), **классификацию и мутации** (`ClassificationField`, список мутаций с перетаскиванием `OrderDragHandle`), а также просмотр досье. Таблицы-блоки и YouTube конструктору не нужны — их выносить ради 17.1 не требуется.
- **D-03:** Вынесенные части **не зависят от сервера**: не знают про Supabase, сохранение, ревизии и `/api/uploads`. Сохранение и загрузку передаёт им основной редактор через props/колбэки; поле картинки должно уметь работать и без `onUpload` (только ссылка), чтобы 17.1 подключил его с экспортом вместо сохранения. Для пользователя основного редактора ничего не меняется. — **Reversibility:** costly — разделение интерфейсов затрагивает все места вызова в редакторе.

### Повторное открытие окна (STAB-DESK-01)
- **D-04:** Текущее поведение `openApp` (`portia-desktop.tsx:960`) — эталон и закрепляется тестом: одно окно на app id; свёрнутое/закрывающееся окно разворачивается и отменяет выход; геометрия запоминается и подгоняется под экран; окно получает фокус; анимация появления только когда окно действительно появляется.
- **D-05:** Если окно уже открыто, но за другими: сейчас — просто выход вперёд с фокусом. Владелец хочет **короткий «кивок»** (встряхнуть/подсветить окно). Это новая анимация → **Phase 18**, в 17 поведение не меняется.
- **D-06:** Закрытое (не свёрнутое) и снова открытое окно ведёт себя **как сейчас**: исследователь фиксирует текущее поведение каждого приложения (что сохраняется, что сбрасывается) и закрепляет его тестом.

### Порядок нарезки
- **D-07:** Порядок increments выбирают исследователь и планировщик по риску (Claude's discretion), с одним условием: increments, выносящие части редактора досье (D-02/D-03), должны быть отдельными планами, чтобы **Phase 17.1 могла стартовать параллельно**, как только они готовы, не дожидаясь конца всей Phase 17.

### Баги, найденные по ходу
- **D-08:** Нарезка **сохраняет найденный пользовательский баг как есть**. Баг записывается (todo/список в фазе) и чинится позже отдельным шагом в Phase 18 или 20. Это держит parity-gate чистым: любое отличие от эталона — регрессия нарезки.

### Паук и фон
- **D-09:** В Phase 17 фон и паук **только не ломаются** (они уже в `portia-wallpaper.tsx` / `portia-wallpaper-spider.tsx`). Все исправления — в **Phase 18** (см. Deferred).

### Claude's Discretion
- Порядок increments (D-07), границы модулей и имена файлов, способ parity-проверки после каждого increment — при условии соблюдения STAB-DESK-07 и отдельного отката каждого increment.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Объём и требования
- `.planning/ROADMAP.md` § Phase 17 — цель, success criteria, acceptance gate (parity-gate после каждого increment, без UX-изменений, без нового generic app shell).
- `.planning/REQUIREMENTS.md` — STAB-DESK-01, STAB-DESK-07; STAB-BASE-01 (художественный язык не меняется без утверждения владельца).
- `CLAUDE.md` — жёсткие правила проекта (стейджинг по путям, owner paths, никакого production).

### Эталон Phase 15 (parity)
- `.planning/phases/PORTIA-15-baseline/15-VERIFICATION.md` — что доказано и что BLOCKED.
- `.planning/phases/PORTIA-15-baseline/evidence/15-LOCAL-UI-CONTRACT.md` — утверждённый/отклонённый UI-контракт.
- `.planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-APPROVAL.md` — 33 APPROVED / 18 REJECTED.
- `tests/e2e/visual/` и `tests/e2e/visual/__screenshots__/` — утверждённые снимки; `node scripts/phase15-visual-manifest.mjs --verify-promotion` (НЕ `--verify`).
- `.planning/phases/PORTIA-15-baseline/15-REVIEW.md` — открытые WR-01..WR-06 (учесть, не чинить здесь).

### Следующая фаза
- `.planning/notes/template-builder-app.md` — описание приложения «Создание шаблона» (Phase 17.1): только экспорт, ничего на сервере, без кнопки переноса в реальную Датабазу вирусов.

### Карта кода
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/portia-editor.tsx`: `FormattedTextarea` (2320), `FloatingTextFormatPanel` (2443), `ImageEditorField` (3001), `ClassificationField` (2296), `ArchivedVirusEditor` (2228), `DossierTabs` (2285), `OrderDragHandle` (227), `ConfirmDialog` (2910), `Field`/`EditorGroup` — кандидаты на вынос для 17.1.
- `components/portia-desktop.tsx`: `VirusRecord` (2101), `DossierSection` (2297), `FormattedText` (2237), `AppWindow` (1960), `DesktopIcon`/`DraggableDesktopIcon`, `GuideApp`, `ScientistDocument`.
- `lib/window-geometry.ts` — `fitGeometry`, `createWindowGeometry`, `workspaceBounds` уже вынесены.

### Established Patterns
- Состояние окон — один объект `windows[appId]` с `open/minimized/exiting/geometry/openOrigin`; `openApp` + `focusApp` + `exitTimers`.
- `PortiaEditor` грузится через `next/dynamic` из рабочего стола.
- Юнит-тесты — `node --experimental-strip-types --test lib/*.test.ts`; часть тестов проверяет исходник регулярками (например `lib/security-headers.test.ts`) — нарезка может их сломать, их надо переносить вместе с кодом.

### Integration Points
- Вынесенные части редактора подключаются обратно в `PortiaEditor` (сохранение/загрузка через колбэки) и позже в конструктор 17.1 (экспорт).
- Ярлыки, start panel, taskbar и search сходятся в `openApp`.

</code_context>

<specifics>
## Specific Ideas

- Конструктор 17.1 использует ту же карточку досье, что «Вирусы»: участник редактирует её и экспортирует физическую копию (HTML/изображение) для проверяющего; у Повышения есть задание «создать шаблон» (например, академик → стажёр).
- «Кивок» окна при повторном открытии — желание владельца для Phase 18.

</specifics>

<deferred>
## Deferred Ideas

### Phase 17.1 — приложение «Создание шаблона» (новая вставленная фаза)
- Полное описание: `.planning/notes/template-builder-app.md`. Нужно вставить фазу в ROADMAP (`/gsd-phase` insert) и обсудить (`/gsd-discuss-phase 17.1`): размещение (ярлык / в Повышении / кнопка), форматы экспорта, внешние ссылки на изображения, новые и изменённые SVG, новый requirement ID.

### Phase 18 — паук, фон, окна (со слов владельца, 2026-11-01)
- Паук дёрганый и резкий; движется слишком быстро и слишком выделяется — отвлекает; поворот резкий.
- След на паутине не синхронизирован с ходьбой паука и действует только с одной стороны паука.
- При выключении паука фон смещается и меняет положение (паутина должна оставаться на месте).
- Фон ломается при окнах и на телефоне.
- Ранее записано: тело паука выглядит прозрачным; нужна настройка «выключить паука, паутина остаётся» (`.planning/todos/pending/spider-body-visible-and-toggle.md`).
- «Кивок» окна, когда уже открытое окно выводится вперёд повторным открытием (D-05).

### Reviewed Todos (not folded)
- «Стабилизировать Повышение и интерфейс рабочего стола» (`2026-10-28-...md`) — исторически Phase 14, UX-фиксы → Phase 19/20, не нарезка.
- «Справочник» (`app-spravochnik.md`) — новое приложение, отдельная фаза.
- «Паук: видимое тело и выключение» (`spider-body-visible-and-toggle.md`) — Phase 18.
- «Повышение как приложение» (`app-povyshenie.md`) — не нарезка.
- «Единая система приложений» (`unified-apps-system-discuss.md`) — владелец хочет обсудить отдельно; Phase 17 прямо запрещает новый generic app shell, поэтому не здесь.

</deferred>

---

*Phase: 17-Обратимая декомпозиция рабочего стола и редактора*
*Context gathered: 2026-11-01*
