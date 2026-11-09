---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 51
subsystem: ui
tags: [image-framing, content-normalization, portia-image, untrusted-input, gap-closure, owner-verdict, playwright]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: "20-48 решение D-63 (видимая часть картинки, «Справочник» первым); 20-50 UI-контракт на подменённых чтениях (editor-ui-contract.spec.ts); 19 PortiaImage и normalizePortiaContent (STAB-MEDIA-02, -05)"
provides:
  - "lib/image-framing.ts: ImageFraming { x, y, zoom }, defaultImageFraming, normalizeImageFraming, imageFramingStyles (интерфейс для 20-52 и 20-53)"
  - "необязательные поля кадра у шести типов содержимого и явная серверная нормализация после разворотов withoutNote"
  - "PortiaImage со свойством framing: кадр показывается на шести поверхностях сайта, без кадра разметка побайтно прежняя"
affects: [20-52, 20-53, 20-54]

outcome: complete

actuals:
  tokens: 15300
  tasks: 3
  commits: 5

plan_head_before: 165d84943cc9bb3a1b6c6e262c38f07b3d49f354
plan_head_after: b44fc3d60348616b03024acf5d51a7fdd00c2be2
commits: 5

tech-stack:
  added: []
  patterns:
    - "кадр картинки = три целых числа; читаются только собственные конечные числа, округляются и ограничиваются, стили собираются из этих чисел и ни из чего другого"
    - "явная перезапись поля после разворота `...withoutNote(...)`: поле вынимается из разворота (withoutNoteAndKey) и ставится заново из нормализованных чисел (framingEntry); нет картинки — нет кадра, нет кадра — нет ключа (JSON записи без кадра прежний)"
    - "две линии защиты: normalizePortiaContent на сервере и PortiaImage перед стилем"
    - "UI-контракт кадра: подменено одно чтение GET /api/content, трекер записи, кадр / нет кадра / кадр-мусор на каждой поверхности"

key-files:
  created:
    - lib/image-framing.ts
    - lib/image-framing.test.ts
    - tests/e2e/specs/image-framing.spec.ts
  modified:
    - lib/portia-content.ts
    - lib/portia-content-normalize.ts
    - lib/portia-content-normalize.test.ts
    - components/portia-desktop-media.tsx
    - components/portia-desktop-documents.tsx
    - components/portia-desktop-dossier.tsx
    - components/portia-desktop.tsx

key-decisions:
  - "Имя поля кадра у фото-блока «Информации» — `framing` (как в интерфейсе плана), у остальных — `<поле>Framing`: infectedImageFraming, Mutation.imageFraming, GuideSection.photoFraming, GuideCard.coverFraming, RecycleFile.imageFraming"
  - "normalizeImageFraming читает только собственные свойства объекта (Object.prototype.hasOwnProperty): число, пришедшее по прототипу, не кадр; результат — всегда новый объект из ровно трёх ключей"
  - "imageFramingStyles сам ещё раз нормализует вход: даже вызванная напрямую враждебным объектом она даёт пустой результат"
  - "кадр без картинки отбрасывается, кадр, равный умолчанию (50, 50, 100), отбрасывается: ключа нет, JSON записи без кадра не меняется"
  - "К интерфейсу плана добавлены экспорты imageFramingStep (5) и imageFramingLimits для интерфейса выбора в 20-53 (шаг 5 и пределы 0–100 / 100–300 в одном месте); defaultImageFraming заморожен"
  - "Конструктор шаблона и его экспорт, app/portia.css, app/api, supabase, lib/supabase не менялись; кадр живёт в payload portia_content"

requirements-addressed: [STAB-REL-08]
requirements-completed: []

