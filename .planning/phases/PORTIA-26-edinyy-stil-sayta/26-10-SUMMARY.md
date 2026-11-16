---
phase: PORTIA-26-edinyy-stil-sayta
plan: 10
subsystem: ui
tags: [info, phone, sections-bar, aria-expanded, focus, escape, search-hit, css, e2e]
status: complete

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "семейство кнопок ui-unify (26-03): .secondary-control с 44px на телефоне; контракт «цвета вне блока ui-unify»"
  - phase: PORTIA-20
    provides: "lib/info-phone-nav.ts (infoNextTarget, toggleInfoExpanded, revealInfoForSearch, infoOverviewVisible), useSyncExternalStore(matchMedia 900px), «Далее» в потоке"
provides:
  - "«Информация» на телефоне: статья всегда на экране, над ней полоса .info-sections-bar в потоке — кнопка «РАЗДЕЛЫ ▾» (secondary, aria-expanded, aria-controls=info-sections-list) и имя текущей статьи"
  - "список разделов — прежняя разметка .info-index, теперь <nav aria-label=\"Разделы информации\" id=\"info-sections-list\">, открывается в потоке под полосой"
  - "закрытие выбором и Escape с возвратом фокуса на кнопку; прокрутка полосы назад только если она выше экрана"
  - "подпись «РАЗДЕЛЫ ▾ · N» и aria-label «Разделы, найдено в разделах: N» при совпадениях поиска"
  - "чистые хелперы infoSectionsHitCount, infoCurrentTitle, infoSectionsButtonLabel в lib/info-phone-nav.ts"
affects: [26-13, 26-14, 27]

plan_head_before: 8b6dc5548ebd107e4da04b904e117264fd2c9ee7
plan_head_after: 74b5755c3d4b9db2ee04c04205c11a1870399b32

actuals:
  tokens: 18175
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "телефонная навигация по документу — кнопка-раскрывашка в потоке над всегда видимой статьёй (не отдельный экран, не fixed/sticky)"
    - "состояние открытия списка — атрибут data-sections-open на .info-library только на телефоне; CSS прячет закрытый список по атрибуту"
    - "возврат фокуса после закрытия: requestAnimationFrame → scrollIntoView только при top < 0 (auto при motion off/reduced) → focus({ preventScroll: true })"

key-files:
  created: []
  modified:
    - lib/info-phone-nav.ts
    - lib/info-phone-nav.test.ts
    - components/portia-desktop.tsx
    - app/portia.css
    - lib/portia-desktop.test.ts
    - lib/ui-unify.test.ts
    - lib/level-ui.test.ts
    - tests/e2e/specs/info-phone-nav.spec.ts
    - tests/e2e/specs/accessibility.spec.ts
    - tests/e2e/visual-candidates/info-phone.spec.ts

key-decisions:
  - "infoSectionsButtonLabel возвращает не только { text, ariaLabel }, а { text, word, glyph, count, ariaLabel }: глиф ▾/▴ рисуется отдельным aria-hidden span, поэтому разметке нужны части; text — полная видимая строка «РАЗДЕЛЫ ▾ · 3»"
  - "Кнопка полосы — обычный .secondary-control (геометрия и 44px из семейства ui-unify), поверх только white-space: nowrap; имя — flex 0 1 auto, min-width 0, многоточие: при нехватке места сжимается имя, а не кнопка"
  - ".info-index стал <nav> и на ПК (как требует UI-SPEC: «existing .info-index markup (<nav aria-label=… id=info-sections-list>)»); все правила CSS по классу, вид ПК не меняется, меняется только роль ориентира (complementary → navigation)"
  - "Попадание глобального поиска на телефоне выбирает статью и держит список закрытым (план, Task 2); раздел попадания раскрывается в данных списка (revealInfoForSearch), строка несёт data-search-hit/.search-hit"
  - "«Далее» после смены статьи ставит фокус на её заголовок (прежнее поведение D-31 без эффекта двух экранов); выбор из списка возвращает фокус на «РАЗДЕЛЫ» (D-15)"
  - "Полоса рисуется при infoRows.length > 0 (строки включают закрытые уровнем заглушки), чтобы посетитель видел и закрытые разделы; при нуле строк окно показывает прежнее пустое состояние"
  - "Плашка устаревших данных теперь всегда внутри статьи (раньше на экране списка — над списком)"

patterns-established:
  - "Escape обрабатывается onKeyDown кнопки и списка с preventDefault — уведомления (QuestToast и др.) пропускают уже обработанный Escape по defaultPrevented"

requirements-completed: [UI-08]

