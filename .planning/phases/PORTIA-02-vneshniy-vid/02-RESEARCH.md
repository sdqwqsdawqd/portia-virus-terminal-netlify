# Phase 2: Внешний вид - Research

**Researched:** 2026-10-13 (forced re-research, `--research`; existing plans 02-01..02-06 were written without research)
**Domain:** CSS theming (accent recolour), raster PNG tinting, next/font, CSS/SVG motion + prefers-reduced-motion, React window exit states
**Confidence:** HIGH on browser-support, font and PNG numbers (measured/verified this session); MEDIUM on perceptual outcomes (need the human-check the plans already contain)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Перекраска по цвету (LOOK-01)**
- **D-01:** Перекрашивается **всё, что сейчас остаётся бирюзовым при смене акцента**. Нужно пройти по всем вписанным в стили цветам акцента (`#00bca6`, `rgba(0,188,166,…)`, `#12897a` и производные, примерно 27 мест в `app/portia.css` плюс inline-стили в TSX и SVG) и перевести их на переменные акцента. Каждую тему (Portia, Холодный, Янтарный, Красный) проверить на живом сайте, включая боковые списки окон, верхнюю строку, панель задач, меню пуска, редактор и экран загрузки.
- **D-02:** Помощница **Вивьян** (`public/assets/portia-assistant.png`) и **лого-паук** (`public/assets/portia-logo.png`) перекрашиваются **только в своих бирюзовых частях** (ДНК-ноги, вирус). Чёрное и белое остаются как есть. Сами PNG не перерисовываются, и паук не становится SVG. Как этого добиться (фильтр, маска, разделение на слои) — на усмотрение Claude, лишь бы оттенок совпадал с акцентом во всех четырёх темах.
- **D-03:** Смысловые цвета **не перекрашиваются**: янтарный «внимание / не сохранено», красный «опасно / удалить», цвета классификации и уровней угрозы вирусов (канон). В янтарной и красной темах подобрать оттенки так, чтобы «внимание» и «опасно» оставались отличимы от акцента.
- **D-04:** Новых цветов интерфейса не добавляем, остаются **четыре** существующих (`teal`, `ice`, `amber`, `red`).

**Шрифт (LOOK-02)**
- **D-05:** Шрифт интерфейса — **IBM Plex Mono** (next/font, `subsets: latin + cyrillic`). Пользователь выбрал его из шести показанных вариантов (JetBrains Mono, IBM Plex Mono, PT Mono, Martian Mono, Jura, Exo 2) на реальных надписях сайта.
- **D-06:** IBM Plex Mono ставится на **весь интерфейс**: кнопки, вкладки, метки, списки, панели, а также на **крупные заголовки окон и досье**, которые сейчас в Unbounded. Unbounded уходит.
- **D-07:** **Шрифт текстов документов остаётся прежним, в моноширинный не переводится.** Это длинные тексты: досье (описание, PPU, мутации), записи учёных, «Информация», тексты рассылок, текстовые файлы Корзины. Сейчас (замер 2026-10-13) запись учёного набрана IBM Plex Serif (`--serif`), а остальные эти области — Golos Text через `--sans`. Поскольку D-05/D-06 переводят `--sans`-интерфейс на IBM Plex Mono, этим текстовым областям нужен свой токен шрифта (например `--doc` = Golos), чтобы они не стали моноширинными. Где именно граница «интерфейс / документ» — на усмотрение Claude по этому правилу.
  - **Поля редактора отдельно не настраиваются.** После плана 01-04 (уточнение пользователя в UAT фазы 1) каждое поле редактора берёт шрифт, размер и межстрочный интервал из того же общего CSS-правила, что и область сайта, которую оно правит (`.formatted-rich-input[data-area=…]` в одном правиле с селектором области). Смена шрифта области в этой фазе автоматически меняет и поле. Нельзя задавать полям собственный шрифт и нельзя разносить правило области и правило поля по разным местам. Прежняя формулировка «поля редактора остаются в IBM Plex Serif (D-03 фазы 1)» отменена.

**Новые SVG (LOOK-03)**
- **D-08:** **Новые обои: «Дорожки геля»** (электрофорез: вертикальные дорожки с полосами) и **«Клетки под микроскопом»** (круг окуляра, клетки и вирусные частицы, шкала). Это два новых варианта в настройке «Фон рабочего стола» рядом с «Паутина», «Спирали ДНК» и «Чистый». Рисуются в `currentColor` и следуют акценту, как существующие обои в `components/portia-wallpaper.tsx`.
- **D-09:** **Значки внутри окон:**
  - значки **классификации вирусов**: свой символ для основных линий Гефест / Протей / Апейрон, распространения Номос / Тезей / Абраксас и уровней угрозы Предупреждение / Риск / Эснов, рядом с текстом в досье и списке. Термины не переименовываются, значок дополняет текст, а не заменяет его;
  - **замки допуска** на записях учёных: уровень II открыт, уровни III–IV закрыты.
  Рисуются на той же сетке 24px и с той же толщиной линии, что и `components/portia-icons.tsx`, в `currentColor`.
- **D-10:** **Экран загрузки:** **починить спуск паука** (сейчас паук не спускается) и **добавить строки запуска**. Под пауком быстро печатаются 3–4 строки терминала (например «ПОДКЛЮЧЕНИЕ К АРХИВУ… OK») вместо простой полосы. Общая длительность загрузки не растёт (сейчас около 1650 мс). Паук остаётся PNG.
  - Вероятные причины поломки спуска, которые нужно проверить: PNG лого грузится позже, чем идёт 900-мс анимация `spider-descend`; либо в системе включено уменьшение движения (`prefers-reduced-motion`), и анимация отключена нарочно (`app/portia.css`, около строки 1097). Если причина во втором, это правильное поведение, о нём нужно сообщить пользователю, а не «чинить».
