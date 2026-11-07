---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 53
subsystem: ui
tags: [image-framing, editor, d-63, d-64, a11y, playwright, gap-closure, candidates]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: "20-51 lib/image-framing.ts и показ кадра на сайте; 20-52 решение владельца employee_framing b; 20-50 UI-контракт редактора и охрана D-64"
provides:
  - "components/portia-image-framing.tsx: блок «Видимая часть» (предпросмотр как на сайте, три ползунка, «Сбросить»)"
  - "ImageEditorField с framing, framingBox, onFramingChange; кадр подключён к шести полям редактора и двум полям ArchivedVirusEditor"
  - "охрана D-64 знает атрибуты кадра (запись D-63 в approvedEditorEdits)"
  - "e2e цепочка редактор -> предпросмотр -> тело PUT -> сайт на восьми поверхностях, PC и phone"
  - "кандидатные кадры для галереи 20-54, раздел UI-SPEC (E9), шаги UAT EDITOR-FRAMING-01 и EDITOR-INFO-ADD-01"
affects: [20-54]

employee_framing: b

outcome: complete

actuals:
  tokens: 30000
  tasks: 3
  commits: 6

plan_head_before: 0e28927d7eebe82ff916be54cc608d85cd37978f
plan_head_after: b0ba2b556d8f57d01ecb7021d8ce84577f9c2526
commits: 6

tech-stack:
  added: []
  patterns:
    - "предпросмотр кадра рисует рамку сайта теми же классами .portia-image и теми же imageFramingStyles, без импорта PortiaImage (граница конструктора шаблона)"
    - "сброс кадра при смене адреса: ввод, вставка, очистка — в обработчике; загрузка файла — запоминанием адреса в момент выбора файла"
    - "охрана файла редактора: атрибуты кадра вырезаются из текущего файла перед сравнением с образцом (normalizeActual), только из строк <ImageEditorField"
    - "e2e цепочка: единственная допущенная запись — PUT /api/content, тело записывается, запрос прерывается, сбой объявлен через expectFault"

key-files:
  created:
    - components/portia-image-framing.tsx
    - lib/editor-image-framing.test.ts
    - tests/e2e/visual-candidates/phase20-editor-images.spec.ts
  modified:
    - components/portia-editor-dossier.tsx
    - components/portia-editor.tsx
    - app/portia.css
    - lib/format-launch.test.ts
    - lib/portia-desktop.test.ts
    - lib/phase20-uat.test.ts
    - tests/e2e/specs/editor-ui-contract.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UAT.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md

key-decisions:
  - "Вид рамки: natural | band | tile. Вариант portrait не вводился: фото сотрудника по решению владельца (b) без кадра, мёртвый код не добавлялся"
  - "Рамка полосы раздела в предпросмотре фиксирована по замеру окна «Справочник»: 12:1 на PC (754x63) и 5,75:1 на phone (362x63). Если окно на PC растянуть, полоса на сайте станет длиннее"
  - "Сравнение transform-origin идёт по инлайн-стилю в процентах, не по вычисленному: вычисленный всегда в пикселях и следует за размером рамки"
  - "Для картинок «как лежат» (досье, мутация, «Информация», «Корзина») соотношение сторон сравнивается по самой картинке, не по рамке: рамка сайта .portia-image шире картинки (у мутации картинка 420 px по центру)"
  - "Допуск axe: три узла вне блока (hint «Текст и GIF можно сочетать.», подписи small[title] строк списка) терпятся по разметке узла; внутри .image-framing допусков нет"
  - "Требование кадра в candidate-спеке STAB-BASE-03: support.ts принимает только это семейство; доказательство относится к STAB-REL-08 и STAB-EDIT-02"

requirements-addressed: [STAB-A11Y-01, STAB-A11Y-02, STAB-REL-06, STAB-REL-08]
requirements-completed: []

