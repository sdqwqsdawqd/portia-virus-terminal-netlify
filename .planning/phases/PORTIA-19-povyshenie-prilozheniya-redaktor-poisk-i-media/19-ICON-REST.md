# 19-ICON-REST: статика иконок ярлыков = конечный кадр (D-17, STAB-MOTION-05)

Plan 19-09. Артефакт замеров: длины путей (`getTotalLength`), причина скачка, таблица diff по иконкам, хостам и проектам.

## Среда замеров

- Node 22.13.1 (reference), Playwright 1.64.1, Chromium из `ms-playwright` (chromium-1248).
- Сервер: production-сборка этого worktree (`next build --webpack --experimental-build-mode compile`, затем `next start --port 3100`), в Playwright передан `PORTIA_E2E_BASE_URL=http://127.0.0.1:3100`. Порты 3000/3001 (UAT владельца) не использовались, `next dev` не запускался.
- Обход: `npm run build` (Turbopack) в worktree не работает, потому что `node_modules` здесь junction на основной checkout (`Could not find the Next.js package`), а полный `next build` падает на type-check из-за отсутствующего в worktree `.claude/hooks/guard.mjs` (файл вне git, нужен `lib/phase16-guard-boundary.test.ts`). Поэтому сборка для замеров: webpack + режим `compile`. Сборка нужна только как носитель CSS для снимков.
- Фон: `wallpaper: "quiet"`, `spider: "off"` (скругленные углы символа полупрозрачны и иначе подхватывают живой фон). Режим анимаций `on` (= `full`).
- Команда прогона: `npm.cmd exec playwright -- test tests/e2e/visual-candidates/icon-rest.spec.ts --project=chromium-desktop` (spec в `tests/e2e/visual-candidates`, исключен из обычного discovery).

## Как снимается кадр

1. Часы страницы остановлены (`page.clock.pauseAt`), чтобы таймер 700ms не снял класс.
2. Триггер: `focus()` на кнопке ярлыка / кнопке Пуска (тот же `play()`, что у hover и touch). Для `editor` хоста нет: синтетический хост строится клонированием соседнего и подстановкой путей из `components/portia-icons.tsx` (spec сверяет `d` с исходником).
3. Все `CSSAnimation` с именем `icon-*` внутри символа ставятся на паузу на `endTime - 0.001ms` (последний кадр цикла, класс еще стоит). Снимок A.
4. `page.clock.runFor(800)` снимает класс, ждем 100ms (больше двух кадров). Снимок B.
5. Попиксельное сравнение A и B (RGBA, без допуска): `diff = число отличающихся пикселей`.

## Замер длин путей (getTotalLength)

Хост `.desktop-icon-symbol`, Chromium, единицы viewBox 24x24.

| Иконка | Часть | d | getTotalLength | Подпути | Rest dasharray |
|--------|-------|---|----------------|---------|----------------|
| info | `.icon-info-lines > :nth-child(1)` | `M9 12h7` | 7 | 7 | 16 |
| info | `.icon-info-lines > :nth-child(2)` | `M9 15h7` | 7 | 7 | 16 |
| info | `.icon-info-lines > :nth-child(3)` | `M9 18h4.5` | 4.5 | 4.5 | 16 |
| sheet | `svg > :nth-child(2)` | `M4 9h16M4 14h16M10 9v11` | 43 | 16, 16, 11 | 32 |
| editor | `svg > :nth-child(1)` | `M5 4v16M5 7h3M5 12h5M5 17h3` | 27 | 16, 3, 5, 3 | 32 |

Пунктир стартует заново на каждом подпути, поэтому покрывать нужно самый длинный подпуть (16), а не `getTotalLength` целиком. Для sheet и editor dasharray 32 покрывает 16 ед. и в пикселях (16 * 62 * 0.58 / 24 = 24px < 32). Значения 16 и 32 остались прежними, но теперь заданы в rest-правиле постоянно.

Dasharray 16 покрывает самый длинный путь 7 ед. и в экранных пикселях (на desktop действует `vector-effect: non-scaling-stroke`, символ 62px: 7 * 62 * 0.58 / 24 = 10.5px < 16). Значения dasharray не менялись, они лишь стали постоянными.

## Причина скачка (подтверждена измерением)

Ведущая гипотеза плана (dasharray и transform-box/origin только под `is-icon-animating`) подтвердилась лишь отчасти: пунктир с покрывающим dasharray не отличается от сплошной линии. Измеренная причина другая:

- пока идет цикл (и пока держится `animation ... both`), Chromium выносит анимируемые части (translate / scale / rotate / opacity) в отдельные composited-слои и растрит их иначе, чем при покое в слое родителя; на последнем кадре цикла штрихи толще/мягче, положение дробное;
- при снятии `is-icon-animating` часть возвращается в обычный слой и перерисовывается: это и есть видимый «скачок» после цикла;
- «Повышение»: верхние два уровня имеют атрибут `opacity=".65"`, а последний кадр `icon-promotion-level` держит `opacity: 1` (`both`); после снятия класса уровни падали с 1 до .65. Это настоящий скачок яркости.

