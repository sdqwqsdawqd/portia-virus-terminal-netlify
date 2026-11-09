# Milestones

## v1.3 Стабилизация PORTIA OS (Closed: 2026-11-09, override closeout — accepted risk, not PASS)

**Phases completed:** 6 phases, 134 plans, 128 tasks
**Closeout type:** override_closeout (аудит `milestones/v1.3-MILESTONE-AUDIT.md` = gaps_found; фазы 18, 19, 20 = gaps_found)
**Known verification overrides:** 3 phases (18, 19, 20) newly overridden, 0 carried forward
**Soft close:** `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` и папки фаз 15–20 оставлены на месте — их читают `npm test` и гейты `phase20-release-gate.mjs` / `phase15-visual-manifest.mjs`. Копии: `milestones/v1.3-ROADMAP.md`, `milestones/v1.3-REQUIREMENTS.md`. Перенос путей — первый шаг v1.4.

### Known Gaps

Решение владельца 2026-11-09 (вариант «B»: закрыть с override, перечисленное принято как долг; ничего не PASS):

- **Физический UAT PC/phone** не проводился (D-70): 80 шагов 20-UAT.md = НЕ ПРОВЕРЕНО (D-70).
- **Релизные гейты BLOCKED (ENV):** e2e-full, visual-phase20 (2 теста Promotion проверяющего), mutation-attest, e2e-mutation, staging-live; `20-DEPLOYED-EVIDENCE.md` = BLOCKED.
- **Phase 20, Accepted debt (D-70):** STAB-MEDIA-07, STAB-A11Y-01..04, STAB-SEC-03, STAB-REL-01/02/03/05/06/07/08, STAB-VIS-01..04, STAB-EDIT-01..04.
- **Phase 18 (gaps_found), принято как долг:** STAB-DESK-02..06 (DESK-05 — Gaps Found), STAB-MOTION-01..08 (MOTION-01 — Gaps Found), STAB-MEDIA-06; WR-01/WR-02 (ярлыки 521–900px) открыты.
- **Phase 19 (gaps_found), принято как долг:** STAB-DESK-08, STAB-PROM-01/02/04/07/08/12/13/14/15, STAB-APP-02/07/08/09/10, STAB-SEARCH-04, STAB-MEDIA-04; живая приёмка «Повышения» на staging не выполнена.
- **Accessibility (open):** `.nested-editor-toggle` label-content-name-mismatch; контраст `.eyebrow` 4,28:1, `small.formatted-text-field-hint` 3,53:1, `small[title]` 3,25:1; D-10; экранный диктор A11Y-SR-01 BLOCKED (DEVICE).
- **STAB-REL-08:** финальный review — проверка агента, не вердикт владельца.

### Перенесено в v1.4

- **STAB-BASE-02, STAB-BASE-03, STAB-BASE-04, STAB-BASE-06** (Phase 15) — открытые требования, не приняты как долг.
- **`portia_promo_register_attempt`** выдан anon без вызывающего кода (`supabase/migrations/20261101000000_portia_baseline.sql:1597`) — отозвать отдельной миграцией с ревью `supabase-rls-reviewer`.
- **Перенос путей** тестов/скриптов на архив v1.3, затем стандартная архивация фаз и REQUIREMENTS.md.

### Ожидает владельца

- Production-миграции `20261104000000`, `20261104000100`, `20261106000000` (последняя не применена и на staging).
- Открытые артефакты на момент закрытия (не подавлены acknowledge, всплывут в следующем аудите): 1 debug-сессия (custom-accent-black-turns-teal), 5 UAT-файлов, 3 quick-задачи, 10 todos, 23 deferred items.

