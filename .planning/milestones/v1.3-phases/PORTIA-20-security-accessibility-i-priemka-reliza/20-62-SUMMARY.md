---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 62
subsystem: release-gate
tags: [D-69, G3, motion, determinism, STAB-REL-03, STAB-VIS-01]
requires:
  - phase: PORTIA-20
    provides: "20-12 parkClock и test.slow() в сцене движения, 20-59 явный npm, 20-61 реестр с 25 строками supersedes"
provides:
  - "tests/e2e/fixtures/determinism.ts: parkClockBeforeLoad, alignParkedClock, settleAnimations (только объекты Animation)"
  - "tests/e2e/visual/motion.spec.ts: сцена движения, дающая побайтно одинаковые кадры во всех пяти состояниях"
  - "lib/e2e-visual-policy.test.ts: охрана политики motion, порядка вызовов и состава помощника"
  - "эталоны motion-vivian-activity/offended/recovery заменены (класс deterministic-capture), web-rest и idle не менялись"
  - "visual-approved раннера на dee25d5: PASS 21/0/54/0 (по проекту 54)"
affects: [20-63]
key-files:
  modified:
    - tests/e2e/fixtures/determinism.ts
    - tests/e2e/visual/motion.spec.ts
    - lib/e2e-visual-policy.test.ts
    - tests/e2e/visual/phase20-baselines.json
    - tests/e2e/visual/__screenshots__/motion-vivian-activity--chromium-desktop.png
    - tests/e2e/visual/__screenshots__/motion-vivian-offended--chromium-desktop.png
    - tests/e2e/visual/__screenshots__/motion-vivian-recovery--chromium-desktop.png
key-decisions:
  - "D-69 G3: недетерминированность сцены имела три причины, а не одну (гипотеза плана про переходы Вивьян верна только для третьей): зависящий от реального времени старт паука при парковке часов после загрузки, фаза бесконечной росы и конечные переходы Вивьян; плюс отдельный дефект сцены (оборванный /api/employees)"
  - "Политика motion (allow, 2300, 0.3), маски и продукт не менялись; помощник settleAnimations работает только с объектами Animation, часы паркуются отдельными функциями"
  - "Три кадра заменены как deterministic-capture с supersedes = одобренный hash Phase 15; web-rest и idle проходят в допуске и остаются"
status: complete
outcome: complete
g3_result: closed
plan_head_before: d901593c7110205479d88f0f4478841635de4f09
plan_head_after: dee25d563250b9b8f80333bea9de43bb7545d331
commits: 3
actuals:
  tokens: 4000
  tasks: 2
  commits: 3
---

# Phase 20 Plan 62: детерминированная сцена движения Вивьян (G3) Summary

PLAN_BASE: d901593c7110205479d88f0f4478841635de4f09

Сцена `motion.spec.ts` теперь даёт побайтно одинаковые кадры во всех пяти состояниях: шесть прогонов подряд дали 0 px (порог 0.3 и порог 0) и совпавшие SHA-256 PNG. Причин расхождения было несколько, и ни одна не требовала менять политику `motion:*`. Три кадра (activity, offended, recovery) заменены, потому что одобренные кадры Phase 15 снимали переход на полпути и текст живых данных Phase 15. Гейт visual-approved раннера на dee25d5: PASS. G3 закрыт. Код продукта не менялся (владельческий вердикт 0c2a59d1d1a7).

## Причина (G3), записана до правки

Порядок по D-69: замер расхождения двух и трёх одинаковых прогонов на HEAD (d901593) во временной копии, затем причина, затем правка. До записи этого раздела в сцене, эталонах и реестре ничего не менялось. Замер: патч `visual-policy.ts` только в копии (выгрузка списка `document.getAnimations()` и фактического кадра перед каждым сравнением, режимы soft и rewrite через переменные окружения); три прогона `--retries=0 --project=chromium-desktop motion.spec.ts`; попарное сравнение компаратором Playwright (порог 0.3 как у политики и порог 0) и карта областей отличия (скрипты в scratchpad сессии, не в репозитории).

### Расхождение до правки (HEAD, три прогона pre1/pre2/pre3, px между прогонами при пороге 0.3)