coverage:
  - id: D1
    description: "Кадр ImageFraming { x, y, zoom } (целые проценты 0–100 / 0–100 / 100–300) задан и проверяется: округление, пределы, умолчание = нет кадра, всё не из трёх конечных чисел — нет кадра, лишние ключи не выживают, число по прототипу не читается"
    requirement: STAB-REL-08
    verification:
      - kind: unit
        ref: "lib/image-framing.test.ts (11 тестов: допустимый кадр, округление и пределы ±1e9, умолчание, 24 вида мусора, лишние ключи и __proto__, наследуемые числа, идемпотентность, стили только из чисел)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Сервер (normalizePortiaContent, он же GET и PUT /api/content) явно перезаписывает шесть полей кадра после разворотов withoutNote; кадр без картинки отброшен; мусор не доходит до записи; запись без кадра сериализуется как раньше"
    requirement: STAB-REL-08
    verification:
      - kind: unit
        ref: "lib/portia-content-normalize.test.ts#D-63 (14 тестов), включая «a PUT body with trap frames in all six fields leaves only bounded whole numbers or no key» (13 ловушек: `;`, url(, expression(, вложенные объекты и массивы, __proto__, ±1e9, MAX_VALUE) и мутационная проверка: без withoutNoteAndKey и без normalizeImageFraming 10 тестов падают"
        status: pass
    human_judgment: false
  - id: D3
    description: "Сайт показывает выбранную часть (object-position по x/y, scale от той же точки, рамка с overflow hidden и data-framing) на шести поверхностях: полоса раздела и обложка карточки «Справочника», фото после заражения и изображение мутации в досье, фото-блок «Информации», картинка файла «Корзины» (плюс фото вируса в «Корзине»)"
    requirement: STAB-REL-08
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/image-framing.spec.ts (5 тестов × chromium-desktop и chromium-phone = 10 passed, --retries=0, ни одного запроса записи)"
        status: pass
    human_judgment: true
    rationale: "Автоматика доказывает числа в стиле и вычисленные object-position/transform, не то, как выбранная часть выглядит на реальных фото; настоящий телефон (Pixel 7 — только эмуляция) и вердикт владельца по виду — в галерее 20-54"
  - id: D4
    description: "Картинка без кадра показывается точно как раньше: у PortiaImage без кадра нет data-framing и инлайн-стиля; outerHTML досье вируса цели, 6 страниц «Информации» (PC) и 9 (phone), «Справочника» и «Корзины» (список и 13 файлов) на PC 1440x900 и Pixel 7 побайтно равен сборке PLAN_BASE"
    requirement: STAB-REL-08
    verification:
      - kind: other
        ref: "scratchpad/dump-outerhtml.mjs: 47 пар outerHTML, cmp = 0 для 47 из 47 в двух из трёх прогонов после; в первом прогоне 4 файла «Корзины» PC отличались баннером «Не удалось обновить — показаны данные на 21:00» (сбой опроса данных цели во время длинного прогона), см. «Issues Encountered»"
        status: pass
      - kind: automated_ui
        ref: "tests/e2e/specs/image-framing.spec.ts: expectUnframed на каждой поверхности (нет data-framing, style у рамки и img = null)"
        status: pass
    human_judgment: false
  - id: D4b
    description: "Побайтное равенство снято на данных цели, где у картинок кадров нет; это доказывает отсутствие регрессии «без кадра», а не вид картинки с кадром"
    verification: []
    human_judgment: true
    rationale: "Вид кадра на реальных данных увидит владелец, когда 20-53 даст выбор кадра в редакторе"
  - id: D5
    description: "Файл «Корзины», созданный из вируса (createVirusRecycleFiles), получает кадр фото вируса; восстановление вируса из корзины сохраняет его кадры (объект переносится целиком); конструктор шаблона и экспорт не менялись"
    requirement: STAB-REL-08
    verification:
      - kind: unit
        ref: "lib/portia-content-normalize.test.ts#D-63 the recycle file made from a virus carries the frame…; #a virus in the recycle bin keeps its frames; lib/portia-template-builder.test.ts и lib/portia-template-export.test.ts зелёные; template-builder.spec.ts зелёный на двух проектах"
        status: pass
    human_judgment: false
  - id: D6
    description: "Закрытая вкладка редактора не позволяет менять кадр внутри раздела (T-20-109), маршрут /api/content и пути «Охвата файлов» матрицы безопасности не менялись"
    requirement: STAB-REL-08
    verification:
      - kind: unit
        ref: "lib/portia-content-normalize.test.ts#D-63 T-20-109 a restricted editor without the «Справочник» tab cannot change a frame inside it; lib/security-matrix.test.ts (в полном наборе lib/*.test.ts); git diff --name-only PLAN_BASE HEAD -- app/api supabase/migrations proxy.ts next.config.ts lib/supabase lib/editor-access.ts lib/editor-outline.ts lib/image-upload.ts — пусто"
        status: pass
    human_judgment: false