**Key accomplishments:**
- Immutable repository evidence and an owner-approved dirty-worktree boundary now protect all later PORTIA OS baseline work.
- Pinned Playwright/axe tooling, a five-project PORTIA OS browser matrix and a fail-closed mutation target boundary now reproduce from a clean checkout.
- PORTIA now has deterministic real-browser visitor, Promotion, settings, keyboard, accessibility and phone gates; privileged role lanes remain explicitly blocked without isolated staging.
- PORTIA now has a complete candidate-only visual inventory and an editable Figma comparison surface, while all golden promotion and owner verdicts remain intentionally pending for Plan 15-05.
- Qloxz signed all 23 available CURRENT candidates, those exact bytes now form the Chromium desktop baseline, and the final clean-checkout automation passes; Phase 15 remains blocked by the 35 unavailable states and external gates.
- Tracked Node/environment preflight now runs before Playwright discovery, while mutation setup requires exact membership in an isolated allow-list and absence from a production deny-list.
- Privileged actor lanes now fail closed unless both isolated-target identity and matching server-session proof exist; the local browser report records four honest blockers instead of fabricated role passes.
- Diagnostic exceptions now expire against the real runner clock, and all 23 approved screenshot states use one typed, bounded policy without changing a single approved PNG byte.
- Public candidates now originate from their real DPR/phone projects, while semantic motion assertions prove the requested front-leg and interaction states without pretending unstable active-motion hashes are approvable.
- The visual ledger now proves exactly what was captured and exactly what remains unavailable, without converting private or unproven states into successful coverage.
- The UI baseline is now repository-owned and machine-checkable, with explicit owner approval for stable current frames and explicit rejection of defective motion.
- The tracked snapshot directory now contains exactly the 33 owner-approved bytes, and every retained visual authority is exercised without promoting rejected motion or transitional loading frames.
- Every visual verification verb (`--verify-ui-map`, `--verify-approval`, `--verify-promotion`, `--promote-approved`) now fails closed unless approval, contract, frame map and stable inventory agree on one candidate set, source commit and local-contract digest before any row is validated.
- A reproducible local security review (`15-SECURITY.md`) finds 0 unresolved critical/high issues, 2 medium, 5 low and 3 info items with owning phases, and keeps authenticated, RLS-runtime, staging and production behavior explicitly BLOCKED.
- A disposable Node 22.13.1 clone at `348684a` passes install, 636 unit tests, typecheck, build, lint, both audits, the secret scan and `--verify-promotion` (33 exact approved bytes); the browser lane gives 63 pass / 15 blocked-data / 77 skip (20 blocked actor) / 0 flaky, so Phase 15 stays `gaps_found` with only concrete role, data, visual and device gaps.
- Восемь частей редактора досье (ClassificationField, ImageEditorField, OrderDragHandle, DossierTabs, Field, EditorGroup, ConfirmDialog, ArchivedVirusEditor) перенесены байт-в-байт в `components/portia-editor-dossier.tsx`; инструмент переноса подтверждает чистый перенос, а граница D-03 закреплена тестом.
- Карточка досье (VirusRecord, DossierSection, MediaBlock, LoadingState), записи учёных и общий рендер FormattedText перенесены байт-в-байт в `components/portia-desktop-dossier.tsx`; инструмент переноса подтверждает чистый перенос, граница D-03 закреплена тестом.
- FormattedTextarea, FloatingTextFormatPanel и общий ActiveFormatContext перенесены байт-в-байт в `components/portia-editor-rich-text.tsx`; контекст создаётся одним `createContext`, перенос подтверждён инструментом parity (569 строк), граница D-03 закреплена тестом.
- Решения openApp и finishExit вынесены в чистые функции `lib/window-open.ts` (`openedWindow`, `exitedWindow`, `windowAppears`, `visibleWindowCount`), поведение прежнее; точки входа и владение состоянием при закрытии закреплены 17 тестами и таблицей по 12 приложениям, а браузерный сценарий написан, но заблокирован окружением.
- `AppWindow` с реестром `AppId`/`appMeta`/`minimumWindowSize` и ярлыки рабочего стола (`DesktopIcon`, `StartPanelButton`, раскладка, анимация) вынесены в `portia-desktop-window.tsx` и `portia-desktop-shortcuts.tsx` чистым переносом (155 и 160 строк, инструмент parity выходит 0); браузерная проверка остаётся BLOCKED (ENV).
- Встроенные документы с масштабом, единый sandbox iframe и «Справочник» перенесены байт-в-байт в components/portia-desktop-documents.tsx (196 строк); portia-desktop.tsx уменьшился до 1567 строк.
- Env-guarded temporary promotion roster for a staging-bound app, plus acceptance-seed / shift / residual / teardown subcommands of the guarded Phase 16 wrapper, proven on fake clients only.
- Participant "Повышение" now shows a correct device-time deadline line, the owner-approved PC/phone warning, the cleanup hint and a submit success only after the server created the request; refusal codes, check order and projections are pinned by tests.
- Серверная часть «Повышения» доказана на изолированном staging (770 live pass, 70 Playwright pass, residual 0), а UI-часть принята владельцем только по прогону на production, поэтому STAB-PROM-15 остаётся открытым.
- Временные данные run `mvz5fqgv_c40b449b` удалены с изолированного staging (2 editors, 2 authUsers, 4 банка), остаток по всем 9 счётчикам равен 0, а STAB-PROM-15 остаётся открытым.
- The editor no longer drops typing on a background update (silent rebase of untouched sections, «Запись изменили» strip on overlap), closes its body with «Доступ закрыт» when the rights check fails, and the format-panel selection, typography and scrolling are pinned by tests.
- Три browser-spec (состояния 8 приложений, click-through поиска, authenticated editor journeys и upload/cache) прошли на изолированном staging без подмены собственных /api (98 тестов прогона A: 77 passed, 0 failed, 21 BLOCKED по данным; mutation-lane 21/21, residual 0), а владелец на PC и iPhone 16 принял состояния, поиск, медиа, иконки и backstop F1-F8, F13; физический осмотр редактора, reviewer-часть F9-F12 и STAB-PROM-15 остаются BLOCKED и записаны долгом.
- Frames and images now count their 15-second timeout only while visible; charter and employee regressions passed on Chromium desktop and phone.
- Owner verdicts recorded in the visual approval ledger: 79 exact candidate rows accepted with their SHA256, 4 sent back for fixes (spider on the dark custom accent, Transitium icon), and the strict approval gate honestly red on exactly those 4 rows.
- Full lint is green (0 errors), the webkit-phone 15 s portrait test no longer depends on test order (fake clock was running at real speed), and diagnostics noise is handled by per-test expected faults judged at assertion time with the 11-row allowlist untouched; one unexplained firefox hang stays a waiver awaiting the owner.
- The security matrix now describes the shipped tree (12 routes, 5 migrations, 8 new findings) and a git-backed test fails on any unlisted route, migration or changed covered file; the removed save-time pool check in 97d7abb was proven not to open a way to confirm an insufficient bank, so the bank route is untouched.
- 20-UAT.md gives the owner a complete PC-then-phone checklist (39 + 41 steps, 14 prerequisites, all ОЖИДАЕТ), and lib/phase20-uat.test.ts refuses any ledger that claims PASS without device, existing commit, date and satisfied prerequisites, or that closes with pending rows, unbacked verdicts or unexplained commit differences.
- The new browser lane for the qualification window (inert, Tab trap, focus return) exposed a real defect - Tab left the page and failed the PC attempt on Chromium - which is fixed with a Tab wrap; the editor keyboard-move scenario is written but BLOCKED (ENV); accessibility.spec.ts re-runs 78 passed, 30 skipped, 0 failed at HEAD 8b81221.
- All 73 owner-review candidates were recaptured on HEAD 0929a084c13d and tied to it by a commit-checked frontmatter field and a strict-mode "stale candidates" test; the old approved baselines were rerun without touching them: 13 pass, 16 are red, 10 of those are explained and attached as rebaseline rows awaiting the owner, 6 stay blockers for 20-13.
- Fail-closed release-gate runner (`scripts/phase20-release-gate.mjs`) that runs 16 gates in a throwaway git worktree of an exact commit, keeps flaky/retry/skip/BLOCKED/unaccepted-waiver out of PASS, and verifies the 20-13 evidence protocol; its first real smoke proved lint in a clean checkout and exposed a clean-checkout unit/typecheck failure.
- STAB-SEC-06 now has a checkable 20-RELEASE-NOTES.md draft (every SEC20 finding, D-33 row, waiver and pending migration named, no protection promised), and STAB-A11Y-01, STAB-A11Y-03 and STAB-MEDIA-07 are no longer Complete; a ledger test keeps them that way until the UAT proof exists.
- Ответы владельца на лист вопросов S1–S3/F1–F7 записаны как D-50 и D-51, его замечания к локальной сборке записаны как D-52; D-52 требует изменений кода, поэтому оркестратору передан checkpoint на план исправлений до 20-37.
- Нижний слой конструктора шаблона по D-52: модель `TemplateDossier` с полями карточки вируса редактора (без записей учёных) и экспорт в самодостаточные HTML и PNG с оформлением каждого фрагмента и локальными изображениями, доказанно без сети и без хранилища браузера.
- Паук «Паутины» теперь рисуется только частями образца Spider.svg: слой канта, правило и токен `--spider-rim` удалены, зазоры между витками ног прозрачны, вторая нить — цвет акцента, и пиксельный зонд подтверждает это на трёх акцентах PC и phone.
- Размах каждой ноги теперь считается из её длины и пути тела за опору (около 9-10° у всех восьми ног вместо 2.4-14°), а выделение волн шага отдаёт слот шагу раньше эха, так что каждая постановка группы ног даёт волну на каждой стороне тела; подтверждено симуляцией 40 маршрутов и трассой ходьбы на chromium-desktop и chromium-phone.
- Пламя горелки и двух спиртовок мерцает двумя слоями на своих неровных циклах, 14 сосудов задней полки переливаются каждый на своём цикле, настенные часы тикают (секундная стрелка 60 шагов в минуту), сцена плотнее (пустых клеток 48 px на PC 35 вместо 78, высота 55.8% экрана), предел анимаций пересмотрен до 140 (phone 80), подписи читаются и в пик (не ниже 4.74).
- Предпросмотр шаблона рисует тот же `VirusCardBody`, что публичное досье (окрашенные иконки классов, разделы 01-05, подвал «ШАБЛОН»), конструктор стал компактным за счёт переключателя «Поля» / «Предпросмотр» (высота формы на PC 2033 -> 769 px), разметка публичного досье побайтно прежняя, запись на сайт по-прежнему невозможна.
- Скачанный HTML и PNG теперь рисуют ту же карточку `VirusCardBody`, что предпросмотр и публичное досье: разметка карточки и её собственные правила из таблиц сайта лежат в одном файле, иконки классов окрашены по уровню (rgb(180, 54, 50) у уровня 3), PNG - растр этого же HTML через SVG foreignObject, а закрытая политика проверяет и HTML, и SVG до скачивания.
- Доступное имя кнопки «ОФОРМЛЕНИЕ» в редакторе сайта теперь содержит видимый текст целыми словами (общий FormatLaunchButton, D-57), а постоянный git-тест гарантирует, что это единственная правка components/portia-editor.tsx.
- По всему сайту, кроме файла редактора, подсказки сокращены до одной фразы или убраны (55 сокращено, 11 убрано), ошибки, причины и подтверждения сохранены, а реестр из 140 строк закреплён тестом, который читает исходники по AST и ловит любой незаписанный длинный текст; components/portia-editor.tsx не изменён.
- Все кандидаты пересняты на H4 `ecf5173a5d51`, раунд 13 закрепил 34 отклонённых кадра в тесте и ledger; владелец 2026-11-07 принял предел анимаций 140 и сокращённые тексты D-56, но вынес «исправить» по 12 строкам колб и по строке предпросмотра конструктора (перенос слова), остальное без вердикта, поэтому план закрыт с `outcome: stopped-for-fixes`.
- Манометр убран (остались одни тикающие часы), на четырёх досках фона 18 новых бесконечных анимаций только opacity/transform (бегущая синусоида осциллографа, «дышащая» линия и растущие столбики диаграммы, подсветка ячеек таблицы, качающиеся инструменты) — 136 на PC при пределе 140, 55 на телефоне при пределе 80, контраст подписей в пик не ниже 4,74.
- Нативный `setTimeout`, вызванный как метод объекта окружения после `anchor.click()`, бросал TypeError во всех трёх движках и превращал уже скачанный файл в «Не удалось подготовить файл» (D-61); теперь после передачи файла ничего не бросает. Значения классов в карточке шаблона не рвутся посреди слова: колонки сменяются меньшим числом (D-60), публичная «База вирусов» побайтно прежняя.
- Во вкладке «Информация» создание раздела переехало наверх: тот же закреплённый SectionAddBar над вкладками «Разделы информации», нижней кнопки раздела нет, «+ ПОДРАЗДЕЛ» остался в карточке; охрана файла редактора теперь знает ровно две одобренные правки (D-57, D-62) и прежний набор русских строк (D-58).
- Кадр картинки `ImageFraming { x, y, zoom }` по D-63: три целых числа проверяются сервером после разворотов withoutNote, `PortiaImage` нормализует их второй раз и показывает выбранную часть (object-position + scale от той же точки, рамка клипает) на шести поверхностях сайта; картинка без кадра остаётся побайтно прежней.
- Владелец решил, что фото сотрудников во вкладке «Сотрудники» остаются без выбора видимой части (вариант «b»): ответ записан дословно, миграции и кода нет, остальные задачи плана не выполнялись.
- Во всех вкладках редактора с картинками (кроме фото сотрудника и фото-блока страницы карточки) под полем есть блок «Видимая часть»: предпросмотр кадром сайта, ползунки с шагом 5 и «Сбросить»; предпросмотр совпадает с сайтом по цепочке редактор -> тело PUT -> сайт на PC и phone, а файл редактора изменён только атрибутами кадра.
- Пересъёмка набора phase20-refresh-a6e2918b2afb (143 строки) показана владельцу: 70 строк принято точными hash, 16 отправлены на исправление (карточка шаблона и интерфейс выбора видимой части картинки), план остановлен как `stopped-for-fixes`.