- **D-11:** **Перед внедрением показать эскизы** новых обоев, значков классификации и замков допуска, и пусть пользователь выберет (ограничение проекта: «по SVG-анимациям, новым SVG и шрифту — сначала предложить варианты»). В плане это точка `checkpoint:decision` перед задачами, которые рисуют эти SVG. — **Reversibility:** reversible

**Анимации (LOOK-03)**
- **D-12:** Анимации нужны:
  - **открытие и закрытие окон**: окно раскрывается из иконки и сворачивается в панель задач;
  - **иконки приложений**: реакция на наведение (линии прорисовываются, колба булькает, вирус поворачивается и т.п.);
  - **переходы внутри окон**: переключение вкладок, открытие досье и записи учёного, короткое проявление;
  - **помощница Вивьян** (D-14).
  Обои новой анимацией **не** оживляем; движение новых обоев на усмотрение Claude, в духе существующих «Спиралей ДНК».
- **D-13:** Характер анимаций окон, иконок и переходов: **быстрые и лёгкие**, 150–250 мс, небольшое масштабирование и проявление. Не тормозить работу с архивом (принцип продукта: погружение не мешает поиску и чтению).
- **D-14:** **Вивьян**: PNG не меняем, анимируем её состояния через CSS-трансформации:
  - **реакция / реплика**: когда она выдаёт реакцию и появляется пузырь с репликой, короткий прыжок, пузырь выскакивает с пружинкой;
  - **клик**: пружинистое сжатие, с каждым частым кликом всё более недовольное, вплоть до обиды;
  - **обида**: резкая дрожь, потом отворачивается (зеркалится), сереет и приседает; по окончании обиды плавно разворачивается обратно. Сейчас уже есть `is-offended` с поворотом на −3° и grayscale, это развить.
  Анимацию покоя («дышит») пользователь **не выбрал**, её не делать.
- **D-15:** Все новые анимации отключаются при `prefers-reduced-motion: reduce`, как это уже сделано для экрана загрузки и окон.

### Claude's Discretion
- Способ перекраски PNG (D-02).
- Где проходит граница «интерфейс / документ» для шрифта и как назвать токен шрифта документов (D-07); заменять ли JetBrains Mono на IBM Plex Mono в часах и кодах, чтобы осталось одно моноширинное семейство (вероятно, да).
- Точные кривые и длительности в пределах D-13; формы эффектов иконок при наведении.
- Как анимация закрытия окна уживается с диалогом несохранённых правок редактора (фаза 3, D-12 там).

### Deferred Ideas (OUT OF SCOPE)
- Перерисовка 10 иконок приложений в новом стиле: пользователь не выбрал (анимация существующих иконок при наведении входит в D-12).
- Новые иллюстрации пустых экранов: не выбраны.
- Обои «Схема станции» и «Молекулы»: не выбраны.
- Анимация покоя Вивьян («дышит»): не выбрана.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOOK-01 | Смена цвета интерфейса перекрашивает боковые панели, помощника и лого-паука | Section "LOOK-01": plain-`oklch()` + `--accent-hue` instead of relative colour syntax; PNG filter numbers measured on the real files; accent FOUC fix; logo `<img>` outside `.portia-mark` |
| LOOK-02 | Шрифт более «терминальный», но приятный глазу (варианты предложить заранее) | Section "LOOK-02": IBM Plex Mono weights/subsets verified in next/font data, 800 does not exist, glyph/width pitfalls |
| LOOK-03 | Новые SVG и SVG-анимации (варианты предложить заранее) | Section "LOOK-03": reduced-motion strategy (transitions, motion-as-enhancement), window exit state, icon hover draw, Vivian animation without remount, boot spider diagnosis |
</phase_requirements>

## Summary

The six existing plans are structurally sound (tracer slice per concern, sketches checkpoint before SVG, exit-state timer for windows, play-state gate for the spider). Research confirms most technical choices and finds **five things to change in a replan**:

1. **Do not use CSS relative colour syntax** (`oklch(from var(--teal) L C h)`) for the ~205 tints. Next 16's own browser baseline is Chrome 111 / Edge 111 / Firefox 111 / Safari 16.4, and relative colour syntax only reaches full support in Chrome 122, Firefox 128, Safari 18. The same result needs no new syntax: declare a plain number `--accent-hue` per theme and write `oklch(L C var(--accent-hue))` (oklch itself: Chrome 111, Firefox 113, Safari 15.4). Measured: with a single uniform hue only 4 of 139 distinct literals move more than OKLab dE 0.01 in the Portia theme, so "Portia looks as before" holds.
2. **The PNG filter approach (`hue-rotate` + `saturate`) is correct and measured**: the logo is exactly one flat teal plus greys; Vivian's chromatic pixels are 98% in one 10-degree hue bucket. Grey axis is untouched. But the `.portia-mark` selector misses two `<img src=".../portia-logo.png">` uses (employee fallback image, editor avatar placeholder); target by `src` attribute instead.
3. **The accent is applied after hydration** (`document.documentElement.dataset.accent` inside a `useEffect`, `components/portia-desktop.tsx:509`), so a user on Холодный/Янтарный/Тревога sees the boot screen and spider in teal for the first frames. No plan covers this; add a tiny pre-hydration script in `app/layout.tsx`.
4. **Reduced motion**: the global safety net at `app/portia.css:1073-1075` shortens animations but not `transition`. Add `transition-duration: .01ms !important` to that one block, and put every NEW motion rule inside `@media (prefers-reduced-motion: no-preference)` (motion as enhancement) instead of enumerating selectors in the "reduce" block. Do NOT zero `animation-delay` globally: `.boot-screen` uses `animation: boot-screen-failsafe 220ms ease 2.2s forwards` and would vanish at once.
5. **Two bugs inside plans**: (a) plan 06 restarts Vivian's squash by `key={assistantSquish}` remounting the 854 KB, 1536x1024 PNG on every click; restart the animation by alternating the keyframe name instead. (b) plan 05's `icon-spin` rotates the virus icon 90 degrees and claims "4-fold symmetric", but the inner details (`circle cx="10.5" cy="11"`, `path d="M13.6 13.2h.01"`) are not, so the icon visibly snaps back when the animation ends; use a twist-and-return keyframe.

