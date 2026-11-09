---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 50
subsystem: ui
tags: [editor, info-tab, section-add-bar, sticky, gap-closure, owner-verdict, accessibility, playwright, guard]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: "20-22 SectionAddBar и закрепление блока в «Справочнике» (D-41), колонки по 5 (D-40); 20-45 охрана файла редактора (D-57); 20-48 решения D-62 и D-64"
provides:
  - "«+ ДОБАВИТЬ РАЗДЕЛ» во вкладке «Информация» стоит в закреплённом блоке над вкладками «Разделы информации», как в «Справочнике»; нижней кнопки раздела нет (D-62)"
  - "охрана components/portia-editor.tsx с реестром одобренных правок (D-57, D-62) и проверкой набора русских строк (D-58, D-64)"
  - "UI-контракт редактора на подменённых чтениях (tests/e2e/specs/editor-ui-contract.spec.ts), пригодный для 20-53 и кадров 20-54"
affects: [20-53, 20-54]

outcome: complete

actuals:
  tokens: 10800
  tasks: 2
  commits: 5

plan_head_before: 557a507b71e5a4a3fc7cb2edf61accbc66cc1893
plan_head_after: 017ad2fd01f340db15e8f392869bcb8e5a37d191
commits: 5

tech-stack:
  added: []
  patterns:
    - "охрана файла редактора = образец 449c756 + реестр одобренных замен (функция на правку); новая одобренная правка добавляет запись в реестр, иначе тест падает"
    - "D-58 как множество: русские строки в кавычках и тексты JSX сравниваются с образцом после одобренных правок, фикстура с изменённой подсказкой и с добавленным текстом обязана падать"
    - "UI-контракт редактора: подменены только GET /api/access и GET /api/content, любой не-GET запрос к /api и *.supabase.co роняет тест"
    - "axe: перенесённый блок и вкладки разделов без допусков; вся страница — с допуском двух измеренных прежних узлов по разметке узла, не по правилу"

key-files:
  created:
    - tests/e2e/specs/editor-ui-contract.spec.ts
  modified:
    - components/portia-editor.tsx
    - lib/format-launch.test.ts
    - lib/editor-outline.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md

key-decisions:
  - "Правка файла редактора ровно такая, как в плане: перед SectionTabs «Разделы информации» поставлен SectionAddBar (создаёт раздел с title || «НОВЫЙ РАЗДЕЛ», выбирает, раскрывает, ставит фокус в заголовок через requestAnimationFrame), нижняя кнопка раздела удалена; 7 строк добавлено, 1 удалена, обе правки внутри блока tab === info. CSS не менялся: .editor-section-addbar из 20-22 уже общий"
  - "Подпись кнопки подраздела в редакторе — «+ ПОДРАЗДЕЛ» (в плане стояло «+ ДОБАВИТЬ ПОДРАЗДЕЛ»); текст не менялся (D-58), проверки идут по реальной подписи"
  - "STAB-EDIT-01, STAB-EDIT-02 и STAB-A11Y-02 в REQUIREMENTS.md НЕ отмечены Complete: чтение замечания B подтверждается владельцем в галерее 20-54, телефонная часть A11Y-02 без устройства остаётся BLOCKED (DEVICE). requirements mark-complete не запускался"
  - "STAB-A11Y-03 возвращён в Pending (Rule 3): закрытие 20-49 снова отметило его Complete без вердикта PC в 20-UAT.md, тест реестра требований падал (та же ошибка, что исправил a3fa230)"

requirements-addressed: [STAB-EDIT-02, STAB-EDIT-01, STAB-A11Y-02]
requirements-completed: []