---

## v1.1 Закрытие замечаний (Shipped: 2026-10-27)

**Delivered:** Закрыты замечания v1.0 с упором на защиту данных, устойчивость рабочего стола и редактора, права доступа и новое приложение «Справочник».

**Phases completed:** 6–13 (8 phases, 49 plans, 122 tasks)

**Audit:** 49/49 требований, 8/8 фаз, 8/8 интеграций и 7/7 пользовательских сценариев; статус `tech_debt`, критических разрывов нет.

**Known deferred items at close:** 7 (see STATE.md Deferred Items)

**Key accomplishments:**

- Сохранение сотрудников стало частичным и устойчивым: несвязанные поля, правки во время запроса и последние хорошие данные больше не теряются.
- Контент нормализуется без обрезки; опрос не сбрасывает отмену, а удаление и смена типа не оставляют мусора.
- Рабочий стол получил устойчивость к пустым данным, безопасные встроенные документы, доступный масштаб и корректный пользовательский акцент.
- Редактор получил свободную панель оформления, сворачиваемую навигацию, мультивыделение и надёжную работу на телефоне.
- Права редакторов ограничивают вкладки в интерфейсе и API, а вход требует подтверждённой почты.
- Выпущен «Справочник» с разделами, карточками, шестью видами блоков, поиском, редактором и правами доступа.