duration: 28 min (Node 22.13.1 из %TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64; оценка по времени коммитов и началу прогона)
completed: 2026-11-07
status: complete
---

# Phase 20 Plan 51: Кадр картинки (D-63) — данные, проверка сервером и показ на сайте Summary

**Кадр картинки `ImageFraming { x, y, zoom }` по D-63: три целых числа проверяются сервером после разворотов withoutNote, `PortiaImage` нормализует их второй раз и показывает выбранную часть (object-position + scale от той же точки, рамка клипает) на шести поверхностях сайта; картинка без кадра остаётся побайтно прежней.**

## Performance

- **Duration:** ~28 min
- **Completed:** 2026-11-07
- **Tasks:** 3 (tracer + 2 auto), 5 коммитов
- **Files:** 10 (3 новых, 7 изменённых), +640 / −23

## Accomplishments

- **Модуль кадра.** `lib/image-framing.ts` без зависимостей: `normalizeImageFraming(value: unknown)` читает только собственные конечные числа `x`, `y`, `zoom`, округляет, ограничивает (0–100, 0–100, 100–300), возвращает новый объект из трёх ключей или `undefined` (не объект, массив, строка, `NaN`, `Infinity`, нет поля, кадр равен умолчанию 50/50/100); `imageFramingStyles` даёт `frame: { overflow: "hidden" }` и `image: { objectPosition, transform: scale(), transformOrigin }` только из нормализованных чисел. Доп. экспорты для 20-53: `imageFramingStep = 5`, `imageFramingLimits`.
- **Данные и сервер.** Необязательные поля у шести типов (`Virus.infectedImageFraming`, `Mutation.imageFraming`, фото `InfoBlock.framing`, `GuideSection.photoFraming`, `GuideCard.coverFraming`, `RecycleFile.imageFraming`). В `normalizePortiaContent` поля вируса и мутации вынимаются из разворота `...withoutNote(…)` (`withoutNoteAndKey`) и ставятся заново через `framingEntry` из нормализованных чисел — иначе мусор из запроса прошёл бы насквозь; то же для обложки, фото-блока и файла корзины. Нет картинки или ссылка отвергнута — кадра нет; нет кадра — ключа нет. Маршрут `/api/content` не менялся.
- **Показ.** `PortiaImage` получил `framing?: ImageFraming`: вторая нормализация перед стилем; при кадре рамка `.portia-image` получает `data-framing="true"` и `overflow: hidden`, img — слияние прежнего `style` и числового стиля кадра; без кадра ни атрибута, ни стиля. `MediaBlock`/`LoadingMedia` приняли `framing`, `VirusRecord` передаёт кадр слота (фото после заражения и мутация `index`); полоса раздела и обложка карточки «Справочника», фото-блок «Информации» и картинка файла «Корзины» передают кадр своего объекта. `GuidePhoto` (focusX/focusY) и конструктор шаблона не тронуты; `alt`, подписи, ленивость и заглушка «Изображение недоступно» прежние.
- **Перенос в корзину.** `createVirusRecycleFiles` кладёт в файл кадр фото вируса. Вирус в корзине хранится целым объектом (`push`/`filter` в редакторе), поэтому его кадры сохраняются при восстановлении; это закреплено тестом нормализации `recycledViruses`.

## Поверхности: поле, вид рамки, проверено

