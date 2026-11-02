# Phase 18: реестр кандидатов и вердиктов владельца (STAB-MOTION-08)

- **Набор кандидатов:** `phase18-b9403654a03f` (папка `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/`, в git не входит)
- **Source commit:** `b9403654a03f7536543408c7ca9bd0d50f6fe1cd` (HEAD после 18-06; тесты 18-07 лежат поверх него)
- **Дата:** 2026-11-02
- **Окружение:** Windows 11, Node 22.13.1, собственный `next start` на порту 3100 (порт 3000 занят чужим процессом), сборка с `PORTIA_E2E_ALLOW_HTTP=1`. Preflight `visitor` пройден. Источник данных: тот, что подхватывает `.env.local` (файл не читался; в кадрах видно содержимое, отличное от эталона, см. раздел 3).

## Правила

- Phase 18 не меняет подписанные PNG (`tests/e2e/visual/__screenshots__`) и evidence Phase 15. Режим `--verify` манифеста не запускался, `--update-snapshots` не использовался.
- Вердикты ставит только владелец. Колонка «Вердикт» остаётся `PENDING`, пока владелец не ответил по этому хэшу; `PENDING` и `BLOCKED` не считаются одобренными.
- Кадры снимаются с `animations: "allow"` там, где нужно движение; часть CSS-анимаций (рисование паутины, паук) идёт по реальному времени, а не по `page.clock`. Поэтому PNG побайтно не воспроизводятся между прогонами. Хэш в таблице относится к PNG в папке набора на момент записи; повторный прогон с тем же `PORTIA_VISUAL_SET_ID` перезапишет файлы, и хэши придётся записывать заново. Побайтное равенство end == rest проверяется внутри одного прогона на снимках элемента.
- Motion-кандидаты снимаются только на chromium-desktop (так было и в Phase 15); на остальных проектах motion-тесты пропускаются (`test.skip`).
- Перед съёмкой кадров паука и волны покачивание паутины (`.wallpaper-web-drift`) закреплено в кадре 0, это отмечено в тексте state кандидата.

## 1. Замена 9 отклонённых motion-кадров Phase 15

