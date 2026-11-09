---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 40
subsystem: ui
tags: [spider, wallpaper, svg, accent, playwright, d-53]

requires:
  - phase: PORTIA-20
    provides: "20-35 (паук по D-50 с кантом), 20-37 (вердикт владельца, D-53 и уточнение 2026-11-07)"
provides:
  - "Паук «Паутины» без канта, ободка, свечения и без светлой заливки внутри ног; зазоры между витками прозрачны"
  - "Вторая нить ног следует за акцентом (--teal), тело #fdfdfd как на образце Spider.svg"
  - "Пиксельный зонд ног на трёх акцентах PC и phone и вырезки ×4 рядом с образцом"
affects: [20-41, 20-47, 20-12]

actuals:
  tokens: 14000
  tasks: 2
  commits: 3
plan_head_before: 59517ba45302b553ed51630a08c02636faa70c53
plan_head_after: 831f2fd19cd4ee44d002fbea733e52ea6dbb8eaf
commits: 3
spider_art_commit: f7a1faf172a9adbe029f066027e3890a0b18a598

tech-stack:
  added: []
  patterns:
    - "Пиксельный зонд: скрыть группу тела и мебель страницы (.desktop-icons, .desktop-assistant), снять элемент .wallpaper-spider, прочитать яркость каждого пикселя в пустой странице-декодере"

key-files:
  created: []
  modified:
    - components/portia-wallpaper-spider.tsx
    - app/portia.css
    - lib/accent-custom.ts
    - lib/wallpaper-web.test.ts
    - lib/accent-theme.test.ts
    - tests/e2e/visual-candidates/phase20-art.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md

key-decisions:
  - "D-53 (20-37) отменяет S1-А из D-50: слой канта, правило .wallpaper-spider-kant и токен --spider-rim удалены целиком, ни для какого акцента канта нет"
  - "Читаемость на очень тёмном «Своём» акценте даёт белое тело (контраст #fdfdfd к столу не ниже 3:1, проверено unit-тестом на пресетах и шести «Своих»); владелец принимает, что ноги читаются хуже"
  - "Зонд яркости ног скрывает ещё и .desktop-icons/.desktop-assistant: на phone подпись ярлыка «Таблица» лежит над покоящимся пауком и давала ложные 224/255"

patterns-established:
  - "Проверка рисунка паука по контракту D-53: нет kant, нет штриха, pale только в BODY_PARTS, яркость ног не выше --teal + 0.05"

requirements-completed: [STAB-VIS-01, STAB-A11Y-04]

coverage:
  - id: D1
    description: "У паука нет канта, ободка, свечения, штриха и фильтра: слой, правило и токен удалены"
    requirement: STAB-VIS-01
    verification:
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#D-53 (20-37) the spider is the owner's logo spider"
        status: pass
      - kind: unit
        ref: "lib/accent-theme.test.ts#D-53 (20-37) the spider has no rim token and no rim layer; the strand follows the accent"
        status: pass
      - kind: e2e
        ref: "tests/e2e/visual-candidates/phase20-art.spec.ts#D-53 (20-37) spider at rest on the standard accent / very dark / very light, chromium-desktop и chromium-phone"
        status: pass
    human_judgment: false
  - id: D2
    description: "Внутри ног нет белого: пиксельный зонд с скрытым телом не находит пикселей ярче --teal + 0.05 на трёх акцентах PC и phone"
    requirement: STAB-VIS-01
    verification:
      - kind: e2e
        ref: "spider-legs-luma-{default,custom-dark,custom-light}--{chromium-desktop,chromium-phone}.json в .runs/phase20-dev-spider-d53"
        status: pass
    human_judgment: false
  - id: D3
    description: "Паук идентичен пауку логотипа без вируса по геометрии (39 путей, четыре глаза, восемь групп ног) и цветам"
    requirement: STAB-VIS-01
    verification:
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#D-53 (20-37) без вируса"
        status: pass
    human_judgment: true
    rationale: "Сходство рисунка с образцом оценивает глаз владельца по кадрам пересъёмки 20-47; вырезки ×4 рядом с образцом подготовлены, походку и волны чинит 20-41"
  - id: D4
    description: "Режимы движения, переключатель «Паук» и резкость в покое прежние"
    requirement: STAB-A11Y-04
    verification:
      - kind: e2e
        ref: "phase20-art.spec.ts: D-27 «Паук: Скрыть», D-01..D-04 full walks / reduced / off, D-45 резкость; 14 passed на двух проектах"
        status: pass
    human_judgment: false