Boot spider: the most likely cause is the OS setting (Windows 11 Settings > Accessibility > Visual Effects > "Animation Effects" off maps to `prefers-reduced-motion: reduce`), which makes `app/portia.css:1108-1110` set `animation: none` on the spider on purpose. This cannot be verified from here; the plan's diagnose-first order is right. The late-PNG gate in plan 06 is harmless and worth keeping.

**Primary recommendation:** keep plan structure; amend plan 01 (hue token instead of relative colour, `src`-selector filter, pre-hydration accent script), plan 03 (replace `font: 800`), plan 05 (virus twist keyframe, motion-as-enhancement), plan 06 (no `key` remount), and extend the global reduced-motion net with `transition-duration`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Accent recolour (tokens, tints) | Browser / Client (CSS custom properties on `html[data-accent]`) | Frontend Server (inline script in root layout sets attribute before paint) | Pure presentation; selection lives in localStorage (`portia-desktop-settings-v1`) |
| PNG tinting | Browser / Client (CSS `filter` on `<img>`) | CDN / Static (PNG assets unchanged) | D-02 forbids redrawing PNGs |
| IBM Plex Mono load | Frontend Server (`next/font/google` at build) | CDN / Static (self-hosted woff2) | Build-time download, no runtime request to Google |
| New wallpapers / badges / locks | Browser / Client (React-rendered inline SVG) | — | Static generators in `components/*.tsx`, `currentColor` |
| Window open/close/minimise | Browser / Client (React state `exiting` + CSS keyframes) | — | State needed to delay unmount; no animation library |
| Boot screen | Frontend Server (SSR markup) | Browser / Client (hydration gates animation) | Markup is in the SSR HTML; the descent must wait for the PNG |
| Vivian animations | Browser / Client (CSS on `<img>` + class/data-attr from React) | — | State in `portia-desktop.tsx` (`assistantOffended`, `activateAssistant`) |

## Standard Stack

No package is added in this phase. Everything uses what is installed. [VERIFIED: package.json read this session]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.4 | `next/font/google`, Turbopack build, lightningcss | already in project [VERIFIED: package.json] |
| react / react-dom | 19.2.6 | state for exit animations, boot gate | already in project [VERIFIED: package.json] |
| IBM Plex Mono via `next/font/google` | font-data of next 16.3.4 | UI face (D-05) | weights `["100","200","300","400","500","600","700"]`, subsets `["cyrillic","cyrillic-ext","latin","latin-ext","vietnamese"]`, **no 800, no variable axis** [VERIFIED: node_modules/next/dist/compiled/@next/font/dist/google/font-data.json] |
| Golos Text via `next/font/google` | same | `--doc` face (D-07) | weights `["400","500","600","700","800","900","variable"]`; already loaded variable (no `weight` given) [VERIFIED: font-data.json, app/layout.tsx:6] |
| IBM Plex Serif | same | `--serif` scientist records | already loaded |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `sharp` (present in node_modules as a Next dependency, not in package.json) | Throwaway scratch scripts to sample PNG pixels | Only in session scratch, never added to package.json [VERIFIED: `ls node_modules` shows `sharp`] |
| `lightningcss` (in node_modules, used by Next build) | Check what the build does to new colour syntax | Verified pass-through, see Pitfall 1 |
| `node --experimental-strip-types --test lib/*.test.ts` | CSS-source tests like plan 01's `lib/accent-theme.test.ts` | `npm test` ran green here: 13 pass [VERIFIED: ran this session on Node v24.21.0; package.json engines says `>=22.13.0 <23`] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `oklch(L C var(--accent-hue))` | `oklch(from var(--teal) L C h)` (plan 01) | relative syntax needs Chrome 122 / Firefox 128 / Safari 18; outside Next's baseline; no gain |
| `oklch(L C var(--accent-hue))` | `color-mix(in oklab, var(--teal) N%, #000)` | works from Chrome 111 / FF 113 / Safari 16.2, but mixes toward black so you can't keep each literal's own lightness and chroma; a different value per literal anyway |
| `oklch(L C var(--accent-hue))` | ~139 per-theme hex tokens (4 themes) | most robust but ~550 declarations; only worth it if a pre-2023 browser matters |
| CSS `filter` hue-rotate+saturate | layered PNGs + `mask-image` + `background-color: var(--teal)` | exact accent colour and lightness, but needs generated asset layers, an `<img>` becomes a stacked `<div>`, edge seams; D-02 allows it, not needed |
| CSS `filter` hue-rotate+saturate | inline SVG `<filter><feColorMatrix>` referenced as `filter: url(#id)` | a free 3x3 matrix can map the logo's single flat teal to the exact accent colour and leave the grey axis fixed; use only if the human-check says the filtered logo is too dull (see Open Question 2) |
| CSS `filter` | `mask-image` alone | impossible: a mask reads only alpha/luminance and cannot separate teal from black/white in the same image |