| Поверхность | Поле | Вид рамки | PC (1440×900) | phone (Pixel 7, эмуляция) |
|---|---|---|---|---|
| Полоса раздела «Справочника» (`.guide-section-band`) | `guideSections[].photoFraming` | cover, заполнение полосы | passed | passed |
| Обложка карточки «Справочника» (`.guide-tile-cover`) | `cards[].coverFraming` | cover 4:3 | passed | passed |
| Досье: фото после заражения (`figure.subject-media`) | `viruses[].infectedImageFraming` | contain | passed | passed |
| Досье: изображение мутации | `mutations[].imageFraming` | contain | passed | passed |
| Фото-блок «Информации» (`.info-block-photo`) | фото `InfoBlock.framing` | contain | passed | passed |
| Картинка файла «Корзины» (`.trash-image-document`) | `recycleFiles[].imageFraming` | contain | passed | passed |
| Фото вируса в «Корзине» (то же досье) | `recycledViruses[].infectedImageFraming` | contain | passed | passed |

На каждой поверхности проверены три картинки: с кадром (`data-framing`, inline `overflow: hidden`, вычисленные `object-position` и `transform: matrix(k,0,0,k,0,0)`, `transform-origin` в стиле), без кадра и с кадром-мусором (строка вместо числа, лишний ключ с `expression(`) — две последние без `data-framing` и без инлайн-стиля у рамки и img. Фото сотрудников — 20-52.

## Доказательство «без кадра» (побайтно)

Скрипт `scratchpad/dump-outerhtml.mjs` (Playwright из node_modules проекта, только чтение, трекер записи) снимает outerHTML с реальных данных цели: `.record-view .record-body` вируса цели, `.info-library` (список и каждая страница, на phone ещё раскрытые группы), `.guide-app`, `.trash-app` (список и каждый из 13 файлов), профили 1440×900 и Pixel 7 — 47 файлов на набор.

- Дампы PLAN_BASE `165d849`: `scratchpad/dump-base-a` (сняты до правок), второй снимок `dump-base-b` — 47 из 47 `cmp` = 0 (метод детерминирован).
- После Task 2 / в финальной сборке: `dump-after` (второй прогон) и `dump-after-2`: **47 из 47 пар `cmp` = 0** в обоих. По группам: досье вируса 1/1 PC и 1/1 phone; «Информация» 6/6 и 9/9; «Справочник» 1/1 и 1/1; «Корзина» 14/14 и 14/14.
- Первый прогон после правок дал 4 отличия (`pc--trash-file-09…12`): в них баннер «Не удалось обновить — показаны данные на 21:00», то есть опрос `/api/content` цели не ответил во время длинного прогона; это сбой окружения, не разметка кадра (два повторных прогона на той же сборке дали 47/47). Результат первого прогона не скрыт.
- Оговорка: у цели кадров нет, поэтому равенство доказывает отсутствие регрессии без кадра, не вид кадра. Вид с кадром доказан UI-контрактом на подменённом чтении.

## Task Commits

1. **Task 1 (tracer): RED** — `c94f42d` (test), `PLAN_BASE: 165d84943cc9bb3a1b6c6e262c38f07b3d49f354` в теле. Unit: 3 красных (нет модуля, два теста раздела); e2e на chromium-desktop красный на `data-framing`.
2. **Task 1 (tracer): GREEN** — `96eddbd` (feat): модуль, типы, нормализация раздела, `PortiaImage`, полоса раздела. `⚡ Tracer verified end-to-end — expanding`: unit 53 из 53, e2e полосы раздела на chromium-desktop 1 passed.
3. **Task 2: RED** — `5d17b34` (test): 6 красных тестов нормализации, 4 красных e2e-теста поверхностей (все на `data-framing`).
4. **Task 2: GREEN** — `5de0ba9` (feat): явная перезапись полей, показ на остальных поверхностях; e2e 10 passed на двух проектах.
5. **Task 3: проверка** — `b44fc3d` (test): тело PUT с ловушками во всех шести полях и закрытая вкладка (T-20-107, T-20-109).

