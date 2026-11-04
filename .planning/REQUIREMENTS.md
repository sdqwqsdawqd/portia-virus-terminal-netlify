# Requirements: PORTIA OS — v1.3 «Стабилизация PORTIA OS»

**Defined:** 2026-10-30
**Core value:** Сделать существующий PORTIA OS доказуемо устойчивым, безопасным и визуально последовательным, сохранив его текущую художественную основу.

Все требования v1.3 считаются открытыми, даже если соответствующий код уже существует. Пункт закрывается только после указанного browser/live/visual/UAT-доказательства. Архивные отметки v1.2 подтверждают реализацию, но не заменяют приёмку v1.3.

## Baseline, тестирование и дизайн-контракт

- [x] **STAB-BASE-01**: До рефакторинга зафиксированы текущие экраны, русские тексты, состояния и переходы; внутренние изменения не меняют художественный язык и ключевые действия без отдельного утверждения владельца.
- [ ] **STAB-BASE-02**: Committed Playwright-suite покрывает visitor, participant, editor, promo reviewer и owner на PC и phone, основные состояния данных и motion on/off, не изменяя production.
- [ ] **STAB-BASE-03**: Утверждённые visual baselines покрывают desktop, окна, «Повышение», редактор, паука, паутину, Вивьян и phone layout при фиксированных данных, DPR, шрифтах и случайности.
- [ ] **STAB-BASE-04**: Repository-owned UI review и immutable captures фиксируют текущий UI/motion-контракт для desktop и phone, включая controls, состояния, ключевые кадры, interruption и rest frame; изменения относительно текущего вида отмечены отдельно.
- [x] **STAB-BASE-05**: Uncaught exception, hydration warning, критический network failure, CSP violation или неожидаемая console error блокируют browser gate; ожидаемые отказы показаны безопасным русским состоянием.
- [ ] **STAB-BASE-06**: Каждая фаза проходит GSD-цепочку requirements → contract → plan → implementation → deterministic tests → Playwright → visual/a11y/security evidence → owner UAT при необходимости → summary/verification.

## Рабочий стол, окна и декомпозиция

- [x] **STAB-DESK-01**: Один app id открывает одну поверхность из ярлыка, start panel, taskbar или search; повторное открытие восстанавливает и фокусирует окно без дубликата и потери состояния.
- [ ] **STAB-DESK-02**: Окно перетаскивается и изменяет размер за все края, не исчезает за workspace, имеет симметричные inset, сохраняет противоположный край и minimum и корректируется после смены viewport; важное содержимое reflow-ится в доступных границах без обрезки и разрушения композиции.
- [ ] **STAB-DESK-03**: Minimize, maximize, close и taskbar не теряют состояние и не затрагивают другие окна; активная квалификация запрещает закрытие, сворачивание, перемещение и взаимодействие с фоном.
- [ ] **STAB-DESK-04**: На phone приложения используют доступный экран, доступны touch, не перекрываются fixed/sticky controls и клавиатурой и не создают page-level horizontal overflow.
- [ ] **STAB-DESK-05**: Accent, wallpaper, icon size/position, motion и spider сохраняются независимо; reload восстанавливает значения, повреждённое storage безопасно возвращается к default.
- [ ] **STAB-DESK-06**: Drag изменяет только выбранный ярлык; позиция сохраняется, остаётся достижимой и не перекрывает критические controls; открытие доступно мышью, клавиатурой и touch.
- [x] **STAB-DESK-07**: Декомпозиция `portia-desktop.tsx` и `portia-editor.tsx` сохраняет app ids, DOM semantics, CSS hooks, storage keys, API shapes, порядок, данные и утверждённые snapshots, кроме отдельно согласованных fixes.
- [ ] **STAB-DESK-08**: Каждая поверхность различает loading, empty, populated, stale/degraded и fatal error, не падает на пустых/частичных данных и не уничтожает last-good state при безопасном retry.

## Motion, паук, паутина, ярлыки и Вивьян

