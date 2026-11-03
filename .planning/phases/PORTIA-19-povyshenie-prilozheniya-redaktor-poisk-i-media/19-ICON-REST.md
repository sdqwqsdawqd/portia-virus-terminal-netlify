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