Доказательство: на текущей базе (до правок CSS) diff последнего кадра и покоя `settings`/desktop = 330 px; тот же спектр с постоянным `will-change` на анимируемых частях = 0 px.

## Результат Task 1: «Информация» (tracer)

| Состояние | Проект | Хост | diff |
|-----------|--------|------|------|
| до правки (базовый коммит 4d2a3e9) | chromium-desktop | desktop-shortcut | 99 px |
| после правки | chromium-desktop | desktop-shortcut | diff = 0 (52x52, байты равны) |

Проверка: `node --experimental-strip-types --test lib/portia-desktop.test.ts` (тест «shortcut rest (D-17, tracer)»).

## Результаты Task 3: 12 иконок x хосты x проекты

Прогон: `PORTIA_E2E_BASE_URL=http://127.0.0.1:3100 npm.cmd exec playwright -- test tests/e2e/visual-candidates/icon-rest.spec.ts --project=chromium-desktop --project=chromium-dpr125 --project=chromium-phone` на сборке коммита c27e5e0: 72 теста (18 пропущено как «хоста нет»), 54 пройдено, все 54 с `diff = 0`. Тот же набор на базовом коммите 4d2a3e9 (CSS без правок) дал ненулевой diff для 8 из 12 иконок (search, virus, employees, broadcasts, info, promotion, settings, charter) (контрольный прогон: метод ловит скачок).

Охват и ограничения:

- Проекты: chromium-desktop (DPR 1), chromium-dpr125 (DPR 1.25), chromium-phone (Pixel 7, phone-сетка). Firefox и webkit-phone в плане не заявлены и не запускались.
- Хосты: ярлык рабочего стола у 11 иконок (`editor` не ярлык); кнопка Пуска у 5 (search, virus, employees, promotion, settings). Остальные пары записаны `n/a`, это не PASS.
- `editor` хоста нет ни на рабочем столе, ни в Пуске: проверен на синтетическом хосте (клон соседнего, пути из `components/portia-icons.tsx`, spec сверяет `d` с исходником). Для editor и sheet diff был 0 и до правки (там dasharray, покрывающий подпуть, ничего не меняет), поэтому это проверка отсутствия регрессии, а не исправления.
- Режимы `reduced` и `off` попиксельно не снимались: rest-правила не завязаны на `html[data-motion]` (проверяется тестом исходника), цикл в `off` не играет вообще.

| Иконка | Хост | Проект | diff до (4d2a3e9), px | diff после (c27e5e0), px |
|--------|------|--------|-----------------------|---------------------------|
| search | desktop-shortcut | chromium-desktop | 16 | 0 |
| search | desktop-shortcut | chromium-dpr125 | 423 | 0 |
| search | desktop-shortcut | chromium-phone | 785 | 0 |
| search | start-panel | chromium-desktop | 39 | 0 |
| search | start-panel | chromium-dpr125 | 237 | 0 |
| search | start-panel | chromium-phone | 667 | 0 |
| virus | desktop-shortcut | chromium-desktop | 115 | 0 |
| virus | desktop-shortcut | chromium-dpr125 | 148 | 0 |
| virus | desktop-shortcut | chromium-phone | 215 | 0 |
| virus | start-panel | chromium-desktop | 81 | 0 |
| virus | start-panel | chromium-dpr125 | 181 | 0 |
| virus | start-panel | chromium-phone | 516 | 0 |
| employees | desktop-shortcut | chromium-desktop | 0 | 0 |
| employees | desktop-shortcut | chromium-dpr125 | 0 | 0 |
| employees | desktop-shortcut | chromium-phone | 0 | 0 |
| employees | start-panel | chromium-desktop | 8 | 0 |
| employees | start-panel | chromium-dpr125 | 0 | 0 |
| employees | start-panel | chromium-phone | 0 | 0 |
| broadcasts | desktop-shortcut | chromium-desktop | 241 | 0 |
| broadcasts | desktop-shortcut | chromium-dpr125 | 325 | 0 |
| broadcasts | desktop-shortcut | chromium-phone | 672 | 0 |
| broadcasts | start-panel | все три | n/a | n/a (хоста нет: в Пуске только 5 приложений) |
| info | desktop-shortcut | chromium-desktop | 99 | 0 |
| info | desktop-shortcut | chromium-dpr125 | 156 | 0 |
| info | desktop-shortcut | chromium-phone | 238 | 0 |
| info | start-panel | все три | n/a | n/a (хоста нет: в Пуске только 5 приложений) |
| guide | desktop-shortcut | chromium-desktop | 0 | 0 |
| guide | desktop-shortcut | chromium-dpr125 | 0 | 0 |
| guide | desktop-shortcut | chromium-phone | 0 | 0 |
| guide | start-panel | все три | n/a | n/a (хоста нет: в Пуске только 5 приложений) |
| promotion | desktop-shortcut | chromium-desktop | 217 | 0 |
| promotion | desktop-shortcut | chromium-dpr125 | 322 | 0 |
| promotion | desktop-shortcut | chromium-phone | 661 | 0 |
| promotion | start-panel | chromium-desktop | 145 | 0 |
| promotion | start-panel | chromium-dpr125 | 195 | 0 |
| promotion | start-panel | chromium-phone | 473 | 0 |
| settings | desktop-shortcut | chromium-desktop | 330 | 0 |
| settings | desktop-shortcut | chromium-dpr125 | 390 | 0 |
| settings | desktop-shortcut | chromium-phone | 359 | 0 |
| settings | start-panel | chromium-desktop | 131 | 0 |
| settings | start-panel | chromium-dpr125 | 138 | 0 |
| settings | start-panel | chromium-phone | 140 | 0 |
| charter | desktop-shortcut | chromium-desktop | 49 | 0 |
| charter | desktop-shortcut | chromium-dpr125 | 71 | 0 |
| charter | desktop-shortcut | chromium-phone | 130 | 0 |
| charter | start-panel | все три | n/a | n/a (хоста нет: в Пуске только 5 приложений) |
| sheet | desktop-shortcut | chromium-desktop | 0 | 0 |
| sheet | desktop-shortcut | chromium-dpr125 | 0 | 0 |
| sheet | desktop-shortcut | chromium-phone | 0 | 0 |
| sheet | start-panel | все три | n/a | n/a (хоста нет: в Пуске только 5 приложений) |
| trash | desktop-shortcut | chromium-desktop | 0 | 0 |
| trash | desktop-shortcut | chromium-dpr125 | 0 | 0 |
| trash | desktop-shortcut | chromium-phone | 0 | 0 |
| trash | start-panel | все три | n/a | n/a (хоста нет: в Пуске только 5 приложений) |
| editor | desktop-shortcut | chromium-desktop | 0 | 0 (синтетический хост) |
| editor | desktop-shortcut | chromium-dpr125 | 0 | 0 (синтетический хост) |
| editor | desktop-shortcut | chromium-phone | 0 | 0 (синтетический хост) |
| editor | start-panel | chromium-desktop | 0 | 0 (синтетический хост) |
| editor | start-panel | chromium-dpr125 | 0 | 0 (синтетический хост) |
| editor | start-panel | chromium-phone | 0 | 0 (синтетический хост) |