- [ ] **STAB-MOTION-01**: Владелец утверждает единый контракт «Анимации»; boot script, desktop, приложения, «Повышение» и редактор одинаково соблюдают on/off и выбранное решение для system preference.
- [ ] **STAB-MOTION-02**: Boot animation показывается максимум один раз за tab session; reload не блокируется повторной заставкой, off/reduced приводит к утверждённому безопасному состоянию.
- [ ] **STAB-MOTION-03**: Включённый PNG-паук не исчезает, не телепортируется и непрерывно интерполируется по утверждённой траектории через соседние сектора паутины; новая точка/поза выбирается при загрузке и после явного `Скрыть → Показать`, смещение spawn-точки не используется как обход маршрутизации, а выключение не оставляет следов.
- [ ] **STAB-MOTION-04**: Передняя пара лап у лица ведёт шаг и выполняет редкий hunting signal; задние лапы не дёргаются постоянно, а волны появляются только от постановки лап и затухают.
- [ ] **STAB-MOTION-05**: Сохраняя идею PORTIA OS, artwork ярлыков и hover/focus-анимации переработаны как единая система; каждый ярлык проигрывает полный semantic cycle без сдвига контейнера, уход pointer не обрывает цикл, последний кадр совпадает со статичным по geometry, viewBox, filter и качеству.
- [ ] **STAB-MOTION-06**: Вивьян следует выбранному accent без неоновой или серой рассинхронизации, остаётся читаемой, детерминированно реагирует на click/idle/activity/offended и не зависит от motion для понимания ответа.
- [ ] **STAB-MOTION-07**: Обои не создают заметный jank; при motion off они полностью статичны, а переключение не даёт flash или пустого слоя.
- [ ] **STAB-MOTION-08**: Для spider/web/Vivian/shortcut/window motion до реализации утверждены start, key states, end/rest, duration, easing, interruption и reduced/off; после реализации проходят visual regression и owner review.

## «Повышение»

- [ ] **STAB-PROM-01**: Участник без аккаунта получает по нику только safe projection; отсутствующий ник не создаёт записей, sheet outage не маскируется как «ник не найден», удаление строки немедленно закрывает доступ и действия.
- [ ] **STAB-PROM-02**: Для каждого server state видна ровно допустимая ordinary/qualification action либо одна стабильная русская причина; cooldown показывает корректную дату/время без `..`, submit — authoritative success/refusal/error.
- [ ] **STAB-PROM-03**: Lookup не привязывает устройство; первый успешно принятый запрос атомарно создаёт HttpOnly-backed binding, reload восстанавливает ник, другой ник получает нейтральный отказ, отклонённый submit не оставляет token/binding/request.
- [ ] **STAB-PROM-04**: Одновременно существует не более одного активного запроса каждого вида на ник; ожидания 5/15/60 минут не продлеваются каждым retry и не раскрывают связанный ник; защита не называется hardware attestation.
- [ ] **STAB-PROM-05**: Ordinary flow выдаёт manual/random active-only, duplicate-free, ordered set; недостаточный банк блокирует подтверждение, preview можно пересобрать, confirmed snapshot неизменяем, новый набор ждёт смены звания в таблице.
- [ ] **STAB-PROM-06**: Qualification доступна только для переходов 2→3, 4→5 и 6→7; банки и quotas независимы, поддержаны single/multiple/free-text, участник видит по одному вопросу и не получает future questions или keys.
- [ ] **STAB-PROM-07**: Один серверный 15-минутный deadline начинается после подтверждения reviewer, переживает reload, CAS отклоняет повторный/старый индекс, timeout/offline завершает попытку ровно один раз и сохраняет отправленные ответы.
- [ ] **STAB-PROM-08**: После ясного предупреждения PC focus/visibility/navigation loss проваливает попытку; phone app/tab switch не проваливает, но offline/deadline проваливают; режим фиксируется сервером, риск spoofing документирован.
- [ ] **STAB-PROM-09**: Editor без `promo` не видит workspace и получает 403; grant/revoke действует сразу; при двух claims ровно один reviewer становится owner; release/force-release и badges соответствуют ролям и видимой очереди.
- [ ] **STAB-PROM-10**: На PC и phone сохраняются required counts; add/edit/disable/delete не теряют typed data; save/saved/error/disabled понятны; правильные ответы выбираются рядом с вариантами без zero-based indices; mutation инвалидирует preview.
- [ ] **STAB-PROM-11**: Reviewer отмечает каждый ответ, процент вычисляется автоматически, но итог выбирается вручную; participant видит только результат и необязательный процент без ошибок, keys, notes и личности reviewer.
- [ ] **STAB-PROM-12**: После провала предлагаются 2 дня с возможностью изменить, продлить или снять срок; попытки не ограничены; после реально наблюдавшегося ожидания показывается одно тихое quest-style уведомление, открывающее «Повышение».
- [ ] **STAB-PROM-13**: Закрытие транзакционно удаляет подробные payload, хранит не более трёх компактных результатов; просроченные данные очищаются после трёх дней без удаления активного непроверенного flow; UI показывает ненавязчивую подсказку.
- [ ] **STAB-PROM-14**: Missing migration/RPC, database/sheet outage, stale response и validation refusal дают разные безопасные состояния; UI не пишет «заявка принята» до authoritative success, retry не дублирует запись.
- [ ] **STAB-PROM-15**: Participant/reviewer, bank CRUD, ordinary, qualification, retake, cleanup и direct denial приняты владельцем подряд после clean reload на PC и phone с временными данными и без unresolved failures.