| Section | id | project | новый хэш (SHA-256) | PNG (.runs) | заменяет строку Phase 15 | Вердикт | комментарий |
|---------|----|---------|---------------------|-------------|--------------------------|---------|-------------|
| Motion | `motion-shortcut-start` | chromium-desktop | `f8c17369e70794b93ebe3ae1d0fc26b1034538e750b049f5187e1e747cc8059e` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-start--chromium-desktop.png` | REJECTED `ec34dd765177` | PENDING |  |
| Motion | `motion-shortcut-key` | chromium-desktop | `afbc20275cbf2fa03c803cbb7a546c09ac4e97384b8a414e558dbcc2a0538327` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-key--chromium-desktop.png` | REJECTED `58f619642516` | PENDING |  |
| Motion | `motion-shortcut-interruption` | chromium-desktop | `bfc200006e2c4347e7580a30fb848c3814fd08bcdcb17028fc5db5232271c379` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-interruption--chromium-desktop.png` | REJECTED `131a826a981f` | PENDING |  |
| Motion | `motion-shortcut-end` | chromium-desktop | `dab06a42e2402e5b9aacd6aa6946811829018935872d1d82a681249fbbf3c57a` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-end--chromium-desktop.png` | REJECTED `0a988de21d76` | PENDING |  |
| Motion | `motion-shortcut-rest` | chromium-desktop | `dcee9fa98a1e543d6aa5de62c06ea5d5cd03cffed1238d9bb75e0a1ec1171040` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-rest--chromium-desktop.png` | REJECTED `a7830c0171c8` | PENDING |  |
| Motion | `motion-spider-spawn` | chromium-desktop | `eb23bad4317fa905be8989110710ea218c75904edc38f20799f7ba0ad679e374` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-spider-spawn--chromium-desktop.png` | REJECTED `99b50cc57d50` | PENDING |  |
| Motion | `motion-spider-front-leg-hunt` | chromium-desktop | `047283368b1e2a3074a113c21210c47c74364914c8d863514c6124442349a48b` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-spider-front-leg-hunt--chromium-desktop.png` | REJECTED `28605e9a525f` | PENDING |  |
| Motion | `motion-spider-route` | chromium-desktop | `39978ee1c90ec327f62544e175868560829d2eb4496f09722c10fc44b0a3f70e` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-spider-route--chromium-desktop.png` | REJECTED `ac599c280835` | PENDING |  |
| Motion | `motion-web-wave` | chromium-desktop | `a5f38956bf87812c2007bf112551032409b23bfad534cff959357121a0fa3ad4` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-web-wave--chromium-desktop.png` | REJECTED `c17356eb2cf8` | PENDING |  |

Проверено тестами при съёмке (chromium-desktop, `--retries=0`):

- Ярлык «Настройки»: рамка (`boundingBox`) одинакова на start, key (280ms), interruption, end (760ms) и rest (D-03); кадр `shortcut.screenshot({ animations: "allow" })` на end и на rest равен побайтно (D-02). Часы заморожены (`page.clock.pauseAt`), чтобы медленные снимки не закончили цикл раньше.
- Волна: перед захватом `motion-web-wave` не меньше двух путей `.wallpaper-web-pulses path` одновременно имеют непустой `d` (D-08, обе стороны тела).
- Паук/волна/Вивьян: тест переживает прежнюю хрупкость (терпение Вивьян берётся из seeded random, зависит от длины хода паука): клики идут раз в секунду до состояния `is-offended`, а не фиксированные 4.

## 2. Строки Phase 15 с recoveryPhase 18 (6 строк: motion-boot, motion-wallpapers, window-search-maximized/minimized на двух phone-проектах)

`motion-boot` и `motion-wallpapers` в Phase 15 были одной строкой каждая; здесь они сняты по кадрам (boot: start 0ms, transition 800ms, complete после 1650ms; обои: покой каждого из пяти фонов).

| Section | id | project | новый хэш (SHA-256) | PNG (.runs) | заменяет строку Phase 15 | Вердикт | комментарий |
|---------|----|---------|---------------------|-------------|--------------------------|---------|-------------|
| Motion | `motion-boot-start` | chromium-desktop | `c1f6627d248f43739e3ccd520937f3f03a28c638ac015e251ff854c369814854` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-boot-start--chromium-desktop.png` | Phase 15 BLOCKED `motion-boot` (recoveryPhase 18, хэша нет) | PENDING |  |
| Motion | `motion-boot-transition` | chromium-desktop | `ec46b9dd44ef4ff03debb357090e23346df4ee6cfeee0208f9a630066cf091f2` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-boot-transition--chromium-desktop.png` | Phase 15 BLOCKED `motion-boot` (recoveryPhase 18, хэша нет) | PENDING |  |
| Motion | `motion-boot-complete` | chromium-desktop | `47b09b635d91992b8bf91e88daea39f8b78746e5d81eb888fa035331bc302d79` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-boot-complete--chromium-desktop.png` | Phase 15 BLOCKED `motion-boot` (recoveryPhase 18, хэша нет) | PENDING |  |
| Motion | `motion-wallpapers-radar` | chromium-desktop | `7c3922b529984d4bb48c1a1530cc64603899fb92350b5797cfe8aaf9e43f5049` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-wallpapers-radar--chromium-desktop.png` | Phase 15 BLOCKED `motion-wallpapers` (recoveryPhase 18, хэша нет) | PENDING |  |
| Motion | `motion-wallpapers-grid` | chromium-desktop | `b24bf1ce08f949add3faf01026071ce6d3fc874b3ecb6dff5a176ad4bab060b7` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-wallpapers-grid--chromium-desktop.png` | Phase 15 BLOCKED `motion-wallpapers` (recoveryPhase 18, хэша нет) | PENDING |  |
| Motion | `motion-wallpapers-gel` | chromium-desktop | `848ba5b141d1953cc72814faf25ffcfbd8513321e6bf269239f5f1fa846f63f4` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-wallpapers-gel--chromium-desktop.png` | Phase 15 BLOCKED `motion-wallpapers` (recoveryPhase 18, хэша нет) | PENDING |  |
| Motion | `motion-wallpapers-cells` | chromium-desktop | `e910f88bc438f0c88634830ea731691bc49c85640c14783883dc7cb3b91f4817` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-wallpapers-cells--chromium-desktop.png` | Phase 15 BLOCKED `motion-wallpapers` (recoveryPhase 18, хэша нет) | PENDING |  |
| Motion | `motion-wallpapers-quiet` | chromium-desktop | `18864f343649bbe0b0dd7ffa88d61c122ee7c69140af79cf2d3288cb2246a295` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-wallpapers-quiet--chromium-desktop.png` | Phase 15 BLOCKED `motion-wallpapers` (recoveryPhase 18, хэша нет) | PENDING |  |
| Desktop | `window-search-maximized` | chromium-phone | `c1c4775eee8359e1f8dbd56274b1ed18bbcbb3c162c29a1bf074e0d881d4c601` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/window-search-maximized--chromium-phone.png` | Phase 15 BLOCKED `window-search-maximized` (recoveryPhase 18, хэша нет) | PENDING |  |
| Desktop | `window-search-maximized` | webkit-phone | `bebcea16f6b2c8858a11ec8396e843f76c494da05f9543934c1de95e6b698a3c` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/window-search-maximized--webkit-phone.png` | Phase 15 BLOCKED `window-search-maximized` (recoveryPhase 18, хэша нет) | PENDING |  |
| Desktop | `window-search-minimized` | chromium-phone | `c813e4b33411be9cf4e86521e5192a63df8799da6eaeae897aa1b2ad3d7cd24d` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/window-search-minimized--chromium-phone.png` | Phase 15 BLOCKED `window-search-minimized` (recoveryPhase 18, хэша нет) | PENDING |  |
| Desktop | `window-search-minimized` | webkit-phone | `9c445fa485a9fd221b216807070542ef7084cda6ee41ca7faca2bf9dea281733` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/window-search-minimized--webkit-phone.png` | Phase 15 BLOCKED `window-search-minimized` (recoveryPhase 18, хэша нет) | PENDING |  |

Проверено тестами при съёмке: под «Уменьшены» и «Выключены» `.boot-screen` не виден (D-12/D-13); при смене фона под «Выключены» входящий слой сразу имеет opacity 1; `window-search-maximized` на phone: кнопки maximize нет (D-16). `motion-window-lock` остаётся `BLOCKED` (recoveryPhase 19, нужны изолированные данные участника).

Заметка по boot: заставка снимается в контексте, где init-скрипт сразу после fixture-детерминизма снимает отметку `portia-boot-seen-v1`; seeded random и часы те же, что у остальных кадров.

## 3. Регрессия утверждённых кадров и EXPECTED DRIFT

Команда: `playwright test tests/e2e/visual --retries=0 --update-snapshots=none` на chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone, webkit-phone. Результат: **7 passed, 14 failed, 54 skipped**. Подписанные PNG не менялись (`git status -- tests/e2e/visual` пуст). Тест останавливается на первом упавшем состоянии, поэтому остальные состояния сверены попиксельно кандидатами того же набора (скрипт сравнения кандидата с `intendedSnapshot`, порог суммы разности каналов > 60; отчёт ниже). Строки с разницей меньше политики (`application-table`, `editor-signed-out-login`, `application-charter` 121px, `motion-web-rest` 78px) в таблицу не вошли.

Причины:

- **A. Паук виден и неподвижен под «Выключены»; тело с обводкой** (18-05, D-07; в эталоне Phase 15 паук под «Выключены» был скрыт).
- **B. Закрытое окно сразу уходит из панели задач под «Выключены»** (18-01/18-02, D-12: все длительности 0s). В эталоне Phase 15 в панели оставалась кнопка «Настройки» после закрытия.
- **C. Подсказка под «Анимации» в «Настройках»** (18-MOTION-APPROVAL п. 4, утверждено владельцем), сдвигает карточки окна.
- **D. DATA DRIFT: текст контента в кадре отличается от эталона** (не решение фазы, код Phase 18 контент не менял): «Информация» («Что такое вирусы?» вместо «Вирус»), «Глобальный поиск» (теги МОРОК/АРАХНА… вместо Вирус/Virus-z…), «База вирусов» («МОРОК» вместо «НОВЫЙ ВИРУС»), «Корзина» (МОРОК_VIR-Δ17.virus… вместо «Шах и мат!»…), фраза Вивьян. Эталон снят на других данных. Это не подтверждённая регрессия кода, но и не объяснено решением фазы: вопрос владельцу (перенос в эталон на текущем источнике данных или фиксированные данные).
- **E. Вивьян: другая фраза и другая фаза плавного появления пузыря** (содержимое пузыря берётся из данных и из seeded random, поток которого изменился вместе с ходом паука, 18-05) вместе с причиной A.
- **F. webkit-phone: в эталоне была вертикальная полоса прокрутки страницы (~30px) и кнопка «Настройки» в панели**; кандидат без полосы. Причина B объясняет кнопку; исчезновение полосы прокрутки отдельно не изолировано (возможна связь с 18-04/18-06, не доказана). Помечено «нужен взгляд владельца».

| Утверждённая строка (эталон) | проект | разница (px) | причины | новый кандидат (id в наборе) | Вердикт |
|------------------------------|--------|--------------|---------|------------------------------|---------|
| `desktop-clean` | chromium-desktop | 2122 | A, B | `desktop-clean-rest` | PENDING |
| `desktop-clean` | chromium-dpr125 | 3176 | A, B | `desktop-clean-rest` | PENDING |
| `desktop-clean` | firefox-desktop | 2049 | A, B | `desktop-clean-rest` | PENDING |
| `desktop-clean` | chromium-phone | 5087 | A, B | `desktop-clean-rest` | PENDING |
| `desktop-start-open` | chromium-desktop | 1565 | A | `desktop-start-open` | PENDING |
| `desktop-start-open` | chromium-dpr125 | 2419 | A | `desktop-start-open` | PENDING |
| `desktop-start-open` | firefox-desktop | 1536 | A | `desktop-start-open` | PENDING |
| `desktop-start-open` | chromium-phone | 3740 | A | `desktop-start-open` | PENDING |
| `desktop-start-open` | webkit-phone | 5247 | A | `desktop-start-open` | PENDING |
| `desktop-dpr125` | chromium-dpr125 | 3262 | A, B | `desktop-dpr125` | PENDING |
| `phone-chromium` | chromium-phone | 3438 | A | `phone-chromium` | PENDING |
| `phone-webkit` | webkit-phone | 117545 | A, B, F | `phone-webkit` | PENDING |
| `window-search-restored` | firefox-desktop | 4006 | A, D (теги поиска) | `window-search-restored` | PENDING |
| `window-search-maximized` | firefox-desktop | 2505 | D (теги поиска; паук вне области разницы) | `window-search-maximized` | PENDING |
| `window-search-minimized` | firefox-desktop | 1536 | A | `window-search-minimized` | PENDING |
| `application-information` | chromium-desktop | 56691 | D, A | `application-information-current` | PENDING |
| `application-trash` | chromium-desktop | 21836 | D, A | `application-trash-current` | PENDING |
| `application-virus-archive` | chromium-desktop | 8073 | D, A | `application-virus-archive-current` | PENDING |
| `application-broadcasts` | chromium-desktop | 7731 | D, A | `application-broadcasts-current` | PENDING |
| `application-search` | chromium-desktop | 5445 | D, A | `application-search-current` | PENDING |
| `application-guide` | chromium-desktop | 2927 | A | `application-guide-current` | PENDING |
| `application-employees` | chromium-desktop | 1979 | A | `application-employees-current` | PENDING |
| `application-settings` | chromium-desktop | 895 | A, C | `application-settings-current` | PENDING |
| `editor-visitor-denied` | chromium-desktop | 2285 | A; нижняя кромка окна (около 280px) как у `application-settings`, причина не изолирована | `editor-visitor-denied` | PENDING |
| `promotion-participant-lookup` | chromium-desktop | 1384 | A | `promotion-participant-lookup` | PENDING |
| `motion-vivian-idle` | chromium-desktop | 2942 | A | `motion-vivian-idle` | PENDING |
| `motion-vivian-activity` | chromium-desktop | 8412 | A, D, E | `motion-vivian-activity` | PENDING |
| `motion-vivian-offended` | chromium-desktop | 6090 | A, E | `motion-vivian-offended` | PENDING |
| `motion-vivian-recovery` | chromium-desktop | 5027 | A, E | `motion-vivian-recovery` | PENDING |

REGRESSION (необъяснённый код-регресс): не выявлено. Группа D описана как нерешённый вопрос данных, не как принятая; группа F описана как неизолированная.

## 4. Перенос в эталон

В Phase 18 не выполнялся. Подписанные PNG не заменялись, ledger Phase 15 не менялся, `--verify-promotion` проходит. Вопрос владельцу (п. 9 18-MOTION-APPROVAL): переносить ли одобренные хэши Phase 18 в `tests/e2e/visual/__screenshots__` отдельным шагом вне фазы (понадобится новый ledger и изменение проверки `--verify-promotion`), и как поступить с группой D (данные).

## 5. Физический вердикт владельца (PC DPR 1 и 1.25, phone)

**(б) Физический просмотр на устройствах: ПРИНЯТО владельцем, 2026-11-02.**

- Точная цитата владельца: «verified».
- На уточняющий вопрос, что именно покрывает «verified», владелец выбрал вариант «Вся проверка (б)». Это весь список (б) на PC и на phone: цикл ярлыков, паук, три режима «Анимации», заставка, кивок окна, drag/resize у краёв, окно на phone. В том числе «на phone окно во весь экран, ни Вивьян, ни клавиатура не закрывают ввод» (клавиатура на телефоне владельца).
- Вердикт дан уже после quick 261102-d7r (убрано покачивание паутины, убран контур паука, паук без рывка на старте и остановке, ярлыки доигрывают в покой, «База вирусов» уменьшена до ~0.86, окно плавно появляется). Он относится к текущему HEAD, а не к кадрам набора `phase18-b9403654a03f`.
- Не выведено из этого вердикта: он не заменяет вердикты по кадрам (а), не принимает группы D и F, не переносит ничего в эталон и не заменяет замеры (в).

**Кандидаты устарели.** Кадры spider / web / shortcut / window в наборе `phase18-b9403654a03f` сняты до quick 261102-d7r и больше не соответствуют коду (STALE). Владелец прямо отказался от пересъёмки («Не надо снимать, я сам оценю»), поэтому пересъёмка не выполнялась. Все строки (а) в разделах 1 и 2 остаются `PENDING`; вердикты по кадрам и группы D/F владелец отложил («позже»), группы D и F остаются открытыми вопросами.

## 6. Что браузерные проверки Claude не доказывают

- Плавность хода паука и ощущение движения: покадровые кандидаты это не показывают; нужен просмотр владельцем.
- Кивок окна в матрице on/reduced/off: покрыт тестами 18-04, кадров кивка здесь нет.
- Редактор (колонки 340px, drag-сортировка по двум осям): нужна аутентифицированная роль и источник данных; **BLOCKED**, не pass.
- Phone: клавиатура и физическое устройство: принято владельцем в (б) (раздел 5), но это ручной вердикт, а не автоматический тест; на других устройствах и ОС не проверялось.
- Скорость (STAB-MEDIA-06): см. `18-PERF-TRACES.md`, **BLOCKED (OWNER-TRACE)**.