coverage:
  - id: D1
    description: "Под полем картинки блок «Видимая часть» (предпросмотр, «По горизонтали», «По вертикали», «Масштаб», «Сбросить») в «Справочнике» (фото раздела, обложка), «Базе вирусов» (фото после заражения, мутация), «Корзине» (файл-картинка, фото и мутация вируса в корзине), «Информации» (фото-блок)"
    requirement: STAB-REL-08
    verification:
      - kind: automated_ui
        ref: "editor-ui-contract.spec.ts D-63 x 8 поверхностей x chromium-desktop и chromium-phone: 16 passed, --retries=0"
        status: pass
      - kind: unit
        ref: "lib/editor-image-framing.test.ts (5 тестов): каждая строка <ImageEditorField, кроме showPreview={false} и фото сотрудника, несёт три атрибута"
        status: pass
    human_judgment: true
    rationale: "Вид выбранной части на настоящих фото и на настоящем телефоне оценивает владелец (20-UAT EDITOR-FRAMING-01, галерея 20-54)"
  - id: D2
    description: "Предпросмотр совпадает с сайтом: objectPosition, transform, transform-origin равны, соотношение сторон не отличается более чем на 2%; цепочка редактор -> тело PUT (перехвачено и прервано) -> сайт"
    requirement: STAB-REL-08
    verification:
      - kind: automated_ui
        ref: "frameChain в editor-ui-contract.spec.ts: те же 16 прогонов; кадр 20/80/160 клавиатурой, тело PUT содержит кадр, сайт на теле PUT"
        status: pass
    human_judgment: false
  - id: D3
    description: "Смена адреса и «Сбросить» убирают кадр из данных; редактор читает сохранённый кадр обратно в ползунки"
    requirement: STAB-REL-08
    verification:
      - kind: automated_ui
        ref: "frameChain, вторая сессия редактора на теле PUT: ключ кадра отсутствует после «Сбросить» и после смены адреса, адрес в теле новый"
        status: pass
    human_judgment: false
  - id: D4
    description: "Доступность: имена и значения в процентах у ползунков, Tab доходит до трёх ползунков и «Сбросить», на phone цели не менее 44 px, нет горизонтального overflow, блок не перекрывает поле адреса и зону загрузки; axe без critical/serious"
    requirement: STAB-A11Y-01
    verification:
      - kind: automated_ui
        ref: "editor-ui-contract.spec.ts [STAB-A11Y-01] и 4 теста [STAB-A11Y-02] (Справочник, База вирусов, Информация, Корзина) на двух проектах; замер phone: ползунки 242x44, «Сбросить» 86x44"
        status: pass
    human_judgment: true
    rationale: "Экранный диктор и касание на физическом телефоне проверяет владелец (STAB-A11Y-01/02 остаются Pending до приёмки)"
  - id: D5
    description: "Файл редактора отличается от образца только правками D-57, D-62 и атрибутами кадра; набор русских строк прежний"
    requirement: STAB-REL-06
    verification:
      - kind: unit
        ref: "lib/format-launch.test.ts (D-64, D-58, фикстуры D-63: другой элемент, следующая строка, изменённый остаток строки, русский текст внутри атрибута)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Кандидатные кадры для 20-54"
    requirement: STAB-REL-08
    verification:
      - kind: automated_ui
        ref: "phase20-editor-images.spec.ts на PORTIA_VISUAL_SET_ID=phase20-dev-editor-images: 10 passed (5 ID x 2 проекта)"
        status: pass
    human_judgment: true
    rationale: "Вердикт по виду кадров даёт владелец в 20-54; агент не отмечает принято/PASS"
  - id: D7
    description: "Выбор кадра для «Фото сотрудника»"
    verification: []
    human_judgment: true
    rationale: "Не реализовано по решению владельца (20-52, вариант b): это не PASS и не BLOCKED"

duration: ~1 ч 40 мин
completed: 2026-11-07
status: complete
---

# Phase 20 Plan 53: Выбор видимой части картинки в редакторе (D-63) Summary

**Во всех вкладках редактора с картинками (кроме фото сотрудника и фото-блока страницы карточки) под полем есть блок «Видимая часть»: предпросмотр кадром сайта, ползунки с шагом 5 и «Сбросить»; предпросмотр совпадает с сайтом по цепочке редактор -> тело PUT -> сайт на PC и phone, а файл редактора изменён только атрибутами кадра.**

## Accomplishments