coverage:
  - id: D1
    description: "Трассер (D-14): на ≤900px полоса .info-sections-bar в потоке над статьёй (min-height 44px, margin-bottom 16px, flex, space-between, gap 8px, без position), кнопка «РАЗДЕЛЫ ▾»/«▴» с aria-expanded и aria-controls, имя 13px 400 с многоточием, «Без названия» для пустого заголовка; статья всегда видна; data-info-screen и «←» удалены; на ≥901px полоса display: none, правила .info-index ПК не тронуты"
    requirement: UI-08
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-08 D-14: on a phone a sections bar stands above the article; the two-screen model and the back arrow are gone"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-08 D-14: the bar exists only on a phone, in the flow; the desktop .info-index rules are unchanged"
        status: pass
      - kind: unit
        ref: "lib/info-phone-nav.test.ts#D-14 infoCurrentTitle: an empty or blank title reads «Без названия», an unknown id falls back to the first section"
        status: pass
      - kind: unit
        ref: "lib/info-phone-nav.test.ts#D-14/D-16 infoSectionsButtonLabel: closed, closed with hits, open"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-15: выбор раздела/подраздела/«Обзора раздела» и Escape закрывают список и возвращают фокус на кнопку; полоса прокручивается назад только если её верх выше окна, мгновенно при motion off/reduced; порядок DOM: кнопка → список → статья"
    requirement: UI-08
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-08 D-15: picking an article or Escape closes the list and gives the focus back to РАЗДЕЛЫ; the bar comes back into view only from above"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-16: при закрытом списке кнопка читается «РАЗДЕЛЫ ▾ · N» с aria-label «Разделы, найдено в разделах: N» по тому же isSearchHit, что подсветка строк; попадание поиска открывает статью под закрытым списком"
    requirement: UI-08
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-08 D-16: the closed button counts the sections with search hits by the same test as the highlight; a hit keeps the list closed"
        status: pass
      - kind: unit
        ref: "lib/info-phone-nav.test.ts#D-16 infoSectionsHitCount: counts sections with a hit in the section itself or in any subsection"
        status: pass
    human_judgment: false
  - id: D4
    description: "Поведение в браузере и на телефоне: закрыто с совпадениями и без, открыто, выбор, Escape, Tab, aria-expanded; нет переполнения на 320/390/521/900px, имя сжимается первым; axe открытого списка и статьи"
    requirement: UI-08
    verification: []
    human_judgment: true
    rationale: "Playwright-линии (info-phone-nav.spec.ts, accessibility.spec.ts, visual-candidates/info-phone.spec.ts) переписаны, но не запускались — BLOCKED (ENV)/(DATA): нет источника данных для чтения; физический телефон BLOCKED (DEVICE) до Phase 27. Не засчитано как пройденное"

duration: 9 min
completed: 2026-11-16
---

# Phase 26 Plan 10: «Информация» на телефоне — полоса «РАЗДЕЛЫ ▾» над всегда видимой статьёй Summary

**На телефоне «Информация» больше не делится на два экрана «список / статья»: статья открыта сразу, над ней тонкая полоса в потоке — кнопка «РАЗДЕЛЫ ▾» слева и имя текущей статьи справа; список разделов раскрывается под полосой, сдвигает статью вниз, закрывается выбором или Escape с возвратом фокуса на кнопку, а совпадения поиска видны числом на кнопке.**

## Performance

