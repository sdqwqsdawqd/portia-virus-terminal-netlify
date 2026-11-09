---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 44
subsystem: ui
tags: [template-builder, export, html, png, svg-foreignobject, closed-policy, d-55, d-24, playwright]

requires:
  - phase: PORTIA-20
    provides: "20-43 (VirusCardBody, предпросмотр как карточка архива), 20-38 (модель шаблона), решения D-24, D-52, D-55"
provides:
  - "Скачанный HTML - разметка той же карточки VirusCardBody со стилями карточки, перенесёнными из таблиц сайта; PNG - растр этого же HTML (SVG foreignObject -> canvas -> toBlob)"
  - "lib/portia-template-export.ts: templateCardCss, templateCardVariableNames, templateCardDocument, templateCardSvg, templateExportViolations, assertTemplateExportClean, neutralizeTemplateText, renderTemplateCardPng; отдельного сжатого документа больше нет"
  - "Конструктор: скрытая рамка .template-export-frame с тем же TemplateCard, что предпросмотр; политика проверяется до скачивания"
affects: [20-47, 20-12, 20-14]

actuals:
  tokens: 52000
  tasks: 3
  commits: 3
plan_head_before: 3b5ba1546fc3bb56fda9e9f3bbae90510164a55f
plan_head_after: be9af79925cb12dd1d6dcb933d7b48a3de3c956e
commits: 3

tech-stack:
  added: []
  patterns:
    - "Один источник карточки для предпросмотра и файлов: TemplateCard рисуется на экране и в скрытой рамке; файл - её outerHTML (HTML) / XMLSerializer (SVG) плюс правила карточки из document.styleSheets"
    - "Перенос стилей по белому списку: правило попадает в файл, только если все классы всех его селекторов - классы карточки; @font-face, @import, url(), image-set(), animation и ссылки на сайт отбрасываются"
    - "Высота PNG измеряется в скрытом iframe sandbox=allow-same-origin шириной 1060 px на том же HTML, а не в рамке приложения (в телефонном окне @media другие)"

key-files:
  created: []
  modified:
    - lib/portia-template-export.ts
    - lib/portia-template-export.test.ts
    - lib/portia-template-dossier.test.ts
    - lib/portia-template-builder.test.ts
    - components/portia-template-builder.tsx
    - app/portia.css
    - tests/e2e/specs/template-builder.spec.ts

key-decisions:
  - "D-55: HTML и PNG - та же карточка, что предпросмотр; createTemplateDossierHtml, layoutTemplateDossierCard, createTemplateDossierPng, wrapTemplateRuns и канвасные примитивы удалены вместе с тестами"
  - "Шрифты в файл не встраиваются (D-24, запрет сети): работают запасные шрифты тех же семейств (Cascadia Code / Consolas, system-ui)"
  - "Ширина файла и PNG - 1060 CSS px; масштаб PNG 2, пока высота не больше 4000, затем 1 до 8000, выше - TemplatePngTooLargeError с предложением HTML"
  - "Телефон и ПК дают один и тот же PNG (2120x2630 для пустой карточки с одним значением): раскладка PNG считается при ширине 1060, а не при окне приложения"

requirements-completed: [STAB-TMPL-01, STAB-VIS-04]