- **Компонент.** `components/portia-image-framing.tsx`: `ImageFramingEditor({ src, framing, box, label, onChange })`. Группа `role="group"` с подписью «Видимая часть», три ползунка (`label for`, `aria-valuetext` «40 %», шаг 5, пределы из `imageFramingLimits`), «Сбросить». Значения проходят `normalizeImageFraming`, кадр по умолчанию в данные не пишется. Предпросмотр рисует рамку сайта (`.portia-image`, те же `imageFramingStyles`), вид `natural` / `band` / `tile`.
- **Поле картинки.** `ImageEditorField` получил `framing`, `framingBox`, `onFramingChange`: блок под предпросмотром только при адресе, открывшейся картинке и переданном обработчике. Смена, очистка и вставка адреса сбрасывают кадр в обработчике; загрузка файла — запоминанием адреса в момент выбора файла (первое отличное значение сбрасывает кадр; отказ загрузки метку снимает). Сброс по эффекту на любое изменение адреса отвергнут: он стирал бы кадр, восстановленный отменой действия, и кадр соседней записи с таким же кадром при переключении записей.
- **Подключение.** `components/portia-editor.tsx`: только атрибуты кадра в строках `<ImageEditorField` (см. таблицу), `components/portia-editor-dossier.tsx`: два поля `ArchivedVirusEditor`. Ключ кадра при сбросе удаляется (`delete`), не пишется `undefined`.
- **Охрана D-64.** Запись `D-63` в `approvedEditorEdits` с `normalizeActual: stripFramingAttributes`: из строк `<ImageEditorField` текущего файла вырезаются `framing={…}`, `framingBox="…"`, `onFramingChange={…}` (сбалансированные скобки, строки и шаблоны), затем файл сравнивается с образцом. Атрибут на другом элементе, на соседней строке, изменённый остаток строки и русский текст внутри атрибута ловятся фикстурами; набор русских строк файла (D-58) прежний.
- **Тесты.** `lib/editor-image-framing.test.ts` (5), расширенный `lib/format-launch.test.ts`, e2e в `editor-ui-contract.spec.ts`: восемь поверхностей, клавиатура, цели phone, axe.
- **Кандидаты и документы.** `phase20-editor-images.spec.ts`, раздел UI-SPEC «Кадр картинки в редакторе (D-63, 2026-11-07)» с Copywriting и строками E9, шаги UAT `EDITOR-FRAMING-01` и `EDITOR-INFO-ADD-01` (PC и phone, статус ОЖИДАЕТ; для сотрудников в шаге записано «нет выбора по решению владельца (b)»).

## Поля: строки, вкладка, framingBox, e2e

Строки `components/portia-editor.tsx` / `components/portia-editor-dossier.tsx` на момент 6-го коммита (первая строка тега).

| Поле | Вкладка | Файл:строка | framingBox | e2e PC | e2e phone |
|---|---|---|---|---|---|
| Фото или GIF после заражения | База вирусов | portia-editor.tsx:1242 | natural | pass | pass |
| Изображение или GIF мутации | База вирусов | portia-editor.tsx:1272 | natural | pass | pass |
| Фото (фото-блок) | Информация | portia-editor.tsx:1331 | natural | pass | pass |
| Фото раздела | Справочник | portia-editor.tsx:1375 | band | pass | pass |
| Обложка | Справочник | portia-editor.tsx:1393 | tile | pass | pass |
| Фото (блок страницы карточки, `showPreview={false}`) | Справочник | portia-editor.tsx:1406 | без кадра (свой «Расположение и видимая часть фото») | - | - |
| Фотография или GIF (файл-картинка) | Корзина | portia-editor.tsx:1551 | natural | pass | pass |
| Фото сотрудника | Сотрудники | portia-editor.tsx:2132 | без кадра, employee_framing: b | - | - |
| Фото после заражения (вирус в корзине) | Корзина | portia-editor-dossier.tsx:227 | natural | pass | pass |
| Изображение мутации (вирус в корзине) | Корзина | portia-editor-dossier.tsx:247 | natural | pass | pass |

Замеры целей phone (Pixel 7, эмуляция): три ползунка 242x44 px, «Сбросить» 86x44 px; `scrollWidth` страницы не больше `clientWidth`.

## RED/GREEN

- Task 1 RED `72afc77` (в теле `PLAN_BASE: 0e28927d7eebe82ff916be54cc608d85cd37978f`): охрана — 1 красный тест на поле раздела (12 из 13 зелёных); e2e на chromium-desktop красный («нет блока»). GREEN `f09ac22`: `⚡ Tracer verified end-to-end — expanding`, e2e 2 passed на двух проектах, весь editor-ui-contract 10 passed.
- Task 2 RED `ee9fa4f`: unit 3 красных из 5; e2e на сборке до подключения 22 красных из 26 (4 прошли: поле раздела и axe/клавиатура по «Справочнику»). GREEN `f8e3213`, исправление границы `19b596b`.
- Task 3: проверка и документы `b0ba2b5`.

