---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 43
subsystem: ui
tags: [template-builder, virus-card, shared-component, view-switch, a11y, playwright, d-55]

requires:
  - phase: PORTIA-20
    provides: "20-38 (модель шаблона и локальные слоты), 20-39 (форма конструктора как у редактора), 20-42 (предшественник), решение владельца D-55"
provides:
  - "components/portia-virus-card.tsx: VirusCardBody (шапка, разделы 01-05, слот after, подвал), FormattedText (embedMedia, emptyText), DossierSection, classificationLevel; медиа через свойство media"
  - "Публичное досье (VirusRecord) рисуется через VirusCardBody, разметка побайтно та же; реэкспорт FormattedText и DossierSection из portia-desktop-dossier.tsx"
  - "Предпросмотр шаблона - article.record-view с тем же VirusCardBody: окрашенные иконки классов, разделы 01-05, подвал «ШАБЛОН <код>», без раздела 06"
  - "Компактный конструктор: переключатель «Поля» / «Предпросмотр» (aria-pressed), форма смонтирована и скрыта, карточка на всю ширину; загрузка и состояние в обоих видах"
affects: [20-44, 20-47, 20-12]

actuals:
  tokens: 21000
  tasks: 3
  commits: 4
plan_head_before: d39f557f9206cd6c32a8c96292020e854609ad22
plan_head_after: 58cabd1570067fba82e4deebf838cebdb8520abf
commits: 4

tech-stack:
  added: []
  patterns:
    - "Одна карточка для двух мест: общий компонент не знает источника картинок, владелец даёт функцию media(slot); публичная и локальная реализации рисуют свою разметку"
    - "Пустое значение в карточке - em.formatted-empty (не span: правила .record-status span и .class-cell span ломают вложенный span)"
    - "Форма остаётся смонтированной под hidden, карточка монтируется только в своём виде"

key-files:
  created:
    - components/portia-virus-card.tsx
  modified:
    - components/portia-desktop-dossier.tsx
    - components/portia-template-builder.tsx
    - app/portia.css
    - lib/portia-template-builder.test.ts
    - lib/portia-desktop.test.ts
    - lib/rich-text-media.test.ts
    - tests/e2e/specs/template-builder.spec.ts
    - tests/e2e/specs/accessibility.spec.ts
    - tests/e2e/visual-candidates/template-builder.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md

key-decisions:
  - "D-55: предпросмотр и экспорт рисует тот же VirusCardBody, что публичное досье; отдельной разметки предпросмотра в конструкторе нет"
  - "Раскладка карточки как у архива, без особого порога: окно «Повышение» шириной 760 px даёт карточке около 690 px, это меньше 840 px, поэтому .record-hero в одну колонку (архив при 1040 px складывается так же); две колонки появляются в развёрнутом окне"
  - "Пустые значения в карточке шаблона - em.formatted-empty со словами «Не заполнено»; пустое фото - рамка архива без логотипа (экспорт самодостаточен)"
  - "Форматирование полей в предпросмотре проходит через templateFieldRuns (фильтр стилей модели 20-38), а не через сырые документы"

requirements-completed: [STAB-TMPL-01, STAB-VIS-04, STAB-A11Y-01, STAB-A11Y-02]