coverage:
  - id: D1
    description: "Скачанный HTML - настоящая карточка архива: class=record-view, .classification-panel, inline svg.class-badge в .class-cell с классом уровня, правила .class-cell.level-3, @container (max-width: 840px); в открытом без сети файле computed color ячейки уровня 3 rgb(180, 54, 50), две колонки .record-hero при ширине 1280, 0 запросов"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "tests/e2e/specs/template-builder.spec.ts#D-55 the downloaded HTML is the archive card (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: true
    rationale: "Похожа ли карточка в файле на «Базу вирусов» глазами владельца, решает он по галерее 20-47"
  - id: D2
    description: "PNG - растр того же HTML: ширина 1060 x масштаб, пиксели цвета уровня 3 (не меньше 40), красная картинка слота нарисована, подвал в нижней части"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "tests/e2e/specs/template-builder.spec.ts#D-55 the downloaded PNG is the archive card и a local image and long text reach the preview (chromium-desktop, chromium-phone)"
        status: pass
      - kind: unit
        ref: "lib/portia-template-export.test.ts#the PNG is the raster of the SVG: one source, scale 2 up to 4000 px, 1 up to 8000 px, a refusal beyond"
        status: pass
    human_judgment: true
    rationale: "Вид растра (шрифты-заменители, отступы) решает владелец по кадрам 20-47"
  - id: D3
    description: "Закрытая политика: файл самодостаточен (CSP default-src 'none'), нет http(s), script, link, url(, обработчиков, ссылочных атрибутов, встроенного содержимого, раздела «ЗАПИСИ УЧЁНЫХ»; img только data:image/png|jpeg|webp; проверка над HTML и над SVG (два адреса пространств имён) до скачивания; при нарушении файл не скачивается"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-export.test.ts (the export stays inside the closed policy; the policy names every kind of violation; the SVG is checked before anything is loaded)"
        status: pass
      - kind: unit
        ref: "GSD_PROHIB_SUBJECT=lib/fixtures/template-export-violation.txt даёт 1 падение (fail-first)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Запрет записи и сети: ловушки fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource, localStorage, sessionStorage, indexedDB на пути правка -> HTML/SVG/растр -> скачивание дают ноль срабатываний; статическая проверка модулей и фикстуры template-io / template-builder падают как прежде; trackWrites пуст во всех сценариях"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-dossier.test.ts (whole path, whole session); fixtures: template-io -> 1 fail, template-builder -> 13 fail"
        status: pass
      - kind: e2e
        ref: "template-builder.spec.ts: expect(writes).toEqual([]) в каждом сценарии"
        status: pass
    human_judgment: false
  - id: D5
    description: "Прежнее поведение: отказ слишком длинной карточки с предложением HTML (1999 строк x 2 поля, HTML хранит все строки), «Готовим файл…», «Повторить скачивание» после сбоя кодирования/контекста/декодирования, подтверждение ухода"
    requirement: STAB-VIS-04
    verification:
      - kind: e2e
        ref: "template-builder.spec.ts + accessibility.spec.ts -g 'STAB-TMPL-01|template builder', chromium-desktop и chromium-phone: 32 passed"
        status: pass
    human_judgment: false

duration: 2h (с перерывом на лимит)
completed: 2026-11-07
status: complete
---

# Phase PORTIA-20 Plan 44: HTML и PNG шаблона - та же карточка базы вирусов (D-55) Summary

**Скачанный HTML и PNG теперь рисуют ту же карточку `VirusCardBody`, что предпросмотр и публичное досье: разметка карточки и её собственные правила из таблиц сайта лежат в одном файле, иконки классов окрашены по уровню (rgb(180, 54, 50) у уровня 3), PNG - растр этого же HTML через SVG foreignObject, а закрытая политика проверяет и HTML, и SVG до скачивания.**

## Performance

- **Duration:** ~2 ч с перерывом на лимит; **Tasks:** 3; **Файлов:** 7 (0 создано)
- **PLAN_BASE:** `3b5ba1546fc3bb56fda9e9f3bbae90510164a55f`
- **Старт:** 2026-11-07T08:13:43Z

## Accomplishments

- `lib/portia-template-export.ts` переписан под D-55: чистые `templateCardCss` (белый список классов карточки, обёртки @media/@container сохраняются, `:root` только с переданными безопасными переменными), `templateCardDocument` (CSP `default-src 'none'; style-src 'unsafe-inline'; img-src data:`, экранированный заголовок), `templateCardSvg` (foreignObject), `templateExportViolations` (политика, режим SVG допускает ровно два xmlns), `renderTemplateCardPng` (один источник `data:image/svg+xml`, масштаб 2 / 1 / отказ). Удалены прежний плоский документ, канвасная раскладка, `wrapTemplateRuns`, `wrapTemplateText` и таблицы подписей.
- Конструктор: `TemplateCard` (общий для предпросмотра и скрытой рамки `.template-export-frame`, `aria-hidden`, `inert`), снятие разметки `outerHTML` (файл) и `XMLSerializer` (SVG), правил - из `document.styleSheets` (одного происхождения), значений переменных - из `getComputedStyle(:root)`; перед каждым скачиванием `templateExportViolations`; рамка снимается сразу после снятия разметки.
- `app/portia.css`: рамка вне экрана шириной 1060 px; внутри карточки экспорта шапка не липкая, ячейки PPU без прокрутки (правила `.template-export-card` едут в файл вместе с карточкой).
- Тесты: 58 unit-тестов тройки проходят, добавлены проверки отбора CSS, политики, SVG, растра, ловушек и источника конструктора; два e2e-сценария (HTML, PNG), прежние сценарии 20-38/20-39 переведены на разметку карточки.

## Замеры