**Installation:** none. **Version verification:** versions read from `package.json`; no registry lookups needed because nothing is installed.

## Package Legitimacy Audit

No external packages are installed in this phase. Audit not applicable.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
localStorage "portia-desktop-settings-v1"
        |  (read synchronously)
        v
 <head> inline script (NEW) --whitelist--> <html data-accent="ice|amber|red|teal">   [before first paint]
        |                                          |
        |                                          v
        |                    app/portia.css  :root + html[data-accent] token blocks
        |                    --teal --teal-dim --teal-soft --desktop-glow --desktop-grid
        |                    --accent-hue (NEW)  --mark-filter  --assistant-filter
        |                                          |
        |             +----------------------------+------------------------------+
        |             v                            v                              v
        |   rgba(var(--desktop-glow),A)   oklch(L C var(--accent-hue))   img[src$=logo/assistant] { filter }
        |   (26 exact glow literals)      (~205 muted tints)              (hue-rotate + saturate chain)
        |
        v
 React hydration -> useEffect re-applies dataset (already exists) -> DesktopSettings state
        |
        +--> BootScreen: <img ref> complete?/onLoad -> .is-ready -> animation-play-state: running
        |        4 boot lines via CSS animation-delay, timer 1650 ms (unchanged)
        +--> openApp(appId, origin?) / closeApp / minimizeApp -> WindowState.exiting -> CSS class
        |        -> setTimeout(160|200 ms) -> finish* (real unmount of state), skipped under reduced motion
        +--> activateAssistant -> data-mood / is-speaking / is-offended -> CSS keyframes on <img>
```

### Recommended Project Structure
Unchanged from the plans: `app/layout.tsx`, `app/portia.css`, `components/portia-{desktop,icons,wallpaper}.tsx`, `lib/accent-theme.test.ts`. No new directories.

### Pattern 1: Accent hue token with plain oklch
**What:** one number per theme; every tint keeps its own lightness and chroma.
**When to use:** every turquoise literal with RGB chroma >= 20 that is not on the plan 01 exclusion list.
**Example:**
```css
/* Source: MDN oklch() (Chrome 111, Firefox 113, Safari 15.4) [CITED: github.com/mdn/browser-compat-data css/types/color.json, oklch] */
:root                  { --accent-hue: 180.4; }  /* #00bca6 */
html[data-accent="ice"]   { --accent-hue: 223.3; }  /* #7ec8e3 */
html[data-accent="amber"] { --accent-hue: 63.1;  }  /* #e8953f (plan 01 value) */
html[data-accent="red"]   { --accent-hue: 10.1;  }  /* #d94f6e (plan 01 value) */