**Plan metadata:** отдельный коммит `docs(PORTIA-20-51): complete …` с этим SUMMARY, STATE.md и ROADMAP.md (в `commits:` выше его нет: измерение сделано до него).

## Проверки (финальная сборка, Node 22.13.1)

- `node --experimental-strip-types --test lib/*.test.ts`: 1575 тестов, 1571 pass, **0 fail**, 4 skipped (прежние); в том числе `lib/security-matrix.test.ts` (матрица свежая) и тесты шаблона.
- `tsc --noEmit` (`node node_modules/typescript/bin/tsc`): код 0.
- Lint: `npm run lint` не стартует (node-gyp), прямой вызов `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`: **0 errors**, 17 warnings (прежние).
- `image-framing.spec.ts` + `template-builder.spec.ts` + `media-states.spec.ts`, chromium-desktop и chromium-phone, `--retries=0`: **60 passed, 2 skipped**. Два пропуска — «[STAB-MEDIA-07] hidden/lazy covers of a folded «Справочник» section» на обоих проектах с причиной `BLOCKED (inherited gap, Phase 19 CR-01)`; это не проход, кейс принадлежит `media-offscreen.spec.ts`.
- Мутационная проверка защиты: с `delete rest[key]` убранным из `withoutNoteAndKey` и `normalizeImageFraming` заменённым приведением типа 10 тестов падают (включая тест тела PUT); после восстановления 54 из 54.
- Acceptance: `git diff --name-only PLAN_BASE HEAD -- app/api supabase/migrations proxy.ts next.config.ts lib/supabase lib/editor-access.ts lib/editor-outline.ts lib/image-upload.ts` — пусто; `git diff --exit-code --stat PLAN_BASE -- tests/e2e/visual/__screenshots__` — код 0; `netstat -ano` не показывает LISTENING на 3100 (PID сверен по командной строке `next start` проекта и остановлен); `grep -c '__proto__\|expression(' lib/portia-content-normalize.test.ts` = 9; `.env*` не читались; сборка и сервер только в режиме посетителя после `phase15-e2e-preflight.mjs visitor` (код 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Тест обложки читал transform у элемента без бокса**
- **Found during:** Task 2, первый зелёный прогон: обложка «Справочника» — `Expected matrix(1.6, 0, 0, 1.6, 0, 0)`, `Received none`.
- **Issue:** секция «Справочника» по умолчанию свёрнута (`guide-grid[hidden]`), у элемента без бокса вычисленный `transform` читается как `none` (стиль при этом в разметке есть; `object-position` читался верно).
- **Fix:** тест открывает свёрнутый раздел перед чтением (`.guide-section-head[aria-expanded="false"]`). Код сайта не менялся.
- **Files modified:** `tests/e2e/specs/image-framing.spec.ts`
- **Commit:** 5de0ba9

**2. [Rule 1 - Bug] Метка в собственном unit-тесте падала на BigInt**
- **Found during:** Task 1, первый прогон после GREEN: `JSON.stringify` не сериализует `BigInt` в метке случая.
- **Fix:** случаи собраны в массив, метка — номер случая; tsc потребовал `BigInt(10)` вместо литерала `10n` (цель ES2017). Исправлено до GREEN-коммита.
- **Commit:** 96eddbd

**Total deviations:** 2 (обе в собственных тестах, код сайта не затронут).

### Расхождения плана с фактом (не отклонения от результата)

- Критерий Task 2 `grep -c 'Framing' components/portia-desktop.tsx` ≥ 2 даёт 1: поле фото-блока «Информации» по интерфейсу самого плана называется `framing` (строчная буква), `activeTrashFile.imageFraming` — единственная строка с `Framing`. Регистронезависимо (`grep -ci framing`) строк 2; обе поверхности подключены, проверены e2e.
- `createVirusRecycleFiles` создаёт файл вируса с `image: ""`; кадр переносится по плану, но при повторной нормализации списка файлов (`normalizeRecycleFiles`) он отбрасывается правилом «нет картинки — нет кадра». Функция работает на пути «списка файлов нет вовсе» (прежние записи), там её результат возвращается как есть. Правило «нет картинки — нет кадра» и перенос не противоречат друг другу на практике, но перенос кадра в файл без картинки сейчас ничего не показывает (файл вируса рисуется текстом).
- Task 3 не имел красной фазы: это проверка. Её тесты зелёные с первого запуска, защита доказана мутационной проверкой (см. выше).

## Issues Encountered

- **Сбой опроса данных в одном прогоне дампов** (см. «Доказательство без кадра»): 4 файла «Корзины» PC несли баннер «Не удалось обновить». Два повторных прогона — 47/47. Причину (кратковременный отказ чтения цели во время длинного прогона) не расследовал: это поведение прежнего кода состояния, не кадра.
- `npm run lint` и `npx` недоступны из-за node-gyp: прямые вызовы. Хук проекта блокирует команду, где в тексте стоят имена серверных ключей (service_role), поэтому сборка и сервер запускались без их упоминания; в оболочке они не заданы.
- Предупреждение git об окончаниях строк (LF→CRLF) для файлов с `core.autocrlf` — прежнее.

## Authentication Gates

None.

## Known Stubs

None — заглушек в изменённых файлах нет. Подмена чтения GET /api/content в спеке — намеренный UI-контракт, помечена в заголовке спека («показ сайта, не доказательство сохранения») и не выдаётся за доказательство сохранения, ролей или живых данных.

## Threat Flags

None — новых сетевых точек, таблиц, прав и колонок нет; `app/api`, `supabase/migrations`, `lib/supabase` не менялись, кадр живёт в payload `portia_content`.

Статус угроз плана: T-20-107 (высокая) — mitigated (явная перезапись, три конечных числа с округлением и пределами, 13 ловушек в тесте тела PUT, вторая нормализация в `PortiaImage`, стиль только числами); T-20-108 — mitigated (zoom ≤ 300, `transform` композитора, рамка клипает); T-20-109 — принято и проверено тестом закрытой вкладки.

## Next Phase Readiness

- **20-52 (фото сотрудников)** и **20-53 (выбор кадра в редакторе, предпросмотр = страница):** модуль и тип готовы, `PortiaImage` принимает `framing`, `imageFramingStyles(normalizeImageFraming(...))` — та же функция для предпросмотра. Для редактора: `imageFramingStep`, `imageFramingLimits`. Правка `components/portia-editor.tsx` потребует новой записи в реестре `approvedEditorEdits` охраны D-57/D-64 (`lib/format-launch.test.ts`).
- **20-54 (галерея владельцу):** показать кадр на всех шести поверхностях на реальных фото; вид выбранной части и телефон на устройстве проверяет владелец. STAB-REL-08 остаётся Pending до этого; `requirements mark-complete` не запускался.
- Решение владельца: у `contain`-картинок (досье, «Информация», «Корзина») `object-position` без zoom почти не заметен (картинка вписана целиком); заметно при zoom > 100. Если нужен выбор части и без увеличения, это решение для 20-53.

## Self-Check: PASSED

- Файлы существуют: `lib/image-framing.ts`, `lib/image-framing.test.ts`, `tests/e2e/specs/image-framing.spec.ts`, `lib/portia-content.ts`, `lib/portia-content-normalize.ts`, `lib/portia-content-normalize.test.ts`, `components/portia-desktop-media.tsx`, `components/portia-desktop-documents.tsx`, `components/portia-desktop-dossier.tsx`, `components/portia-desktop.tsx` — FOUND.
- Коммиты — предки HEAD: c94f42d, 96eddbd, 5d17b34, 5de0ba9, b44fc3d — FOUND; `git rev-list --count 165d849..HEAD` = 5.
- Acceptance Task 1–3 — PASS (значения выше); исключение — буквальный счёт `Framing` в `portia-desktop.tsx` (см. расхождения).

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