## Task Commits

1. `72afc77` test: правило охраны и цепочка по фото раздела (RED)
2. `f09ac22` feat: блок «Видимая часть» под фото раздела «Справочника»
3. `ee9fa4f` test: остальные поверхности, клавиатура, axe (RED)
4. `f8e3213` feat: остальные поля
5. `19b596b` fix: граница конструктора шаблона и закреплённая строка загрузки
6. `b0ba2b5` test/docs: кандидаты, UI-SPEC, UAT, deferred-items

## Кандидатные кадры для 20-54

Набор `phase20-dev-editor-images`, `tests/e2e/visual-candidates/.runs/phase20-dev-editor-images/` (игнорируется git), 10 кадров, оба проекта chromium-desktop и chromium-phone:

| ID | Поверхность | Требование (поле спека / доказательство) |
|---|---|---|
| editor-info-add-section | «Информация» с кнопкой «+ ДОБАВИТЬ РАЗДЕЛ» сверху (D-62) | STAB-BASE-03 / STAB-EDIT-02 |
| editor-image-framing-guide | «Справочник», блок под фото раздела | STAB-BASE-03 / STAB-REL-08 |
| editor-image-framing-dossier | «База вирусов», блок под фото после заражения | STAB-BASE-03 / STAB-REL-08 |
| guide-framed | окно «Справочник» сайта: полоса и плитка с кадром, плитка без кадра рядом | STAB-BASE-03 / STAB-REL-08 |
| dossier-framed | досье сайта с кадром фото | STAB-BASE-03 / STAB-REL-08 |

Кадры `editor-image-framing-employee` и `employee-portrait-framed` не снимались (вариант b). Пометка на каждом кадре: «UI-контракт на подменённых чтениях GET /api/access и GET /api/content, не доказательство ролей». Картинки — файлы public/assets, не настоящие фото. В галерее 20-54 нужно честно написать владельцу, что выбор видимой части у фото сотрудников не сделан по его решению. Ни один кадр не отмечен принято/PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Предпросмотр на PortiaImage ломал границу конструктора шаблона**
- **Found during:** Task 3, полный `lib/*.test.ts` (3 красных: `portia-template-builder.test.ts`, `portia-desktop.test.ts`, `dossier-parts.test.ts`).
- **Issue:** конструктор шаблона делит с редактором `ImageEditorField`; импорт `PortiaImage` из `portia-desktop-media` затягивал в его граф модуль рабочего стола. Кроме того, переписанная строка `if (file && onUpload) onUpload(file);` нарушила закреплённый тест D-03.
- **Fix:** `FramedPreview` внутри `portia-image-framing.tsx` рисует ту же рамку `.portia-image` и те же `imageFramingStyles`; строка загрузки возвращена как была, запоминание адреса вынесено отдельной строкой; `portia-image-framing` добавлен в список известных общих компонентов семейства редактора (`lib/portia-desktop.test.ts`). После правки e2e пройден заново (44 passed), полный набор `lib/*.test.ts`: 1579 pass, 0 fail.
- **Commit:** 19b596b

**2. [Rule 3 - Blocking] Сохранение идёт через чип несохранённых правок**
- **Found during:** Task 1. Кнопка «СОХРАНИТЬ» лежит в панели за чипом `.editor-save-chip`, а не в виде постоянной кнопки; после прерванного PUT черновик равен прежней базе и чипа нет, поэтому «Сбросить» проверяется второй сессией редактора на содержимом уже с кадром. Исправлено в спеке (`f09ac22`, `f8e3213`).

**3. [Rule 3 - Blocking] Требование кадров в candidate-спеке**
- `tests/e2e/visual-candidates/support.ts` принимает только `STAB-BASE-03` | `STAB-BASE-04`; план просил STAB-REL-08 / STAB-EDIT-02. Использован `STAB-BASE-03` с пояснением в заголовке спека и в `state` (как в `template-builder.spec.ts` и `phase20-art.spec.ts`); `support.ts` не менялся.

### Расхождения плана с фактом (не отклонения от результата)

