---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 35
subsystem: ui
tags: [wallpaper-spider, d-50, gap-closure, accessibility, accent]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: 20-34 решение D-50 (S1-А, S2-А, S3-А)
provides:
  - паук «Паутины» перерисован по логотипу владельца (D-50): белое тело, чёрные части, вторая нить цвета акцента, четыре чёрных глаза, светлый кант
  - проверки окраски и зонд «spider at rest» по контракту D-50
affects: [20-37]

actuals:
  tokens: 13000
  tasks: 2
  commits: 4

plan_head_before: ca76bdb19a9bfbe638f7bd23442c0e2ffc534d3d
plan_head_after: 919424c36ee26a3cc2dd190170bcc56ec3c2908f

key-files:
  modified:
    - components/portia-wallpaper-spider.tsx
    - app/portia.css
    - lib/accent-custom.ts
    - lib/accent-theme.test.ts
    - lib/wallpaper-web.test.ts
    - tests/e2e/visual-candidates/phase20-art.spec.ts
    - .planning/todos/pending/2026-11-06-spider-match-logo.md

key-decisions:
  - "S1-А: один светлый нейтральный кант #d0d0d0 на любом акценте (--spider-rim в :root и в deriveAccentTokens), слой канта лежит внутри группы тела и каждой группы [data-leg]"
  - "S2-А: вторая нить ног = var(--teal), нового токена нет (ROOT_KEEP не менялся)"
  - "S3-А: ширина .wallpaper-spider не менялась (72 * масштаб), D-25 «размер не меняется» сохранён"

requirements-completed: [STAB-VIS-01, STAB-A11Y-04]

duration: одна сессия 2026-11-06
completed: 2026-11-06
status: complete
---

# Phase 20 Plan 35: паук по логотипу владельца (D-50) Summary

Паук «Паутины» перерисован по D-50: белое тело #fdfdfd, почти чёрные части #070707 без примеси акцента, вторая нить ног цвета акцента, четыре чёрных глаза без зрачков, светлый нейтральный кант #d0d0d0 шириной штриха 18 единиц рисунка (около 1 CSS px снаружи силуэта при 72 px), без SVG-фильтров; цикл ходьбы, LEG_PIVOTS, переключатель «Паук» и режимы движения не менялись.

spider_fix_commit: d7d917e466e77e43ea0fa7ae126c86810acd7b19

## Что сделано

