# Phase 18: Рабочий стол, окна и живые анимации - Pattern Map

**Mapped:** 2026-11-02
**Files analyzed:** 14 (все modify; новых файлов по сути нет, кроме тестов/candidates)
**Analogs found:** 14 / 14 (analog = сам файл или соседний). Все пути проверены как tracked (app/portia.css, lib/window-geometry.ts, components/portia-wallpaper-spider.tsx; остальные в components/, lib/, tests/ - обычный tracked source).

Нет RESEARCH.md; источник - 18-CONTEXT.md + 18-UI-SPEC.md. Номера строк - на момент 2026-11-02.

## File Classification

| File | Role | Data Flow | Analog | Match |
|------|------|-----------|--------|-------|
| `lib/accent-boot.ts` | config/utility (head script, modes) | transform | сам файл (21 строка) | exact |
| `lib/accent-theme.test.ts` (extend) | test | request-response | сам файл, строки 221-290, 500-507 | exact |
| `components/portia-desktop.tsx` (settings read, boot timer 434-438, `openApp` 839-860, group `motion: motionModes` строка 49) | component | event-driven | сам файл | exact |
| `components/portia-desktop-shortcuts.tsx` (`useShortcutAnimation` 56-70, `DraggableDesktopIcon`) | hook/component | event-driven | сам файл | exact |
| `components/portia-desktop-window.tsx` (phone: matchMedia 94, 117) | component | event-driven | сам файл | exact |
| `components/portia-wallpaper-spider.tsx` | component (rAF loop) | streaming | сам файл | exact |
| `components/portia-wallpaper.tsx` | component | transform | сам файл | exact |
| `components/portia-editor-dossier.tsx` (строка 55 читает prefers-reduced-motion) | component | event-driven | сам файл | exact |
| `lib/window-geometry.ts` + `.test.ts` | utility | transform | сам файл | exact |
| `lib/window-open.ts` + `window-open.test.ts` (nod: чистая функция/флаг) | utility | transform | `windowAppears` / `openedWindow` | role-match |
| `app/portia.css` | config (styles) | transform | сам файл | exact |
| `lib/wallpaper-web.ts` + test (волны/секторы паука) | utility | transform | сам файл | exact |
| `tests/e2e/visual-candidates/motion.spec.ts`, `desktop.spec.ts` | test | request-response | `tests/e2e/visual/motion.spec.ts` | exact |
| `lib/accent-theme.test.ts` / `lib/portia-desktop.test.ts` (settings storage cases) | test | CRUD | `lib/accent-theme.test.ts` | exact |

Не трогать: `tests/e2e/visual/*` и `__screenshots__` (подписанные); owner paths.

## Pattern Assignments

### `lib/accent-boot.ts` (STAB-MOTION-01, STAB-DESK-05, D-10/D-11)

Текущий код (целиком, строки 9-21):
```ts
export const motionModes = ["on", "off"] as const;
export const spiderModes = ["on", "off"] as const;
export const bootSeenStorageKey = "portia-boot-seen-v1";
export const accentBootScript =
  `(function(){var d=document.documentElement,s={};try{s=JSON.parse(localStorage.getItem(${JSON.stringify(desktopSettingsStorageKey)})||"{}")||{}}catch(e){}` +
  `...` +
  `d.dataset.motion=s.motion==="off"?"reduce":"full";` +
  `d.dataset.spider=s.spider==="off"?"off":"on";` +
  `try{if(sessionStorage.getItem(${JSON.stringify(bootSeenStorageKey)}))d.dataset.boot="seen"}catch(e){}})()`;
```
Паттерн изменения: `motionModes = ["on","reduced","off"]`; скрипт `d.dataset.motion=s.motion==="off"?"off":s.motion==="reduced"?"reduced":"full"` (unknown -> full; interpolation рантайм-значений в строку запрещено, см. комментарий строки 1-3). Значение `"reduce"` исчезает (классифицировать каждое css-правило, см. таблицу ниже). Ключ `portia-desktop-settings-v1` и `portia-boot-seen-v1` не менять.

