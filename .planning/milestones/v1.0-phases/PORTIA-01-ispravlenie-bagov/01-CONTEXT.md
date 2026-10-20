# Phase 1: Исправление багов - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Устранить пять видимых багов (FIX-01…FIX-05) и закоммитить уже сделанную, но незакоммиченную работу на `design/stage-1-desktop` (зум Ctrl+колесо в «Устав»/«Таблица», `darkreader-lock`, удалённый подзаголовок пустого архива). Новые возможности — в других фазах.

</domain>

<decisions>
## Implementation Decisions

### FIX-01 Ручка перетаскивания
- **D-01:** Убрать слово «ТЯНИТЕ», оставить только значок ≡; ручка стоит в **начале** строки (слева). `aria-label` с названием элемента сохраняется (доступность), видимых подсказок нет.
- Касается всех мест `OrderDragHandle`: вирусы, разделы информации, Корзина, Рекомендации.

### FIX-02 Устав
- **D-02:** Встроенный документ заполняет всё окно при любом масштабе (50–200 %). Полоса «− % + / Открыть отдельно» не должна растягиваться и отъедать место — компактная.

### FIX-03 Шрифт документов
- **D-03:** Georgia заменить **везде** (поля редактора `.formatted-rich-input`, `.scientist-rich-text`, `.archive-document-section p`) на **IBM Plex Serif** (next/font, subsets latin+cyrillic), новая переменная `--serif`.
- Терминальный шрифт интерфейса — отдельное решение фазы 2, не здесь.

### FIX-04 Файл из Корзины
- **D-04:** Пользователь: шапка/заголовок Корзины занимают много места, а нижняя часть окна не отдаётся файлу — по ширине нормально, по высоте файл сжат. Открытый файл должен занимать **всю высоту и ширину окна ниже строки заголовка окна** (скрыть шапку Корзины на время просмотра, убрать ограничение высоты `.trash-layout`). Закрытие (×) возвращает список.

### FIX-05 Профиль Roblox
- **D-05:** Ссылку «Профиль Roblox» под ником убрать. Маленькое фото (`.personnel-portrait`) рядом с полным аватаром становится ссылкой на `https://www.roblox.com/users/{robloxUserId}/profile` (новая вкладка, `rel="noreferrer"`). **Без видимых подсказок** (нет значка, нет title-тултипа); только курсор-рука и лёгкая реакция на наведение. Невидимый `aria-label` для экранных читалок допустим. Если `robloxUserId` нет — фото не кликабельно.

### Claude's Discretion
- Точная реакция на наведение у фото (подсветка рамки акцентом и т.п.).
- Как именно чинить обрезку Устава (высота iframe / контейнера), лишь бы D-02 выполнялся.
- Вид кнопки закрытия файла в Корзине.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Проект
- `.planning/PROJECT.md` — ограничения (русский, телефоны, выкладка только локально)
- `.planning/REQUIREMENTS.md` — FIX-01…FIX-05
- `.planning/codebase/CONCERNS.md` — подтверждённые места багов
- `PRODUCT.md`, `.impeccable/surfaces/components-portia-desktop-tsx.md` — договор направления «Электрофорез»

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OrderDragHandle` — `components/portia-editor.tsx:115`; CSS `.order-drag-handle` — `app/portia.css:406-408` (колонка 34px).
- `EmbeddedDocument` (зум, iframe `${100/zoom}%` + scale) — `components/portia-desktop.tsx`; стили `.document-app*` в `app/portia.css`.
- Корзина: разметка `components/portia-desktop.tsx:921-940`; `.trash-layout` `app/portia.css:585`, `.trash-viewer` `:597` (absolute inset 0 внутри layout), мобильный `min-height: 390px` `:963`.
- Сотрудники: `.personnel-avatar-stage` / `.personnel-portrait` / ссылка — `components/portia-desktop.tsx:870-874`.
- Georgia — `app/portia.css:465, 468, 519, 772`.
- Шрифты подключаются в `app/layout.tsx` через `next/font/google` с переменными на `<html>`.

### Established Patterns
- Цвета через токены и `currentColor`, акценты `data-accent`.
- Тесты: `node --test lib/*.test.ts`; компоненты тестами не покрыты — проверка в браузере на localhost:3123 (ПК + 375px).

### Integration Points
- `app/layout.tsx` (новый шрифт), `app/portia.css`, `components/portia-desktop.tsx`, `components/portia-editor.tsx`.

</code_context>

<specifics>
## Specific Ideas

- Пользователь против лишних подсказок на интерфейсе (ранее просил убрать подсказки).
- «РЕВИЗИЯ N» не трогать.

</specifics>

<deferred>
## Deferred Ideas

- Терминальный шрифт интерфейса — фаза 2 (LOOK-02).
- Перекраска панелей/помощника/паука — фаза 2 (LOOK-01).

</deferred>

---

*Phase: 01-ispravlenie-bagov*
*Context gathered: 2026-10-12*