- **Компонент:** 39 путей Spider.svg вынесены в константы `BODY_PARTS` и `LEG_PARTS` (порядок рисования R4, R3, R2, R1, L4, L3, L2, L1 сохранён, `LEG_DRAW_ORDER`), глаза в `EYES`. Помощник `SpiderParts` рисует группу: сперва слой канта (`g.wallpaper-spider-kant` с теми же путями тёмных частей и нити), затем части. Кант поэтому поворачивается и сжимается вместе со своей ногой. Четыре кружка-зрачка `wallpaper-spider-accent` убраны. Вируса нет.
- **Стили:** `.wallpaper-spider-dark` #070707, `-limb` var(--teal), `-pale` #fdfdfd, `.wallpaper-spider-kant` (fill и stroke = --spider-rim, stroke-linejoin round, ширина 18). Старое правило штриха `.wallpaper-spider :is(path, circle)` удалено; части без штриха. Правила слоя компоновщика при ходьбе и `html[data-spider="off"]` не тронуты.
- **«Свой» акцент:** `--spider-rim` для любого выбора `#d0d0d0` (раньше `--teal` ниже светлоты 0.62 и #020706 иначе).
- **Проверки:** тест окраски и тест «без вируса» (точный набор групп, 39 путей, 8 ног, LEG_PIVOTS, одна `<circle>` на четыре глаза) в lib/wallpaper-web.test.ts; токен и контраст канта на пресетах и «Своих» акцентах в lib/accent-theme.test.ts; зонд спека «spider at rest on the ...» на трёх акцентах. Над каждым изменённым тестом комментарий «D-50 (20-34)». Id кадров не менялись.

## RED / GREEN

RED (коммит f6a6a6b на коде до перерисовки): `node --experimental-strip-types --test lib/wallpaper-web.test.ts lib/accent-theme.test.ts` дал `# pass 69 / # fail 4`: «D-50 the spider rim token is a light neutral...», «G1: the light spider rim keeps 3:1...», «D-50 the spider is drawn as the owner's logo spider...», «D-50 без вируса: ...». GREEN после d7d917e: `# pass 73 / # fail 0` (на HEAD до плана 72 pass).

Вывод зонда на собранном сервере (desktop и phone, три акцента, все 14 тестов прошли): 8 элементов `[data-leg]`; частей больше 20, все непрозрачны, штриха у частей нет; белые заливки яркости выше 0.9; тёмные ниже 0.01; заливка нити равна вычисленному `--teal`; 4 чёрных глаза; слой канта в 9 группах; зрачков акцента 0; фильтров на кант 0. Контраст канта #d0d0d0 к --desktop-base: 12.49 (стандартный #07100f), 12.91 (#090909 для #1a1a1a и #f2f2f2).

## Сверка с логотипом (ручная, ×4 без сглаживания, рядом растр образца того же масштаба)

Вырезки лежат в `tests/e2e/visual-candidates/.runs/phase20-dev-spider/logo-check/` (игнорируется git). Образец при сверке показывает вирус под пауком: в нашем пауке его нет, это намеренно.

| Акцент × устройство | Вывод сверки с логотипом | Контраст канта к --desktop-base | Вырезка |
|---|---|---|---|
| стандартный × PC | брюшко-капля, шестиугольник головогруди, четыре чёрных глаза, белые клыки, чёрный контур, бирюзовая нить с перемычками узнаются; кант тонкий и не перетягивает внимание | 12.49 | logo-check/default--chromium-desktop.png |
| #1a1a1a × PC | нить серая (#868686), тело и контур читаются на столе, кант виден; нить и кант по яркости близки, ноги выглядят серой массой с тонкими чёрными витками | 12.91 | logo-check/custom-dark--chromium-desktop.png |
| #f2f2f2 × PC | нить светло-серая (#bebebe) почти сливается с кантом: ноги светлым пятном, чёрные витки видны слабее; силуэт паука различим | 12.91 | logo-check/custom-light--chromium-desktop.png |
| стандартный × phone | как на PC, чёрный контур и витки спирали видны отчётливо; бирюзовая нить и белые клыки по образцу | 12.49 | logo-check/default--chromium-phone.png |
| #1a1a1a × phone | серая нить, читается на тёмном столе, кант тонкий | 12.91 | logo-check/custom-dark--chromium-phone.png |
| #f2f2f2 × phone | как на PC: ноги светлой массой, тело и глаза по образцу | 12.91 | logo-check/custom-light--chromium-phone.png |

Замечание для вердикта в 20-37: на очень светлом «Своём» акценте цвет нити по S2-А (производный --teal) и светлый кант по S1-А почти одной яркости, поэтому ноги читаются хуже, чем на стандартном. Различимость (контраст канта к столу не ниже 3:1) выполнена; решение по цвету нити на таком акценте оставлено владельцу. На phone в точке покоя паук частично под ярлыком «Таблица» (положение паука и порядок слоёв в этом плане не менялись).

## Резкость в покое (D-45, «как есть», порог 0.9 не менялся)

| Устройство | motion off | motion full (стоит) |
|---|---|---|
| chromium-desktop (dpr 1) | 38.59 / 35.88 = 1.075 | 38.27 / 35.47 = 1.079 |
| chromium-phone (dpr 2.625) | 18.72 / 13.05 = 1.434 | 18.50 / 13.34 = 1.387 |

Источник: `.runs/phase20-dev-spider/spider-rest-sharpness.json`.

## Итоговые проверки

`npm test`: 1500 pass, 0 fail (на HEAD 1465). `npm exec tsc -- --noEmit`: код 0. `npm run lint`: 0 errors, 17 warnings (как на HEAD). Спек паука на chromium-desktop и chromium-phone (`--grep "spider|Паук|full walks"`, `--retries=0`): 14 passed. Порт 3100 свободен (процесс node с командой `next start` портала остановлен, `netstat` не показывает LISTENING). `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` код 0. Node 22.13.1 (из %TEMP%).

## Deviations from Plan

None - plan executed exactly as written. Мелкие уточнения без отклонений от контракта: в тесте «без вируса» допущен атрибут `key={leg}` в разметке группы ноги; задача 2 не потребовала правок кода сверх `lib/accent-custom.ts`, уже включённого в коммит d7d917e (рассмотрено: S3-А, размер не менялся; `--spider-strand` не нужен при S2-А).

## Не проверено (BLOCKED, без пометки «пройдено»)

Бюджет кадра ходьбы на физическом устройстве (SPIDER-03) остаётся BLOCKED до 20-14, как зафиксировано в T-20-58. Эталоны tests/e2e/visual/__screenshots__ не трогались. Кадры для владельца снимает 20-37.

## Known Stubs

None.

## Threat Flags

None - визуальная правка клиентского компонента; сети, прав и данных не затрагивает.

## Commits

- f6a6a6b test(20-35): D-50 spider contract tests (RED)
- d7d917e feat(20-35): redraw the wallpaper spider from the owner's logo (D-50)
- 7263795 test(20-35): spider-at-rest probe by the D-50 contract on three accents
- 919424c docs(20-35): mark the spider-match-logo todo implemented

## Self-Check: PASSED

Файлы components/portia-wallpaper-spider.tsx, app/portia.css, lib/accent-custom.ts и ссылки на коммиты проверены; `git cat-file -e d7d917e466e77e43ea0fa7ae126c86810acd7b19^{commit}` успешен.