.global-result:hover { border-color: oklch(.43 .052 var(--accent-hue)); }   /* was #39786d */
.personnel-profile-head { background: linear-gradient(130deg, rgba(var(--desktop-glow), .055), transparent 48%); }
```
Hue values were computed by my own sRGB-to-OKLCH script for those four hex colours in this session. Generate the `L C` pairs with a script (not by hand), round to 3 decimals, and emit `oklch(L C var(--accent-hue) / A)` when there is alpha. Do not use `calc(var(--accent-hue) + delta)`: preserving per-literal hue offsets (range 158..217 vs 180.4) would put some borders pink or orange in the red theme.

### Pattern 2: PNG tint by filter, selected by `src`
```css
/* every <img> that shows the spider, wherever it is used (portia-desktop.tsx:814,978,986,999,1004; portia-editor.tsx:940) */
img[src$="/portia-logo.png"] { filter: var(--mark-filter); }
/* higher specificity already wins for the grayscale placeholder: .media-empty > img[aria-hidden="true"] { filter: grayscale(1) } */
.assistant-button img { filter: var(--assistant-filter) brightness(.7); }
```
Reference values from my grid search on the real pixels (the executor must re-run its own, plan 01 Task 1 step 2 already says how). Matrices are the Filter Effects Level 1 ones applied to gamma-encoded sRGB, which is what CSS `hue-rotate()`/`saturate()` do:

| Theme | Logo `--mark-filter` | mean / max hue error | Vivian `--assistant-filter` | mean / max hue error |
|-------|----------------------|----------------------|-----------------------------|----------------------|
| ice (#7ec8e3, hue 223.3) | `hue-rotate(29deg) saturate(.5)` | 0.0 / 5.0 deg | `hue-rotate(20deg) saturate(.8)` | 1.1 / 51.8 deg |
| amber (#e8953f, hue 63.1) | `hue-rotate(-131deg) saturate(.75)` | 0.1 / 4.4 deg | `hue-rotate(-141deg) saturate(.6)` | 1.3 / 43.7 deg |
| red (#d94f6e, hue 10.1) | `hue-rotate(-180deg) saturate(.7)` | 0.0 / 4.1 deg | `hue-rotate(171deg) saturate(.7)` | 0.8 / 35.8 deg |

The large "max" for Vivian comes from a tiny share of off-bucket pixels (below), not from the main body.

### Pattern 3: Motion as enhancement
```css
@media (prefers-reduced-motion: no-preference) {
  .app-window.is-closing { animation: window-close 160ms cubic-bezier(.4,0,1,1) forwards; }
  .desktop-assistant[data-mood] .assistant-button img { animation: assistant-squish-a 260ms cubic-bezier(.34,1.56,.64,1); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
```
Reasoning: a forgotten selector in an enumerated "reduce" block leaks motion; a rule that exists only under `no-preference` cannot. Existing base rules (`.app-window { animation: window-open }`, helix drift, spider) stay where they are with their existing reduce lines.

### Pattern 4: Pre-hydration accent (new)
```tsx
// app/layout.tsx, inside <html> (it already has suppressHydrationWarning), as first child of <head>
<head>
  <script dangerouslySetInnerHTML={{ __html:
    `try{var a=JSON.parse(localStorage.getItem("portia-desktop-settings-v1")||"{}").accent;` +
    `if(["teal","ice","amber","red"].indexOf(a)>-1)document.documentElement.dataset.accent=a}catch(e){}` }} />
</head>
```
The string is a constant (no user data is interpolated); the value is whitelisted before use. No CSP is configured in `next.config.ts`, `netlify.toml` or `proxy.ts` [VERIFIED: grep for content-security/script-src/headers returned nothing]. The wallpaper id does not need this (the wallpaper is an SVG element, not the first paint). The list of four ids must match the `SettingGroup` at `components/portia-desktop.tsx:958` [VERIFIED: `['teal','Portia'],['ice','Холодный'],['amber','Янтарный'],['red','Тревога']`].

### Pattern 5: Restart an animation without remounting
```css
.desktop-assistant[data-squish="a"] .assistant-button img { animation: squish-a 260ms cubic-bezier(.34,1.56,.64,1); }
.desktop-assistant[data-squish="b"] .assistant-button img { animation: squish-b 260ms cubic-bezier(.34,1.56,.64,1); }
@keyframes squish-a { 35% { scale: var(--squish-x) var(--squish-y); rotate: var(--squish-tilt); } 70% { scale: .98 1.03; } 100% { scale: 1; rotate: 0deg; } }
@keyframes squish-b { /* identical body, different name */ }
```
```tsx
data-squish={assistantSquish % 2 ? "a" : "b"}   // flips each click; changing animation-name restarts the animation
```
Define the body once through a shared custom-property-driven rule or generate the duplicate; this replaces `key={assistantSquish}` in plan 06 Task 2.

### Anti-Patterns to Avoid
- **`oklch(from var(--teal) …)`** for ~205 declarations: a declaration containing `var()` is accepted at parse time, so on a browser without relative colours it becomes "invalid at computed-value time" and silently falls to inherited/initial. There is no cascade fallback line that survives. (If relative syntax is ever used, gate it in `@supports (color: oklch(from red l c h))`.)
- **SMIL (`<animate>`, `<animateTransform>`) in new SVG**: not stopped by `@media (prefers-reduced-motion)` or `animation: none`. Use CSS keyframes only (the project already does).
- **Rotating SVG children with CSS without `transform-box: fill-box; transform-origin: center`**: the default origin is the viewBox origin, particles in the "Клетки" wallpaper would orbit the top-left corner.
- **Zeroing `animation-delay` in the reduce block**: breaks `boot-screen-failsafe` (2.2 s delay) and stagger logic.
- **Enumerating every new motion selector inside a reduce block** (see Pattern 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-theme tints | 139 x 4 hand-written hex values | script-generated `oklch(L C var(--accent-hue))` | one variable per theme; test that no turquoise literal remains (plan 01 test (f)) |
| Font loading | `@font-face` + manual files | `next/font/google` (already used) | self-hosted at build, preload, size-adjust fallback [CITED: node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md:13] |
| Colour math in tests | ad-hoc approximations | one small OKLCH/hue-rotate helper (as in plan 01 Task 1 step 5) | the same code verifies PNG hue targets and "Portia unchanged" |
| Exit animations | an animation library | `exiting` state + CSS keyframes + `setTimeout` equal to the CSS duration | timeout, not `animationend`: under reduced motion or in a hidden tab `animationend` may never fire (plan 05 already says this) |
| Hover "draw" on icons | JS path-length measurement | `stroke-dasharray: 80` + `stroke-dashoffset` keyframe | every icon path in `components/portia-icons.tsx` is far shorter than 80 user units (largest: `sheet` rect, 16x16 with rx 1.5, about 62); the multi-subpath `settings`/`virus` paths total about 36 and 28 [VERIFIED: read lines 1-94 this session] |
| Window-from-icon origin | animation library FLIP | `transform-origin` in px set in `useLayoutEffect` + individual `scale` property | plan 05; `scale` composes with the inline `transform` that window geometry uses |

**Key insight:** this phase is CSS-heavy, and every hand-rolled helper (colour conversion at runtime, JS tweening) is unnecessary: the browser already has `oklch()`, `filter`, individual transform properties, and `@media` queries. The only code that truly needs JS is the exit-state timers and the boot gate.

## Common Pitfalls

### Pitfall 1: Relative colour syntax outside the project's browser baseline
**What goes wrong:** ~205 declarations become invalid on Chrome < 122, Firefox < 128, Safari < 18 (and on Safari 16.4-17 the `h` channel only works with units).
**Why it happens:** Next 16 builds for Chrome 111 / Edge 111 / Firefox 111 / Safari 16.4 and does not down-level `var()`-containing colours.
**Evidence:** [VERIFIED: node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:124 `| Browsers      | Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+ |`]; [CITED: github.com/mdn/browser-compat-data css/types/color.json, `oklch.relative_syntax`: Chrome 122 (119-121 partial: `l` resolves to 0-100), Firefox 128, Safari 18 (16.4-17 partial: "calculations with `h` channel values do not work correctly, requiring values to be specified with units (`deg`)")]; plain oklch: Chrome 111, Firefox 113, Safari 15.4 [CITED: same file]. Plan 01 assumption A3 ("Safari before 16.4") is therefore incomplete.
**How to avoid:** Pattern 1.
**Build behaviour:** [VERIFIED: ran `lightningcss.transform` from node_modules with targets chrome/edge/firefox 111, safari 16.4] `oklch(.42 .03 var(--accent-hue))`, `oklch(.42 .03 var(--accent-hue) / .5)`, `rgba(var(--desktop-glow), .09)` and `oklch(from var(--teal) .42 .03 h)` all pass through unchanged. A static `oklch(.42 .03 181)` is expanded to `#3b534e` plus a `lab()` fallback line, which is another reason to keep the hue as a variable.

### Pitfall 2: Muted teal-greys the plan leaves green
**What goes wrong:** the plan converts only literals with RGB chroma >= 20 (248 occurrences, 139 distinct values, found by my own scan with the same rule). 174 more `#rrggbb` literals with chroma 6-19 (near-black panels, `#07110f` x8, `#0b1714`, `#101e1b`, ...) and `:root --bg/--panel/--panel-2` stay green-black. On the red or amber theme, `--desktop-base` changes but panels stay green-black.
**Why it happens:** threshold chosen so "black stays black".
**How to avoid:** keep the threshold as a script parameter; the plan's human-check already asks the user. If the user says "still green", re-run with chroma >= 6 (same mechanism, oklch chroma around .01-.02 at the accent hue). Also consider `--bg`, `--panel`, `--panel-2` per-theme tokens (3 tokens x 3 themes).
**Warning signs:** red theme windows look "military green" against a red-brown desktop.

### Pitfall 3: Logo `<img>` outside `.portia-mark`
**What goes wrong:** `EmployeeImage` falls back to `/assets/portia-logo.png` (`components/portia-desktop.tsx:1004`) and the editor shows it as an avatar placeholder (`components/portia-editor.tsx:940`); neither has `.portia-mark`, so both stay teal. `.media-empty > img[aria-hidden="true"]` (portia-desktop.tsx:1383) is intentionally `grayscale(1)` at `opacity:.08` and must stay as is.
**How to avoid:** `img[src$="/portia-logo.png"]` (Pattern 2). Do not tint the favicon (`portia-virus-icon.png`, plan 01 A4 is right).

### Pitfall 4: Accent flash on load
**What goes wrong:** `data-accent` is written in a `useEffect` after hydration, and the stored settings are restored through `window.setTimeout(..., 0)` [VERIFIED: components/portia-desktop.tsx:398-409, 508-512]. The SSR boot screen therefore paints teal first.
**How to avoid:** Pattern 4.

### Pitfall 5: IBM Plex Mono has no weight 800 and is wider than Golos
**What goes wrong:** `font: 800 …` appears 9 times in `app/portia.css` [VERIFIED: grep]; with 400/500/600/700 loaded the browser silently renders 700 (no visual difference, harmless but misleading). Weights used elsewhere: 400, 500 (7 uses), 600 (9), 700 (66+). Monospace at 11px uppercase with `letter-spacing` and 20 `white-space: nowrap` rules, 18 declarations of 7-10px text, will widen taskbar entries, tabs and titlebar paths.
**How to avoid:** `weight: ["400","500","600","700"]`; replace `800` by `700` in the same pass; the fit-audit task in plan 03 is the right place; verify at 1440x900, 900, 520, 430 and 375 widths (the file's media-query breakpoints are 1050, 900, 520, 430). Glyphs outside Plex Mono (the `⌕ ✎ ✓ ≡ □ ―` characters used in TSX/CSS) fall back to a system font [ASSUMED: Plex Mono lacks them; ✓ ✎ ⌕ were already outside Golos]. Build-time font download requires network access at `next build` [CITED: font.md:13 "downloaded at build time"].

### Pitfall 6: React misses `onLoad` of a server-rendered image
**What goes wrong:** the boot `<img>` is in the SSR HTML and may finish loading before hydration attaches `onLoad`; a gate that waits only for `onLoad` never opens.
**How to avoid:** plan 06 already checks `markRef.current?.complete` in an effect and also sets the flag in `onError`; keep both. Additionally call `preload("/assets/portia-logo.png", { as: "image" })` from `react-dom` in the root layout (React 19 resource preloading) so the PNG request starts with the HTML. Without JS the gated spider would stay invisible; the page has a `javascript-warning` banner at z-index 998 below the boot screen (z 999) and a 2.2 s failsafe that hides the boot screen, so this is acceptable.

### Pitfall 7: Boot spider "does not descend" is probably the OS setting
`.boot-core > .portia-mark { animation: spider-descend 900ms … both }` (portia.css:586) and the reduce block `.boot-core > .portia-mark, .boot-thread, .app-window { animation: none; }` (portia.css:1108-1110) show the spider already in its final place. MDN names the OS setting: Windows 11 "Settings > Accessibility > Visual Effects > Animation Effects"; Windows 10 "Show animations in Windows" [CITED: developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion]. Whether the user's browser reports `reduce` is [ASSUMED]; one-line check in DevTools: `matchMedia("(prefers-reduced-motion: reduce)").matches`. Note the same block also disables `window-open`, so if the user also never sees windows animate, that is the same cause. Report it, do not "fix" it (D-10).

### Pitfall 8: Virus-icon spin snaps back
`@keyframes icon-spin { from { rotate: 0deg } to { rotate: 90deg } }` (plan 05) ends with no fill, so the icon returns to 0 degrees. The outer spokes are 4-fold symmetric but `circle cx="10.5" cy="11" r="1.1"` and `path d="M13.6 13.2h.01"` are not [VERIFIED: components/portia-icons.tsx:15-16]. Use `@keyframes icon-twist { 50% { rotate: 18deg } }` (returns to rest by itself) or a full `360deg` in 250 ms.

### Pitfall 9: Vivian PNG is heavy
`public/assets/portia-assistant.png` is 854,844 bytes, 1536x1024 (header read), displayed at `clamp(76px, 8.4vw, 104px)` [VERIFIED: portia.css:631-640]. Remounting it per click (`key`) risks a decode flash; D-14 forbids changing the PNG, so only avoid extra work (Pattern 5). The parent `.desktop-assistant` has `filter: drop-shadow(...)`, so animated children repaint through that filter each frame; negligible at 100 px, but do not add more filtered ancestors.

### Pitfall 10: Window exit details
Plan 05's design (timer + `exiting` state + reduced-motion shortcut + cancel on reopen + cleanup) is correct. Add: (a) export the two durations (160, 200) as TS constants next to the CSS values with a comment, the only coupling in the design; (b) apply `pointer-events: none` while exiting (plan does) and skip `exiting` windows when counting `openCount` for cascade positions (`openApp` filters open && !minimized at portia-desktop.tsx:551); (c) the unsaved-changes guard of phase 3 must run before `requestExit`, plan 05 already leaves a comment; (d) `scale` individual property composes with the inline `transform: "none"` set in `geometryStyle` [VERIFIED: portia-desktop.tsx:1238-1244], individual transform properties are supported in Chrome 104+, Firefox 72+, Safari 14.1+ [ASSUMED from memory, well inside the baseline].

## Code Examples

### Filter chain order for Vivian (keeps existing offended grey)
```css
/* Source: derived from plan 01 + measured values above */
.assistant-button img { filter: var(--assistant-filter) brightness(.7); }
.assistant-button:hover img, .assistant-button:focus-visible img { filter: var(--assistant-filter) brightness(.7) drop-shadow(0 0 8px rgba(var(--desktop-glow), .2)); }
.desktop-assistant.is-offended .assistant-button img { filter: var(--assistant-filter) brightness(.7) grayscale(.85) saturate(.4); }
```

### Boot gate (React 19)
```tsx
// Source: plan 02-06 Task 1, keep as written
const [markReady, setMarkReady] = useState(false);
const markRef = useRef<HTMLImageElement>(null);
useEffect(() => {
  if (!markRef.current?.complete) return;
  const t = window.setTimeout(() => setMarkReady(true), 0);
  return () => window.clearTimeout(t);
}, []);
```

### Font load (layout.tsx)
```tsx
// Source: next/font docs [CITED: node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md:112-127]
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-plex-mono", display: "swap" });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `hsl(var(--h) s l)` with var hue | `oklch(L C var(--hue))` | oklch: Chrome 111 / Safari 15.4 / FF 113 | perceptually even tints at a fixed L and C |
| `oklch(from X …)` relative colour | still new | Chrome 122, FF 128, Safari 18 | not usable inside Next 16's stated baseline |
| JS-driven exit animation libs | state + CSS + timer | — | no dependency |
| `transform: scale()` shorthand in keyframes | individual `scale`/`rotate`/`translate` | Chrome 104 / Safari 14.1 / FF 72 | compose with window-position transforms (already used by `window-open`) |

**Deprecated/outdated:** Unbounded and JetBrains Mono in `app/layout.tsx` (removed by D-06 / plan 03); the `.boot-progress` bar (replaced by lines).

## Runtime State Inventory

Not a rename/refactor/migration phase: omitted. The only persisted state touched is the existing `portia-desktop-settings-v1` localStorage key (read-only here; the pre-hydration script only reads and whitelists it).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The user's Windows has "Animation Effects" off, so the browser reports `prefers-reduced-motion: reduce` and the spider is static on purpose | Pitfall 7 | If false, the cause is the late PNG (plan 06 gate fixes it) or something not yet seen; the gate is harmless either way |
| A2 | Plex Mono lacks glyphs `⌕ ✎ ✓ ≡ □ ―`; they fall back to a system font | Pitfall 5 | Symbols look inconsistent; fix by turning them into the existing SVG icons |
| A3 | Remounting the big PNG on each click would flash or cost a decode | Pitfall 9 | Low; Pattern 5 is free either way |
| A4 | Individual transform property support versions (Chrome 104, FF 72, Safari 14.1) | Pitfall 10 | None; far inside the Chrome 111 / Safari 16.4 baseline |
| A5 | A hue-matched but duller logo (ice logo L about 0.64 vs UI accent L 0.79) is acceptable to the user | Pattern 2 | User asks for brighter logo; fallback is the SVG `feColorMatrix` route |
| A6 | The retuned amber `#e8953f` and red `#d94f6e` from plan 01 are accepted | Pattern 1 | Both are Claude's pick under D-03; plan 01 human-check already asks |

## Open Questions

1. **Should near-black panels follow the accent (chroma 6-19, 174 literals plus `--bg/--panel/--panel-2`)?**
   - What we know: the plan leaves them (A1 of plan 01); `--desktop-base`/`--desktop-deep` already change per theme.
   - What's unclear: whether the user reads the result as "still turquoise".
   - Recommendation: keep the plan's threshold, run the generator with the threshold as a parameter, and make the human-check explicit about window backgrounds in the red theme. Re-run at chroma >= 6 only if the user says yes.
2. **Is a hue-matched but darker logo (see Pattern 2 table: mean L 0.64 / 0.66 / 0.66 vs accent L 0.79 / 0.74 / 0.62) good enough?**
   - What we know: D-02 asks only for the hue to match; grey axis is unchanged; no `brightness()` allowed.
   - Recommendation: ship the filter; if the user wants exact colour, switch the logo (single flat teal) to an inline SVG `feColorMatrix` per theme.
3. **Does the user's browser report reduced motion?** Cannot be known here; plan 06 Task 1's diagnose-first step and a DevTools one-liner answer it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm test`, scratch scripts | yes | v24.21.0 (package.json engines `>=22.13.0 <23`; `npm test` still passes 13/13) | — |
| `sharp` in node_modules | scratch PNG sampling (plan 01) | yes | present | write a raw PNG decoder |
| `lightningcss` in node_modules | verify build behaviour | yes | present | — |
| Network at `next build` | download IBM Plex Mono | assumed yes (Netlify build and dev machine) [ASSUMED] | — | none; `next/font/google` fails the build offline |
| Headless browser / Playwright | automatic reduced-motion and fit checks | not checked, not installed per package.json | — | manual human-checks already in the plans |

**Missing dependencies with no fallback:** none for planning.

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high) [VERIFIED: .planning/config.json]. The phase touches presentation only.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — (lock icons on scientist records are decoration; access logic is unchanged and must not be inferred from them) |
| V5 Input Validation | yes | accent and wallpaper ids come from localStorage: whitelist in the pre-hydration script; keep the plan 04 behaviour that an unknown wallpaper id renders the default web wallpaper |
| V6 Cryptography | no | — |

### Known Threat Patterns for Next.js + static CSS/SVG

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered localStorage value injected into the DOM | Tampering | `dataset.accent = value` is attribute-escaped; plus whitelist in the inline script; the inline script string is a constant |
| Inline script and CSP | Tampering | no CSP exists today [VERIFIED: grep]; if one is added later the inline script needs a nonce or must move to `next/script beforeInteractive` |
| Runtime third-party font request | Information disclosure | `next/font/google` self-hosts at build; no requests to Google from the browser [CITED: font.md:13] |
| `dangerouslySetInnerHTML` for SVG | Tampering / XSS | not needed: all new SVG is static JSX in `components/*.tsx` |

## Validation Architecture

Skipped: `workflow.nyquist_validation` is `false` in `.planning/config.json`. Existing automated check: `npm test` (13 tests); plan 01's `lib/accent-theme.test.ts` is a CSS-source test and fits that runner. If kept, update test (f) and the compiled-CSS grep in plan 01 Task 2 `<verify>` (`oklch\(from var\(--teal\)` count >= 150) to the new `var(--accent-hue)` form, add `--accent-hue` to test (a), and add a Portia round-trip check (each converted literal, rendered at hue 180.4, within OKLab dE 0.02 of the old colour; measured now: 135 of 139 within 0.01, outliers are `rgb(22,122,77)` = `#167a4d`, `rgb(0,255,255)`, `rgb(133,188,200)` and `rgb(26,44,49)`).

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` read by script: IBM Plex Mono / Golos Text / Unbounded weights and subsets
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:124` and `01-installation.md:57-60`: Next 16 browser baseline
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`: self-hosting, weight rules
- lightningcss run from `node_modules` against the Next default targets (this session)
- Pixel analysis of `public/assets/portia-logo.png` (650x768) and `portia-assistant.png` (1536x1024) via `sharp` in a scratch script (this session)
- `app/portia.css`, `app/layout.tsx`, `components/portia-{desktop,icons,wallpaper}.tsx`, `lib/portia-content.ts:33-72` (classification `danger`/`spread`/`escapeRisk` each with levels 1-3: Гефест, Протей, Апейрон; Номос, Тезей, Абраксас; Предупреждение, Риск, Эснов), `.planning/config.json`

### Secondary (MEDIUM confidence)
- MDN browser-compat-data `css/types/color.json` (oklch, relative_syntax, color-mix) fetched from raw.githubusercontent.com
- MDN `@media/prefers-reduced-motion` page (Windows setting names)

### Tertiary (LOW confidence)
- Web search results on relative colour syntax (Chrome 119 blog post; one low-quality Japanese glossary with conflicting Firefox version) were used only to point at the MDN data above and are not relied on

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing installed; font data read from the installed Next
- Architecture: HIGH for CSS/token and exit-state design; MEDIUM for perceived colour quality (needs the plans' human-checks)
- Pitfalls: HIGH for 1, 3, 4, 5 (weights), 8; MEDIUM for 7 (user setting unknown), 9

**Research date:** 2026-10-13
**Valid until:** 2026-11-12 (stable CSS features; Next 16.3.x pinned)
