# 20-16 «Информация» на телефоне: журнал доказательств (D-28..D-32)

Статус: автоматические проверки зелёные там, где у цели есть данные; всё, что требует раздела с подразделами, записано как BLOCKED (DATA), не PASS.
Физическая проверка на телефоне здесь не выполнялась: 20-14, шаги INFO-PHONE-*: не выполнена здесь.

## Среда

- Production-сборка локально (`PORTIA_E2E_ALLOW_HTTP=1`), `next start` на порту 3100, `PORTIA_E2E_BASE_URL=http://127.0.0.1:3100`; сервер остановлен после работы. Порт 3000 занят чужой сессией и не трогался.
- Цель читается как есть (источник данных из локального окружения). `/api/content` цели отдаёт 4 раздела «Информации»: «Что такое вирусы?», «Способы распространения вирусов», «Классификация», «Документация и утверждение»; ни у одного нет подразделов. Ответы `/api` в тестах не подменялись.
- Снимки лежат в `tests/e2e/visual-candidates/.runs/` (в .gitignore) и не перенесены в `tests/e2e/visual/__screenshots__`.

## 1. Снимки до и после (chromium-phone, webkit-phone)

| Set | Кадр | Проект | Статус | sha256 | Коммит исходников | Файл |
|-----|------|--------|--------|--------|-------------------|------|
| phase20-info-phone-before | info-phone-open | chromium-phone | CAPTURED | 00c46b6e328dc27354da6c1b7ccbcb982493309627526efe585108b530bff0ef | 8fdbf8d | .runs/phase20-info-phone-before/info-phone-open--chromium-phone.png |
| phase20-info-phone-before | info-phone-open | webkit-phone | CAPTURED | ca78172fc5c789993e3cf6ff6ef2b29070ac4e83fdbf6f7efa7cd617bc69467f | 8fdbf8d | .runs/phase20-info-phone-before/info-phone-open--webkit-phone.png |
| phase20-info-phone-before | info-phone-article | chromium-phone | CAPTURED | aa658490934c1e0e440e5adf3b73b7a58e6fda61808513899979c86bc1e04f27 | 8fdbf8d | .runs/phase20-info-phone-before/info-phone-article--chromium-phone.png |
| phase20-info-phone-before | info-phone-article | webkit-phone | CAPTURED | ca78172fc5c789993e3cf6ff6ef2b29070ac4e83fdbf6f7efa7cd617bc69467f | 8fdbf8d | .runs/phase20-info-phone-before/info-phone-article--webkit-phone.png |
| phase20-info-phone-after | info-phone-open | chromium-phone | CAPTURED | 0dec336bf18580b675e65b794b187d800ac51234444e4d21861de629b816b406 | 4219446 | .runs/phase20-info-phone-after/info-phone-open--chromium-phone.png |
| phase20-info-phone-after | info-phone-open | webkit-phone | CAPTURED | f9b66cef1d1a562bb23fda01d988531bbce3a03f11fde4f8721df342bafff36b | 4219446 | .runs/phase20-info-phone-after/info-phone-open--webkit-phone.png |
| phase20-info-phone-after | info-phone-article | chromium-phone | CAPTURED | 9f0cbc53a627a9bfb00ddb8149a8a2c20d3d3d284a451d81ff22811d5a18c01d | 4219446 | .runs/phase20-info-phone-after/info-phone-article--chromium-phone.png |
| phase20-info-phone-after | info-phone-article | webkit-phone | CAPTURED | ac4195cd45ad75ab954a06fcdbfe2b878f4ebed34665fa342fd1eaf067fc3404 | 4219446 | .runs/phase20-info-phone-after/info-phone-article--webkit-phone.png |
| phase20-info-phone-after | info-phone-expanded | chromium-phone | BLOCKED (DATA) | - | 4219446 | .runs/phase20-info-phone-after/info-phone-expanded--chromium-phone.blocked.json |
| phase20-info-phone-after | info-phone-expanded | webkit-phone | BLOCKED (DATA) | - | 4219446 | .runs/phase20-info-phone-after/info-phone-expanded--webkit-phone.blocked.json |
| phase20-info-phone-after | info-phone-next | chromium-phone | BLOCKED (DATA) | - | 4219446 | .runs/phase20-info-phone-after/info-phone-next--chromium-phone.blocked.json |
| phase20-info-phone-after | info-phone-next | webkit-phone | BLOCKED (DATA) | - | 4219446 | .runs/phase20-info-phone-after/info-phone-next--webkit-phone.blocked.json |

Исходники «до» сняты на 8fdbf8d (до любых правок 20-16; рабочее дерево по компонентам и CSS чистое). Кадры «после» сняты на 4219446 (включает все три функциональных коммита).

Оговорка по «до»: в webkit-phone кадры open и article «до» дают одинаковый sha256. В ленте статья лежит под блоком разделов за пределами первого экрана, поэтому нажатие на раздел не меняет видимый кадр. Это то же наблюдение владельца (лента занимает высоту, статья уходит вниз). В chromium-phone кадры различаются только подсветкой нажатого раздела.

Счёт файлов: before 4 `.candidate.json`; after 4 `.candidate.json` и 4 `.blocked.json` (всего 8 строк). Проверка плана «after rows ≥ 8» считает только `.candidate.json` и дала бы 4; BLOCKED-строки записаны другим суффиксом (`.blocked.json`), 8 строк по смыслу плана есть.