| Состояние | pre1-pre2 | pre1-pre3 | pre2-pre3 | Область отличия (pre1-pre2, дельта канала не меньше 40) |
|---|---|---|---|---|
| web-rest | 413 | 360 | 815 | паук, x 1118-1251, y 670-743 (1082 px) |
| vivian-idle | 413 | 360 | 815 | та же область, паук |
| vivian-activity | 1575 | 2031 | 1725 | паук и Вивьян, x 1110-1407, y 670-829 (4055 px) |
| vivian-offended | 544 | 464 | 568 | пузырь и Вивьян, x 1131-1363, y 539-832 |
| vivian-recovery | 201 | 201 | 0 | Вивьян, x 1352-1380, y 781-832 |

При пороге 0 те же пары давали 2902 / 2903 / 34398 / 4938 / 3752 px. То есть дрейф был не только у Вивьян: даже web-rest не воспроизводился. Эталон тоже не воспроизводился: расхождение с одобренным кадром 1785-2447 px у каждого состояния.

### Различавшиеся анимации и состояния (выгрузка `getAnimations()` и состояния страницы)

| Источник | Что различалось между прогонами | Где виден |
|---|---|---|
| 1. Паук (не Animation: цикл requestAnimationFrame) | часы паркуются `parkClock` после загрузки: `performance.now()` на парковке 323 / 288 / 277 мс в трёх прогонах, паук успевал пройти разное число реальных кадров; на web-rest позы ног и сдвиг тела различались (`translate(-94.32px, 356.91px)` против `(-95.6px, 352.59px)` против `(-95.19px, 354.01px)`, углы ног 6.42/9.92/9.97 градусов) | все пять состояний |
| 2. Бесконечная роса паутины (CSSAnimation `web-dew`, 16 кругов, 7 с, infinite) | `currentTime` 6700 / 6866 / 6766 мс на web-rest, 9733 / 9766 / 9833 на offended: фаза по реальному времени документа | все пять состояний, вклад небольшой |
| 3. Конечные переходы и анимации Вивьян | на снимке activity: CSSTransition `filter` 360 мс, `transform` 220 мс на `.assistant-button img` (указатель остаётся над кнопкой), CSSAnimation `vivian-bubble` 360 мс на `.assistant-bubble`, `vivian-squish-a` 320 мс, все `running`, `currentTime` 0; на offended: `vivian-offended` 660 мс, переходы `filter`, `opacity`, `transform`; на recovery: `vivian-recover` 780 мс, переходы `opacity`, `transform` | activity, offended, recovery |
| 4. Конечные web-draw, web-dew-in | `finished`, одинаковы во всех прогонах | не различались |

Гипотеза плана (переходы hover и появление пузыря) подтверждена как пункт 3, но не объясняет web-rest и idle (пункты 1 и 2).

### Дефект сцены, найденный замером (не пиксели)

В каждом прогоне, даже при совпадающих пикселях, тест падал: `[PORTIA_E2E_DIAGNOSTICS] 1 unexpected runtime event(s)` (requestfailed `GET /api/employees net::ERR_ABORTED`). Причина: офлайн-обвязка отвечает на `/api/employees` примерно за 8 с реального времени (замер `curl`: 7.9 с), а `fetchWithTimeout` в `components/portia-desktop.tsx` обрывает запрос по таймеру 15 с; при остановленных часах сцена прокручивает `runFor` больше 15 с условного времени и обрывает запрос. Событие появлялось между `spider.toBeVisible` и сравнением web-rest (метки в сцене: счётчик диагностики 0 до этого места, 1 после). Раньше его скрывал упавший пиксельный тест. Это 6 из 6 прогонов, не гонка.

### Промежуточные замеры, определившие правку

| Вариант | Результат между прогонами |
|---|---|
| пауза часов до загрузки (`pauseAt` на пустой странице), 3 прогона | web-rest, idle, activity 0 px при пороге 0.3; offended 306, recovery 201 (при пороге 0: 186-3643); паук воспроизводится, остались роса и переходы |
| то же плюс `settleAnimations`, 3 прогона | 0 px при пороге 0.3 в двух из трёх парах; в одном прогоне паук смещён на 0.85 px и на 0.02 градуса (offended 116 px, при пороге 0 до 2726) |
| причина остатка | в новом документе часы бегут 25-29 мс реального времени до того, как до него доходит пауза; фазы кадров `requestAnimationFrame` стоят на кратных 16 мс `performance.now()`; при головном старте 28 мс и больше те же 100 мс `runFor` содержат на кадр больше (метки: p = 125/127 против 128/129, `translate(-381.52px, 404.35px)` против `(-381.51px, 404.32px)`) |
| то же плюс выравнивание по сетке 16 мс (`alignParkedClock`), 6 прогонов | паук и offended совпали во всех 6 (`performance.now()` после выравнивания всегда 32, затем 82 на монтировании) |

