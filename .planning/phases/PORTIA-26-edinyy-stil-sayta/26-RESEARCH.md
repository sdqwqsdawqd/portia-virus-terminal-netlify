# Phase PORTIA-26: Единый стиль сайта - Research

**Researched:** 2026-11-16
**Domain:** единый визуальный язык (radius-токены, кнопки/плашки/поля/вкладки), раскладка вкладок редактора, окна и развёрнутое окно, телефонная «Информация», ярлыки 521–900px, axe/контраст, регрессии рабочего стола. Plain CSS + React 19 + source-тесты на `node:test`.
**Confidence:** HIGH по тому, что лежит в коде и тестах (всё прочитано в этой сессии); MEDIUM по контрасту (посчитано скриптом по приближённым поверхностям, авторитет — будущий тест); LOW только там, где помечено `[ASSUMED]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward (locked earlier, not re-asked)
- Style direction **C** (owner, 2026-11-12, `22-STYLE-DIRECTION.md`): windows and dialogs soft 10px; editor tabs, buttons and fields sharp 0; plaques/status badges pill 999px (dots stay 50%); cards/list rows 7px. Values come from the table in `22-STYLE-DIRECTION.md`; tokens `--radius-*` already exist in `app/portia.css:80-85` at today's values.
- Only radii and the look of buttons/plaques/tabs/windows change; colours, fonts, spacing and animations stay.
- At most one redo per screen (D-71 8а).
- Visual changes are reported to the owner as text (no `review.html` galleries, no per-hash ledger, no Figma).
- Promotion template export classes `level-1..3` must not break; access levels use separate `access-level-*` classes.
- Never run `scripts/phase15-visual-manifest.mjs --verify` (default mode).
- If the phase adds SQL — `supabase-rls-reviewer`.

#### Развёрнутое окно (UI-06)
- **D-01:** In a maximized window, lists (e.g. «Доступные записи» in global search, record lists) become an auto-fill grid of cards: as many columns as fit (2–4 on wide screens), one column in a normal-size window.
- **D-02:** Buttons keep their content width and never stretch. Text inputs are capped at a comfortable width (~640px). Editor forms switch to two columns where the window is wide enough.
- **D-03:** A maximized window differs from a normal one only in layout: the 8px inset from screen edges and the 10px window radius (direction C) stay as today (`.app-window.is-maximized`, `app/portia.css:260`).
- **D-04:** Audit scope = all windows and apps: every one is checked maximized on a wide screen and fixed under D-01/D-02.

#### Иконки классификации (UI-07)
- **D-05:** 15 icons to redraw: groups danger, spread, escapeRisk, mind, appearance × 3 levels (`classificationIcon` in `components/portia-icons.tsx:131`); `route-*` («Способ распространения») untouched. Current icons are 24×24 line SVG.
- **D-06:** Variants are shown to the owner on ONE private claude.ai artifact page (not a repo gallery, not a hash ledger): all 15 icons per style on the site's dark background, link given in chat.
- **D-07:** Three styles are shown: **А** thin line like today but with a solid recognizable silhouette; **Б** filled with cut-outs (reads as a sign); **В** sign inside an emblem frame (rhombus or circle), like a department patch.
- **D-08:** Inside a group the three icons share one base shape; the level (1/2/3) is shown by a common mark — number of notches/dots.
- **D-09:** One round: the owner picks a style (А/Б/В); all 15 are drawn in it and the result is shown as text plus the same artifact page. A second showing only if something is clearly wrong (fits 8а). No drawing before the owner's pick — blocking owner checkpoint in the plan.

#### Порядок экранов и правило «одна переделка»
- **D-10:** A «screen» for the one-redo rule = each window/app and each editor tab separately («Справочник», «Повышение», «Пользователи» are three screens). A complaint redoes only that screen.
- **D-11:** Order: (1) tokens and shared elements — corners, buttons, plaques, fields, tabs, close cross in the corner (UI-02, UI-03, UI-05); (2) window frame and maximized layout (UI-06); (3) editor tabs to one layout (UI-04); (4) access/request screen and «Пользователи»; (5) phone — «Информация» and labels 521–900px (UI-08, UI-09); (6) icons after the owner's pick (UI-07), axe and regressions (UI-10, UI-11).
- **D-12:** Editor tabs get a NEW shared layout: record list on the left, form on the right, one action bar on top («Сохранить», «Отменить», status). All tabs including «Справочник», «Повышение», «Пользователи» use it. Owner emphasis: convenient buttons and design, better navigation between sections, the «Повышение» tab explicitly included.
- **D-13:** Both navigation problems are fixed: (a) section navigation inside a tab (e.g. Promotion branches/ranks/tasks, Справочник sections) with a clearly visible current section; (b) long forms and lists — the action bar with «Сохранить» stays visible while scrolling (sticky).

#### «Информация» на телефоне (UI-08, phone only `max-width: 900px`)
- **D-14:** A thin bar above the article: «Разделы ▾» button on the left, current section name on the right. The bar scrolls away with the text (not fixed) and covers nothing. Desktop `.info-index` is unchanged.
- **D-15:** The list opens inline under the bar and pushes the article down (no overlay). After picking a section the list closes and focus returns to the button. Keyboard access, `aria-expanded`, current section and the subsections marker (`info-sub-marker`) stay available.
- **D-16:** Search hits while the list is closed: the button shows a count («Разделы ▾ · 3»); in the opened list sections with hits are highlighted as today (`data-search-hit`, 19-11).

#### Снимки v1.3
- **D-17:** The approved v1.3 snapshots are frozen as history: snapshots and signatures stay in the archive but are no longer the reference for the current look. Phase 26 does not capture a new signed reference; changes are described as text and device acceptance is the owner's in Phase 27. — **Reversibility:** costly — tests and scripts that treat v1.3 snapshots as the current reference must be re-scoped to "historical", and re-establishing a signed reference later needs a new capture.

### Claude's Discretion
- Shortcut label placement at 521–900px (UI-09): one JS rule, no immovable absolute labels, no scroll lock — mechanism is the planner's choice.
- Exact card size/gap for D-01 grid, the two-column breakpoint for D-02, the sticky action bar details for D-13 — decided in UI-SPEC and described to the owner as text.
- axe fixes (UI-10): contrast of `.eyebrow`, field hints, `small[title]`, accessible name of `.nested-editor-toggle`; contrast checked on all accents.
- Regressions (UI-11): verify on current code first; fix only live ones (symmetric window clamp left/right in `lib/window-geometry.ts`, shortcut label last-frame == static frame: sharpness, scale, position).
- How the radius guard test evolves from today's pinned count (`lib/style-tokens.test.ts`; `grep -c border-radius app/portia.css` = 131 now) to "no arbitrary radius outside tokens".

### Deferred Ideas (OUT OF SCOPE)
- Reviewed Todos (not folded): `2026-11-07-nick-access-request.md`, `2026-11-08-access-levels.md` — access features, delivered by Phases 23–25; only their screens' look is in scope here.
- `2026-10-28-stabilize-promotion-and-desktop-ui.md` items 1–6 (Promotion dates, requests, device binding, editor saving) and 8 (spider lifecycle) — behaviour, not style; out of this phase unless still live and purely visual.
- None else — discussion stayed within phase scope.

(Folded todos: `2026-11-07-desktop-visual-overhaul.md` → D-01..D-12; `2026-11-03-info-phone-sections-toggle.md` → D-14..D-16; `2026-10-28-stabilize-promotion-and-desktop-ui.md` items 7, 9, 10 → D-12/D-13 and UI-11.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-02 | Одно правило углов, общие токены, тест не даёт добавить произвольный радиус | Радиус-перепись и маппинг ролей (ниже), грамматика guard-теста, перестройка `lib/style-tokens.test.ts`, цена хеш-охраны |
| UI-03 | Кнопки/плашки/поля/вкладки одинаковы везде | Список расходящихся семейств (`.primary-control`, `.app-state-action`, `.promotion-*`, `.editor-section-tabs`), список растягиваемых кнопок, правила `ui-unify` блока |
| UI-04 | Все вкладки редактора — одна раскладка | Структура `portia-editor.tsx` (одна общая `draft` и один Save), шов `portia-editor-*.tsx`, цена охраны `format-launch.test.ts`, реальное строение вкладок «Информация/Справочник/Сводка» (аккордеон-карточки, не список+форма) |
| UI-05 | Крестик в самом углу | Разбор `.window-titlebar`/`.window-controls`/`.window-edge-ne`, телефонный блок 2485–2498 с `::before`, список остальных крестов |
| UI-06 | Развёрнутое окно без растянутых кнопок и пустых полос | Единственный хук `.app-window.is-maximized`, списки грид-селекторов, конфликт с закреплёнными тестами фиксированных ширин (D-43, D-15), запрет `container-type` |
| UI-07 | Новые иконки классов после выбора владельца | Карта `classificationIcon` (15 ключей), блокирующий чекпоинт, ограничения `virus-classes.test.ts` |
| UI-08 | Телефонная «Информация»: кнопка разделов | Текущая реализация — список/статья как два экрана (D-28/D-30 из Phase 20), не лента карточек; точки правки в `portia-desktop.tsx`, затронутые e2e-спеки |
| UI-09 | Ярлыки 521–900px одним правилом с JS | Найден конкретный механизм: абсолютные `--shortcut-*` + `.workspace { overflow: hidden }` + запрет drag ≤900; чистая функция в `lib/shortcut-layout.ts` |
| UI-10 | Находки axe и контраст на всех акцентах | Точные места: `.eyebrow` (1122), `.formatted-text-field-hint` (807), `.editor-record-list small` (654), `CollapsibleCard` (portia-editor.tsx 236–256), допуски в `editor-ui-contract.spec.ts`; расчёт контраста по пресетам |
| UI-11 | Регрессии 2026-10-28 | Клэмп окон уже симметричен и покрыт тестами; конец анимации ярлыка покрыт D-17 тестами; предлагаемый исход `NOT REPRODUCED` на уровне исходников, устройство — BLOCKED |
</phase_requirements>

## Summary

Фаза — это не «добавить библиотеку», а аккуратная переработка трёх связанных систем в одном проекте без новых зависимостей: CSS (`app/portia.css`, 2607 строк почти без переносов, плюс `app/portia-promotion-editor.css`), монолитный редактор (`components/portia-editor.tsx`, 2465 строк, защищённый побайтной охраной от git-образца) и source-тесты, которые закрепили текущую разметку и классы. Токены `--radius-*` объявлены, но **никто их не читает** (проверено: тест «radius and tap tokens remain declarations only»), поэтому «единое правило углов» = пройти по 137 объявлениям `border-radius` (131 + 6) и заменить значение на роль, а затем заменить закрепление счётчика тестом грамматики. Это самая механическая и самая рискованная для регрессий часть: ~25 селекторов требуют суждения по роли (список ниже), и три места требуют подтверждения владельца (круглые «выбор паутины и обоев», такбар, пилюля «ОФОРМЛЕНИЕ»).

Основные ловушки, которых нет в UI-SPEC: (1) `format-launch.test.ts` сравнивает `components/portia-editor.tsx` с git-образцом `449c756` и набором «одобренных правок» — любая правка редактора роняет тест, пока реестр не расширен (или охрана не перебазирована); (2) `lib/phase20-hints-inventory.test.ts` падает на любом **новом русском тексте из 7 и более слов** в `components/*.tsx` (копия «Она откроется справа. Выберите строку в списке слева.» — 8 слов); (3) вкладки «Информация», «Справочник», «Сводка» — аккордеоны из `CollapsibleCard` с `SectionTabs` и оглавлением, а не «список слева — форма справа», поэтому D-12 для них — реальная перестройка JSX, а не новая обёртка; (4) UI-SPEC требует «текст любого токена ≥4.5:1 на `--panel-2`», но у пресета red `--teal` на `--panel-2` ≈ 4.30:1 — контракт невыполним без правки палитры; (5) `.eyebrow` в текущем коде нигде не стоит на бумажной поверхности (ветка `--ink-soft` из UI-SPEC не нужна); (6) телефонная «Информация» сегодня — два экрана «список/статья» с кнопкой `←`, а не лента карточек (todo 2026-11-03 в этой части устарел).

**Primary recommendation:** Идти строго по D-11, но каждый шаг начинать с «перебазирования охраны» (tests first): сначала переписать `lib/style-tokens.test.ts` на грамматику и вынести новые компоненты редактора в шов `components/portia-editor-*.tsx` (читаются `componentFamily`, не требуют правки списка разрешённых импортов), чтобы хункам в защищённом `portia-editor.tsx` оставалось минимум. Все CSS-правки делать в одном плане на волну (файл общий), без параллельных планов на `portia.css`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Правило углов, токены, кнопки/плашки/поля/вкладки | Browser / Client (CSS в `app/*.css`) | — | Чистый стиль; нет серверной части, нет SQL |
| Guard «нет произвольного радиуса» | Build/test (node:test над исходниками) | — | Единственный стабильный артефакт этого milestone (скриншоты — история) |
| Окно: крестик в углу, развёрнутый режим | Browser / Client (`AppWindow` + CSS) | — | Хук `.app-window.is-maximized`, геометрия в `lib/window-geometry.ts` |
| Единая раскладка вкладки + sticky action bar | Browser / Client (React-компонент шва + CSS) | — | Состояние `draft`/`save` уже в `PortiaEditor`; бар только отображает |
| «Пользователи» detail pane | Browser / Client | API / Backend (существующие `/api/users*`, без изменений) | Права/решения серверные (Phase 22), UI только перекладывает разметку |
| Телефонная «Информация» | Browser / Client (`portia-desktop.tsx` + `lib/info-phone-nav.ts`) | — | Состояние раскрытия и текущий раздел уже в клиенте |
| Расстановка ярлыков 521–900px | Browser / Client (чистая функция в `lib/` + эффект измерения) | — | Нужны размеры рабочей области; localStorage ключ позиций не меняется |
| Иконки классов | Browser / Client (инлайн SVG) | — | Блокирующий внерепозиторный чекпоинт владельца до любой правки |
| Контраст / axe | Build/test + CSS | — | Расчёт по токенам, не по скриншотам |

## Standard Stack

Новых пакетов нет. Фаза использует то, что уже стоит. [VERIFIED: package.json]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.5 | App Router, сборка | Уже стек проекта (`package.json` `"next": "16.4.5"`) |
| react / react-dom | 19.2.6 | UI | `"react": "19.2.6"` |
| tailwindcss + @tailwindcss/postcss | 4.2.1 | импортируется в `globals.css`, утилиты не используются | Не трогаем |
| node:test (встроенный) | Node 22.13.1 | source-тесты | `"test": "node --experimental-strip-types --test lib/*.test.ts"` |
| typescript | см. lockfile | `tsc --noEmit` | Чисто в базовой линии |
| eslint | см. lockfile | `npm run lint` | 0 errors / 17 warnings в базовой линии |
| @playwright/test + @axe-core/playwright | 1.64.1 / 4.14.0 | e2e и axe | Линии BLOCKED (ENV/DATA) без преднастроенного окружения |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lib/component-source.ts` (`componentFamily`, `lf`) | — | читает `portia-desktop.tsx`/`portia-editor.tsx` вместе с их `-*.tsx` сиблингами | Любой source-тест на редактор/рабочий стол |
| Хелперы контраста в `lib/accent-theme.test.ts` (`oklchToRgb`, `contrast`, `deriveAccentTokens`, `themes`) | — | уже считают контраст по пресетам и «Своим» | База для `lib/ui-contrast.test.ts` (скопировать, не экспортировать из теста) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Простой CSS с `var(--radius-*)` | CSS Modules / Tailwind utilities | Нарушает «palette, fonts, spacing stay» и каскад из трёх импортов, закреплённый тестом |
| Контейнерные запросы в развёрнутом окне | `.app-window.is-maximized` + media | Контейнер на `.app-window` перепривязывает `position: fixed`/sticky потомков (UI-SPEC) — не использовать |

**Installation:** не требуется.

**Version verification:** версии прочитаны из `package.json` в этой сессии; `npm view` не нужен — нового пакета нет.

## Package Legitimacy Audit

Фаза не устанавливает внешних пакетов. Аудит не применим: **Packages removed (SLOP): none. Packages flagged (SUS): none.** Если планировщик решит добавить зависимость (не рекомендуется), он обязан прогнать `gsd_run query package-legitimacy check`.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │  app/layout.tsx: globals.css → portia.css →  │
                    │  portia-promotion-editor.css (порядок закреплён тестом) │
                    └───────────────┬──────────────────────────────┘
                                    │  :root токены (первый блок, маркеры style-tokens:start/end)
                                    ▼
   --radius-window/dialog/card/control/field/tab/plaque/round, --control-height, --field-max, --card-min, --tap-target
                                    │ читаются
        ┌───────────────┬───────────┴────────────┬──────────────────────┐
        ▼               ▼                        ▼                      ▼
  Окно/титул       Семейства элементов      Раскладка вкладки       Телефон ≤900px
  AppWindow        (кнопка/плашка/поле/     .etab (bar+list+detail)  «Информация»: bar
  .window-controls  вкладка/строка списка)   PortiaEditor ──► шов     .info-sections-bar
  .app-window.      ui-unify блок в конце    portia-editor-*.tsx      lib/info-phone-nav.ts
  is-maximized      portia.css                │ единый draft/save      ярлыки 521–900:
        │                                     ▼                        lib/shortcut-layout.ts
        │                               saveStatusText()                + эффект измерения
        ▼                               (lib/editor-save-status.ts)
  lib/window-geometry.ts (clamp, margin = 8)

  Охрана:  lib/style-tokens.test.ts (грамматика)  ·  lib/format-launch.test.ts (git-образец редактора)
           lib/phase20-hints-inventory.test.ts (тексты ≥7 слов)  ·  portia-desktop.test.ts (закреплённые правила CSS)
           lib/accent-theme.test.ts (литералы, --accent-chroma)  ·  новые: ui-unify / ui-contrast / editor-tab-layout
```

### Recommended Project Structure
```
app/
├── portia.css                    # радиусы правятся на месте; один новый блок ui-unify:start/end в конце
├── portia-promotion-editor.css   # 6 радиусов, есть --muted (не определён) и flex:1 у кнопок
components/
├── portia-editor.tsx             # ЗАЩИЩЁН охраной: только вызовы <EditorActionBar/>, <EditorTabLayout/>
├── portia-editor-tab-shell.tsx   # НОВЫЙ шов (имя portia-editor-*): .etab, .etab-bar, nav, статус, действия
├── portia-desktop.tsx            # info-bar, ярлыки: добавить состояние sectionsOpen
├── portia-desktop-shortcuts.tsx  # применяет расстановку ≥521px
lib/
├── shortcut-layout.ts            # + чистая функция авторасстановки (UI-09)
├── info-phone-nav.ts             # + чистые хелперы бара (число совпадений, имя кнопки)
├── card-toggle-name.ts           # (опц.) чистая функция имени .nested-editor-toggle
├── style-tokens.test.ts          # переписан на грамматику
├── ui-unify.test.ts / ui-contrast.test.ts / editor-tab-layout.test.ts   # новые
```

### Pattern 1: Радиус только через роль (грамматика)
**What:** каждое `border-radius` в трёх CSS равно `var(--radius-<роль>)`, `0` или пробельной композиции из них. Роль выбирается по назначению элемента, не по старому значению (UI-SPEC).
**When to use:** любая правка CSS в этой фазе.
**Example:**
```ts
// Source: идея из UI-SPEC «Guard test» + текущие хелперы lib/style-tokens.test.ts (withoutComments/ruleRadius)
const ROLE = "var\\(--radius-(?:window|dialog|card|control|field|tab|plaque|round)\\)|0";
const GRAMMAR = new RegExp(`^(?:${ROLE})(?:\\s+(?:${ROLE})){0,3}$`);
// заменить комментарий его же переводами строк, чтобы номера строк в сообщении были верны
const strip = (css: string) => css.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ""));
for (const [name, css] of files) {
  const text = strip(css);
  for (const m of text.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
    const value = m[1].replace(/\s*!important\s*$/, "").trim();
    const line = text.slice(0, m.index).split("\n").length;
    assert.match(value, GRAMMAR, `${name}:${line} border-radius: ${value}`);
  }
}
```

### Pattern 2: Один sticky-механизм, существующий
**What:** на телефоне `.app-window` — это `overflow: hidden`, т.е. scroll-контейнер, и sticky внутри него не держится; проект уже решает это через `overflow: clip` на `.app-window:has(.editor-section-addbar), .content-editor:has(.editor-section-addbar)` (portia.css ~927–930). Новый бар обязан использовать **тот же** приём с новым селектором `:has(.etab-bar)`, а не изобретать другой. [VERIFIED: app/portia.css:927-930]
**Example:**
```css
/* ui-unify (pattern) — позиции top считать от существующих значений: .editor-section-addbar top: 48px (phone), -28px (PC) */
.etab-bar { position: sticky; top: 0; z-index: 3; background: var(--panel); border-bottom: 1px solid var(--line); min-height: 48px; }
@media (max-width: 900px) {
  .app-window:has(.etab-bar), .content-editor:has(.etab-bar) { overflow: clip; }
  .etab-bar { top: 48px; }   /* под системной панелью, как .editor-section-addbar */
}
```
Старые правила `.editor-section-addbar` и `.editor-section-tabs` сегодня закреплены в `lib/portia-desktop.test.ts:1013-1030` (список sticky-слоёв `[".editor-save-chip", ".editor-section-tabs", ".editor-section-addbar"]`) — тест надо обновить вместе с заменой.

### Pattern 3: Вынос нового в шов, чтобы охранный diff был малым
**What:** `componentFamily("portia-editor")` автоматически включает `components/portia-editor-*.tsx`; `lib/portia-desktop.test.ts` (тест «component families import only their own seams…») разрешает импорт только из членов семейства и из закреплённого списка. Новый компонент с именем `portia-editor-tab-shell.tsx` проходит оба теста без правки списка. Побайтная охрана `format-launch.test.ts` читает только `portia-editor.tsx`, поэтому весь код бара/раскладки уносится в шов. [VERIFIED: lib/component-source.ts; lib/portia-desktop.test.ts:107-139]

### Anti-Patterns to Avoid
- **`width: 100%` / `flex: 1` на кнопках** в любом состоянии окна (D-02). Найденные кандидаты ниже.
- **`container-type` на `.app-window` или предке `position: fixed`/sticky** — перепривязывает фиксированные элементы (UI-SPEC).
- **Определять `--muted`** (не определён, ~42 использования) — изменило бы цвет существующих экранов; цвета вне границы фазы.
- **Редактировать `portia-editor.tsx` без правки реестра/образца охраны** — тест упадёт.
- **Длинный русский текст в `components/*.tsx` (≥7 слов)** без записи в реестр подсказок.
- **Запускать `phase15-visual-manifest.mjs --verify`** (перезаписывает подписанные доказательства).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Пересчёт контраста по акцентам | новый colour-math | скопировать `oklchToRgb`/`contrast`/`deriveAccentTokens` из `lib/accent-theme.test.ts` (включая режим `PORTIA_CONTRAST_REPORT=1`) | уже проверен на 432 «Своих» и пресетах |
| Статус сохранения | новый словарь | `saveStatusText(status, counts)` из `lib/editor-save-status.ts` | один словарь на редактор и сотрудников |
| Диалог «Отменить правки» | новый confirm | существующий `ConfirmDialog` («Отменить несохранённые правки?» / «ВЕРНУТЬ СОХРАНЁННОЕ» / «НЕ ОТМЕНЯТЬ») | поведение и фокус уже протестированы |
| Sticky на телефоне | свой JS-«прилипатель» | `overflow: clip` на `.app-window`/`.content-editor` (Pattern 2) | единственный рабочий способ в этом окне |
| Геометрия окон | свой clamp | `lib/window-geometry.ts` (`fitGeometry`, `dragGeometry`, `resizeGeometry`, `margin = 8`) | симметрично, 80 тестов вместе с соседями |
| Расстановка ярлыков | CSS-позиции по иконке | чистая функция в `lib/shortcut-layout.ts` (рядом с `clampShortcutPosition`) | UI-09 прямо требует правило с JS, а не набор абсолютных позиций |
| Имя кнопки раскрытия карточки | правка строки внутри JSX | чистая функция + тест «имя содержит видимый текст» | WCAG 2.5.3 проверяем без браузера |

**Key insight:** в этой фазе почти всё уже есть как закреплённый source-тест; «руками написанное» — это новые тесты-стражи, а не новые утилиты.

## Runtime State Inventory

Фаза — стилистическая перестройка с переименованием классов, не миграция данных. Прохожу все пять категорий:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage` ключ `portia-desktop-shortcuts-v3` (позиции ярлыков, `components/portia-desktop.tsx:221`); `portia-desktop-settings-v1` (`accent-boot.ts`). Радиусы и классы в данных не хранятся. | Только код: ключи не менять; на ≤900px авторасстановка игнорирует сохранённые позиции (решение планировщика), без миграции |
| Live service config | None — фаза не трогает Supabase, Netlify, n8n; SQL не добавляется (если добавится — `supabase-rls-reviewer`) | None — проверено grep по плану: ни одного `.sql` в охвате |
| OS-registered state | None — задач планировщика/сервисов с именами классов нет | None |
| Secrets/env vars | None — переменные не читаются и не переименовываются; `.env*` не открывались | None |
| Build artifacts | `tsconfig.tsbuildinfo`, `.next`, `test-results/`, `playwright-report/` — не зависят от имён классов; снимки `tests/e2e/visual/__screenshots__` перестанут совпадать (история, D-17) | Не регенерировать; не запускать `--verify` |

## Common Pitfalls

### Pitfall 1: Охрана `components/portia-editor.tsx` (format-launch.test.ts)
**What goes wrong:** любая правка редактора роняет тест «D-64: portia-editor.tsx differs from 449c756 only by the approved edits» и «D-58: the set of Russian texts…». [VERIFIED: lib/format-launch.test.ts:569-581, `const SAMPLE_COMMIT = "449c756200b3db32f9cfaf4b3ca36b47822b395b";`]
**Why it happens:** охрана берёт образец через `git show <коммит>:components/portia-editor.tsx` и применяет реестр побайтных замен (`D-57, D-62, D-63, PORTIA-24, PORTIA-24-08, PORTIA-22, PORTIA-25`). Комментарий в самом тесте требует: «новый коммит-образец или новая разрешённая замена здесь».
**How to avoid:** три варианта, выбрать один в плане и описать владельцу текстом: (a) по хунку писать `apply…Hunk` (UI-SPEC так и требует, цена высокая: побайтные якоря, и они ломаются при следующей правке); (b) **рекомендуется:** после того как все правки редактора фазы закоммичены, перебазировать `SAMPLE_COMMIT` на этот коммит и обнулить реестр, оставив охрану как «заморозку после Phase 26» (это перескоупление, не отключение; сохранить тесты D-57 launch button); (c) вынести максимум в шов (Pattern 3) и уменьшить число хунков. Комбинировать (c)+(b). Побочное: тест падает «до перебазирования» — перебазирование делать в той же задаче, что и последняя правка редактора, иначе промежуточные коммиты красные.
**Warning signs:** `firstDifference` в сообщении падения, `added/missing` из `textSetDifference`.

### Pitfall 2: Реестр подсказок (phase20-hints-inventory.test.ts)
**What goes wrong:** тест «the register and the sources agree (… nothing unrecorded …)» падает на любой новой кириллической строке **≥7 слов** (`const longTextWords = 7;`) в `components/*.tsx`. [VERIFIED: lib/phase20-hints-inventory.test.ts:34, :219-230]
**Why it happens:** решение D-56 владельца: длинные пояснения запрещены.
**How to avoid:** копия UI-SPEC «Она откроется справа. Выберите строку в списке слева.» — 8 слов в одном литерале: разбить на два литерала/элемента (3 и 5 слов) либо сократить; либо по прецеденту добавить файл в `replacedCopy` внутри теста (так сделали Phase 23/24). `aria-label` «Разделы, найдено в разделах: 3» — 4 слова, безопасно.
**Warning signs:** сообщение теста «unrecorded explanation».

### Pitfall 3: Вкладки «Информация», «Справочник», «Сводка» — аккордеоны, не «список + форма»
**What goes wrong:** D-12/UI-SPEC маппинг («list = section list, detail = section form») предполагает список слева, а сегодня эти вкладки — `SectionTabs` + `EditorToc` + `SectionColumns` из `CollapsibleCard` (portia-editor.tsx 1341–1370), форма-аккордеон на ширину окна. [VERIFIED: components/portia-editor.tsx:1341-1357]
**Why it happens:** Phase 20 (D-40/D-41) пришла к колонкам по пять карточек, D-15 закрепил фиксированную ширину карточки 340px (`--editor-card-width`), 18-MOTION-APPROVAL item 5 — одобрение владельца.
**How to avoid:** договорить маппинг до плана: **list pane = существующее оглавление `EditorToc` (разделы), nav = `SectionTabs`, detail = активная карточка раздела** — и не менять внутреннюю структуру карточек. Не выдумывать новый список. Эти три экрана — по одной переделке каждый (D-10).
**Warning signs:** тесты `portia-desktop.test.ts:313-357` (регэкспы на `.editor-card-columns`, `--editor-card-width: 340px`, и на JSX-форму `<div className="editor-form flat-editor-form editor-card-columns">\n…<p className="editor-guidance">`) падают при любой реорганизации.

### Pitfall 4: Единый «Сохранить» — общий для всех черновых вкладок
**What goes wrong:** кнопка в баре кажется «сохранить эту вкладку», но `draft` в `PortiaEditor` один (один `useReducer` истории), сохранение отправляет все изменённые секции (`changedSections`, частичное сохранение `partialSave`). [VERIFIED: components/portia-editor.tsx:1690-1725, lib/editor-save-status.ts]
**How to avoid:** бар показывает статус из `saveStatusText` и «Не сохранено: N» (как в UI-SPEC), а не «в этой вкладке изменено». Сотрудники (`EmployeeProfilesEditor`) сохраняют отдельно и имеют свой статус; «Пользователи»/«Повышение» вообще без черновика. Бар-компонент принимает слоты, а не `draft`.

### Pitfall 5: `saveNotice` и сообщения привязаны к чипу
**What goes wrong:** тест `lib/level-editor.test.ts:233-240` («D-17 the notice of the server's lift is a status line beside the save chip, outside the popover») закрепляет `className="editor-save-chip"` и порядок `chip < notice < popover`; `lib/portia-desktop.test.ts:1013-1030` закрепляет z-индексы и `bottom: 12px` у чипа. Причины ошибки сохранения (`saveError`, oversize, `bodyMessage`, `badQuest`) живут во всплывающем окне чипа (portia-editor.tsx 1706–1716).
**How to avoid:** при выводе чипа из эксплуатации перенести `saveNotice` в слот статуса бара, причины — в `role="alert"` под баром; обновить оба теста в той же задаче (не удалять, перенацелить).

### Pitfall 6: Радиус-токены — «только объявления» закреплено тестом
**What goes wrong:** тесты `UI-01: radius and tap tokens remain declarations only` (запрет `var(--radius-` и `var(--tap-target` в `app/` и `components/`, включая `.css`!) и `UI-01: declare-only tokens sit in the first root at today's values` (точный список `TOKEN_NAMES`, `tokens.get("--radius-window") === ruleRadius(css, ".app-window")` и т.д.) падают при первой же замене значения на `var(--radius-…)`. [VERIFIED: lib/style-tokens.test.ts:122-156, :185-189]
**How to avoid:** первая задача фазы — переписать `lib/style-tokens.test.ts` (грамматика, значения ролей по таблице, список имён с `--radius-card`, `--control-height`, `--control-height-compact`, `--field-max`, `--card-min`; удалить примитивы `--radius-0…19`, `--radius-pill`); хеш `PRE_PHASE_PORTIA_CSS_SHA256` перебазировать/упразднить; тест «users-tab must stay the last block of the file» (и `lib/users-component.test.ts:76` «users CSS is one sharp marked block at the end») перенацелить: блок `ui-unify` будет добавлен после него.

### Pitfall 7: Тесты акцентов и литералов
**What goes wrong:** `lib/accent-theme.test.ts` проверяет весь `portia.css`: «no turquoise literal left» (литералы бирюзового оттенка вне ROOT_KEEP/SKIP), «every accent tint follows --accent-chroma» (каждое `var(--accent-hue)` должно стоять в форме `calc(N * var(--accent-chroma)) var(--accent-hue)`), «Portia tints stay in gamut» (каждый `oklch(L calc(C * …) hue)` должен быть в sRGB). **How to avoid:** в новом CSS использовать токены и существующие `oklch(... calc(...) var(--accent-hue))` как есть; не писать hex для нейтралов и бирюзовых.

### Pitfall 8: Тесты на фиксированные ширины плиток/карточек (D-43, D-15)
**What goes wrong:** R1/R3 из UI-SPEC (`1fr`, две колонки) противоречат закреплённым `broadcast-grid` (`minmax(min(100%, 340px), 340px)`), `guide-grid` (`176px`) и `--editor-card-width: 340px` (`lib/portia-desktop.test.ts:331-357`, одобрено владельцем 18-MOTION-APPROVAL item 5). **How to avoid:** R1/R3 действуют **только** внутри `.app-window.is-maximized` (так и написано в UI-SPEC), нормальное окно остаётся на 340/176; тест D-43/D-15 расширяется, а не удаляется. Открытый вопрос 2 ниже.

### Pitfall 9: Окружение — `npm` в портативной Node 22.13.1 сломан
**What goes wrong:** `npm test` из этой оболочки падает `Cannot find module 'node-gyp/bin/node-gyp.js'` (npm из `%TEMP%\portia-node-v22.13.1`). Скрипт `portia-check/run.sh` вызывает `npm test`, поэтому тоже падает; то же зафиксировано в STATE (25-10: «run.sh blocked by npm in the temp Node, direct equivalents green»). [VERIFIED: запуск в этой сессии]
**How to avoid:** использовать прямые эквиваленты (раздел Validation). Не записывать падение `npm` как красные тесты и не записывать прямой запуск как `portia-check`.

### Pitfall 10: Хук-страж блокирует shell-циклы
**What goes wrong:** простой `for f in lib/*.test.ts; do grep … done` был заблокирован сообщением «Staging keys are loaded: this command could expose or bypass them.» **How to avoid:** для обзора использовать инструменты Read/Grep/Glob, не shell-циклы; соблюдать CLAUDE.md (не читать `.env*`).

## Code Examples

### Расстановка ярлыков ≥521px (UI-09): сигнатура чистой функции
```ts
// Source: [ASSUMED] проектное предложение; опирается на clampShortcutPosition в lib/shortcut-layout.ts
export type IconBox = { width: number; height: number };           // размер ячейки: compact 80×72, default 94×86, large 110×98 + запас на 2 строки подписи
export function placeShortcuts(
  ids: readonly string[],
  area: { width: number; height: number },                          // clientWidth/Height .desktop-icons
  cell: IconBox, gap: number, inset = 8, reserveBottom = 56,        // 56px — резерв таскбара, уже есть в .workspace
): { positions: Record<string, { x: number; y: number }>; contentHeight: number };
// column-major: сверху вниз; колонка кончилась — следующая колонка; если и ширины не хватает — растёт contentHeight,
// компонент ставит min-height на .desktop-icons и .workspace перестаёт быть overflow:hidden (никакой блокировки прокрутки).
```

### Имя кнопки раскрытия карточки (UI-10, WCAG 2.5.3)
```ts
// Source: [CITED: dequeuniversity.com/rules/axe/4.10/label-content-name-mismatch] — имя должно содержать видимый текст в том же порядке; регистр и крайние пробелы игнорируются
export function cardToggleName(open: boolean, label: string, title?: string) {
  const visible = title ? `${label} ${title}` : label;              // видимо: <strong>РАЗДЕЛ 01</strong><span>title</span>
  return `${open ? "Свернуть" : "Развернуть"} раздел «${visible}»`;  // начало «Развернуть раздел» сохраняет /^Развернуть раздел/ в tests/e2e/specs/editor-journeys.spec.ts:84
}
```
Между `<strong>` и `<span>` добавить пробельный текстовый узел, иначе видимый текст сольётся («РАЗДЕЛ 01Foo») `[ASSUMED]` — проверять юнит-тестом на функции и, когда линия e2e откроется, axe-ом.

### Грамматика радиуса — см. Pattern 1.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Число `border-radius` закреплено счётчиком (131/6) | Грамматика «только токены/0» | Phase 26 | Новый радиус нельзя добавить «молча» |
| Круглые/скруглённые кнопки с 6 разными значениями | Роль `control` = 0, `plaque` = 999px | Phase 26 (C) | видимые изменения на 25 селекторах, часть — спорные |
| Плавающий `.editor-save-chip` + popover | Липкий `.etab-bar` | Phase 26 | перенос `saveNotice`/причин ошибок |

**Deprecated/outdated:** описание todo `2026-11-03` («горизонтальная лента карточек») — в коде уже вертикальный список/статья двумя экранами (Phase 20, D-28/D-30); todo `2026-11-07` пишет «шесть иконок», CONTEXT D-05 — пятнадцать.

## Радиус: перепись и предлагаемый маппинг ролей

Перепись на 2026-11-16 (`grep -o "border-radius\s*:…"`): `portia.css` 131 = 7px×32, 4px×17, 3px×12, 10px×12, 6px×11, 5px×10, 8px×9, 50%×9, 9px×7, 2px×2, 14px×2, `0`×2, 999px×1, `7px 7px 0 0`×1, `6px 6px 2px 6px`×1, 19px, 18px, 12px по ×1; `portia-promotion-editor.css` 6 = 6px×4, 8px×1, 7px×1; `globals.css` 0. [VERIFIED: grep в этой сессии] Номера строк `portia.css` ниже — до правок.

Предложение по ролям (правило UI-SPEC «по назначению»; пункты с **?** — суждение, вынести в текстовый отчёт владельцу):
- **window (10px):** `.app-window` 249, телефонный `.app-window, .archive-window, .global-search-window` 1345 (сейчас 7px → станет 10px), `.desktop-icon` 201, `.desktop-icon-symbol` 230 (14→10), `.start-panel` 1290.
- **dialog:** `.access-card` 3, `.portia-dialog` 596, `.floating-text-format` 810 и 1454 (`7px 7px 0 0` → `var(--radius-dialog) var(--radius-dialog) 0 0`), `.custom-color-picker` 842, `.promotion-confirm` 2361, `.template-confirm` 2415, `.assistant-bubble` 1101 (`var(--radius-dialog) var(--radius-dialog) 0 var(--radius-dialog)` по примеру UI-SPEC), `.owner-login-card` и toast — сейчас без радиуса, добавить. `.editor-save-popover` 585 уходит вместе с чипом. **?** `.document-app-zoom` 2032.
- **card (7px):** `.global-result` 318, `.global-result-skeleton` 331, `.window-app-mark` 288, `.info-index button` 390, `.embedded-rich-media` 397, `.personnel-list > button` 446, аватары 458/461, `.recommendation-preview-item` 743, `.employee-editor-summary figure` 746, `.editor-dropzone` 955, `.trash-file-icon` 1047, `.assistant-formatted-text` 1105, `.virus-row` 1133, `.mini-app-icon` 1287, `.start-panel-icon` 1299, `.start-panel > button` 1296, `.guide-photo-layout` 2091, `.skeleton-block` 2158, все `.promotion-*` контейнеры 2116–2358 (кроме полей/кнопок/вкладок/плашек), `.template-card-preview` 2442, `.promotion-template-entry` 2409, `.custom-color-board` 846. Строки списка `.editor-record-list button` и `.users-row` сейчас без радиуса → card.
- **control (0):** `.window-controls button` 291 и `::before` 2495, `kbd` 314, `.format-*` кнопки 816/821/828/829/835/845/860, `.info-next button` 1419, `.app-state-action` 2140, `.promotion-action` 2124, кнопки Promotion (`portia-promotion-editor.css`: действия, `.promotion-preview-actions > button` и т.д.), `.access-card button`. **?** `.start-button` 1278, `.taskbar-app` 1282 (10px → 0: кнопки таскбара станут острыми), `.global-format-launch > button` 19px (пилюля «ОФОРМЛЕНИЕ» → острая), `.document-app-external` 2036, `.setting-options > button` 357 (5px, в т.ч. выбор паутины и обоев), `.swatch` 364 (сейчас 50%; UI-SPEC относит «colour swatches» к control = 0, но `.swatch` — круглые образцы акцента).
- **field (0):** `.access-card input` 8, `.global-search-box` 309, `.editor-field input/textarea/select` 690, `.formatted-rich-input` 777, `.classification-select-wrap` 760 (select внутри уже `0 !important`), `.search-box` 1126, `.promotion-gate input` 2121, `.promotion-free-answer textarea` 2206, `.promotion-device-reset input` 2270, `.promotion-final-decision input` 2326, `.promotion-bank-*` input/textarea/select 2334/2338, `.custom-color-value input` 855.
- **tab (0):** `.editor-section-tabs nav button, .editor-section-tab-order button` 908 (6px), `.promotion-editor-branches button, .promotion-queue-filters button` 2264 (7px), `.promotion-bank-workflow-tabs button` (promo css, 7px).
- **plaque (999px):** `.search-recommendations button` 339, `.global-result-mark` 320, `.info-sub-marker` 402, `.promotion-step-badge` 2233, счётчики внутри вкладок Promotion 2266, `::-webkit-scrollbar-thumb` 132, `.qualification-focus-backdrop span` 262, `.assistant-label` 1100; **добавить** радиус плашкам, у которых его нет: `.quest-badge`, `.manual-mark`, `.users-plaque`, `.users-table-mark`, `.tab-count`.
- **round (50%):** `.status-dot` 174, `.desktop-icon-badge` 240, `.tab-dot` 595, `.record-status span` 1154, `.loading-spinner` 1788, `.promotion-flow-icon` в квалификации 2175, 831/847 внутренности пикера.
- **литерал `0`:** `.taskbar-app.active::after` 1285 (2px → 0), `.document-app-viewport > .app-skeleton .skeleton-fill` 2169 (уже `0`), `.classification-select-wrap select` 761 (`0 !important`, единственное разрешённое `!important`).

Сложные тонкие места: у `.window-controls button` на телефоне видимая рамка рисуется `::before` с `inset: 7px; border-radius: 8px` (portia.css 2495), а сама кнопка 44×44 без рамки в титульной полосе 48px — это нужно переделать вместе с угловым крестом, иначе кнопка останется «внутри» и закруглённой.

## Окна и крестик (UI-05, UI-11)

- Структура (прочитано): `.window-titlebar` — grid `1fr auto auto`, `height: 46px`, `padding: 0 15px`; `.window-controls` — `gap: 6px`, кнопки 28×28 с `border-radius: 8px`, порядок «―», «□», «×» (`data-window-action`), последняя `×`; на телефоне ≤900px блок 1349–1352 даёт 42px/30px, а **более поздний** блок 2485–2498 (`.window-titlebar { height: 48px }`, кнопки 44×44 с `::before`) — каскад выигрывает второй. [VERIFIED: app/portia.css:269-293, 1349-1352, 2492-2498; components/portia-desktop-window.tsx:185]
- `.window-edge-ne` 14×14 `z-index: 9` перекрывает правый верхний угол — это и есть «чуть левее угла»; контролам нужен `position: relative; z-index: 10`.
- Остальные кресты, которые надо привести к `.corner-close`: `.access-close` (3 места: portia.css 17, портал `portia-access-gate.tsx:136`), `.quest-toast-close` (608; `portia-access-gate.tsx:186`, `portia-desktop.tsx:2236, 2266`), `custom-color-picker.tsx:65` (`.custom-color-picker-head button` 24×24), плавающая панель оформления (`portia-editor-rich-text.tsx:635`, `.floating-text-format > header button` 28×28; на телефоне 44×44).
- `lib/window-open.test.ts:213` закрепляет `{!locked && <div className="window-controls">` — разметка контролов может меняться только классами/стилями.

**UI-11a (клэмп слева/справа):** `fitGeometry` (`x = min(max(margin, x), bounds.width - width - margin)`), `dragGeometry` (`low = margin`, `high = room - size - margin`), `resizeGeometry` (`e`: `bounds.width - margin - start.x`; `w`: `max(margin, …)`) симметричны, и `lib/window-geometry.test.ts` уже содержит тесты «dragging far right keeps the full window inside the same eight-pixel inset as the left», «resize then drag preserves the resized width and mirrored horizontal limits», «fractional bounds (DPR 1.25) give equal unrounded insets». [VERIFIED: lib/window-geometry.ts:1-48, lib/window-geometry.test.ts] Начальное положение намеренно смещено на 56px влево (`createWindowGeometry`: `(workspaceWidth - width) / 2 - 56 + cascade`), но потом проходит тот же clamp. **Предлагаемый исход: NOT REPRODUCED на уровне lib** — добавить зеркальный property-тест (старт x=8 и x=parent−width−8, ±Δ) как защитный и записать исход; визуальная проверка на DOM/устройстве — BLOCKED (DEVICE).
**UI-11b (конец анимации ярлыка):** гипотеза закрыта Phase 19-09 (D-17): `will-change` постоянный, последний кадр объявлен в покое вне селектора анимации; тесты `portia-desktop.test.ts:873-935` («shortcut rest (D-17): … rest on their last keyframe», «shape-rendering and will-change are constant on both hosts») и `:468-484`. Подпись ярлыка (`<span>` внутри `.desktop-icon`) сама не анимируется; масштаб касается контейнера только при перетаскивании (`.is-dragging { transform: scale(1.035) }`, `shortcut-pickup/drop` до `scale: 1`). **Предлагаемый исход: NOT REPRODUCED на уровне исходников** (добавить тест «last frame == identity» для `shortcut-drop`/`shortcut-pickup` и отсутствие `will-change: transform` на `.desktop-icon` в покое); резкость/DPR 1.25 — BLOCKED (DEVICE).

## «Информация» на телефоне (UI-08)

Текущее состояние (прочитано): на ≤900px `infoPhone` (`useSyncExternalStore(matchMedia 900px)`) включает два экрана `data-info-screen="list"|"article"` (`infoScreen`), кнопку `.info-phone-back` «←» (`aria-label="Назад к разделам"`), `closeInfoArticle`/`openInfoArticle`, возврат фокуса по `data-info-id`; `.info-index` скрыт на экране `article`, `.info-document` скрыт на экране `list`; поиск ставит `setInfoScreen("list")` и раскрывает секцию (`revealInfoForSearch`); «Далее» (`infoNextTarget`) остаётся. [VERIFIED: components/portia-desktop.tsx:1495-1522, 1775-1784, 2002-2036; app/portia.css:1406-1420]
План изменения (по UI-SPEC): новое состояние `sectionsOpen`; `.info-index` показывается в потоке под баром при `sectionsOpen`; статья показывается всегда; выбор раздела закрывает список и возвращает фокус на кнопку; Escape закрывает; счёт совпадений `РАЗДЕЛЫ ▾ · N` считается чистой функцией (число секций с хитом — переиспользовать `isSearchHit`/`hitAttrs`), текущее имя — первая непустая строка заголовка, fallback «Без названия». Чистые хелперы — в `lib/info-phone-nav.ts` (там уже 4 чистые функции и тест). `data-info-screen` и `.info-phone-back` удаляются, а значит обновляются: `tests/e2e/specs/info-phone-nav.spec.ts` (≈12 ссылок), `tests/e2e/specs/accessibility.spec.ts:690`, `tests/e2e/visual-candidates/info-phone.spec.ts:63-65` (линии BLOCKED, но спеки не оставлять с мёртвыми локаторами).

## Ярлыки 521–900px (UI-09)

Найденная причина «недвижимых абсолютных ярлыков и блокировки прокрутки» (прочитано): `@media (min-width: 521px) and (max-width: 900px)` (portia.css 1539–1549) ставит `.workspace { overflow: hidden }`, `.desktop-icons { position: absolute; inset: 0; display: block }`, `.desktop-icon { position: absolute; left/top/right/bottom: var(--shortcut-*) }` из `defaultShortcutLayout` (колонки `left: 14` и `left: 124`, шаг сверху 104px, `charter/sheet` прибиты `bottom: 18`, `trash` `right: 14`), а перетаскивание и Alt+стрелки выключены на ≤900px (`handlePointerDown`/`handleKeyDown` возвращаются по `matchMedia("(max-width: 900px)")`). [VERIFIED: app/portia.css:1539-1549; components/portia-desktop-shortcuts.tsx:20-32, 117-121, 184-187]
Оценка (не рендерилось, `[ASSUMED]`): при размере `large` (ширина 110, `min-height: 98`, подпись 13px в две строки) ячейка выше ≈118px против шага 104px — подписи наезжают на следующий ярлык; при `default` зазор нулевой; на низких экранах нижние ярлыки обрезаются `overflow: hidden` и недоступны (прокрутка заблокирована).
Рекомендация по механизму: чистая функция `placeShortcuts` (колонка за колонкой, учитывает размер режима `compact|default|large` и 2 строки подписи, возвращает `contentHeight`), применяемая эффектом в `DesktopIcons` при ширине ≥521 (`ResizeObserver` на `.desktop-icons`); правило `@media (min-width:521px) and (max-width:900px)` перестаёт позиционировать `.desktop-icon` (остаётся только размер); `.workspace` не `overflow: hidden`; подпись переносится внутри ширины иконки (2 строки, затем многоточие, как в UI-SPEC). Ключ localStorage не меняется. На ≤520px остаётся `inset: auto !important`.

## Развёрнутое окно и растянутые кнопки (UI-06)

- Единственный хук — `.app-window.is-maximized` (портиа 260: `inset: 8px !important; width: auto !important; …`). Сегодня в CSS **нет ни одного** правила, зависящего от `is-maximized`, кроме скрытия рёбер, т.е. развёрнутое окно отличается лишь габаритами; все R1–R5 пишутся с нуля, селекторы должны начинаться с `.app-window.is-maximized`. Контейнерные запросы уже есть только на `.personnel-profile`, `.record-document`, `.guide-tile-thin`, `.wallpaper-layer`, `.template-card-preview .class-cell` — они не затрагиваются. [VERIFIED: app/portia.css:260, 301; grep `container-type`]
- Кнопки, растягиваемые сегодня (кандидаты на аудит D-02; найдено разбором правил, часть — на телефоне и в узких колонках, где допустимо A3): `.format-choice-row > button` (flex:1), `.content-control-actions button, a` (flex:1, телефон), `.promotion-preview-actions > button` (`flex: 1 1 160px`, promo css), `.promotion-device-reset button` (flex:1), `.promotion-bank-workflow-tabs button` (flex:1), `.archive-document-bar button`/`.info-next button` (width:100%, телефон), `.promotion-action` (width:100% на ≤520), `.users-action-dialog-body …button` (width:100%, ≤900, диалог ≤420px — допустимый «стек»), `.start-panel > button` (строки меню). Строки списков (`.editor-record-list button`, `.global-result`, `.personnel-list > button`, `.virus-row`) — это строки, не кнопки; они заполняют ячейку.
- Сегодня 2D-сетки — «карточки фиксированной ширины» (`.broadcast-grid` 340px, `.guide-grid` 176px, `.editor-card-columns` 340px) — оставляют пустую полосу справа в широком окне; R1 для «Сводки» и «Справочника» заменяет это **только в развёрнутом окне**.
- «Доступные записи» — `.global-search-results { display: grid; gap: 8px }` (portia.css 317), строки `.global-result { width: 100% }`; R1 переписывает `grid-template-columns`, не трогая нормальное окно.

## Тесты, которые придётся обновить (карта «что падает при какой правке»)

| Правка | Тест / место | Действие |
|--------|--------------|----------|
| Любой `border-radius` → токен | `lib/style-tokens.test.ts` (UI-01 ×5, хеш) | переписать на грамматику (первая задача) |
| Конец файла: блок `ui-unify` | `lib/style-tokens.test.ts` (users-tab last), `lib/users-component.test.ts:76` | перенацелить на «`ui-unify` последний» |
| Редактор: чип → бар, `aria-pressed`→`aria-current`, `nested-editor-toggle` | `lib/format-launch.test.ts` (D-64, D-58), `lib/level-editor.test.ts:233-240`, `lib/portia-desktop.test.ts:1013-1030`, `lib/portia-desktop.test.ts:340-357`, `tests/e2e/specs/editor-journeys.spec.ts:84` | перебазировать охрану, перенацелить тесты |
| Новый русский текст ≥7 слов | `lib/phase20-hints-inventory.test.ts:219` | сократить/разбить или `replacedCopy` |
| Новый шов в редакторе | `lib/portia-desktop.test.ts:113-139` | имя `portia-editor-*.tsx` — без правки теста |
| Развёрнутое окно R1/R3 | `lib/portia-desktop.test.ts:313-357` (D-43, D-15) | расширить, не удалять |
| Телефонная «Информация» | `tests/e2e/specs/info-phone-nav.spec.ts`, `accessibility.spec.ts:690`, `visual-candidates/info-phone.spec.ts` | переписать локаторы |
| Ветки Promotion `aria-pressed` | `lib/portia-promotion-editor.test.ts:153-154` | менять вместе с компонентом, либо оставить `aria-pressed` у фильтров |
| `.window-controls` | `lib/window-open.test.ts:213` | разметка не меняется |
| Контраст-фиксы | `tests/e2e/specs/editor-ui-contract.spec.ts:106-111, 929-931` (карты допусков `knownBeforeD62/D63`) | удалить допуски ровно для исправленных узлов |
| Снимки v1.3 | `tests/e2e/visual/__screenshots__`; `node scripts/phase15-visual-manifest.mjs --verify-promotion` | **не меняется**: проверяет байты снимков (в этой сессии: «Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded.»), CSS не читает; UI-SPEC предполагал «ожидаемый красный» — его не будет |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Для охраны редактора предпочтительнее перебазировать `SAMPLE_COMMIT` после последней правки, чем писать побайтные хунки на каждую правку | Pitfall 1 | Владелец/планировщик могут трактовать UI-SPEC («every approved hunk extends the guard») буквально; цена хунков выше |
| A2 | Маппинг «list pane = EditorToc, nav = SectionTabs, detail = активная карточка» для «Информация/Справочник/Сводка» | Pitfall 3 | Иная трактовка D-12 даёт перестройку JSX на сотни строк под охраной |
| A3 | Подписи ярлыков при `large` и 2 строках выше шага 104px (расчёт по CSS, не по рендеру) | Ярлыки 521–900px | Если подписи помещаются, UI-09 всё равно требует правило с JS, но «живой дефект» не подтверждён |
| A4 | Пробельный узел между `<strong>` и `<span>` в `.nested-editor-toggle` нужен, чтобы видимый текст содержал пробел | Code Examples | Имя может не совпасть с видимым текстом на пробеле; ловится юнит-тестом на функции, но не axe до открытия e2e |
| A5 | Таксбар/старт/«ОФОРМЛЕНИЕ»/выбор паутины-обоев/swatch → `control` (0) по правилу «действие → control» | Радиус: маппинг | Это видимое изменение; владелец сам называл выбор паутины и обоев образцом скруглённого места |
| A6 | Приблизительные поверхности `--bg/--panel/--panel-2` как `oklch(.163/.201/.229, .014/.018/.021·chroma, hue)` без градиентов | Контраст | Градиентные фоны `.info-library`/`.guide-app` (L .192→.221) дают значения между panel и panel-2; тест должен считать обе точки |
| A7 | Новые кириллические строки UI-SPEC укладываются в <7 слов после разбиения | Pitfall 2 | Иначе падает реестр подсказок |

## Open Questions

1. **Круглые образцы и выбор паутины/обоев (A5).**
   - What we know: владелец сам привёл «выбор паутины и обоев рабочего стола» как пример места со скруглением (`2026-11-07-desktop-visual-overhaul.md`); по правилу ролей `.setting-options > button` (5px) и `.swatch` (50%) становятся `control` = 0 / UI-SPEC относит «colour swatches» к control.
   - What's unclear: хочет ли владелец, чтобы именно эти образцы остались мягкими (в C это пилюли/карточки?).
   - Recommendation: до задачи с радиусами в текстовом отчёте спросить «круглые образцы цвета и выбор паутины/обоев оставить скруглёнными?»; по умолчанию — `.swatch` = `round`, `.setting-options > button` = `card` (7px), т.к. это выбор из плиток, а не кнопка действия. Помечено `[ASSUMED]`.

2. **R3 (две колонки `1fr`) против D-15 / 18-MOTION-APPROVAL item 5 (карточка фиксированной ширины 340px).**
   - What we know: `--editor-card-width: 340px` закреплён тестом и одобрен владельцем; R3 действует только при `.is-maximized` и ≥1281px.
   - What's unclear: применяется ли R3 к вкладкам с `editor-card-columns` (там уже `auto-fill` по 340px) или только к плоским формам (вирусы, сотрудники, настройки).
   - Recommendation: R3 — только плоские формы; `editor-card-columns` в развёрнутом окне растут колонками по 340px (без `1fr`), если владелец не скажет иначе.

3. **Контракт контраста ≥4.5:1 «на `--panel-2`» для пресета red.**
   - What we know: посчитано `--teal` red `#d94f6e`: bg 4.88, panel 4.58, **panel-2 4.30**; `--teal-dim` red 2.56–2.91 на всех. Серый `.559` 3.59–4.19, `.525` 3.11–3.64 на всех пресетах; `.658` ≥5.37.
   - What's unclear: проверять ли `--teal`-текст на `--panel-2` (UI-SPEC требует), или менять оттенок red-пресета (палитра вне границы), или ограничить контракт `--bg/--panel`.
   - Recommendation: тест фиксирует реальную карту (какие пары на каких поверхностях стоят) и падает только на пары, реально присутствующие в CSS; пары `red --teal` на `--panel-2` — найти, где `--teal` стоит как текст на `--panel-2`, и либо перенести текст на `--panel`, либо вынести вопрос владельцу как «осветлить red на 1 шаг». `[ASSUMED]` до решения.

4. **Стратегия охраны `portia-editor.tsx` (A1).**
   - Recommendation: см. Pitfall 1 (c)+(b); подтвердить у владельца/в плане в одну строку.

5. **Телефонная титульная полоса 48px против «46×46 в углу».**
   - What we know: на ≤900px полоса 48px, кнопки 44×44; UI-SPEC даёт 46×46 для окон (ПК).
   - Recommendation: ПК — 46×46 (полоса 46), телефон — 44×48 вплотную к правому краю (без `padding-right`, без `::before`-рамки), записать как A10-подобное исключение.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | всё | ✓ (эталонная) | v22.13.1 (`%TEMP%\portia-node-v22.13.1\...`, временная папка — может исчезнуть; тогда Node 24 по умолчанию и сказать об этом) | — |
| npm в этой Node | `npm test/lint/exec` | ✗ | падает `MODULE_NOT_FOUND node-gyp/bin/node-gyp.js` | прямые команды (см. Validation); `portia-check/run.sh` в этой оболочке неисполним целиком |
| tsc | типы | ✓ | `node node_modules/typescript/bin/tsc --noEmit` чисто, ≈2.4s | — |
| eslint | lint | ✓ | `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`: 0 errors, 17 warnings, ≈24s | — |
| git (полная история) | `format-launch.test.ts` (`git show 449c756…`) | ✓ (тесты проходят) | — | `git fetch --unshallow` при shallow |
| Playwright / браузеры, e2e-препфлайт | e2e, axe | ✗ (BLOCKED (ENV)/(DATA)) | MCP Playwright не подключился в этой сессии; данные-lanes падают ENOTFOUND без read data source | source-тесты + пометка BLOCKED, не PASS |
| Context7 MCP | docs | ✗ | CONNECTION_CLOSED | для этой фазы не нужен (нет библиотечных API) |
| Supabase staging / физические устройства / screen reader | приёмка | ✗ | — | BLOCKED до Phase 27, A11Y-SR-01 BLOCKED (DEVICE) |

**Missing dependencies with no fallback:** нет блокирующих для исполнения; приёмка на устройствах — Phase 27.
**Missing dependencies with fallback:** `npm` → прямые вызовы `node`.

## Validation Architecture

> `workflow.nyquist_validation` в `.planning/config.json` равно `false`, но запрос оркестратора явно требует раздел — включён.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (встроенный, Node 22.13.1) + `--experimental-strip-types` |
| Config file | none — тесты читают исходники (`readFileSync`) |
| Quick run command | `node --experimental-strip-types --test lib/<файл>.test.ts` (1–2 с на файл) |
| Full suite command | `node --experimental-strip-types --test lib/*.test.ts` (≈10 с; базовая линия: 2229 tests, 2226 pass, 3 skipped, 0 fail) |
| Types | `node node_modules/typescript/bin/tsc --noEmit` (эквивалент `npm exec tsc -- --noEmit`) |
| Lint | `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` (эквивалент `npm run lint`; 17 предупреждений уже есть, 0 ошибок) |
| Visual manifest (разрешено) | `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` затем `node scripts/phase15-visual-manifest.mjs --verify-promotion`; **никогда `--verify`** |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-02 | любой `border-radius` = токен/0/композиция; значения 8 ролей = таблице; нет `--radius-<digits>`/`--radius-pill`; 2 `:root`; порядок импортов; нет inline `borderRadius` | unit (source) | `node --experimental-strip-types --test lib/style-tokens.test.ts` | ✅ переписать (Wave 0) |
| UI-03 | нет `width:100%`/`flex:1`/`1fr` у кнопок вне допустимых исключений; единая геометрия кнопка/поле/плашка/вкладка/строка (высоты 40/32/44); общие радиус-роли у `.primary-control`, `.editor-record-list button`, `.quest-badge`, `.users-plaque`, `.editor-tabs button` | unit (source) | `node --experimental-strip-types --test lib/ui-unify.test.ts` | ❌ Wave 0 |
| UI-04 | бар `.etab-bar`: sticky, слоты nav/status/actions, `aria-current` у раздела, действия только у черновых вкладок, чип/popover удалены, `saveNotice` в статусе; тот же шов у всех вкладок | unit (source) | `node --experimental-strip-types --test lib/editor-tab-layout.test.ts lib/portia-desktop.test.ts lib/level-editor.test.ts lib/editor-save-status.test.ts` | ❌ Wave 0 (+ обновить три существующих) |
| UI-05 | `.window-controls` flush справа, 46×46 (ПК), `z-index` выше `.window-edge`, `.corner-close` у `access`/toast/picker/format panel; телефон 44×48 без `::before` | unit (source) | `node --experimental-strip-types --test lib/ui-unify.test.ts lib/window-open.test.ts` | ❌ Wave 0 |
| UI-06 | правила R1–R5 только под `.app-window.is-maximized`; нет `container-type` на окне; потолки 640/820/1320; нормальное окно сохраняет D-43/D-15 | unit (source) | `node --experimental-strip-types --test lib/ui-unify.test.ts lib/portia-desktop.test.ts` | ❌ Wave 0 |
| UI-07 | **после** `26-ICON-DECISION.md`: 15 ключей `class-*` без изменений, `currentColor`, у каждой группы общая база и 1/2/3 отметки; `route-*` и поведенческие иконки не тронуты | unit (source) | `node --experimental-strip-types --test lib/virus-classes.test.ts` | ✅ (дополнить после выбора) |
| UI-08 | чистые хелперы бара; разметка бара, `aria-expanded`, `aria-controls="info-sections-list"`, Escape, возврат фокуса, `info-phone-back`/`data-info-screen` удалены; поиск не ломается | unit (source) | `node --experimental-strip-types --test lib/info-phone-nav.test.ts lib/portia-desktop.test.ts` | ✅ расширить |
| UI-09 | `placeShortcuts`: для 521/600/768/900px × compact/default/large нет пересечений и обрезки, `contentHeight` корректен; старое `@media (521–900)` больше не позиционирует `.desktop-icon`; нет `overflow:hidden`/`touch-action` на body | unit (source) | `node --experimental-strip-types --test lib/shortcut-layout.test.ts lib/portia-desktop.test.ts` | ✅ расширить |
| UI-10 | контраст пар из Color-контракта на 4 пресетах и «Своих»; `.eyebrow` ≠ `--teal-dim`; подсказки/`small[title]` не светлота .525/.559; имя `.nested-editor-toggle` содержит видимый текст; убрать допуски в e2e-спеке | unit (source) | `node --experimental-strip-types --test lib/ui-contrast.test.ts lib/accent-theme.test.ts` | ❌ Wave 0 (+ юнит имени карточки) |
| UI-11 | зеркальные тесты клэмпа; последний кадр `shortcut-drop/pickup` = покой; `will-change` не залипает | unit (source) | `node --experimental-strip-types --test lib/window-geometry.test.ts lib/portia-desktop.test.ts` | ✅ расширить |

### Sampling Rate
- **Per task commit:** конкретный тест-файл задачи (см. таблицу) + `tsc --noEmit`.
- **Per wave merge:** полный `node --experimental-strip-types --test lib/*.test.ts` + `tsc --noEmit` + `eslint` (≈40 с суммарно).
- **Phase gate:** всё выше + `phase15-visual-manifest` test + `--verify-promotion` зелёные; `npm run build` — если `.env.local` у владельца настроен (читает Next, не мы); e2e — записать BLOCKED (ENV)/(DATA), не PASS.

### Wave 0 Gaps
- [ ] `lib/style-tokens.test.ts` — переписать на грамматику (UI-02), снять закрепление счётчика и хеша, перенацелить «users-tab last»
- [ ] `lib/ui-unify.test.ts` — семейства, кнопки не растягиваются, `corner-close`, R1–R5 (UI-03/05/06)
- [ ] `lib/editor-tab-layout.test.ts` — бар/раскладка/sticky (UI-04)
- [ ] `lib/ui-contrast.test.ts` — пары на пресетах и «Своих» (UI-10); основа — хелперы из `accent-theme.test.ts`
- [ ] Перебазирование охраны `lib/format-launch.test.ts` (Pitfall 1) — до первой правки `portia-editor.tsx`
- [ ] Блокирующий чекпоинт владельца для иконок (`26-ICON-DECISION.md`) в плане до любой правки `portia-icons.tsx`

## Security Domain

`security_enforcement` включён (ASVS уровень 1, `security_block_on: high`). Фаза не меняет аутентификацию, сессии, API, SQL, RLS, хранилище, CSP (`style-src 'self' 'unsafe-inline'` уже разрешает инлайн-стили из `style`-пропсов).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | не затрагивается (экран доступа меняет только вид) |
| V3 Session Management | no | не затрагивается |
| V4 Access Control | no | серверные права «Пользователей» неизменны; UI не принимает решений о правах |
| V5 Input Validation / Output Encoding | yes (косвенно) | заголовки разделов в `aria-label`/подписи бара рендерятся React-ом (экранирование по умолчанию); не использовать `dangerouslySetInnerHTML` |
| V6 Cryptography | no | — |
| V14 Configuration | yes (косвенно) | не ослаблять заголовки/CSP; `lib/security-headers.test.ts` остаётся зелёным |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS через редакторский заголовок в `aria-label`/имени бара | Tampering | React-экранирование; не склеивать HTML; имя кнопки — чистая функция над строками |
| Утечка метки доступа в новом «detail pane» «Пользователей» | Information disclosure | брать поля из существующего серверного ответа (маскирование решающих, Phase 22); не добавлять клиентских вычислений прав |
| Обход гейта в «развёрнутом» режиме | Elevation | не затрагивается; `AppDeniedPanel` остаётся |

Если фаза всё же добавит SQL — обязательно агент `supabase-rls-reviewer` (CLAUDE.md); сейчас такой потребности не найдено.

## Project Constraints (from CLAUDE.md)

- Ответы владельцу — на русском; визуальные изменения сообщать **текстом** (ни `review.html`, ни хеш-реестр, ни Figma/Codex Security).
- Никогда: продакшн Supabase, реальные ключи/service-role; не читать и не печатать реальные `.env*` (`.env.example` можно); не мутировать прод.
- Не менять/не стейджить/не коммитить владельческие пути: `.planning/milestone.lock`, `.planning/forensics/`, `.planning/milestones/v1.2-incomplete-research/`, `.planning/quick/261028-c9g-portia-promotion-1-8/`, `.planning/ui-reviews/`.
- Стейджить только явными путями; без `git add -A/.`, `git stash`, `git clean`, `git reset --hard`.
- BLOCKED-доказательства (авторизованные роли, Postgres/RLS, staging/prod, физические устройства) нельзя записывать как PASS.
- Команды: `/portia-check`; тесты `npm test` (= `node --experimental-strip-types --test lib/*.test.ts`); типы `npm exec tsc -- --noEmit`; lint `npm run lint`; визуальный манифест — тест, затем `--verify-promotion`; **не `--verify`**.
- Для `supabase/*.sql`, RLS, RPC, storage — `supabase-rls-reviewer`.
- Эталонная Node 22.13.1 (может исчезнуть из `%TEMP%`; тогда сказать, что используется Node 24 по умолчанию).
- Project skills: `.claude/skills/portia-check/SKILL.md` (читан) — полный локальный чек; `ui-ux-pro-max`, `design-system`, `ui-styling` и др. присутствуют, но для этой фазы их предписания не нужны: UI-SPEC уже утверждён и палитра/шрифты/интервалы не меняются.

## Sources

### Primary (HIGH confidence)
- Прочитано в этой сессии (`Read`/запуск): `26-CONTEXT.md`, `26-UI-SPEC.md`, `package.json`, `app/portia.css` (1–130, 185–410, 575–700, 894–945, 1318–1350, 1400–1425, 1520–1565, 1849–1960, 2552–2607 и точечные grep), `app/portia-promotion-editor.css`, `components/portia-desktop-window.tsx`, `components/portia-desktop-shortcuts.tsx`, `components/portia-desktop.tsx` (180–225, 1366–1385, 1490–1525, 1766–1801, 1996–2040), `components/portia-editor.tsx` (228–340, 1150–1270, 1338–1380, 1676–1810), `components/portia-icons.tsx` (95–184), `components/portia-promotion-editor-main.tsx`, `lib/window-geometry.ts` + test, `lib/shortcut-layout.ts`, `lib/info-phone-nav.ts`, `lib/editor-save-status.ts` + test, `lib/style-tokens.test.ts`, `lib/accent-theme.test.ts`, `lib/format-launch.test.ts` (фрагменты), `lib/phase20-hints-inventory.test.ts` (фрагменты), `lib/portia-desktop.test.ts` (фрагменты), `lib/component-source.ts`, `tests/e2e/specs/editor-ui-contract.spec.ts`, `22-STYLE-DIRECTION.md`, todo-файлы 2026-10-28/11-03/11-07, `.claude/skills/portia-check/{SKILL.md,run.sh}`.
- Запуски: полный `node --experimental-strip-types --test lib/*.test.ts` (2229/2226/3 skipped/0 fail, ≈10 с), `tsc --noEmit` (чисто), `eslint` (0 errors/17 warnings), `phase15-visual-manifest.mjs --verify-promotion` (65 snapshots verified).

### Secondary (MEDIUM confidence)
- [CITED: dequeuniversity.com/rules/axe/4.10/label-content-name-mismatch] — имя должно содержать видимый текст в том же порядке; регистр и крайние пробелы игнорируются; правило срабатывает на элементах с `aria-label`.
- Расчёт контраста (скрипт в scratchpad, формулы OKLCH→sRGB и WCAG relative luminance из `accent-theme.test.ts`) — приближённые поверхности (A6).

### Tertiary (LOW confidence)
- Оценка высоты ярлыков `large` по CSS-метрикам (A3), поведение пробела между `<strong>`/`<span>` (A4), реакция владельца на маппинг A5 — `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — новых пакетов нет, версии из `package.json`
- Architecture: HIGH для CSS/окон/информации/ярлыков (код прочитан); MEDIUM для вкладок «Информация/Справочник/Сводка» (маппинг D-12 требует решения, A2)
- Pitfalls: HIGH — каждый подтверждён чтением теста или запуском

**Research date:** 2026-11-16
**Valid until:** 30 дней или до первой правки `app/portia.css`/`components/portia-editor.tsx` (номера строк сдвинутся; перед использованием перегрепать)