## 2. Результаты info-phone-nav.spec.ts

`npx playwright test --retries=0 --project=chromium-phone --project=webkit-phone --project=chromium-desktop tests/e2e/specs/info-phone-nav.spec.ts`: 5 passed, 22 skipped.

- Прошли на данных цели (по chromium-phone и webkit-phone): D-28 список сверху вниз без горизонтальной прокрутки, цель ≥44px, `.info-document` скрыт; D-30 отдельный экран статьи, фокус на h1, «←» «Назад к разделам» ≥44×44 и не пересекается с h1, возврат списка и фокус на нажатый пункт, у раздела без подразделов нет «Далее».
- Прошла на chromium-desktop: ПК-вид без `data-info-screen`, без `.info-phone-back`, `.info-index` слева и `.info-document` справа видны одновременно.
- Пропуски: 8 phone-тестов на chromium-desktop («phone-only»); ПК-тест на двух phone-проектах («phone-only lanes cover the phone screens»); 12 пропусков **BLOCKED (DATA)**: у цели нет раздела с ≥2 подразделами. Это тесты D-29 (раскрытие, `aria-expanded`, маркер в своей колонке), D-31 («Далее» в потоке, внутри раздела, нет в последнем подразделе; «Обзор раздела» и переход к первому подразделу), клавиатура на подразделе, D-32 (поиск из списка и из статьи) на обоих phone-проектах. Эти пункты **не доказаны на данных цели**.
- Регрессия: `search-click.spec.ts -g info` (chromium-phone, webkit-phone, chromium-desktop): 3 passed, `search-click.spec.ts` не изменён; `app-states.spec.ts` для «Информация» на chromium-phone и chromium-desktop: прошли (полоса устаревших данных остаётся одна на видимом экране; сначала один тест падал из-за того, что кнопка полосы стояла внутри `.info-index`, исправлено выносом полосы из `aside`).

### Локальный просмотр на подставленных данных (не доказательство)

Чтобы увидеть поведение раскрытия, «Далее», клавиатуры и поиска, я запускал одноразовую копию спеки, которая подмешивала в ответ `/api/content` три подраздела в «Классификацию» (копия удалена, не закоммичена, на данных цели не основана): 16 passed, 2 skipped на chromium-phone и webkit-phone. В отчёт как доказательство это не идёт; закрыть BLOCKED (DATA) нужно прогоном закоммиченной спеки на источнике, где есть раздел с подразделами (исходное содержание «Классификации» с подразделами или изолированный источник).

## 3. Юнит и исходники

- `lib/info-phone-nav.test.ts`: 11 тестов (порядок «Далее» внутри раздела, пустой и длинный заголовок, переключение без мутации, раскрытие по поиску, «Обзор раздела»). RED: 11 из 11 упали на «not a function» (коммит 7261a0f), GREEN 18ff790: 11 pass.
- `npm test`: 1261 тестов, 1258 pass, 0 fail, 3 skipped. `tsc --noEmit` чист. ESLint по затронутым файлам: 0 errors (в `npm run lint` в целом остаются прежние 32 errors в других файлах, как в 20-19).
- `grep`: `dangerouslySetInnerHTML` в portia-desktop.tsx 0; `hitAttrs("info", section.id)` и `hitAttrs("info", sub.id)` на месте.

## 4. ПК-вид и утверждённый снимок

`npm run test:e2e:visual -- --retries=0 tests/e2e/visual/apps.spec.ts` (chromium-desktop; на цели через `PORTIA_E2E_BASE_URL`):

| Момент | Результат | Упали |
|--------|-----------|-------|
| До правок (8fdbf8d) | 5 failed, 5 passed | База вирусов, Сводка, Информация, Справочник, Корзина |
| После правок (4219446 + кадры) | 5 failed, 5 passed | те же пять |

Тест «approved public application: Информация» падал до изменения и падает после; причина не в 20-16 (те же пять приложений, включая не затронутые правкой, расходятся с утверждёнными снимками: данные цели и анимированные обои). Утверждённые снимки не менялись (`git status -- tests/e2e/visual/__screenshots__` пуст).

Чтобы проверить, что ПК-вид действительно не изменился, сохранены `*-actual.png` до и после и посчитано побитовое различие (макс. дельта канала): Информация 200 px, bbox (936,747)-(968,759), дельта ≤9; для не затронутых Сводка 272 px, Справочник 177 px в той же области (936..971, 747..759). Различия лежат в одном и том же маленьком участке (анимация обоев) и одинаковы по порядку у не затронутых приложений: окно «Информации» на ПК не изменилось. Это сравнение до/после собственных прогонов, не заменяет одобренный снимок.

## 5. Не доказано, отложено

- BLOCKED (DATA): раскрытие подразделов, «Далее», «Обзор раздела», клавиатура на подразделах, поиск с раскрытием, кадры info-phone-expanded и info-phone-next на chromium-phone и webkit-phone.
- Физическая проверка на телефоне: 20-14, шаги INFO-PHONE-*: не выполнена здесь. Слова PASS для физического устройства нет.
- Отличие от плана: кнопка «←» стоит в потоке документа, не `position: sticky` (на телефоне `.app-window` обрезает содержимое, и sticky внутри не держится при прокрутке страницы; см. комментарий о `.editor-save-chip` в portia.css).