coverage:
  - id: D1
    description: "Предпросмотр шаблона - настоящая карточка базы вирусов: один VirusCardBody у публичного досье и конструктора, нет своей разметки предпросмотра, окрашенные иконки классов (7 svg.class-badge, цвета уровней rgb(180,54,50) / (128,88,0) / (22,122,77) и transmission rgb(11,117,104)), пять .section-kicker, нет «ЗАПИСИ УЧЁНЫХ»"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-builder.test.ts#D-55 (20-37) x4 и D-55 (20-43)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/specs/template-builder.spec.ts#D-55 the preview is the archive card with coloured class icons (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: true
    rationale: "Похожа ли карточка на «Базу вирусов» глазами владельца, решает он по кадрам 20-47"
  - id: D2
    description: "Публичное досье не изменилось: outerHTML .record-view .record-body первого (единственного) вируса цели побайтно равен до и после на PC и phone, SHA256 двух кадров панели класса равны принятым в ledger"
    requirement: STAB-VIS-04
    verification:
      - kind: other
        ref: "cmp дампов record-pc/phone before1 и final (код 0); sha256 class-icons-dossier-virus-mv6ykt3r-xtsai-panel--chromium-desktop/phone"
        status: pass
    human_judgment: false
  - id: D3
    description: "Компактный конструктор: переключатель «Поля» / «Предпросмотр» с aria-pressed, форма смонтирована и скрыта, карточка на всю ширину, загрузка в обоих видах; scrollHeight в виде «Поля» на PC 769 px против 2033 (38%), на телефоне 1491 против 3384"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "tests/e2e/specs/template-builder.spec.ts#D-55 compact: the view switch keeps the draft and the card is two-column on a PC (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: true
    rationale: "Достаточно ли компактно и удобно, решает владелец по кадрам 20-47"
  - id: D4
    description: "Доступность: у кнопок вида доступные имена и aria-pressed, axe без critical/serious в обоих видах, цели вида, вкладок и загрузки не меньше 44 px на телефоне"
    requirement: STAB-A11Y-01
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/accessibility.spec.ts#template builder (UI-contract stub) (chromium-desktop, chromium-phone)"
        status: pass
      - kind: automated_ui
        ref: "tests/e2e/visual-candidates/template-builder.spec.ts (assertTouchTargets для кнопок вида на chromium-phone)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Запрет записи на сайт сохранён: граф импорта конструктора (с portia-virus-card) без модулей редактора, рабочего стола, «Повышения», загрузки, доступа, сети, Supabase; fail-first фикстура по-прежнему роняет тест; trackWrites пуст в каждом сценарии"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-builder.test.ts (17 тестов); GSD_PROHIB_SUBJECT=lib/fixtures/template-builder-violation.txt даёт 10 падений"
        status: pass
      - kind: e2e
        ref: "template-builder.spec.ts: expect(writes).toEqual([]) в каждом сценарии"
        status: pass
    human_judgment: false

duration: 23 min
completed: 2026-11-07
status: complete
---

# Phase PORTIA-20 Plan 43: шаблон как настоящая карточка базы вирусов (D-55) Summary

**Предпросмотр шаблона рисует тот же `VirusCardBody`, что публичное досье (окрашенные иконки классов, разделы 01-05, подвал «ШАБЛОН»), конструктор стал компактным за счёт переключателя «Поля» / «Предпросмотр» (высота формы на PC 2033 -> 769 px), разметка публичного досье побайтно прежняя, запись на сайт по-прежнему невозможна.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-11-07T07:42:25Z
- **Completed:** 2026-11-07T08:05:47Z (метаданные позже)
- **Tasks:** 3 (Task 1 типа tracer)
- **Files modified:** 11 (1 создан)
- **PLAN_BASE:** `d39f557f9206cd6c32a8c96292020e854609ad22` (HEAD перед Task 1)

## Accomplishments

- **Общий модуль карточки** `components/portia-virus-card.tsx`: `VirusCardBody` (свойства `virus`, `formattedText`, `media`, `embedMedia`, `emptyText`, `after`, `footer`), `FormattedText`, `DossierSection`, `classificationLevel`. Импортирует только react, lib/portia-content, portia-icons, lib/rich-text-media.
- **Публичное досье** `VirusRecord` стало `VirusCardBody` + публичный `MediaBlock` + раздел 06 в `after` + подвал «ЗАПИСЬ <код>»; из portia-desktop-dossier.tsx реэкспортируются `FormattedText` и `DossierSection`, импорты в portia-desktop-documents.tsx и portia-desktop.tsx не менялись.
- **Предпросмотр конструктора** - `article.record-view.template-card-preview[aria-label="Предпросмотр шаблона"]` с `VirusCardBody`: локальные слоты `figure.subject-media` с подписью архива, пустой слот без логотипа, `embedMedia={false}`, `emptyText="Не заполнено"`, подвал «ШАБЛОН <код>»; стили текста проходят через `templateFieldRuns`.
- **Компактный конструктор:** группа «Вид» (две кнопки, `aria-pressed`), полоса с кнопками «Скачать PNG/HTML», подсказкой и состоянием над обоими видами; форма смонтирована и скрыта `hidden`, карточка монтируется только в своём виде; смена вида закрывает панель оформления, как смена вкладки; отступы формы меньше.
- **Стили:** удалены все правила прежнего предпросмотра (`grep -cE '^\.template-(class|kicker|mutation|rich|preview)' app/portia.css` = 0, на HEAD 16), добавлены переключатель, `.formatted-empty`, `.template-card-preview`, цели 44 px на телефоне.