## Что изменено

- `tests/e2e/fixtures/determinism.ts`:
  - `parkClockBeforeLoad` останавливает часы на пустой странице ровно на 1000 мс до загрузки (ошибка `[PORTIA_MOTION_PARK_LATE]`, если установленные часы уже прошли больше 500 мс).
  - `alignParkedClock` после загрузки доводит `performance.now()` до кратного 16 мс.
  - `settleAnimations(page, scope)`: в заданных областях конечные анимации и переходы доводит до конца (`await animation.finished`, предел реального времени 5 с, ошибка `[PORTIA_MOTION_SETTLE_TIMEOUT]`), бесконечные ставит на паузу на фазе 0 (`pause()`, `currentTime`). Ничего не скрывает, стили не пишет.
- `tests/e2e/visual/motion.spec.ts`: часы паркуются до загрузки, выравниваются, рабочий стол монтируется только через `runFor` по 50 мс до появления паука, ответ `/api/employees` дожидается на остановленных часах (иначе обрыв по таймеру 15 с); перед каждым из пяти сравнений `settleAnimations(page, [".wallpaper-web-dew", ".desktop-assistant"])` (области только те, где замер нашёл различия). Указатель не уводился: замер не показал, что дело в нём, а финальное состояние наведения детерминировано.
- `lib/e2e-visual-policy.test.ts`: четыре охранных теста (политика `motion:*` закреплена: allow, 2300, 0.3, без маски; `settleAnimations` вызывается перед каждым из пяти `compare` по порядку исходника; сцена не скрывает, не маскирует и не отключает анимации; тело помощника содержит `getAnimations`, `.finished`, `.pause()`, `currentTime` и не содержит записи стилей, смены видимости, `cancel`).
- `tests/e2e/fixtures/visual-policy.ts`: не менялся (`git diff` к PLAN_BASE пуст).

## RED

До помощника `node --experimental-strip-types --test lib/e2e-visual-policy.test.ts`: `# tests 10`, `# pass 8`, `# fail 2` (не прошли «the scene settles animations before every comparison» и «settleAnimations exists and acts only on Animation objects»; охрана политики прошла, политика не менялась). Коммит cf36225.

## Два и более прогонов после правки (patched копия, дамп кадров, px между прогонами)

Четыре прогона fin1-fin4 и два прогона g1, g2 на финальном коде: попарно fin1-fin2, fin2-fin3, fin3-fin4, g1-g2, g1-fin1:

| Состояние | px при пороге 0.3 | px при пороге 0 | SHA-256 PNG |
|---|---|---|---|
| web-rest | 0 | 0 | совпали |
| vivian-idle | 0 | 0 | совпали |
| vivian-activity | 0 | 0 | совпали |
| vivian-offended | 0 | 0 | совпали |
| vivian-recovery | 0 | 0 | совпали |

## Task 2: детерминированные кадры против одобренных

Обычные прогоны `--update-snapshots=none` без патчей до замены: два подряд FAIL на `motion:vivian-activity` с одним и тем же числом 4179 px. По остальным состояниям числа из прогонов с патчем soft (в 4 прогонах одинаковы): web-rest 1828, idle 1803, offended 3110, recovery 2730 px против одобренных (допуск 2300).

Лист «одобренный / детерминированный / diff» просмотрен по каждому состоянию (кадр 1440x900).

| Кадр | Итог двух прогонов | Класс | Что отличается | SHA256 до | SHA256 после |
|---|---|---|---|---|---|
| motion-web-rest | PASS в допуске (1828 px) | не менялся | паук в другом месте (код паука D-45, D-50, D-53) и три символа часов | 5a2a82e8eaef44181c040c7f1aed50f7f27c930d5677253a85e397d4642bb752 | то же |
| motion-vivian-idle | PASS в допуске (1803 px) | не менялся | то же | 954878cd14f7f2277d838bca697966884f15aabf750e2c41556c785ede547b2a | то же |
| motion-vivian-activity | FAIL 4179 px, оба прогона | deterministic-capture | одобренный кадр: пузырь в начале появления (полупрозрачный), Вивьян в нажатии; теперь переходы закончены. Текст совета «Вода лабораторная не рождается...» не найден в репозитории (`git log -S` пуст): живые данные Phase 15; сейчас стартовый контент («После сохранения изменения...», `lib/portia-content.ts:481`) | bcc8f283cd7db2b2801389988a7539e29922dfbb159c5c8048092dc94b3ed81a | 06914a0b5fa3a44bea6bcb7f7a5546a4ec30549cf0d868aaa635c69cc0e6202c |
| motion-vivian-offended | FAIL 3110 px, в сводке soft тот же | deterministic-capture | одобренный кадр: середина `vivian-offended` (Вивьян в профиль), фраза «Ла-ла-ла! Я тебя не слышу...» из живых данных (в репозитории не найдена); теперь анимация закончена, фраза стартового контента | f042c262e5913daee42317b1b3e1bf2a824ece7d038dd1486d3ebb3cdc5681b8 | 683f1fdaa0d6a30b03e34385404b8a5c653770421282755b649ed7a5398ed8d6 |
| motion-vivian-recovery | FAIL 2730 px, в сводке soft тот же | deterministic-capture | одобренный кадр: середина `vivian-recover` (Вивьян поднимается); теперь анимация закончена | fc39b8c67f8aa6b4e033b03307a34e5c17d04c01eb91a47f98190f499d397c65 | c3c9a74f62884731740f0cd011a8205dbfb7aea3c332934aa2310113a9cf73d7 |