| | значение |
|---|---|
| HTML в файле, офлайн-открытие (ширина 1280) | запросов 0 (кроме file:/data:), computed color `.class-cell.danger strong` и его svg = `rgb(180, 54, 50)`, колонок `.record-hero` = 2 |
| Блок `<style>` скачанного HTML | не короче 2000 знаков, без `@font-face`, `@import`, `url(`, `http` (тест) |
| PNG chromium-desktop / chromium-phone | 2120x2630 / 2120x2630, 866979 байт (масштаб 2; карточка 1315 CSS px; оба файла совпадают) |
| Пиксели цвета уровня 3 (±12) | не меньше 40 (проверка проходит; точное число тест не печатает) |
| Порог «слишком длинной» карточки | высота страницы более 8000 CSS px (при 4000-8000 масштаб 1; при 2 x высота не более 8000 - масштаб 2). Пустая карточка 1315 px; строка ~28 px, то есть отказ примерно с 240 дополнительных строк (в тесте 2 x 1999) |
| WebKit-проба (Playwright 1.64.1, собранная страница, сайт-CSP) | PNG с картинкой слота получен с первого раза без повторного decode: красная картинка нарисована; ширина 2120, высота 7096 для длинной карточки; в хвосте WebKit-растра пустое поле около 300 CSS px (содержимое не обрезано), причина не установлена |
| Firefox-проба | PNG и HTML-сценарии (D-55) проходят; в сценарии «local image and long text» Firefox не находит «строка-89 описание» в HTML (вставка в contenteditable), отдельно не разбирался |
| `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` | код 0; порт 3100 свободен |

Файлы прогонов: `tests/e2e/visual-candidates/.runs/phase20-dev-template-d55/exports/` (`template-html--chromium-{desktop,phone}.html`, `template-png--chromium-{desktop,phone}.png`; игнорируются git).

## RED

Коммит `bee4d9d` (test): unit-тройка падает (2 SyntaxError «does not provide an export named renderTemplateCardPng / assertTemplateExportClean», 3 проверки конструктора, итог `# fail 5`); сценарий HTML добавлен в тот же коммит.

## Task Commits

1. **RED:** `bee4d9d2de64b2b50e1e187ecce5c7bf78ef63a5` (test) - тесты D-55.
2. **Task 1 + Task 2 (GREEN):** `d3254ac24eed61f0c422b9d21b1ef80e90abce58` (feat) - модуль, конструктор, стили; PNG-путь реализован вместе с HTML, потому что оба берут один снимок карточки.
3. **Task 2/3:** `be9af79925cb12dd1d6dcb933d7b48a3de3c956e` (feat) - сценарий PNG, перенос прежних e2e, высота страницы по нижней кромке карточки.

template_fix_commit: be9af79925cb12dd1d6dcb933d7b48a3de3c956e

**Plan metadata:** следующий коммит (docs: complete plan).

## Результаты проверок

- Unit `node --experimental-strip-types --test lib/*.test.ts`: 1532 теста, 1528 pass, 0 fail, 4 skipped. `tsc --noEmit` - код 0. eslint `. --ignore-pattern dist --ignore-pattern .next` - 0 errors, 17 warnings (как на базе).
- Fail-first: `template-export-violation.txt` - `# fail 1`; `template-io-violation.txt` - `# fail 1`; `template-builder-violation.txt` - `# fail 13`.
- `template-builder.spec.ts` + `accessibility.spec.ts -g "STAB-TMPL-01|template builder"`, chromium-desktop и chromium-phone, `--retries=0`: **32 passed**. Кадровый спек `visual-candidates/template-builder.spec.ts` (набор `phase20-dev-template-d55`): **8 passed**, трекер записи пуст.
- Сборка `next build` на Node 22.13.1 с `PORTIA_E2E_ALLOW_HTTP=1` - код 0 (дважды); `.env*` не читались.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Набранный участником адрес не должен блокировать экспорт**
- **Found during:** проектирование Task 1 (политика теперь работает во время экспорта, а не только в тесте)
- **Issue:** текст поля «https://...» или «url(» в тексте карточки попал бы под правило «внешний адрес»/«css url», и скачивание отказывало бы без причины.
- **Fix:** `neutralizeTemplateText` заменяет в тексте между тегами `http:`/`https:`/`url(` на символьную ссылку одного знака (текст виден прежним); атрибуты и теги не трогаются, настоящий адрес в атрибуте по-прежнему ловится. Тесты на набранный адрес и на атрибут.
- **Files modified:** lib/portia-template-export.ts, lib/portia-template-export.test.ts
- **Committed in:** d3254ac