Чтение настроек в `portia-desktop.tsx` строка 49 (`motion: motionModes`) - поштучный валидатор по спискам; новое значение подхватится автоматически, проверить место, где `motion` сопоставляется с `data-motion` в клиенте (grep `dataset.motion` в portia-desktop.tsx) и `SettingGroup` значения `['on', ...]` (тест строка 289 сверяет порядок `motionModes` с `['id',` в JSX группы - добавить `['reduced', 'Уменьшены']` в том же порядке).

**Boot once per tab** (portia-desktop.tsx 434-438, уже реализовано):
```ts
const bootSeen = document.documentElement.dataset.boot === "seen";
... if (!bootSeen) try { window.sessionStorage.setItem(bootSeenStorageKey, "1"); } catch {}
}, bootSeen ? 0 : 1650);
```
Нужно: для `reduced`/`off` не рендерить boot вообще (D-12) - условие по `dataset.motion !== "full"`.

### Тесты настроек: `lib/accent-theme.test.ts`

Harness `runBoot(saved, systemReduce, sessionGet)` (строки ~221-240) исполняет `accentBootScript` над фейковым dataset. Паттерн кейсов (273-279):
```ts
const saved = (motion?: string) => () => JSON.stringify({ accent: "teal", motion });
assert.equal(runBoot(saved(), true).motion, "full");
assert.equal(runBoot(saved("system"), true).motion, "full");
assert.equal(runBoot(saved("off"), false).motion, "reduce");   // -> "off" после фазы
assert.equal(runBoot(() => { throw new Error("storage blocked"); }, true).motion, "full");
```
Обновить: `"off"` -> `"off"`, добавить `saved("reduced")` -> `"reduced"`, повреждённое (`123`, `{}`, `null`) -> `"full"` и соседние поля (`accent`, `spider`) не затронуты (кейс 500-504 как образец для spider: `runBoot(() => JSON.stringify({ spider: "invalid" })).spider === "on"`). Строки 282-284: проверка, что все селекторы внутри `@media (prefers-reduced-motion` начинаются с `html:not([data-motion])` - при удалении блоков (D-10) заменить на проверку отсутствия блоков или на no-op; строка 251 (`blocked.motion === "reduce"`) тоже обновить. Строки 12/492+: тесты читают `portia-wallpaper-spider.tsx` как исходник (regex по тексту) - после правок прогнать `npm test`.

### `app/portia.css` - инвентарь reduced-motion (обязательный список)

Все `html[data-motion="reduce"]` и `@media (prefers-reduced-motion)` (номера строк). Классификация предложена планировщику: OFF = только off; BOTH = reduced+off; RED = только reduced.