Совпадение области отличия с найденными анимациями (T-20-147): отличие сверх паука (около 1800 px, как у web-rest и idle, принятый вид паука) лежит ровно в областях найденных замером анимаций: пузырь (`vivian-bubble`) и Вивьян (`vivian-squish`, `vivian-offended`, `vivian-recover`, переходы `.assistant-button img`). Текст из живых данных Phase 15 тоже входит в отличие, он объяснён тем же принятым решением 20-58 (стартовый контент вместо живых данных, как у трёх application-кадров в 20-12). Необъяснённых отличий нет, «G3 открыт» не записывается. Допуск 2300 px, порог 0.3 и маски не менялись; строки реестра: `supersedes` = одобренный hash, `class: deterministic-capture`, `decisions` D-68, D-69, D-50, D-53, `captureCommit` cc3f13ee27963fa2650a3be2c0808c2c9410f465 (код продукта равен 0c2a59d1d1a7).

Замена: режим rewrite патча `visual-policy.ts` только в копии; он перезаписывает все пять файлов, поэтому `motion-web-rest` и `motion-vivian-idle` откатаны `git checkout --` (они проходят в допуске), в копии остались три ожидаемых файла; патч откатан; два прогона `--update-snapshots=none` PASS; три PNG скопированы по явным путям.

`grep -c '"supersedes": "[0-9a-f]\{64\}"' phase20-baselines.json`: было 25, стало 28 (25 + 3 заменённых кадра).

### Полная проверка visual в копии на dee25d5 (offline-обвязка, `--retries=0 --update-snapshots=none --grep-invert @phase20`)

| Прогон | Проекты | Итог |
|---|---|---|
| A1, A2 | chromium-desktop, chromium-dpr125 | 16 passed, 14 skipped (правила проекта, 20-59); 16 passed, 14 skipped |
| B1, B2 | chromium-phone, webkit-phone, firefox-desktop | 5 passed, 40 skipped; 5 passed, 40 skipped |

Сбой завершения Firefox (`browserContext.close ... _maybeDontRestoreTabs`) в этих четырёх прогонах не проявился: 0 из 2 прогонов с firefox-desktop; ни PASS, ни пикселями он не записывается (в 20-12 проявлялся в 5 из 8). Сервер остановлен по проверенному PID 22264 (командная строка `next start` копии этого плана), копия удалена, порт 3100 свободен.

### Гейт раннера

Команда `node --experimental-strip-types scripts/phase20-release-gate.mjs --run --commit HEAD --only npm-ci,visual-approved --npm-cli "$NPM_CLI"` на dee25d5 (Node 22.13.1, npm 11.19.0 через `--npm-cli C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`):

- вердикт частичного прогона: PASS-WITH-OWNER-WAIVERS (waiver-ы владельца в раннер не входят и этим планом не менялись);
- `npm-ci`: PASS, exit 0;
- `visual-approved`: PASS, exit 0, `21/0/54/0 (по проекту 54)`: 21 прошёл, 0 упавших, 54 пропуска по условию проекта (каждый прошёл на другом проекте в этом же прогоне), 0 нестабильных;
- каталог артефактов: `test-results/release-gate/dee25d563250-20261108T180134653Z` (есть `visual-approved-1-results.json`, `visual-approved-2-results.json`, логи), ветка (г) 20-61 больше не красная (эталон phone-webkit заменён в 20-61), открытых блокеров visual-approved нет.