**2. [Rule 2 - Missing critical] Политика расширена двумя правилами**
- **Issue:** адрес без схемы (`href="//evil"`) и вложенное содержимое (`<iframe>`, `<object>`, `<embed>`, `<base>`, `<form>`, `<image>`, `<use>` ...) не попадали в прежний список.
- **Fix:** добавлены «reference attribute» (`href`, `xlink:href`, `action`, `formaction`, `poster`, `srcset`, `ping`, `data`) и «embedded content»; `img` проверяется по единственному `src` в любом порядке атрибутов (React пишет src последним). Прежний список правил остался как есть.
- **Committed in:** d3254ac

**3. [Rule 3 - Blocking] Высота PNG измеряется в iframe, а не в рамке приложения**
- **Found during:** Task 1 (проектирование)
- **Issue:** рамка живёт в окне приложения; в телефонном окне применяются правила `@media (max-width: 900px)`, и её высота не равна высоте SVG, который рисуется при ширине 1060 (обрезка или пустой хвост).
- **Fix:** `measureCardPage` загружает собранный HTML в скрытый `iframe sandbox="allow-same-origin"` шириной 1060 px и берёт нижнюю кромку карточки. Следствие: PNG на телефоне и на ПК совпадают. Сайт-CSP пропускает srcdoc-фрейм.
- **Committed in:** d3254ac, be9af79

**4. Task 1 и Task 2 в одном GREEN-коммите**
- Рамка, снятие разметки и растр используют одну и ту же функцию снимка; PNG-путь реализован одновременно с HTML. Тесты RED по-прежнему закоммичены отдельно (bee4d9d).

**5. e2e прежних сценариев**
- Ожидания прежнего HTML заменены разметкой карточки: `<h3>` -> `<h4>`, `style` в форме браузера (`font-size: 22px; font-weight: 800;`, `rgb(180, 54, 50)`), `img` с `src` в любом порядке, заголовок файла - `h2` шапки карточки; проверки PNG - ширина 1060 x масштаб и пиксели цвета уровня 3 вместо раскладки 1000 px. Правила проверки не ослаблены.

**6. Окружение:** `npm run ...` на Node 22.13.1 падает на node-gyp; использованы прямые команды (next build/start, playwright cli.js, tsc, eslint). Playwright не умеет запускать webkit/firefox в репозиторном конфиге: пробы сделаны отдельным конфигом вне репозитория (в scratchpad).

---

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 3), 3 замечания.
**Impact on plan:** продуктовый контракт выполнен; политика строже плана, а набранный текст при этом не ломает скачивание.

## Issues Encountered

- WebKit: пустой хвост около 300 CSS px в PNG длинной карточки, причина не установлена (содержимое не обрезано); в WebKit общий диагностический ledger e2e ловит только предупреждения report-only CSP (так же падает несвязанный сценарий на WebKit без моих изменений), поэтому WebKit в проверки плана не входит.
- Firefox: сценарий «local image and long text» не находит последнюю строку в HTML (поведение вставки в contenteditable); HTML- и PNG-сценарии D-55 проходят.
- Шрифты сайта в файле заменены запасными (Cascadia Code / Consolas, system-ui); владелец увидит это в галерее 20-47. Физический телефон - 20-14.

## Known Stubs

Нет.

## Threat Flags

Нет новых сетевых точек. Митигации T-20-88..T-20-90 выполнены: политика над готовым файлом и над SVG до скачивания (при нарушении - «Не удалось подготовить файл», черновик цел), перенос стилей по белому списку без шрифтов/url(), в растр грузится только собранный SVG (один источник в unit-тесте). Новый скрытый iframe использует `sandbox="allow-same-origin"` без скриптов и загружает только проверенный HTML.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 20-47 показывает файлы из `exports/` и читает `template_fix_commit` (раздел 13 ledger).
- Решения владельца по кадрам: вид шрифтов-заменителей в файле и PNG, раскладка при ширине 1060.
- Сервер на порту 3100 остановлен.

## Self-Check: PASSED

- `lib/portia-template-export.ts`, `components/portia-template-builder.tsx`, `app/portia.css`, четыре файла тестов, `exports/template-{html,png}--chromium-{desktop,phone}.*` - найдены.
- Коммиты bee4d9d, d3254ac, be9af79 - предки HEAD; `git cat-file -e be9af79...^{commit}` - код 0.
- `grep -cE '^export (async )?function (createTemplateDossierHtml|layoutTemplateDossierCard|createTemplateDossierPng|wrapTemplateRuns)' lib/portia-template-export.ts` = 0; `grep -c templateExportViolations components/portia-template-builder.tsx` = 2.
- `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст; порт 3100 не слушается.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