| Строка | Правило | Предложение |
|--------|---------|-------------|
| 496 | комментарий quest toast | обновить текст |
| 510 | `.promotion-retake-toast` animation none | BOTH (или off) |
| 831 | `.boot-lines p` fade-in 160ms | boot не рендерится в reduced/off - можно удалить |
| 1368 | комментарий "reduce or full" | переписать на full/reduced/off |
| 1371 | глобальный `html[data-motion="reduce"] *` duration .01ms, iteration 1 | OFF (для reduced нужны короткие отклики окон/ярлыков, D-11) |
| 1373 | `.desktop-wallpaper, *, .wallpaper-spider` animation none | BOTH (обои/паук без цикла) |
| 1374-1375 | `[data-motion="reduce"] .wallpaper-spider, [data-spider="off"] .wallpaper-spider { display:none }` | паук сидит видимым в reduced/off (D-07, спека): убрать reduce из display:none, оставить только `data-spider="off"` |
| 1376 | `.wallpaper-web path { stroke-dashoffset: 0 }` | BOTH |
| 1377 | `.wallpaper-web-dew { opacity: 1 }` | BOTH |
| 1382-1383 | `@media (prefers-reduced-motion: reduce) { html:not([data-motion]) ... }` | D-10: удалить/no-op |
| 1399-1400 | `.wallpaper-layer.is-entering/is-leaving` 300ms fade | 1399-1400 -> RED (300ms); OFF -> мгновенно (новое правило `off`) |
| 1412 | `html[data-motion="full"][data-spider="off"] .wallpaper-web` web-idle-drift | D-09: убрать `[data-spider="off"]`, применять при full для обоих |
| 1514 | `[reduce] .app-window` fade-in 160ms !important | RED (opacity-only <=160ms); OFF -> none |
| 1515 | `.app-window:is(.is-closing,.is-minimizing)` fade-out 120ms | RED; OFF мгновенно |
| 1526 | `[reduce] .doc-open` fade-in 160ms | RED |
| 1532 | `[reduce] .content-fade` duration var(--motion-fast) | RED (OFF: 0) |
| 1642 | `[reduce] .assistant-bubble` fade-in 160ms | RED; OFF none |
| 1644-1646 | vivian-soft-a/b, fade-in 280ms | RED (<=160ms по спеке); OFF none/мгновенно |
| 1681 | `[reduce] :is(.boot-core > .portia-mark, .boot-thread)` fade-in 200ms | удалить вместе с boot |
| 1860 | `[reduce] .promotion-card, .promotion-qualification-runner, .icon-promotion-arrow` animation none | BOTH |
| 1861-1862 | `@media (prefers-reduced-motion: reduce) { html:not([data-motion]) .promotion-card ... }` | D-10: удалить/no-op |

Комментарии строк 1368-1371 и 1380-1381 описывают старую модель; тест accent-theme (282-284) завязан на их структуре.

Все `html[data-motion="full"]` блоки (507, 509, 830, 1409, 1426, 1435, 1451-1453, 1466-1468, 1484, 1511-1513, 1524-1525, 1535-1541, 1552-1599, 1634-1641, 1759-1760, 1841) остаются как "только в `on`"; reduced получает короткие отклики через отдельные RED-правила (при `reduced` `full`-селекторы не сработают, значит нужны явные `html[data-motion="reduced"]` для окон/ярлыков).

**Ярлыки (1552-1599)** - паттерн, который унифицировать (D-01..D-04): общий префикс селектора
```css
html[data-motion="full"] :is(.desktop-icon.is-icon-animating .desktop-icon-symbol, .start-panel > button.is-icon-animating .start-panel-icon)[data-icon="virus"] .icon-virus-scan { transform-box: view-box; transform-origin: 12px 12px; animation: icon-virus-scan 640ms cubic-bezier(.2,.72,.25,1) both; }
html[data-motion="full"] ... [data-icon="employees"] svg > :nth-child(-n+2) { animation: icon-hop 460ms var(--ease-out); }
```
Длительности сейчас 420-640ms, произвольные `cubic-bezier(.2,.72,.25,1)` в 1558-1562 и `(.2,.85,.25,1)` в 1589 - заменить на `var(--ease-out)/var(--ease-in)` (спека 158). Спека: цикл 560ms, stagger <=90ms.

**Паук (1417-1426):** `.wallpaper-spider-dark { fill: color-mix(in oklab, var(--teal) 12%, #020706) }` (1421) уже подходит под D-07; добавить обводку/opacity:1. Строка 1426 `fade-in 600ms ease-out 1.8s both` - при opacity 1 проверить.

**Формы редактора (D-15)** - копировать из 524-525:
```css
.broadcast-grid { display: grid; gap: 12px; margin-top: 28px; }                       /* 436 */
@media (min-width: 901px) {
  .broadcast-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 340px)); align-items: start; }
  .broadcast-grid > .broadcast-empty { grid-column: 1 / -1; }
}
```
(проверить, что 524-525 внутри `@media (min-width: 901px)`, открывающая строка выше). Применить к контейнерам форм "Информация/Справочник/Сводка" в `components/portia-editor*.tsx`; `.recommendation-order-list`, `.access-editor-list` не менять.