## Проверки

| Проверка | Результат |
|---|---|
| `node --experimental-strip-types --test lib/*.test.ts` (основная папка, Node 22.13.1) | 1647 tests, 1644 pass, 0 fail, 3 skipped |
| `node --experimental-strip-types --test lib/e2e-visual-policy.test.ts lib/phase15-visual-manifest.test.ts` | 59 pass, 0 fail |
| `tsc --noEmit` | exit 0 |
| eslint | 0 errors, 17 warnings (как было) |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | exit 0: 65 точных одобренных снимков, 18 исключено |
| `git diff --exit-code --stat PLAN_BASE -- .planning/phases/PORTIA-15-baseline tests/e2e/fixtures/visual-policy.ts` | код 0 |
| `grep -c PORTIA_MOTION_SETTLE_TIMEOUT determinism.ts` / `export async function settleAnimations` / `settleAnimations motion.spec.ts` | 1 / 1 / 7 |
| `git status --porcelain -- tests/e2e/visual/__screenshots__`, копии `portia-20-62-` в `git worktree list`, порт 3100 | пусто; нет; свободен |

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 RED | cf36225 | RED for a deterministic motion scene (G3) |
| 1 GREEN | cc3f13e | settle the motion scene before the Vivian frames (G3) |
| 2 | dee25d5 | replace motion baselines with their deterministic frames (G3) |

`commits: 3` измерено `git rev-list --count PLAN_BASE..HEAD` на dee25d5 (до коммита этого SUMMARY).

## Deviations from Plan

**1. [Rule 1 - Bug] Оборванный `/api/employees` ронял тест на диагностике в каждом прогоне.**
- **Found during:** Task 1, замер.
- **Issue:** запрос `/api/employees` (в офлайн-обвязке отвечает 8 с реального времени) обрывался таймером 15 с условного времени при `runFor`; unexpected `requestfailed ERR_ABORTED`. Раньше был скрыт упавшим пиксельным сравнением.
- **Fix:** сцена дожидается ответа на остановленных часах (`page.waitForResponse` до загрузки, `await` после монтирования). Событие не объявлялось ожидаемым, диагностика не ослаблялась.
- **Files modified:** tests/e2e/visual/motion.spec.ts
- **Commit:** cc3f13e

**2. [Rule 3 - Blocking] Помощник только над Animation недостаточен.** Расхождения web-rest и idle (паук, `requestAnimationFrame`) помощник над Animation не устраняет; добавлены две функции управления часами (`parkClockBeforeLoad`, `alignParkedClock`) в determinism.ts, не в `settleAnimations`. Охрана помощника (только Animation) остаётся в силе. Затронуты те же файлы, что и в плане; политика не менялась. Commit: cc3f13e.

**3. [Класс] `deterministic-capture` для трёх строк реестра** вместо `accepted-redesign`, как разрешает план; компонент «принятый вид паука» и «живые данные Phase 15» записан в `reason`.

**Total deviations:** 3 (1 Rule 1, 1 Rule 3, 1 по классу). **Impact:** без влияния на политику, допуски, маски и код продукта; сцена шире, чем предполагал план.

## Известные ограничения

- Часы и выравнивание зависят от того, что рабочий стол монтируется за один-два шага `runFor` по 50 мс; число шагов до появления паука в шести прогонах 2 (метка `CH`). Если оно изменится, сработает проверка 0 px в двух прогонах гейта, а не молчаливый дрейф.
- Задержка `/api/employees` в офлайн-обвязке 8 с делает сцену медленнее (около 27 с на прогон, `test.slow()`).
- `requirements.mark-complete` не запускался (по плану; STAB-REL-03 остаётся за 20-63 и вердиктом владельца).

## Known Stubs

None.

## Threat Flags

None. T-20-146 закрыта (помощник только над Animation, охранный тест, область только найденных замером анимаций); T-20-147 закрыта (замена после одинакового отличия в двух прогонах, класс записан, `supersedes` = одобренный hash, `--verify-promotion` проходит); T-20-SC: пакеты не устанавливались, node_modules копии - robocopy основной папки.

## Self-Check: PASSED

- Коммиты cf36225, cc3f13e, dee25d5 - предки HEAD.
- Три PNG в `__screenshots__` совпадают с `sha256` строк реестра; `--verify-promotion` exit 0; в реестре 28 строк с `supersedes`.
- Порт 3100 свободен, копий `portia-20-62-` нет, файлы Phase 15 и `visual-policy.ts` не менялись.