- План требовал равенства вычисленного `transformOrigin`; вычисленное значение всегда в пикселях и следует за размером рамки, поэтому сравнивается инлайн `transform-origin` (пара процентов) — это то, что отправляет сайт.
- Для `natural` соотношение сторон сравнивается по картинке: у мутации картинка 420 px по центру более широкой рамки `.portia-image`, и «соотношение рамки» на сайте и в предпросмотре отличалось бы по причинам, не связанным с кадром. Для полосы и обложки сравнивается рамка.
- 20-51 сказал, что у `contain`-картинок смещение без масштаба почти не видно. Замер подтвердил: UX не менялся, решение записано в UI-SPEC («выбор виден при масштабе больше 100 %»); как это выглядит на реальных фото, увидит владелец в 20-54.
- Номера строк плана (1369 и т. д.) сдвинулись на 6 после правок 20-50; перечень актуальных строк выше.

**Total deviations:** 3 (2 в тестах и окружении, 1 исправление кода по красному набору).

## Authentication Gates

None.

## Known Stubs

None. Подмена чтений в e2e и кандидатном спеке — намеренный UI-контракт, помечена в заголовках; не выдаётся за доказательство ролей, сохранения на сервере или вида на настоящих фото.

## Threat Flags

None — новых маршрутов, таблиц, прав и колонок нет (`git diff --name-only PLAN_BASE HEAD -- app/api supabase lib/supabase proxy.ts` пусто). Статус угроз: T-20-114 mitigated (охрана расширена записью D-63 + фикстуры, набор русских строк прежний), T-20-115 mitigated (`normalizeImageFraming` в компоненте, нормализация сервера из 20-51; e2e проверяет тело PUT), T-20-116 mitigated (подменены только чтения, единственный перехваченный и прерванный PUT, любая другая запись роняет тест).

## Issues Encountered

- `npm run lint` и `npx` не используются (node-gyp): прямые вызовы eslint, tsc, playwright на Node 22.13.1 из `%TEMP%`.
- Хук проекта блокирует команду, где в тексте стоит имя серверного ключа; сборка и сервер запускались без него в окружении.
- Axe нашёл три узла вне блока с недостаточным контрастом (подсказка «Текст и GIF можно сочетать.», подписи `small[title]` в строках списка вирусов и «Корзины»); записаны в `deferred-items.md`, терпятся по разметке узла, внутри `.image-framing` ноль нарушений.

## Проверки (финальная сборка, Node 22.13.1)

- `node --experimental-strip-types --test lib/*.test.ts`: 1583 теста, 0 fail (4 прежних пропуска).
- `node node_modules/typescript/bin/tsc --noEmit`: код 0. Eslint: 0 errors, 17 warnings (прежние).
- `editor-ui-contract.spec.ts` + `image-framing.spec.ts`, chromium-desktop и chromium-phone, `--retries=0`: 44 passed. Кандидатный спек: 10 passed (+ `template-builder.spec.ts` 8 passed, регрессия общего поля).
- `git diff --exit-code --stat PLAN_BASE -- tests/e2e/visual/__screenshots__`: код 0; сервер на 3100 остановлен (PID сверён по командной строке `next start` проекта), `netstat` не показывает LISTENING.
- Реестр требований: `requirements.mark-complete` не запускался; STAB-A11Y-01, STAB-A11Y-02, STAB-REL-06, STAB-REL-08 остаются Pending до приёмки владельцем.

## Next Phase Readiness

- 20-54: галерея должна показать владельцу кадры из набора `phase20-dev-editor-images`, шаги `EDITOR-FRAMING-01` и `EDITOR-INFO-ADD-01` ждут физической проверки; сообщить, что выбор видимой части у фото сотрудников не сделан по решению (b).
- Открытое: фиксированная пропорция полосы раздела в предпросмотре (окно «Справочник» в размере по умолчанию); контраст трёх узлов вне блока (deferred-items.md).

## Self-Check: PASSED

- FOUND: components/portia-image-framing.tsx, lib/editor-image-framing.test.ts, tests/e2e/visual-candidates/phase20-editor-images.spec.ts
- FOUND коммиты (предки HEAD): 72afc77, f09ac22, ee9fa4f, f8e3213, 19b596b, b0ba2b5; `git rev-list --count PLAN_BASE..HEAD` = 6
- `git diff --exit-code --stat PLAN_BASE -- tests/e2e/visual/__screenshots__`: 0; 3100 не слушается