coverage:
  - id: D1
    description: "«+ ДОБАВИТЬ РАЗДЕЛ» вкладки «Информация» — в закреплённом блоке .editor-section-addbar над «Разделы информации»; форма «Заголовок раздела», «Создать раздел» добавляет раздел в конец, выбирает (aria-pressed=true), раскрывает и ставит фокус в заголовок; Escape возвращает фокус на кнопку; пустой заголовок даёт «НОВЫЙ РАЗДЕЛ»; ниже колонок кнопки раздела нет"
    requirement: STAB-EDIT-02
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/editor-ui-contract.spec.ts#[STAB-EDIT-02] D-62 «Информация»: add-section sits above the section tabs like «Справочник» (chromium-desktop, chromium-phone)"
        status: pass
      - kind: automated_unit
        ref: "lib/format-launch.test.ts#D-62: the «Информация» tab starts with the add-section bar and has no add-section button below the columns"
        status: pass
    human_judgment: false
  - id: D2
    description: "Блок остаётся в виду при прокрутке вкладки на PC и phone, не перекрывает вкладки разделов и поле «Заголовок»; на phone цель 44×44 px (149,7×44), горизонтального overflow страницы нет"
    requirement: STAB-A11Y-02
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/editor-ui-contract.spec.ts#[STAB-EDIT-02] D-62 the bar stays in view while the tab scrolls … (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: true
    rationale: "Реальное устройство и вердикт владельца по виду вкладки не проверены; STAB-A11Y-02 на телефоне остаётся BLOCKED (DEVICE) до 20-54/20-14"
  - id: D3
    description: "«+ ПОДРАЗДЕЛ» остаётся внизу карточки раздела (ниже списка подразделов, внутри карточки), добавляет подраздел; колонки по 5 (D-40): пятый раздел в первой колонке, шестой во второй"
    requirement: STAB-EDIT-01
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/editor-ui-contract.spec.ts#[STAB-EDIT-02] D-62 «+ ПОДРАЗДЕЛ» stays at the bottom of the section card, and sections run in columns of five (D-40) (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Файл редактора отличается от образца 449c756 только правками D-57 и D-62; набор русских строк прежний (D-58); охрана падает на лишней правке, отсутствии правки D-62, изменённой и добавленной подсказке"
    requirement: STAB-EDIT-02
    verification:
      - kind: automated_unit
        ref: "lib/format-launch.test.ts#D-64 … differs from 449c756 only by the approved edits; D-58 … set of Russian texts; D-64 … the guard notices any other edit"
        status: pass
    human_judgment: false
  - id: D5
    description: "axe без critical/serious в перенесённом блоке (с открытой формой) и во вкладках разделов; на всей странице редактора остаются два прежних узла (метка .nested-editor-toggle, контраст .eyebrow), они не от D-62 и вынесены в deferred-items.md"
    requirement: STAB-A11Y-02
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/editor-ui-contract.spec.ts#[STAB-EDIT-02] D-62 axe finds nothing critical or serious … (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: true
    rationale: "Полная чистота страницы редактора по axe не достигнута: две прежние находки требуют правки файла редактора и portia.css, запрещённых D-58/D-64 в этом плане; решение за владельцем"
  - id: D6
    description: "Чтение замечания B и дополнения владельца: «Информация» и «Справочник» работают одинаково; у конструктора шаблона разделов и подразделов нет"
    requirement: STAB-EDIT-02
    verification: []
    human_judgment: true
    rationale: "Толкование оркестратора; подтверждает только владелец в галерее 20-54"

duration: 12 min (Node 22.13.1 из %TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64)
completed: 2026-11-07
status: complete
---

# Phase 20 Plan 50: «Информация» редактора — «+ ДОБАВИТЬ РАЗДЕЛ» сверху, как в «Справочнике» Summary

**Во вкладке «Информация» создание раздела переехало наверх: тот же закреплённый SectionAddBar над вкладками «Разделы информации», нижней кнопки раздела нет, «+ ПОДРАЗДЕЛ» остался в карточке; охрана файла редактора теперь знает ровно две одобренные правки (D-57, D-62) и прежний набор русских строк (D-58).**

## Accomplishments

- **D-62.** Перед `<SectionTabs label="Разделы информации" …>` поставлен `<SectionAddBar onCreate=…/>` по образцу «Справочника»: `makeId("info")`, раздел `{ id, title: title || "НОВЫЙ РАЗДЕЛ", body: "", subsections: [] }` в конец, `setSelectedInfoSection(id)`, `setOpen([id], true)`, фокус в первый input тела новой карточки (её «Заголовок») через `requestAnimationFrame`. Нижняя кнопка раздела после колонок удалена. Дифф файла против начала плана: `@@ -1301,0 +1302,7` и `@@ -1347 +1353,0` — обе правки внутри `tab === "info"`. `app/portia.css` не менялся: правила `.editor-section-addbar` из 20-22 общие и работают в обеих вкладках.
- **Охрана D-64 (T-20-105).** `lib/format-launch.test.ts`: реестр `approvedEditorEdits` (D-57 `applyLaunchButtonHunk`, D-62 `applyInfoAddSectionHunk` с блоком-константой побайтно); тест «differs from 449c756 only by the approved edits»; тест D-58 — множество русских строк (кавычки, шаблоны, тексты JSX без комментариев) равно множеству образца после одобренных правок; тест, что охрана падает на лишней строке, на файле без правки D-62, на переписанной и на добавленной подсказке. Полный клон обязателен (shallow — падение, как раньше).
- **UI-контракт редактора (T-20-106).** `tests/e2e/specs/editor-ui-contract.spec.ts`: заголовок-оговорка, подмена только GET `/api/access` (`canEdit: true`, все вкладки открыты) и GET `/api/content` (`defaultPortiaContent`, ревизия 1), трекер записи (любой не-GET к `/api` и `*.supabase.co` роняет тест; запись в подменённые пути отменяется). Четыре теста на chromium-desktop и chromium-phone.