## Решения и видимые последствия

1. **Rest = последний keyframe, дословно** (`translate: 0 0`, `rotate: 0deg`, `scale: 1`, `opacity: 1`, `stroke-dasharray` 16/32 + `stroke-dashoffset: 0`) для каждой анимируемой части, одним правилом на часть вне анимируемого селектора. Анимируемые правила теперь содержат только `animation`. Keyframes, 560ms, easing, задержки и `components/portia-icons.tsx` не тронуты.
2. **Постоянный `will-change`** (translate / rotate / scale / opacity ровно по тем свойствам, которые анимирует часть) задан в rest-правиле, не под классом анимации. Без него вынос части в composited-слой на время цикла и возврат в слой родителя после снятия класса давали ненулевой diff у 8 из 12 иконок. Это и есть измеренная причина скачка. Следствие: в покое части растрятся тем же путем, что на последнем кадре цикла.
3. **«Повышение»: яркость уровней.** Артворк задает `opacity=".65"`, последний кадр цикла `opacity: 1` (fill `both`). По правилу 4 (меняется статика, не keyframes) rest = `opacity: 1`. Это единственное видимое изменение статичного вида: два верхних уровня иконки «Повышение» в покое теперь полной яркости, как на последнем кадре цикла, и больше не падают до .65 после него. Если владелец хочет .65 в покое, нужно менять keyframes (это вне плана и требует решения владельца).
4. **Постоянные свойства рендера:** `transform-box: fill-box; transform-origin: center` для `svg > *` обоих хостов без `html:not([data-motion="off"])`; `transform-box: view-box` и особые origin (virus-scan/spikes/tips, broadcast-signal, info-fold, guide-front, trash-lid) в rest-правилах; `shape-rendering: geometricPrecision` добавлен для `.start-panel-icon svg` (у `.desktop-icon-symbol svg` был).
5. `vector-effect: non-scaling-stroke` задан только для `.desktop-icon-symbol` и не менялся (вне плана).

## Что не доказано (BLOCKED, не PASS)

| Проверка | Статус | Причина |
|----------|--------|---------|
| Физический вердикт владельца на PC и phone: скачка иконок после цикла нет (UI E9 overflow) | BLOCKED (owner device) | нужен физический PC и телефон владельца; уходит в 19-14 |
| Firefox / webkit-phone | не запускались | вне охвата плана (D-17 заявляет chromium-desktop, chromium-dpr125 и phone-проект) |
| Режимы `reduced` / `off` попиксельно | не снимались | см. выше; покрыто тестом исходника |