duration: 8 min
completed: 2026-11-07
status: complete
---

# Phase PORTIA-20 Plan 40: паук без канта и без белого внутри ног Summary

**Паук «Паутины» теперь рисуется только частями образца Spider.svg: слой канта, правило и токен `--spider-rim` удалены, зазоры между витками ног прозрачны, вторая нить — цвет акцента, и пиксельный зонд подтверждает это на трёх акцентах PC и phone.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-07T06:49:26Z
- **Completed:** 2026-11-07T06:58:13Z
- **Tasks:** 2 (Task 1 типа tracer)
- **Files modified:** 7
- **PLAN_BASE:** `59517ba45302b553ed51630a08c02636faa70c53`

## Accomplishments

- `SpiderParts` рисует только пути частей; удалены слой `.wallpaper-spider-kant`, одноимённое правило CSS (штрих 18 единиц, который заливал светлым зазоры между витками ДНК), `--spider-rim` в `:root` и в `accentTokenNames` / `deriveAccentTokens`. Геометрия (39 путей, четыре глаза, восемь групп `[data-leg]`, `LEG_PIVOTS`, `ARTWORK_HEADING`), цикл движения, D-45 и `html[data-spider="off"]` не менялись.
- Проверки переписаны по контракту D-53 и помечены «D-53 (20-37)»: нет канта и токена, нет штриха/фильтра/свечения, `pale` только в `BODY_PARTS`, две группы в разметке, контраст белого тела `#fdfdfd` к столу не ниже 3:1 на `:root`, пресетах и шести «Своих» (#1a1a1a, #0d0d0d, #101820, #f2f2f2, #a0a0a0, #ffffff), `--spider-rim` не определён ни для одного выбора.
- Зонд спека «spider at rest on the …» (три акцента × PC/phone): восемь `[data-leg]`, ноль слоёв канта, ноль штрихов, ноль фильтров, ноль `pale` в ногах, заливки частей по образцу, нить равна вычисленному `--teal`; пиксельный замер при скрытой группе тела.
- Вырезки ×4 без сглаживания рядом с растром Spider.svg лежат в `logo-check/` рабочего набора.

## Task Commits

1. **Task 1 RED: тесты D-53** — `546aaa3` (test). RED на HEAD 59517ba: `# tests 73, # pass 69, # fail 4` (падают оба новых теста accent-theme и оба переписанных теста wallpaper-web).
2. **Task 1 GREEN: компонент, стили, токены, зонд спека** — `f7a1faf172a9adbe029f066027e3890a0b18a598` (fix). GREEN: `# tests 73, # pass 73, # fail 0`; зонд на стандартном акценте chromium-desktop на собранном сервере: 1 passed.
3. **Task 2: зонд игнорирует подписи ярлыков, вырезки для сверки, UI-SPEC** — `831f2fd19cd4ee44d002fbea733e52ea6dbb8eaf` (test, docs).

**Plan metadata:** следующий коммит (docs: complete plan).

spider_art_commit: f7a1faf172a9adbe029f066027e3890a0b18a598

## Результаты проверок

- Unit: `node --experimental-strip-types --test lib/*.test.ts` — 1521 тест, 1517 pass, 0 fail, 4 skipped (прямая команда; `npm test` на Node 22.13.1 падает на node-gyp, это окружение).
- `node node_modules/typescript/bin/tsc --noEmit` — код 0.
- `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` — 0 errors, 17 warnings (как на базе, новых нет).
- Playwright `--retries=0 --project=chromium-desktop --project=chromium-phone phase20-art.spec.ts --grep "spider|Паук|full walks"` против production `next start` на 127.0.0.1:3100: **14 passed**, ни одного skipped и failed.
- Node 22.13.1 из `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64` использован. Сборка `next build` — прямой командой (npm-скрипты падают на node-gyp), код 0.
- Сервер на 3100 остановлен (PID 19888, команда `next start` этого проекта, проверено); `netstat` LISTENING на 3100 не показывает.
- `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` — код 0 (эталоны не тронуты).

### Пиксельный зонд ног (`spider-legs-luma-*.json`, как есть)

Порог = яркость `--teal` + 0.05; максимум — самая яркая точка паука со скрытым телом.

| акцент | устройство | --teal | яркость --teal | максимум | порог | самая яркая точка |
|---|---|---|---|---|---|---|
| default | chromium-desktop | rgb(0, 188, 166) | 0.3872 | 0.3872 | 0.4372 | 0, 188, 166 |
| default | chromium-phone | rgb(0, 188, 166) | 0.3872 | 0.3872 | 0.4372 | 0, 188, 166 |
| custom-dark #1a1a1a | chromium-desktop | rgb(134, 134, 134) | 0.2384 | 0.2384 | 0.2884 | 134, 134, 134 |
| custom-dark #1a1a1a | chromium-phone | rgb(134, 134, 134) | 0.2384 | 0.2384 | 0.2884 | 134, 134, 134 |
| custom-light #f2f2f2 | chromium-desktop | rgb(190, 190, 190) | 0.5149 | 0.5149 | 0.5649 | 190, 190, 190 |
| custom-light #f2f2f2 | chromium-phone | rgb(190, 190, 190) | 0.5149 | 0.5149 | 0.5649 | 190, 190, 190 |

Самая яркая точка везде — сама вторая нить (равна --teal), светлого канта и белого внутри ног нет. Пути: `tests/e2e/visual-candidates/.runs/phase20-dev-spider-d53/spider-legs-luma-{default,custom-dark,custom-light}--{chromium-desktop,chromium-phone}.json` (игнорируется git).

### Резкость в покое (D-45, `spider-rest-sharpness.json`, «as-is», порог 0.9 не менялся)

| проект | состояние | отношение | резкость | образец |
|---|---|---|---|---|
| chromium-desktop | off | 1.029 | 14.50 | 14.09 |
| chromium-desktop | full | 1.015 | 14.14 | 13.94 |
| chromium-phone | off | 1.306 | 7.45 | 5.71 |
| chromium-phone | full | 1.291 | 7.49 | 5.80 |

Все не ниже 0.9.

### Сверка с образцом (вырезки ×4 без сглаживания рядом с растром Spider.svg)

Папка: `tests/e2e/visual-candidates/.runs/phase20-dev-spider-d53/logo-check/` (слева кадр паука, справа растр образца на том же фоне; игнорируется git). Файлы `spider-x4-vs-sample-<акцент>--<устройство>.png`, исходные вырезки `spider-crop-*.png`. Осмотрены глазом два файла (default desktop, custom-dark phone); остальные четыре построены тем же кодом из тех же проходов и записаны по результатам зонда.

| акцент × устройство | нет канта | нет белого в ногах | нить цвета акцента | заметка о читаемости на тёмном |
|---|---|---|---|---|
| default × desktop | да (зонд, осмотр) | да (зонд, осмотр) | да, rgb(0, 188, 166) | читается хорошо |
| default × phone | да (зонд) | да (зонд) | да, rgb(0, 188, 166) | читается хорошо |
| custom-dark #1a1a1a × desktop | да (зонд) | да (зонд) | да, rgb(134, 134, 134) | чёрные части ног почти сливаются со столом, нить серая; читаются хуже — принято владельцем (уточнение D-53) |
| custom-dark #1a1a1a × phone | да (зонд, осмотр) | да (зонд, осмотр) | да, rgb(134, 134, 134) | то же: чёрные витки на столе #090909 едва различимы, различимость даёт белое тело |
| custom-light #f2f2f2 × desktop | да (зонд) | да (зонд) | да, rgb(190, 190, 190) | читается, нить светло-серая |
| custom-light #f2f2f2 × phone | да (зонд) | да (зонд) | да, rgb(190, 190, 190) | читается, нить светло-серая |

Различие позы (паук в кадре повёрнут и с шагом, образец стоит прямо) — не дефект рисунка: походку чинит 20-41.

## Files Created/Modified

- `components/portia-wallpaper-spider.tsx` — `SpiderParts` без слоя канта, комментарий по D-53.
- `app/portia.css` — без `.wallpaper-spider-kant` и `--spider-rim`, комментарий над правилами паука.
- `lib/accent-custom.ts` — токен канта удалён из `accentTokenNames` и `deriveAccentTokens`.
- `lib/wallpaper-web.test.ts`, `lib/accent-theme.test.ts` — проверки D-53.
- `tests/e2e/visual-candidates/phase20-art.spec.ts` — зонд «spider at rest» по D-53 с пиксельным замером и вырезками.
- `20-UI-SPEC.md` — пункт «[ВЛАДЕЛЕЦ, D-53, обновление 2026-11-07]» в строке «Паук на «Паутине»».

## Decisions Made

- Токен канта убран и из `accentTokenNames`: рабочий стол перебирает этот список и сам снимет токен с html.
- Различимость на очень тёмном акценте — только белое тело; никаких компенсаций (кант, ободок, свечение, фильтр) не добавлено по явному принятию владельца.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Пиксельный зонд ловил подпись ярлыка над пауком на phone**
- **Found during:** Task 2 (первый прогон chromium-phone)
- **Issue:** на phone подпись ярлыка «Таблица» лежит над покоящимся пауком; снимок элемента включал её светлые пиксели (rgb 219-224), и зонд падал с яркостью 0.75 при пороге 0.44 — ложное срабатывание, не рисунок паука (в кадре видно, что ног светлого нет).
- **Fix:** на время замера зонд скрывает `.desktop-icons` и `.desktop-assistant` (мебель страницы выше обоев); порог и логику не менял.
- **Files modified:** tests/e2e/visual-candidates/phase20-art.spec.ts
- **Verification:** 14 passed на обоих проектах, максимум яркости равен яркости --teal на всех шести прогонах.
- **Committed in:** 831f2fd

**2. [Rule 3 - Blocking] Ошибка типов в зонде спека (`Node.remove`)**
- **Found during:** Task 1 (`next build` проверяет типы спека)
- **Fix:** приведение `(node as Element).remove()` до GREEN-коммита.
- **Committed in:** f7a1faf

**3. Окружение:** `npm run build` и `npm test` на Node 22.13.1 падают на `node-gyp`; использованы прямые команды из плана (`node node_modules/next/dist/bin/next build`, `node --experimental-strip-types --test lib/*.test.ts`, tsc, eslint, `node node_modules/@playwright/test/cli.js`). Не отклонение продукта.

---

**Total deviations:** 2 auto-fixed (1 bug в тесте, 1 blocking), 1 замечание об окружении
**Impact on plan:** тест стал надёжнее, продуктовый код не затронут.

## Issues Encountered

- Вырезка паука на phone заметно крупнее, чем на desktop (226×249 против 103×109): это размер элемента при DPR 2.625, а не изменение рисунка.

## Known Stubs

Нет.

## Threat Flags

Нет: новых сетевых точек, путей аутентификации и доступа к файлам продукта не добавлено (зонд читает только собственные кадры в `.runs`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Рисунок паука готов для 20-41 (походка восьми ног и синхронность волн) и пересъёмки 20-47; `spider_art_commit` назван выше.
- Кадры рабочего набора `phase20-dev-spider-d53` (игнорируются git) — рабочие, не для владельца; кадры для владельца снимает 20-47.

## Self-Check: PASSED

- `components/portia-wallpaper-spider.tsx`, `app/portia.css`, `lib/accent-custom.ts`, `tests/e2e/visual-candidates/phase20-art.spec.ts`, `20-UI-SPEC.md` — найдены.
- Коммиты 546aaa3, f7a1faf, 831f2fd — предки HEAD; `git cat-file -e f7a1faf172a9adbe029f066027e3890a0b18a598^{commit}` — код 0.
- `grep -c wallpaper-spider-kant` по компоненту и CSS — 0; `grep -c spider-rim` по CSS и accent-custom — 0; `grep -c D-53` по трём тестовым файлам — 9, 5, 11 и по UI-SPEC — 1.
- Шесть `spider-legs-luma-*.json` существуют, у каждого максимум не выше порога; `spider-rest-sharpness.json` не ниже 0.9.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