## Замеры (UI-контракт, `--retries=0`)

| Проект | Верх кнопки «+ ДОБАВИТЬ РАЗДЕЛ» | Верх навигации «Разделы информации» | Цель кнопки |
|---|---|---|---|
| chromium-desktop | 401,8 px (высота 38) | 467,8 px | 149,7×38 |
| chromium-phone | 291,6 px (высота 44) | 365,6 px | 149,7×44 (≥ 44×44) |

После прокрутки вкладки до конца: PC — блок `y 117, высота 55` над вкладками (верх 198); phone — блок `y 48, высота 61` над вкладками (верх 117): блок в виду, не пересекает вкладки; в верхнем положении три полосы (блок, вкладки, поле «Заголовок») попарно не пересекаются. `scrollWidth − clientWidth` страницы ≤ 0 на обоих проектах. Вкладка прокручиваема (запас > 200 px) — проверка закрепления не пустая.

## Task Commits

1. **Task 1 (tracer): RED** — `082dec1901d425119fbb053add72447677a8a23f` (test), в теле `PLAN_BASE: 557a507b71e5a4a3fc7cb2edf61accbc66cc1893`. Охрана: 8 из 10 зелёных, **2 красных** — «D-62: …starts with the add-section bar» и «D-64: …differs from 449c756 only by the approved edits» (`line 1302: expected "<SectionAddBar onCreate…", got "<SectionTabs label=\"Разделы информации\" …"`). e2e на chromium-desktop **красный**: кнопка не внутри `.editor-section-addbar` (подмены сработали, редактор смонтировался).
2. **Task 1 (tracer): GREEN** — `06c396510fe98739a9deca13d693ba6a954d5a60` (feat): правка D-62 в `components/portia-editor.tsx` и поправка локатора спека. `⚡ Tracer verified end-to-end — expanding`: охрана 10 из 10, e2e D-62 на chromium-desktop 1 passed.
3. **Task 2: тесты** — `546e63ff493fe236e749dcac3821cd7d3fd2d3e7` (test): закрепление, колонки по 5, подраздел внизу, phone, axe; `lib/editor-outline.test.ts` считает `SectionAddBar` по вкладкам.
4. **Task 2: требования** — `2680847f33cf224a2bae6a1e745d8ecbdd212e0a` (fix): STAB-A11Y-03 снова Pending (см. отклонение 2).
5. **Task 2: документы** — `017ad2fd01f340db15e8f392869bcb8e5a37d191` (docs): пункт D-62 в `20-UI-SPEC.md`, две находки в `deferred-items.md`.

**Plan metadata:** отдельный коммит `docs(PORTIA-20-50): complete …` с этим SUMMARY, STATE.md, ROADMAP.md (в `commits:` выше его нет: измерение сделано до него).

## Проверки