## Остальные приложения и редактор

- [ ] **STAB-APP-01**: «База вирусов» сохраняет поиск, выбор dossier, classification, mutations, logs и locked levels; normal/empty/loading/error различимы, background poll без причины не сбрасывает выбранную запись.
- [ ] **STAB-APP-02**: «Сотрудники» сохраняют 34 места, last-good roster при upstream failure, manual details/ratings и phone usability; portrait открывает Roblox только при валидной ссылке.
- [ ] **STAB-APP-03**: «Сводка» сохраняет published/important ordering, разделение новостей и квестов, active/upcoming/finished ordering и одно неблокирующее уведомление при live poll.
- [ ] **STAB-APP-04**: «Информация» и «Справочник» сохраняют порядок sections/cards/blocks и шесть block types; guide начинает свёрнутым, back не перекрывает card, старые данные нормализуются без потерь.
- [ ] **STAB-APP-05**: «Корзина» показывает записи на рабочей области, восстанавливает только в editor с правами и удаляет необратимо только после ясного подтверждения без порчи соседних records.
- [ ] **STAB-APP-06**: «Таблица» и «Устав» сохраняют fullscreen, sandbox и +/- zoom; ограничение Ctrl+wheel внутри focused cross-origin iframe остаётся документированной accepted limitation.
- [ ] **STAB-APP-07**: Редактор сохраняет undo/redo, drafts during save, revision conflict, poll suppression, save-all, permissions и per-field errors; success только authoritative, длинные списки прокручиваются внутри и заголовки не закрывают content.
- [ ] **STAB-APP-08**: WYSIWYG на PC/phone использует typography редактируемой области, применяет формат к selection, сохраняет range при panel drag/touch и сохраняет документ с открытой панелью.
- [ ] **STAB-APP-09**: Regular tabs соблюдают grants/closed tabs, trusted Promotion закрыта по умолчанию, revoked section нельзя изменить через UI/API, access outage fail-closed с русским сообщением.
- [ ] **STAB-APP-10**: Для каждого приложения проверены loading, empty, populated, stale/degraded, permission denied и fatal error; disabled action объяснён, retry не уничтожает last-good data и не требует нового generic shell.

## Глобальный поиск

- [ ] **STAB-SEARCH-01**: Поиск охватывает apps, employees, viruses, info/subsections, guide cards/blocks, published broadcasts и recycle records по title/code/body/meta с нормализацией регистра и `е/ё`, не индексируя unpublished content.
- [ ] **STAB-SEARCH-02**: Каждый тип результата открывает точную сущность в приложении-владельце, а search window не остаётся modal blocker.
- [x] **STAB-SEARCH-03**: Ctrl/Cmd+K, Tab, arrows, Enter и Escape имеют утверждённое keyboard-first поведение; focus видим, результаты читаемы на phone, loading и zero results различаются.
- [ ] **STAB-SEARCH-04**: Удалённые records исчезают после poll; private editor data, answer keys и reviewer fields никогда не индексируются; degraded roster показывает safe last-good или явное состояние.
- [ ] **STAB-SEARCH-05**: При каждой загрузке страницы под строкой поиска показывается случайный набор из 5–10 рекомендаций списка редактора (все, если их меньше 5); набор не меняется до перезагрузки, форматирование рекомендаций сохраняется (Phase 20, D-43).
- [ ] **STAB-SEARCH-06**: Поиск находит слова с ударением и без него: комбинирующий акут U+0301 нормализуется в запросе и в тексте, регистр и `е/ё` работают как прежде (Phase 20, D-37).
- [ ] **STAB-SEARCH-07**: Глобальный поиск открывается с клавиатуры только по Ctrl/Cmd+K; стрелка ↑ вне окна поиска (в полях, textarea, contenteditable, на рабочем столе) его не открывает и не уводит фокус; стрелки, Enter и Escape внутри поиска работают как прежде (Phase 20, D-44, D-46).