## Замеры

### Публичное досье до и после (T-20-85)

Дампы вне репозитория, скрипты `dump-record.mjs` и `dump-all.mjs` (Playwright из node_modules проекта, `http://127.0.0.1:3100`, профили 1440x900 и Pixel 7): `C:\Users\User\AppData\Local\Temp\claude\281999b507a4367f\405847e2-d153-49cb-ad1a-ef80fe916ab2\scratchpad\dumps\`.

| файл до | файл после | `cmp` |
|---|---|---|
| `record-pc-before1.html` (7000 знаков; `before2` равен `before1`, дамп детерминирован) | `record-pc-after.html`, `record-pc-final.html` | код 0 (побайтно равны) |
| `record-phone-before1.html` | `record-phone-after.html`, `record-phone-final.html` | код 0 |
| `records-all-pc-before1.html`, `records-all-phone-before1.html` | `records-all-*-after.html` | код 0 |

Оговорка: цель отдаёт ровно один вирус (`virus-mv6ykt3r-xtsai`, «НОВЫЙ ВИРУС», без мутаций и фото), поэтому дамп не покрывает мутации, картинки и встроенные GIF публичной карточки; для них равенство держится на дословном переносе разметки и на неизменных свойствах `MediaBlock` (alt, label, recordId, priority). Старые `VirusRecord` и новый не сравнивались на синтетическом наборе с мутациями.

### Кадры class-icon (панель классификации записи)

| кадр | SHA256 до (HEAD d39f557) | SHA256 после (final) | hash в ledger (20-VISUAL-APPROVAL.md, cf8fcfcc249f) |
|---|---|---|---|
| `class-icons-dossier-virus-mv6ykt3r-xtsai-panel--chromium-desktop.png` (class-icon-oblivium:pc, infernar:pc, xenomorph:pc) | `6cc911915bfe7c3ed69251b95a85d0a4ba21fad9c58f378e4141c32e6134faf7` | то же | начинается с `6cc911915bfe7c3ed69251b` |
| `class-icons-dossier-virus-mv6ykt3r-xtsai-panel--chromium-phone.png` (class-icon-oblivium:phone, xenomorph:phone) | `8bcad9a0c90ae4652788190635a7f230788cacae90bedb1df08e2b1523e3630b` | то же | начинается с `8bcad9a0c90ae46527` |

Пять строк ledger дают два файла (PC и phone), потому что одна запись несёт все три класса.

### Высота прокручиваемой области `.template-builder` (пустой черновик, вкладка «Основное»)

| | до (сборка Task 1, карточка рядом с формой) | после (вид «Поля») | доля |
|---|---|---|---|
| PC (chromium-desktop, окно 760x620) | 2033 px | **769 px** | 0.38 (требование не больше 0.75) |
| phone (chromium-phone) | 3384 px | **1491 px** | 0.44 |

Базой взята сборка Task 1: сборки HEAD 33552db нет, а Task 1 форму не менял (менялась только карточка рядом).

## RED

Отдельный коммит `a6bf37d` (test): 3 падения unit (`the public dossier and the builder's preview render the same VirusCardBody`, `no markup of its own`, `keeps links as text and draws pictures only from the model's local slots`) и падение сценария `D-55 the preview is the archive card` на chromium-desktop на сборке HEAD (`Received string: "template-preview"` вместо `record-view`). Оговорка: модуль карточки и перенос в portia-desktop-dossier.tsx уже лежали в рабочем дереве (не закоммиченными) при RED-прогоне, поэтому тест «модуль карточки импортирует только ...» в RED уже проходил.

## Task Commits

1. **RED:** `a6bf37dd8100ef1dbaec6a44a4640c0ed8a61989` (test) - проверки D-55.
2. **Task 1 (tracer, GREEN):** `92fa1f0937f9e1648abe642b6e18d7abc1977fb2` (feat) - общий модуль карточки, публичное досье, предпросмотр, сопровождающие правки source-reading тестов.
3. **Task 2:** `1f39e70b692bc11b207f4489a27132c25628e055` (feat) - переключатель вида, компактная форма, стили, перенос спеков.
4. **Task 3 docs:** `58cabd1570067fba82e4deebf838cebdb8520abf` (docs) - 20-UI-SPEC.md.

**Plan metadata:** следующий коммит (docs: complete plan).

## Результаты проверок

- Tracer (Task 1): unit-тройка (60 pass, 0 fail), фикстура `template-builder-violation.txt` роняет тест (10 падений), сценарий D-55 на chromium-desktop - 1 passed; `⚡ Tracer verified end-to-end - expanding` (interactive, `end-of-phase`, `<verify>` только автоматический).
- `template-builder.spec.ts` + `accessibility.spec.ts -g "STAB-TMPL-01|template builder"` на chromium-desktop и chromium-phone, `--retries=0`: **28 passed**.
- Кадры `tests/e2e/visual-candidates/template-builder.spec.ts` на обоих проектах: **8 passed** (трекер записи в `afterEach` пуст); файлы в `tests/e2e/visual-candidates/.runs/phase20-dev-template-d55/`: `template-builder-{main,text,mutations,preview}--{chromium-desktop,chromium-phone}.png` (в плане названы `phase20-template-builder-*`, реальные имена без префикса `phase20-`).
- Кадр `template-builder-preview`: на PC (окно развёрнуто) карточка архива на всю ширину, две колонки (фото слева, панель классификации справа), окрашенные иконки классов (Апейрон красный, Тезей жёлто-коричневый, Предупреждение/Изоморф/Стабилар зелёные), раздел 02 с оформленным словом «Бугристая»; на phone одна колонка, фото, затем ячейки классификации с иконками. «Предупреждение» на PC в трёх колонках переносится по буквам («Предупреждени/е») - это поведение архива при той же ширине панели, не правилось.
- Unit `node --experimental-strip-types --test lib/*.test.ts`: 1535 тестов, 1531 pass, 0 fail, 4 skipped. `tsc --noEmit` - код 0. eslint `. --ignore-pattern dist --ignore-pattern .next` - 0 errors, 17 warnings (как на базе).
- `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` - код 0; `netstat` - 3100 свободен (сервер `next start` останавливался по PID после проверки командной строки).
- Сборка `next build` (Node 22.13.1, `PORTIA_E2E_ALLOW_HTTP=1`) - код 0; `.env*` не читались, `.env.local` читал только Next.js.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-reading тесты следуют за перенесённым кодом**
- **Found during:** Task 1 (полный прогон lib-тестов)
- **Issue:** три теста читали разметку из portia-desktop-dossier.tsx (`component families import only their own seams`, `every record picture goes through PortiaImage`, `IN-01: dossier uses splitEmbeddedMedia`).
- **Fix:** модуль карточки добавлен в список известных общих компонентов; проверки recordId/priority и `splitEmbeddedMedia`/`onError`/«Изображение недоступно» читают portia-virus-card.tsx; проверяется реэкспорт.
- **Files modified:** lib/portia-desktop.test.ts, lib/rich-text-media.test.ts
- **Committed in:** 92fa1f0

**2. [Rule 1 - Bug] Пустое значение во вложенном span ломалось правилами архива**
- **Found during:** Task 2 (axe: `.record-status > .formatted-empty` color-contrast serious)
- **Issue:** `.record-status span` рисует любой span как красную точку 7 px, `.class-cell span` делает его меткой в верхнем регистре.
- **Fix:** пустое значение стало `em.formatted-empty`; правила архива не менялись.
- **Files modified:** components/portia-virus-card.tsx
- **Committed in:** 1f39e70

**3. [Rule 2 - Missing critical] Длинное слово без пробелов в шапке карточки раздвигало окно**
- **Found during:** Task 2 (сценарий «long unbroken text», builderOverflow 1978 px)
- **Issue:** `.record-header h2` в архиве не переносит слова, у шаблона имя набирает участник (до 120 знаков).
- **Fix:** правила `overflow-wrap: anywhere` и `min-width: 0` только внутри `.template-card-preview`.
- **Files modified:** app/portia.css
- **Committed in:** 1f39e70

**4. [Rule 3 - Blocking] Замер axe во время появления карточки**
- **Found during:** Task 2
- **Issue:** карточка архива появляется через `content-fade` (200 мс), axe мерил кадр затухания.
- **Fix:** в полосе шаблона перед сканом вызывается существующий `settle(page)`.
- **Files modified:** tests/e2e/specs/accessibility.spec.ts
- **Committed in:** 1f39e70

### Расхождения с планом (не продуктовые)

**5. Две колонки `.record-hero` на PC - только в развёрнутом окне.** План ожидал две колонки в окне «Повышение» по умолчанию. Окно открывается шириной 760 px; карточке достаётся около 690 px, а правило архива `@container (max-width: 840px)` складывает колонки, как у архива в его окне по умолчанию (1040 px -> около 670 px). Особый порог для шаблона отвергнут: в 690 px три колонки классов дают ячейки около 120 px и слова ломаются по буквам. Сценарий «D-55 compact» проверяет обе ширины: окно по умолчанию (одна колонка, карточка на всю ширину) и развёрнутое (панель класса рядом с фото, верх не ниже верха фото больше чем на 20 px). Кадр preview на PC снимается в развёрнутом окне. Владелец может ответить «исправить» по кадрам 20-47, если нужен другой порог.

**6. База для высоты - сборка Task 1, а не HEAD 33552db** (см. таблицу замеров).

**7. Дамп публичного досье покрывает один вирус без мутаций** (см. оговорку выше).

**8. Окружение:** `npm run build/start/test/lint` на Node 22.13.1 падают на node-gyp; использованы прямые команды (`node node_modules/next/dist/bin/next build|start`, `node node_modules/@playwright/test/cli.js test`, `tsc`, eslint, `node --experimental-strip-types --test lib/*.test.ts`).

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 1 Rule 2, 1 Rule 3), 4 замечания
**Impact on plan:** продуктовый контракт выполнен; расхождение 5 меняет только ширину, с которой карточка шаблона становится двухколоночной, как у архива.

## Issues Encountered

- Мутации, картинки и встроенные GIF публичной карточки на живой цели не покрыты дампом (одна запись без них).
- Экспорт HTML/PNG по-прежнему рисует свой макет (20-44); предпросмотр и экспорт расходятся, пока 20-44 не выполнен.

## Known Stubs

Нет.

## Threat Flags

Нет: новых сетевых точек, путей аутентификации, доступа к файлам и изменений схемы не добавлено. Новый модуль карточки не содержит токенов сети и хранилища (тест проверяет граф), ссылки на картинки в тексте шаблона остаются текстом (T-20-87), подвал «ШАБЛОН» отличает шаблон от записи (T-20-86), разметка публичного досье не изменилась (T-20-85), запрет записи доказан тестом и пустым `trackWrites` (T-20-84).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 20-44 может строить экспорт HTML/PNG из той же карточки; `VirusCardBody` и `FormattedText` с `embedMedia`/`emptyText` готовы.
- 20-47 снимает кадры для владельца: кадры предпросмотра PC лучше в развёрнутом окне (как в рабочем кадре), решение по порогу двух колонок - за владельцем.
- Сервер на порту 3100 остановлен.

## Self-Check: PASSED

- `components/portia-virus-card.tsx`, `components/portia-desktop-dossier.tsx`, `components/portia-template-builder.tsx`, `lib/portia-template-builder.test.ts`, `20-UI-SPEC.md`, восемь кадров `template-builder-*--*.png` - найдены.
- Коммиты a6bf37d, 92fa1f0, 1f39e70, 58cabd1 - предки HEAD.
- `grep -c aria-pressed components/portia-template-builder.tsx` = 2; `grep -c D-55 20-UI-SPEC.md` = 4; `grep -cE 'template-class-grid|template-preview|template-kicker' components/portia-template-builder.tsx` = 0.
- `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст; 3100 свободен.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