**Phone окна (D-16):** `.document-app { height: calc(100svh - 142px) }` (строки 1387-1389) - образец `100svh` внутри `@media (max-width: 900px)`. `portia-desktop-window.tsx` строки 94/117 уже блокируют drag/resize при `matchMedia("(max-width: 900px)")`:
```ts
if (locked || state.maximized || window.matchMedia("(max-width: 900px)").matches) return;
```

### `components/portia-desktop-shortcuts.tsx` - цикл ярлыка (D-02, D-04)

Текущий хук (строки 56-70) снимает класс по таймеру 760ms, запуск по `onPointerEnter`/`onFocus`:
```ts
const shortcutAnimationMs = 760;
function useShortcutAnimation() {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const play = useCallback(() => {
    if (timer.current !== null) return;      // повторный trigger игнорируется - сохранить
    setPlaying(true);
    timer.current = window.setTimeout(() => { setPlaying(false); timer.current = null; }, shortcutAnimationMs);
  }, []);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  return { playing, play };
}
```
Спека требует снятие по `animationend`; но в portia-desktop.tsx 902 комментарий "A timer, not animationend: in a hidden tab the animation event may never fire" - паттерн: оставить таймер как failsafe (подогнать до цикла <=700ms + запас) и/или добавить `onAnimationEnd`. Phone: добавить `onPointerDown`/`onClick` -> `play()` и сразу `onActivate`. `StartPanelButton` (строки 73-77) использует тот же хук - менять синхронно (селекторы CSS общие для `.desktop-icon` и `.start-panel > button`).

### `components/portia-desktop.tsx` - `openApp` кивок (D-14)

Точка (839-860). `windowAppears(windows[appId])` уже различает "появляется" и "уже видно":
```ts
const openApp = (appId: AppId, origin?: OpenOrigin) => {
  if (qualificationLocked && appId !== "promotion") return;     // кивок не запускать при блокировке
  if (windowAppears(windows[appId])) bounceTaskbarEntry(appId);
  ...
```
Паттерн для кивка: если `!windowAppears(windows[appId])` - выставить временный класс (напр. `is-nodding`) на окно, снимать по таймеру (см. `bounceTaskbarEntry`, `TASKBAR_BOUNCE_MS` ~строки 825-837 - копировать структуру таймера/очистки), CSS: `html[data-motion="full"] .app-window.is-nodding { animation: window-nod 240ms var(--ease-out) }` с `translate` по Y ~2px. Тест-образец: `lib/window-open.test.ts` для чистой логики.

### `components/portia-wallpaper-spider.tsx` (STAB-MOTION-03/04, D-06..D-09)

Константы (строки 18-51): `TURN_TIME = 0.22`, `MAX_DT = 0.05`, `GAIT_A = ["L1","R2","L3","R4"]`, `LEG_SWING_BY_PAIR`, `BODY_BOB`, `PULSE_SLOTS = 8`, `STEP_PEAK = 0.34`, `LANE_SETTLE_TIME`, `THREAD_LANE_OFFSET`. Не менять скорость; сглаживать поворот (TURN_TIME) и волны ставить по обе стороны (искать код с `PULSE_SLOTS`/`STEP_PEAK`, grep перед правкой).

Режимы - ЕДИНСТВЕННОЕ чтение системной настройки в TS-ходе (удалить по D-10):
```ts
63:  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
212: const motionOn = () => (root.dataset.motion ? root.dataset.motion === "full" : !reduceQuery.matches);
244: watcher.observe(root, { attributes: true, attributeFilter: ["data-motion", "data-spider"] });
246: reduceQuery.addEventListener("change", sync);
253: reduceQuery.removeEventListener("change", sync);
```
-> `motionOn = () => root.dataset.motion !== "reduced" && root.dataset.motion !== "off"` (fallback без атрибута = full), убрать reduceQuery. MutationObserver на `data-motion`/`data-spider` (244) - паттерн реакции на переключатели, сохранить. Visibility pause (236-242: `document.hidden`, cancelAnimationFrame) - сохранить.

### `components/portia-editor-dossier.tsx` (строка 55)