## Медиа и производительность

- [x] **STAB-MEDIA-01**: Upload проверяет реальные bytes, размер и поддерживаемый формат; отказ не стирает URL/draft, успех возвращает безопасный UUID URL.
- [ ] **STAB-MEDIA-02**: Normalization, SQL constraint и rendering используют один URL-contract; unsafe scheme/path отклоняется, invalid legacy value даёт fallback.
- [ ] **STAB-MEDIA-03**: Активное hero/media имеет приоритет, offscreen collections lazy, initial request storm отсутствует, при смене записи старое изображение не показывается как новое.
- [ ] **STAB-MEDIA-04**: Immutable UUID media кэшируется повторно без скачивания, новый upload получает новый URL, content revision invalidation не ломает media cache.
- [ ] **STAB-MEDIA-05**: Broken, slow или blocked external media сохраняет читаемый текст/caption и стабильный layout без app crash или infinite spinner.
- [ ] **STAB-MEDIA-06**: До оптимизации записаны воспроизводимые owner PC/phone traces; после изменений interaction, drag, wallpaper и app-open не хуже утверждённого baseline и проходят согласованные budgets.
- [ ] **STAB-MEDIA-07**: Внешние media hosts инвентаризированы; CSP проходит report-only до enforcement, approved images/YouTube продолжают работать, rejected host показывает fallback.

## Accessibility и security

- [ ] **STAB-A11Y-01**: PC controls имеют name/role/state, видимый focus, корректный trap/restore в dialogs и keyboard alternative для действия, доступного только drag.
- [ ] **STAB-A11Y-02**: Phone actions доступны touch без hover, не перекрываются keyboard/sticky bars, имеют практичную tap area и не создают page-level horizontal overflow.
- [ ] **STAB-A11Y-03**: Русские labels, success/error/disabled reason понятны и объявляются; нет пустых, шуточных, удвоенных или непереведённых technical labels; alt соответствует назначению изображения.
- [ ] **STAB-A11Y-04**: Итоговая motion-настройка применяется ко всем поверхностям; off/reduced прекращает looping movement, но сохраняет content и feedback.
- [x] **STAB-SEC-01**: Anon, authenticated, editor, reviewer и owner видят и изменяют только разрешённые данные; запрещённые UI/API/table/RPC действия fail-closed, revoke действует без rebuild.
- [ ] **STAB-SEC-02**: Participant network/UI не получает answer keys, future questions, internal notes, bank payload и reviewer identity; sensitive responses используют no-store.
- [ ] **STAB-SEC-03**: CSP, frame, nosniff, referrer, permissions, COOP и HSTS присутствуют, не ломая approved charter/sheet/video; CSP ужесточается только через report-only.
- [x] **STAB-SEC-04**: Staging и production schema fingerprints, functions, grants и RLS соответствуют canonical migrations; ручной production step имеет записанный postflight. (Complete: staging golden == U == final; production после owner-run миграций == golden по правилу A, единственное отличие — платформенная `rls_auto_enable()`, см. `evidence/16-PRODUCTION-POSTFLIGHT.md`.)
- [ ] **STAB-SEC-05**: Глубокий GSD code review и локальная security matrix покрывают auth/API/RLS/headers/CSP/uploads/secrets/dependencies; high findings исправлены или явно приняты, production dependency audit чист, dev findings имеют disposition, lockfile меняется отдельно.
- [ ] **STAB-SEC-06**: Release notes честно фиксируют, что device binding не hardware attestation, initial mode spoofable, и перечисляют остальные accepted risks/waivers без расширения риска.

## Release readiness