- **Duration:** ~9 мин
- **Started:** 2026-11-16T12:26:42Z
- **Completed:** 2026-11-16T12:35:01Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `lib/info-phone-nav.ts`: `infoSectionsHitCount(sections, isHit)` (раздел с несколькими совпадениями считается один раз), `infoCurrentTitle(sections, id)` (раздел или подраздел; пустой — «Без названия»; неизвестный id — первый раздел), `infoSectionsButtonLabel(open, hits)` → `{ text, word, glyph, count, ariaLabel }`. Прежняя константа `untitled = "БЕЗ НАЗВАНИЯ"` и `infoNextTarget` не тронуты.
- `components/portia-desktop.tsx`: `const [sectionsOpen, setSectionsOpen] = useState(false)` вместо `infoScreen`; удалены `infoReturnIdRef`, `openInfoArticle`, `closeInfoArticle`, эффект «статья с начала, фокус на h1», `data-info-screen` и кнопка `.info-phone-back` «Назад к разделам».
- Полоса (только при `infoPhone && infoRows.length > 0`): `<div className="info-sections-bar" ref={infoSectionsBarRef}>` → `<button className="secondary-control" aria-expanded aria-controls="info-sections-list" aria-label={…}>РАЗДЕЛЫ <span aria-hidden>▾</span>{ · N}</button>` и `<span className="info-sections-current">`.
- `.info-index` — `<nav aria-label="Разделы информации" id="info-sections-list" onKeyDown={onInfoSectionsKeyDown}>`; `.info-library` получает `data-sections-open` на телефоне. Строки списка — прежние: `aria-current`, переключатель подразделов, `info-sub-marker`, «Обзор раздела», `hitAttrs`/`.search-hit`.
- `pickInfoArticle` (раздел без подразделов, подраздел, «Обзор раздела») и `closeInfoSections` (Escape) → `setSectionsOpen(false)` + `returnToInfoSections()`: в следующем кадре полоса прокручивается в видимую область только при `getBoundingClientRect().top < 0` (`behavior: "auto"` при `data-motion` off/reduced, иначе `smooth`), затем `focus({ preventScroll: true })` на кнопку.
- Поиск: попадание в «Информацию» на телефоне выбирает статью, `setSectionsOpen(false)`, раскрывает раздел в данных списка (`revealInfoForSearch`); подпись кнопки считается `infoSectionsHitCount(content.infoSections, (id) => isSearchHit("info", id))` — тем же тестом, что подсветка строк.
- CSS: `.info-sections-bar { display: none; }` в базовых правилах; в `@media (max-width: 900px)` — `display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; margin: 0 0 16px; padding: 13px 17px 0` без `position`; имя `flex: 0 1 auto; min-width: 0; 400 13px; многоточие`; закрытый список `.info-library[data-sections-open="false"] .info-index { display: none; }`; у статьи на телефоне верхний отступ 0 (зазор задаёт полоса). Правила двух экранов и `.info-phone-back` удалены, `.info-phone-back` снят из семейства кнопок ui-unify.
- E2E переписаны на полосу (не запускались): открытие по `getByRole("button", { name: /^РАЗДЕЛЫ/i })`, `#info-sections-list`, выбор закрывает и возвращает фокус, Escape, Tab, счёт совпадений, ширины 320/390/521/900px, ПК без полосы; axe — открытый список и выбранная статья; кандидаты визуала открывают список перед кадрами.

## Task Commits

1. **Task 1: Трассер — полоса «РАЗДЕЛЫ ▾» над всегда видимой статьёй, список в потоке** — `3ae4f69` (feat)
2. **Task 2: Закрытие, фокус, Escape и совпадения поиска (D-15, D-16)** — `9cfea3e` (feat)
3. **Task 3: E2E-локаторы на полосу (линии BLOCKED)** — `74b5755` (test)

## Files Created/Modified

- `lib/info-phone-nav.ts` — три чистые функции полосы и тип `InfoSectionsButtonLabel`.
- `lib/info-phone-nav.test.ts` — 5 тестов хелперов (счёт, имя, подпись, длина копии).
- `components/portia-desktop.tsx` — состояние `sectionsOpen`, refs полосы и кнопки, `returnToInfoSections`, `pickInfoArticle`, `closeInfoSections`, `onInfoSectionsKeyDown`, полоса и `<nav>` списка, поиск.
- `app/portia.css` — базовое скрытие полосы, телефонные правила полосы и закрытого списка; удалены правила двух экранов и «←».
- `lib/portia-desktop.test.ts` — 4 source-теста UI-08.
- `lib/ui-unify.test.ts` — `.info-phone-back` убран из `BUTTON_FAMILY`, у всех членов 11px.
- `lib/level-ui.test.ts` — якорь оглавления `<aside className="info-index">` → `<nav className="info-index" …`.
- `tests/e2e/specs/info-phone-nav.spec.ts`, `tests/e2e/specs/accessibility.spec.ts`, `tests/e2e/visual-candidates/info-phone.spec.ts` — локаторы полосы.

## TDD

План типа `execute`, у Task 1 и Task 2 `tdd="true"`. RED и GREEN в одном коммите на задачу, как в 26-03 … 26-09.

- **Task 1 RED:** 7 из 92 (5 тестов хелперов — функций нет; 2 source-теста — нет полосы, есть `data-info-screen`). GREEN: verify (4 файла + level-ui) 167/167, полный набор 2317/0.
- **Task 2 RED:** 2 из 78 в `lib/portia-desktop.test.ts` (нет refs, возврата фокуса, Escape, счёта совпадений). GREEN: verify 100/100, полный набор 2319/0.
- **Tracer gate:** авто-режим выключен, `human_verify_mode` — end-of-phase, `<verify>` трассера только автоматический; после коммита `3ae4f69` повторный прогон — 0 fail, расширение продолжено.

## Decisions Made

См. `key-decisions` во frontmatter. Главное: подпись кнопки разбита на части, чтобы глиф был `aria-hidden`; кнопка — обычный `.secondary-control`; `.info-index` стал `<nav>` и на ПК (по UI-SPEC), вид ПК не меняется.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Тесты, привязанные к удалённой разметке**
- **Found during:** Task 1
- **Issue:** `lib/ui-unify.test.ts` держал `.info-phone-back` в `BUTTON_FAMILY` (с исключением 20px), `lib/level-ui.test.ts` искал оглавление по `<aside className="info-index">`.
- **Fix:** `.info-phone-back` убран из списка семейства и из CSS семейства; якорь level-ui перенацелен на `<nav className="info-index" …` (без закрывающей `>`, чтобы пережить `onKeyDown` из Task 2).
- **Files modified:** lib/ui-unify.test.ts, lib/level-ui.test.ts
- **Commit:** 3ae4f69, 9cfea3e