**Stats:**

- 254 files changed across the milestone range
- 14,416 current lines in `app/`, `components/` and `lib/`
- 8 phases, 49 plans, 122 recorded tasks
- 8 days (2026-10-19 → 2026-10-27)

**Git range:** `b8ba5cf` → `afb2491`

**What's next:** отдельный milestone для приложения «Повышение».

---

## v1.0 Доработка (Shipped: 2026-10-19)

**Phases completed:** 7 phases, 43 plans, 23 tasks (Phase 4 skipped by owner)
**Closeout:** override_closeout — no milestone audit; phases 1–03.3 verification stale
**Known verification overrides:** 2 newly acknowledged, 0 carried forward (debug `editor-field-font-wysiwyg` diagnosed; Phase 5 UAT diagnosed, 0 pending)
**Git:** 5aa1105 → 96c582f (2026-10-06 → 2026-10-19)

**Key accomplishments:**

- User's zoom/Dark Reader WIP landed as its own commit, embedded documents pinned to an absolutely positioned viewport so they fill the window at any zoom, and the legacy serif replaced by next/font IBM Plex Serif behind a `--serif` token.
- Drag handle reduced to a bare ≡ at the start of every sortable row, Корзина files and viruses open across the whole window (`is-viewing`), and the Roblox profile is reached only through the small portrait anchor.
- `metadata.other["darkreader-lock"]` changed from `""` to `"true"` so Next 16.3.4 emits the meta tag; verified in the production build head.
- Each editor text field now shares one CSS font rule with the site area that displays its text, via a typed `area` prop rendered as `data-area`; the БЕЛЫЙ/ЧЁРНЫЙ toggle no longer touches the font.
- One `--accent-hue` number per theme now drives 391 OKLCH tints and 27 glows in `app/portia.css`, CSS filter tokens recolour the spider and Vivian, and a whitelisted head script applies the saved accent before first paint.
- A static sketch board (02-SKETCHES.html, no script, no network) showed two variants of each new SVG in production geometry and all four accents; the user chose gel A, cells B, badge set B and lock A for plan 02-06.
- The interface now renders in self-hosted IBM Plex Mono with Cyrillic, long document texts keep Golos (new `--doc`) and scientist records Plex Serif, the two retired faces and weight 800 are gone, and Vivian got a centred Plex Mono 500 name label plus even saturation in every theme.
- A single motion language for PORTIA OS: windows zoom from icons and scale into the taskbar, documents print out, every app icon acts out its own hover, the taskbar hops and reorders by drag, data shows a loader only while it is actually loading, the web wallpaper keeps living — all switchable through a new «Анимации» setting that follows the system by default.
- The boot spider now waits for its image and descends while four terminal lines type under it, and Vivian became a character: she leaps on her own phrases, squashes harder (and finally shakes her head) as clicks annoy her, sulks turned away and grey, glances back before turning round, and perks up when hovered.
- Two lab wallpapers, a web that keeps living after it is spun, badges on every classification line and padlocks on scientist records; plus the checkpoint fixes: the restore that silently did nothing, and Vivian jittering under a cursor at her edge.
- Editor draft now lives in a pure undo-history reducer; a bottom bar names the unsaved sections, offers step undo, a confirmed discard in a native PORTIA dialog and the save, and tabs with unsaved edits carry an amber dot.
- Ctrl/Cmd+S saves and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y step the shared history on any keyboard layout while the editor is the active window; closing with unsaved edits asks in a PORTIA dialog, reload warns, and the last two native confirm prompts are gone.
- At 900px and below every list + form section of the editor becomes list then full-width record with «← К списку», the header collapses so the tabs come first, and the format panel takes the keyboard's place with the selected text kept marked above it.
- Virus dossiers split into four tabs with amber unsaved dots (live and bin), and the ≡ reorder rebuilt as gel lanes: lit band, positions, midpoint hysteresis, edge autoscroll, arrow keys and one undo step per drag.
- The ≡ reorder drag now tracks the pointer on window, not through pointer capture, so one hold can go up and back down. Every row move slides over 160 ms with a per-row FLIP, and is skipped under reduced motion.
- Editors add a person outside the Google Sheet by Roblox nickname (typed Звание/Ранг/Позывной), the person is listed after the sheet staff with a «ВНЕ ТАБЛИЦЫ» mark, gets photo (link or upload), ratings and biography through the existing profile save, and can be removed; sheet employees cannot. The code works before the table exists.
- A «Информация» category now holds up to 50 ordered subsections made of text and «признак — значение» table blocks in any order, edited and reordered in the editor, opened from a tree on the desktop and found by global search; pre-03.3 flat sections normalize to `subsections: []` unchanged.
- Guides in «Информация» now mix text, tables, uploaded photos and YouTube videos in any order: an editor pastes a YouTube link (only the 11-character id is kept), readers play it inline from youtube-nocookie.com and can open it on youtube.com; photos go through the same /api/uploads path as other site images.
- The owner approved and applied the manual-employees SQL in production; adding, editing and removing people outside the sheet works live.

---