- [ ] **STAB-REL-01**: На release commit проходят tests, typecheck, production build, full lint и production dependency audit; skipped live test допустим только вместе с успешным staging-run.
- [ ] **STAB-REL-02**: Playwright-suite проходит с documented setup на clean checkout, не мутирует production, не маскирует flaky retry и сохраняет artifacts.
- [ ] **STAB-REL-03**: На release commit проходят утверждённые visual baselines, axe, keyboard journeys и zero-unexpected-console policy.
- [x] **STAB-REL-04**: Fresh isolated Supabase строится canonical migrations; role/RLS/RPC и concurrent claim/admission/CAS/cleanup tests проходят на disposable fixtures. (Доказано: `evidence/16-FINGERPRINT-CALIBRATION.md`, `16-UPGRADE-LADDER.md`, `16-LIVE-RUN.md`, receipts `receipt-roles*.json`, `receipt-concurrency*.json`, `receipt-playwright.json`, residual 0.)
- [ ] **STAB-REL-05**: Owner принимает Promotion на PC/phone с временными данными и без destructive production testing.
- [ ] **STAB-REL-06**: Owner после clean reload принимает window bounds, spider lifecycle/gait/palette, shortcut handoff, Vivian accent, qualification lock, search coverage и bounded editor layout на PC/phone.
- [ ] **STAB-REL-07**: Roadmap, requirements, summaries, verification и deployed evidence описывают итоговый release commit/state; UAT фиксирует проверенный commit для каждого устройства. После исправления только phone-дефекта допускается сохранить прежний PC-вердикт с его commit, повторить полную phone UAT на новом commit и повторить технические gates на итоговом release commit; объём изменения и причина сохранения PC-вердикта документированы. Carried risks перечислены, blocked verification не помечен complete.
- [ ] **STAB-REL-08**: Финальный review подтверждает целостность PORTIA OS после согласованной в Phase 20 визуальной переработки; новый font или motion-язык требуют отдельного owner approval, а новые SVG-рисунки и визуал паука/фона проходят владельческое одобрение до принятия baseline.

## Визуальная переработка Phase 20

- [ ] **STAB-VIS-01**: Детали паука и паутины полностью перерисованы в тёмной палитре PORTIA OS по утверждённому владельцем визуальному контракту; движение, режимы full/reduced/off, читаемость и производительность проверены на PC/phone. Формат графического ресурса определяется при проектировании.
- [ ] **STAB-VIS-02**: К существующим выбираемым фонам добавлен фон с колбами на лабораторном штативе: колбы бурлят независимо и несинхронно, жидкость переливается по яркости, видны пузырьки. На PC/phone проверены сохранение выбора, читаемость окон и контента, контраст, full/reduced/off и скорость; существующие фоны сохранены.
- [ ] **STAB-VIS-03**: Перерисованы два SVG-рисунка пустых состояний — колба, используемая в «Информации» и состоянии «Новостей пока нет», и микроскоп в «Справочнике», — а также 9 иконок классов «Разум», «Поведение» и «Вид / внешность» (D-39, уточнено решением D-48). Остальные SVG-иконки и иллюстрации не меняются; новые варианты и visual baselines утверждены владельцем.
- [ ] **STAB-VIS-04**: Структура экранов вкладки «Повышение» в редакторе и внутреннего приложения «Повышение» сохранена, но оформление и удобство использования на PC/phone переработаны без потери participant/reviewer flow, прав, состояний сохранения и безопасных ошибок; итог принят владельцем.
- [ ] **STAB-TMPL-01**: Внутри приложения «Повышение» кнопка «Создать шаблон» открывает отдельный редактор карточки досье вируса для текста и локальных изображений; готовую работу можно скачать на устройство как самодостаточные PNG или HTML для передачи проверяющему вне сайта. Создание, изображения и экспорт не записываются в Supabase database/storage, `/api/uploads` и реальные записи архива; ошибки экспорта сохраняют черновик в текущем сеансе.

## Классы вирусов и редактор Phase 20