- `node --experimental-strip-types --test lib/format-launch.test.ts`: 10 pass, 0 fail.
- `node --experimental-strip-types --test lib/*.test.ts`: 1549 тестов, 1545 pass, **0 fail**, 4 skipped (прежние).
- `editor-ui-contract.spec.ts`, `--retries=0`, chromium-desktop и chromium-phone: **8 passed**, ни одного запроса записи.
- `tsc --noEmit` (`node node_modules/typescript/bin/tsc`): код 0.
- Lint: `npm.cmd run lint` не стартует (node-gyp, как в 20-48/20-49), поэтому `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`: **0 errors**, 17 warnings (прежние, артефакты `tests/e2e/visual-candidates/.runs/…`); три изменённых TS/TSX-файла — 0 замечаний, у `portia-editor.tsx` три прежних предупреждения `<img>`.
- Acceptance: `grep -c '<SectionAddBar' components/portia-editor.tsx` = 2; нижняя кнопка раздела = 0; `D-62` в охране 12, в спеке 3, в UI-SPEC 1; `chromium-phone|isPhone|-phone` в спеке 5; `git diff --exit-code --stat 557a507 -- tests/e2e/visual/__screenshots__` — код 0; порт 3100 свободен (PID проверялся по командной строке `next start` проекта); `.env*` не читались; сборка и сервер — только в режиме посетителя после `phase15-e2e-preflight.mjs visitor` (код 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Исходная проверка кнопки в блоке считала два предка**
- **Found during:** Task 1, первый зелёный прогон: локатор `ancestor::div[contains(@class,'editor-section-addbar')]` находил и `.editor-section-addbar`, и `.editor-section-addbar-row`.
- **Fix:** локатор `.editor-section-addbar` → кнопка по имени, count 1.
- **Files modified:** `tests/e2e/specs/editor-ui-contract.spec.ts`
- **Commit:** 06c3965

**2. [Rule 3 - Blocking] Полный набор unit красный из-за прежнего состояния**
- **Found during:** Task 2, `lib/*.test.ts`: 2 красных.
  - `lib/editor-outline.test.ts` «D-41 section editing stays in Справочник…» требовал ровно одного `<SectionAddBar` в файле редактора. Файла нет в `files_modified`, но тест — прямое следствие D-62. Теперь проверяет два вхождения: по одному в «Информации» и «Справочнике», нигде больше. Commit 546e63f.
  - `lib/phase20-requirements-ledger.test.ts` «nothing is Complete without its proof»: закрытие 20-49 (557a507) снова отметило STAB-A11Y-03 Complete, в `20-UAT.md` нет «Вердикт PC: PASS» (та же ошибка, что откатил a3fa230 после 20-46). Возвращён Pending (чекбокс и трассировка). Commit 2680847. SUMMARY 20-49 не менялся (в его `requirements-completed` остаётся A11Y-03; для оркестратора: при закрытии плана не отмечать A11Y-03).
- **Verification:** 1549 тестов, 0 fail.

**3. [Rule 4-граница, не архитектурное] Подпись кнопки подраздела**
- План называет «+ ДОБАВИТЬ ПОДРАЗДЕЛ»; в файле «+ ПОДРАЗДЕЛ». Текст не менялся (D-58), тесты и UI-SPEC описывают реальную подпись.

**Total deviations:** 3 (1 bug в собственном тесте, 1 blocking с двумя исправлениями, 1 расхождение названия). **Impact:** объём плана не менялся; требования EDIT-01/02 и A11Y-02 намеренно не отмечены Complete.

## Issues Encountered

- **axe на всей странице редактора не чист.** Две находки измерены в первом прогоне (на PC обе, на phone только первая): `label-content-name-mismatch` у `.nested-editor-toggle` («Развернуть раздел «…»» не содержит видимого «РАЗДЕЛ 01 …», WCAG 2.5.3) и `color-contrast` у `.eyebrow` «УПРАВЛЕНИЕ СОДЕРЖИМЫМ» (4,28:1, PC). Обе не от D-62 (охрана доказывает, что файл отличается от образца только правкой D-62, а `.nested-editor-toggle` общий для всех вкладок); исправление — правка файла редактора и `portia.css`, запрещённая D-58/D-64 и планом. Записаны в `deferred-items.md` (status open). Спек терпит ровно эти два узла по разметке узла, любой другой critical/serious роняет тест; блок «+ ДОБАВИТЬ РАЗДЕЛ» (с открытой формой) и вкладки разделов сканируются без допусков. Критерий плана «axe без critical/serious» выполнен для перенесённого интерфейса, не для всей страницы редактора.
- `npm run lint` и `npx` недоступны из-за node-gyp: прямые вызовы. Хук проекта заблокировал команду с `PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY=` в переменных окружения (запрет на service_role), поэтому сборка и сервер запускались без этих переменных; в оболочке они не заданы.

## Authentication Gates

None.

## Known Stubs

None — заглушек в изменённых файлах нет. Подмена чтений в спеке — намеренный UI-контракт, помечен в заголовке спека и не выдаётся за доказательство роли.

## Threat Flags

None — клиентская раскладка вкладки; права, сохранение и `contentRefusal` не менялись, спек ничего не пишет на сайт.

## Next Phase Readiness

- Для 20-53: UI-контракт редактора (`openInfoTab`, подмены, трекер записи) готов; в `lib/format-launch.test.ts` кадр картинок D-63 добавляется как третья запись реестра `approvedEditorEdits`.
- Для 20-54 (галерея владельцу): показать «Информацию» и «Справочник» рядом (кнопка сверху, форма, подраздел внизу); подтвердить прочтение замечания B; на телефоне — устройство остаётся BLOCKED (DEVICE).
- Решение владельца: две прежние находки axe редактора (метка переключателя карточки, контраст `.eyebrow`) — править ли их отдельным планом (потребует расширить реестр охраны D-64).
- STAB-EDIT-01, STAB-EDIT-02, STAB-A11Y-02 остаются Pending до галереи 20-54; STAB-A11Y-03 снова Pending.

## Self-Check: PASSED

- Файлы существуют: `components/portia-editor.tsx`, `lib/format-launch.test.ts`, `lib/editor-outline.test.ts`, `tests/e2e/specs/editor-ui-contract.spec.ts`, `20-UI-SPEC.md`, `deferred-items.md`, `.planning/REQUIREMENTS.md` — FOUND.
- Коммиты — предки HEAD: 082dec1, 06c3965, 546e63f, 2680847, 017ad2f — FOUND; `git rev-list --count 557a507..HEAD` = 5.
- Acceptance Task 1 и Task 2 — PASS (значения выше).

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