**2. [Rule 1 - Bug] Порядок объявления подписи кнопки**
- **Found during:** Task 2
- **Issue:** `isSearchHit` объявлен как `const` ниже по телу компонента; вычисление подписи рядом с хелперами статьи обратилось бы к нему до объявления (TDZ при рендере).
- **Fix:** `infoSectionsLabel` вычисляется сразу после `hitAttrs`; source-тест проверяет порядок.
- **Files modified:** components/portia-desktop.tsx, lib/portia-desktop.test.ts
- **Commit:** 9cfea3e

**3. [Rule 1 - Bug] e2e: `window` внутри `page.evaluate` затенён локатором**
- **Found during:** Task 3 (tsc)
- **Issue:** в тесте ширин `window.innerWidth` внутри `page.evaluate` типизировался как `Locator`.
- **Fix:** `globalThis.innerWidth`.
- **Files modified:** tests/e2e/specs/info-phone-nav.spec.ts
- **Commit:** 74b5755

### Отличия от буквы плана

- `infoSectionsButtonLabel` возвращает `{ text, word, glyph, count, ariaLabel }` вместо `{ text, ariaLabel }` — для `aria-hidden` глифа; `text` совпадает с планом.
- Task 2 указывал `app/portia.css`, но правки не понадобились: строки списка на телефоне уже 44px (`.info-index button`, `.info-index .info-subsections button`), подсветка — общий `.search-hit`; source-тест это закрепляет.
- В e2e добавлен тест ширин 320/390/521/900px (must_have backstop) и тест Escape/Tab; ни один старый сценарий не удалён — каждый перенацелен.

## Issues Encountered

- `npm test` в этой среде не работает (node-gyp), тесты запускались напрямую `node --experimental-strip-types --test lib/*.test.ts`.

## Known Stubs

Нет.

## Threat Flags

Нет: новых сетевых путей, данных и прав нет. T-26-21 — имя раздела и подпись выводятся через экранирование React, без `dangerouslySetInnerHTML`; T-26-22 — полоса берёт заголовки только из уже отфильтрованных `content.infoSections`, счёт совпадений — тоже.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` — 2319 pass, 0 fail.
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок.
- ESLint изменённых файлов — 0 ошибок (6 прежних предупреждений `no-img-element` в portia-desktop.tsx).
- Acceptance: `info-sections-bar` — 1 строка в компоненте, 3 в CSS; `data-info-screen` — 0 в компоненте и во всех трёх e2e-файлах; `setSectionsOpen(false)` — 3; `infoSectionsHitCount` — 2; `info-sections-list` в info-phone-nav.spec.ts — 4.
- **BLOCKED (не пройдено):** Playwright-линии телефона и ПК, axe в браузере, ширины 320/390/521/900px, касания на физическом телефоне — BLOCKED (ENV)/(DATA)/(DEVICE) до Phase 27.

## Для владельца

Что изменилось на экране «Информация» на телефоне (ПК не менялся):

- Статья открывается сразу. Отдельного экрана со списком разделов и стрелки «←» больше нет.
- Над статьёй — тонкая полоса: слева кнопка «РАЗДЕЛЫ ▾», справа серым мелким шрифтом название текущей статьи (длинное обрезается многоточием). Полоса не прилипает к экрану: при прокрутке она уезжает вместе с текстом и ничего не закрывает. Нажать можно только кнопку, название не нажимается.
- По кнопке список разделов раскрывается прямо под полосой и сдвигает статью вниз (стрелка меняется на «▴»). Разделы с подразделами раскрываются как раньше, со счётчиком подразделов.
- Выбор раздела закрывает список и показывает статью; если вы долистали длинный список вниз, страница вернётся к полосе. Escape тоже закрывает список.
- Если вы пришли из поиска, откроется найденная статья, а кнопка ненадолго покажет «РАЗДЕЛЫ ▾ · 1» — в скольких разделах есть совпадения.
- «Далее» в конце статьи осталось на месте.

Проверить на настоящем телефоне и в браузере пока нельзя (нет тестовых данных и устройства) — это отложено до фазы 27 и не засчитано как пройденное.

## Self-Check: PASSED

- Файлы: lib/info-phone-nav.ts, components/portia-desktop.tsx, app/portia.css, tests/e2e/specs/info-phone-nav.spec.ts, 26-10-SUMMARY.md — на месте.
- Коммиты 3ae4f69, 9cfea3e, 74b5755 — в истории HEAD.