- [ ] **STAB-CLASS-01**: Классы «Разум», «Поведение» и «Вид / внешность» переименованы с сохранением уровней 1/2/3 (Люцидиум/Транзитиум/Обливиум, Стабилар/Импульсар/Инфернар, Изоморф/Полиморф/Ксеноморф); в карточке вируса, редакторе и выпадающих списках названия без знака ударения; остальные оси классификации не меняются (D-35, D-37).
- [ ] **STAB-CLASS-02**: Записи со старыми названиями показываются, ищутся и редактируются как новые, при следующем сохранении записывается новое; неизвестные значения не теряются, а проверка закрытых вкладок не даёт ложного отказа (D-36а).
- [ ] **STAB-CLASS-03**: Forward-only SQL-миграция переписывает старые названия в сохранённых записях; она проверена offline и агентом `supabase-rls-reviewer`, применяется только на изолированном staging после решения владельца; production применяет владелец сам, и статус применения записан честно, без PASS от агента (D-36б).
- [ ] **STAB-CLASS-04**: Раздел «Классификация» стартового контента «Информации» содержит тексты владельца дословно, с ударениями, под сохранённым заголовком «ДОПОЛНИТЕЛЬНАЯ ЛИНЕЙКА»; уже отредактированная «Информация» в базе молча не перезаписывается (D-38, D-49).
- [ ] **STAB-EDIT-01**: Во вкладке «Информация» редактора разделы идут колонками сверху вниз, не больше 5 в колонке, без пустой правой части окна; на phone — одна колонка без горизонтального overflow (D-40).
- [ ] **STAB-EDIT-02**: Во вкладках «Справочник», «Сводка» и «Рекомендации» кнопка «+ ДОБАВИТЬ РАЗДЕЛ» закреплена сверху; раздел создаётся с заголовком и заметкой, внутри создаются подразделы, раскладка плотная; новая форма данных читает прежний контент без потерь и не меняет публичный контракт сайта (D-41).
- [ ] **STAB-EDIT-03**: Порядок разделов и карточек и перетаскивание (указатель и ArrowUp/ArrowDown) работают в новых раскладках, включая перенос через границу колонки, одним шагом отмены (D-42).
- [ ] **STAB-EDIT-04**: Заметки разделов редактора хранятся отдельно от публичного контента и не попадают в `/api/content`, публично читаемую таблицу контента и данные посетителей; читает и меняет их только редактор с доступом к соответствующей вкладке (D-47).

## Out of Scope