```ts
if (motion === undefined ? matchMedia("(prefers-reduced-motion: reduce)").matches : motion !== "full") return;
```
D-10: заменить fallback на `motion !== undefined && motion !== "full"`; тип `motion` prop может быть `"full" | "reduce"` - обновить на новые значения (grep `motion` в portia-editor*.tsx и portia-desktop.tsx).

### `lib/window-geometry.ts` (STAB-DESK-02)

Сигнатуры: `fitGeometry(geometry, bounds, minimum)`, `resizeGeometry(start, edge, dx, dy, bounds, minimum)`, `dragGeometry(start, dx, dy, bounds)`, `const margin = 8`. Тесты (`lib/window-geometry.test.ts`) - формат образца:
```ts
test("dragging the left edge keeps the right edge in place", () => {
  const start = { x: 300, y: 100, width: 800, height: 500 };
  const next = resizeGeometry(start, "w", -120, 0, { width: 1600, height: 900 }, minimum);
  assert.equal(next.x, 180);
  assert.equal(next.x + next.width, start.x + start.width);
});
```
Добавлять кейсы для всех 8 краёв, дробные bounds (DPR 1.25: нецелые width/height), titlebar достижим (`bounds.height - 46`). Заметка: `dragGeometry` y-clamp не использует margin 8 сверху (0) - спека говорит "inset 8px симметричный"; решить в плане.

### `lib/window-open.ts`

Чистые функции + тест-файл рядом; образец для нового состояния кивка (если хранить в `WindowState`) - `windowAppears` (`!open || minimized || exiting`) и `openedWindow` (не менять `openOrigin` у видимого окна, чтобы не переиграть анимацию).

### `tests/e2e/visual-candidates/*` (STAB-MOTION-08)

Образец: `tests/e2e/visual/motion.spec.ts` - `DesktopPage` из `../pages/desktop.page`, `page.clock.runFor(50)` через `advanceUntil`, `project.name === "chromium-desktop"`, `compareApprovedScreenshot`. Новые кадры - только в `tests/e2e/visual-candidates` (tracked, 5 spec-файлов уже есть), не в `tests/e2e/visual`. Не запускать `phase15-visual-manifest.mjs --verify`; только `--verify-promotion`.

## Shared Patterns

### Режим анимаций
**Источник:** `lib/accent-boot.ts` (head script) + `app/portia.css` инвентарь выше.
**Применять к:** любой новой анимации. Правило: полный motion под `html[data-motion="full"]`, короткий отклик под `html[data-motion="reduced"]`, статика под `html[data-motion="off"]`. Только токены `--motion-press/fast/base/slow`, `--ease-out`, `--ease-in`; анимировать лишь transform/translate/scale/rotate/opacity.

### Хранилище настроек (поштучный fallback)
**Источник:** `components/portia-desktop.tsx` ~строка 49 (`motion: motionModes`, `spider: spiderModes`) и head-скрипт. Каждое поле валидируется независимо; ошибка storage -> try/catch, defaults.

### Таймер вместо animationend
**Источник:** `components/portia-desktop.tsx` ~902 (комментарий) и `bounceTaskbarEntry`. Применять к кивку и циклу ярлыка (failsafe).

### Source-grep тесты
`lib/accent-theme.test.ts` читает `app/portia.css`, `portia-wallpaper-spider.tsx`, `portia-desktop.tsx` как текст. После каждой правки CSS/TSX запускать `npm test` (`node --experimental-strip-types --test lib/*.test.ts`), затем `npm exec tsc -- --noEmit`.

## No Analog Found

| Файл/задача | Причина |
|-------------|---------|
| Инструкция замеров Chrome Performance (D-17) | в репо нет аналога; готовить как документ в `.planning/phases/PORTIA-18-*`; STAB-MEDIA-06 = BLOCKED без owner traces |
| `window-nod` keyframes, волны от лап по обеим сторонам | нет прямого аналога; ближайшие - `taskbar-hop` (1541) и логика `PULSE_SLOTS` в spider |

## Metadata

**Analog search scope:** app/portia.css, lib/, components/, tests/e2e/visual*
**Pattern extraction date:** 2026-11-02