- Полный редизайн поверхностей вне согласованной визуальной переработки Phase 20 или смена художественной основы PORTIA OS без отдельного решения владельца.
- Новый generic/schema-driven app shell или переписывание modular monolith на другую архитектуру.
- Motion/Framer Motion, другой test runner, package manager, BaaS, database или hosting platform.
- Новый font/icon system и массовая замена SVG за пределами утверждённого реестра Phase 20 без отдельного решения владельца.
- Desktop-виджет «Сводка» и свободная общая расстановка ярлыков.
- Загрузка доказательств повышения на сайт и автоматический pass/fail по проценту.
- Показ участнику конкретных ошибок, правильных ответов, notes или личности reviewer.
- Обещание аппаратной идентификации устройства или неуязвимости к spoofing/VPN/cookie cleaning.
- Мутационные проверки на production и `npm audit fix --force`.
- Исправление принятого ограничения Ctrl+wheel внутри focused cross-origin iframe.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAB-BASE-01 | Phase 15 | Complete |
| STAB-BASE-02 | Phase 15 | Pending |
| STAB-BASE-03 | Phase 15 | Pending |
| STAB-BASE-04 | Phase 15 | Pending |
| STAB-BASE-05 | Phase 15 | Complete |
| STAB-BASE-06 | Phase 15 | Pending |
| STAB-DESK-01 | Phase 17 | Complete |
| STAB-DESK-02 | Phase 18 | Pending |
| STAB-DESK-03 | Phase 18 | Pending |
| STAB-DESK-04 | Phase 18 | Pending |
| STAB-DESK-05 | Phase 18 | Gaps Found |
| STAB-DESK-06 | Phase 18 | Pending |
| STAB-DESK-07 | Phase 17 | Complete |
| STAB-DESK-08 | Phase 19 | Pending |
| STAB-MOTION-01 | Phase 18 | Gaps Found |
| STAB-MOTION-02 | Phase 18 | Pending |
| STAB-MOTION-03 | Phase 18 | Pending |
| STAB-MOTION-04 | Phase 18 | Pending |
| STAB-MOTION-05 | Phase 18 | Pending |
| STAB-MOTION-06 | Phase 18 | Pending |
| STAB-MOTION-07 | Phase 18 | Pending |
| STAB-MOTION-08 | Phase 18 | Pending |
| STAB-PROM-01 | Phase 19 | Pending |
| STAB-PROM-02 | Phase 19 | Pending |
| STAB-PROM-03 | Phase 19 | Pending |
| STAB-PROM-04 | Phase 19 | Pending |
| STAB-PROM-05 | Phase 19 | Pending |
| STAB-PROM-06 | Phase 19 | Pending |
| STAB-PROM-07 | Phase 19 | Pending |
| STAB-PROM-08 | Phase 19 | Pending |
| STAB-PROM-09 | Phase 19 | Pending |
| STAB-PROM-10 | Phase 19 | Pending |
| STAB-PROM-11 | Phase 19 | Pending |
| STAB-PROM-12 | Phase 19 | Pending |
| STAB-PROM-13 | Phase 19 | Pending |
| STAB-PROM-14 | Phase 19 | Pending |
| STAB-PROM-15 | Phase 19 | Pending |
| STAB-APP-01 | Phase 19 | Pending |
| STAB-APP-02 | Phase 19 | Pending |
| STAB-APP-03 | Phase 19 | Pending |
| STAB-APP-04 | Phase 19 | Pending |
| STAB-APP-05 | Phase 19 | Pending |
| STAB-APP-06 | Phase 19 | Pending |
| STAB-APP-07 | Phase 19 | Pending |
| STAB-APP-08 | Phase 19 | Pending |
| STAB-APP-09 | Phase 19 | Pending |
| STAB-APP-10 | Phase 19 | Pending |
| STAB-SEARCH-01 | Phase 19 | Pending |
| STAB-SEARCH-02 | Phase 19 | Pending |
| STAB-SEARCH-03 | Phase 19 | Complete |
| STAB-SEARCH-04 | Phase 19 | Pending |
| STAB-MEDIA-01 | Phase 19 | Complete |
| STAB-MEDIA-02 | Phase 19 | Pending |
| STAB-MEDIA-03 | Phase 19 | Pending |
| STAB-MEDIA-04 | Phase 19 | Pending |
| STAB-MEDIA-05 | Phase 19 | Pending |
| STAB-MEDIA-06 | Phase 18 | Pending |
| STAB-MEDIA-07 | Phase 20 | Pending |
| STAB-A11Y-01 | Phase 20 | Pending |
| STAB-A11Y-02 | Phase 20 | Pending |
| STAB-A11Y-03 | Phase 20 | Pending |
| STAB-A11Y-04 | Phase 20 | Pending |
| STAB-SEC-01 | Phase 16 | Complete |
| STAB-SEC-02 | Phase 20 | Pending |
| STAB-SEC-03 | Phase 20 | Pending |
| STAB-SEC-04 | Phase 16 | Complete |
| STAB-SEC-05 | Phase 20 | Pending |
| STAB-SEC-06 | Phase 20 | Pending |
| STAB-REL-01 | Phase 20 | Pending |
| STAB-REL-02 | Phase 20 | Pending |
| STAB-REL-03 | Phase 20 | Pending |
| STAB-REL-04 | Phase 16 | Complete |
| STAB-REL-05 | Phase 20 | Pending |
| STAB-REL-06 | Phase 20 | Pending |
| STAB-REL-07 | Phase 20 | Pending |
| STAB-REL-08 | Phase 20 | Pending |
| STAB-VIS-01 | Phase 20 | Pending |
| STAB-VIS-02 | Phase 20 | Pending |
| STAB-VIS-03 | Phase 20 | Pending |
| STAB-VIS-04 | Phase 20 | Pending |
| STAB-TMPL-01 | Phase 20 | Pending |
| STAB-SEARCH-05 | Phase 20 | Pending |
| STAB-SEARCH-06 | Phase 20 | Pending |
| STAB-SEARCH-07 | Phase 20 | Pending |
| STAB-CLASS-01 | Phase 20 | Pending |
| STAB-CLASS-02 | Phase 20 | Pending |
| STAB-CLASS-03 | Phase 20 | Pending |
| STAB-CLASS-04 | Phase 20 | Pending |
| STAB-EDIT-01 | Phase 20 | Pending |
| STAB-EDIT-02 | Phase 20 | Pending |
| STAB-EDIT-03 | Phase 20 | Pending |
| STAB-EDIT-04 | Phase 20 | Pending |

---
*Last updated: 2026-11-04 after owner decisions D-46..D-49 added Phase 20 requirements (92/92 uniquely mapped)*
