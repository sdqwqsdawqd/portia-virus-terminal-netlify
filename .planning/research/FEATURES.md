# Feature Landscape: v1.3 «Стабилизация PORTIA OS»

**Domain:** стабилизация существующего русского desktop-metaphor web application
**Researched:** 2026-10-30
**Scope:** пользовательские возможности и проверяемое поведение; без редизайна и без изменения продуктового кода
**Overall confidence:** HIGH для инвентаризации текущей реализации; MEDIUM для поведения в live Supabase и физической PC/phone-среде, потому что эти проверки ещё не выполнены

## Вывод

v1.3 не должен заново изобретать PORTIA OS. Рабочий стол, приложения, редактор, текущая тёмно-бирюзовая визуальная система, русская терминология и большинство бизнес-правил уже существуют. Ценность этого milestone — превратить существующее поведение из набора локальных реализаций и частичных preflight-проверок в утверждённые контракты с воспроизводимыми доказательствами.

Главное различие для roadmap: **«реализовано» не равно «доказано»**. Текущий `npm test` даёт 584 теста: 583 проходят, один mutating live-тест Promotion пропущен. При этом в проекте нет committed Playwright-конфигурации, browser page objects, visual snapshots или Figma-контракта, а Phase 14 UAT содержит 0 полностью принятых сценариев. Поэтому старые галочки требований подтверждают наличие реализации, но не являются release acceptance для v1.3.

Отдельный риск — дрейф контрактов. `.impeccable/surfaces/components-portia-desktop-tsx.md` описывает неутверждённый дизайн с другой типографикой, а текущий валидированный проект использует IBM Plex Mono, Golos Text и IBM Plex Serif. Планирование также упоминает режим анимации «системная / вкл / выкл», тогда как текущий код предлагает только «Включены / Выключены» и намеренно игнорирует системный reduced-motion после загрузки настройки. До новых визуальных правок эти расхождения нужно решить и зафиксировать, не меняя художественную основу молча.

## Модель статусов

| Статус | Значение для v1.3 |
|---|---|
| **PRESENT — validated** | Поведение выпущено и ранее принято; v1.3 обязана сохранить его без дрейфа. |
| **IMPLEMENTED — preflight only** | Код и deterministic-тесты есть, но отсутствует live/browser/owner-доказательство. Это не release-ready. |
| **MISSING — implementation/evidence** | Нужного механизма или обязательного доказательства в репозитории нет. |
| **ACCEPTED LIMITATION** | Ограничение уже осознанно принято; milestone не должен незаметно превращать его в новый feature scope. |

## Текущая граница продукта

### Уже присутствует и не подлежит редизайну с нуля

- Рабочий стол PORTIA OS с ярлыками, панелью задач, окнами, настройками акцента/обоев/размера значков/анимаций/паука и сохранением настроек устройства.
- Приложения: «База вирусов», «Сотрудники», «Глобальный поиск», «Информация», «Справочник», «Повышение», «Настройки», «Сводка», «Корзина», «Таблица», «Устав» и встроенный «Редактор».
- Перетаскивание и изменение размера окон, сворачивание, разворачивание, закрытие, taskbar и переходы из ярлыков/поиска.
- Контентные потоки архива, сотрудников, информации, справочника, рассылок/квестов, корзины и встроенных документов.
- Редактор с правами вкладок, историей undo/redo, ревизиями, защитой от перезаписи, сохранением несохранённых правок и WYSIWYG-полями.
- Визуальная идентичность PORTIA OS: тёмно-бирюзовая основа, ice/amber/red семантика, текущие шрифты с кириллицей, PNG-паук, паутина, Вивьян, тематические SVG-иконки и обои.
- Реализованный бизнес-контур Promotion: отдельные ordinary/qualification-потоки, банки, reviewer queue, серверные сроки, приватность ответов, история и cleanup.

### Чего сейчас нет как доказанного контракта

- Committed Playwright E2E/visual/a11y/console suite и утверждённых screenshot baselines.
- Figma UI/motion-контракта, согласованного с текущим продуктом и владельцем.
- Изолированного mutating Supabase staging-прогона RLS/RPC/concurrency.
- Полной владельческой PC/phone UAT для Promotion и последних desktop/motion исправлений.
- Подтверждения, что актуальные SQL hardening-изменения действительно применены к целевой Supabase-среде.
- Финального решения по расхождению между текущим переключателем motion и заявленным системным reduced-motion поведением.

## 1. Baseline, тестирование и дизайн-контракт

| ID | Пользовательская возможность / поведение | Текущее состояние | Acceptance для v1.3 | Обязательное доказательство |
|---|---|---|---|---|
| STAB-BASE-01 | Существующий PORTIA OS остаётся узнаваемым и функционально тем же продуктом | **PRESENT — validated.** Основной shell и приложения выпущены в v1.0/v1.1. | До рефакторинга фиксируются текущие экраны, тексты, состояния и переходы. Изменение внутренней структуры не меняет названия, расположение ключевых действий, данные или художественный язык без отдельного утверждения. | Инвентарь экранов + before/after Playwright evidence для каждой затронутой поверхности. |
| STAB-BASE-02 | Критические пользовательские пути воспроизводятся автоматически | **MISSING — evidence.** Есть 583 проходящих Node-теста и один skipped live-тест, но Playwright отсутствует в `package.json`, конфиге и репозитории. | Committed browser suite покрывает visitor, participant, regular editor, `promo` reviewer и owner; PC и phone; loading/empty/error/full/permission-denied/conflict; motion on/off. Тесты не меняют production данные. | Playwright run с trace/screenshot/video на ошибке и стабильными staging fixtures. |
| STAB-BASE-03 | Визуальный вид не дрейфует случайно | **MISSING — evidence.** Утверждённых visual snapshots нет. | Скриншоты утверждаются владельцем до refactor/motion changes. Visual gate сравнивает desktop, основные окна, Promotion, editor, spider/web/assistant и phone layout при фиксированных данных, viewport, DPR, шрифтах и выключенной случайности. | Versioned baseline images + documented update/approval rule; PC owner check включает DPR 1.25. |
| STAB-BASE-04 | UI и motion имеют единый источник правды | **MISSING — contract.** Существующий Impeccable surface unreviewed и расходится с валидированной типографикой; Figma-файлы в репозитории не найдены. | Figma фиксирует текущую, а не новую, идентичность: desktop/phone frames, окна, ярлыки, controls, empty/loading/error/saving/disabled/focus states, spider/web/Vivian и motion keyframes. Любое отклонение от current UI помечено как отдельное утверждённое изменение. | Ссылка/экспорт утверждённого Figma-контракта, revision/date/owner verdict и mapping к Playwright snapshots. |
| STAB-BASE-05 | Пользователь не получает скрытых runtime-регрессий | **IMPLEMENTED — partial.** Последний audit видел чистую консоль; раньше был Next overlay из raw script. | Любая uncaught exception, React hydration warning, failed critical request, CSP violation или unexpected console error валит browser gate. Ожидаемые отказы upstream/API проверяются как оформленные русские состояния. | Console/network assertions на cold load, reload и основных flows. |
| STAB-BASE-06 | Каждая фаза закрывается по одному GSD-порядку | **MISSING — process evidence.** Phase 14 implementation и planning ledger разошлись. | Для каждой фазы: requirements → approved design contract when visual → plan → implementation → deterministic tests → Playwright → visual/a11y/security evidence → owner UAT when required → summary/verification. Нельзя закрыть фазу только по исходным checked requirements. | Полный набор GSD artifacts без пропущенных summary/verification и с traceability к acceptance IDs. |

### Минимальная browser-матрица

| Измерение | Обязательные состояния |
|---|---|
| Роль | анонимный посетитель; participant по нику; редактор без `promo`; reviewer с `promo`; owner |
| Экран | phone portrait/touch; обычный PC; owner PC с DPR 1.25 для window/shortcut visual checks |
| Данные | нормальные; пустые; loading; upstream unavailable; stale/conflict; permission denied |
| Motion | текущие «Включены» и «Выключены»; fallback при отсутствии `data-motion`; итоговое решение о системной настройке |
| Навигация | мышь; клавиатура; touch; reload; direct URL/API denial where relevant |

## 2. Рабочий стол и окна

| ID | Пользовательская возможность / поведение | Текущее состояние | Acceptance для v1.3 | Обязательное доказательство |
|---|---|---|---|---|
| STAB-DESK-01 | Приложение открывается из ярлыка, start panel, taskbar или search и получает фокус | **PRESENT — validated.** App metadata и 12 оконных surface существуют. | Один app id всегда открывает одну и ту же поверхность; повторное открытие поднимает/восстанавливает окно, не создаёт дубликат и не теряет внутреннее состояние. | Playwright переходы для каждого entry point и app id. |
| STAB-DESK-02 | Окна перетаскиваются и resize-ятся за все края без исчезновения | **IMPLEMENTED — preflight only** для последнего symmetric clamp fix. Unit geometry tests проходят; физический PC drag pending. | Обычное окно остаётся полностью внутри workspace с одинаковым левым/правым inset; resize сохраняет противоположный край и minimum; окно после смены viewport помещается в доступную область. | Playwright geometry assertions + owner physical PC drag at left/right/top/bottom and after resize. |
| STAB-DESK-03 | Minimize/maximize/close/taskbar предсказуемы | **PRESENT — validated**, но нет committed E2E. | Действия не теряют app state, не меняют другие окна и возвращают фокус ожидаемому окну; locked qualification не позволяет закрыть, свернуть или сдвинуть Promotion. | Multi-window browser scenarios, включая qualification lock. |
| STAB-DESK-04 | Phone layout остаётся полноценным | **PRESENT — partial validation.** Audit подтверждал mobile layout без horizontal overflow. | На phone открытое приложение использует доступный экран, действия достижимы touch, sticky/fixed controls не закрывают content, закрытие возвращает desktop; ни одна поверхность не имеет общего горизонтального crawl. | Phone Playwright screenshots + touch actions для всех приложений. |
| STAB-DESK-05 | Настройки устройства сохраняются независимо | **PRESENT — validated.** Accent, wallpaper, icon size/position, motion и spider хранятся локально. | Изменение одной настройки не сбрасывает остальные; reload восстанавливает значения; повреждённое storage безопасно возвращается к default; custom accent сохраняет читаемость. | Storage round-trip и corrupted-storage browser cases. |
| STAB-DESK-06 | Ярлыки не теряются и не ломают desktop | **PRESENT — validated** для независимых positions; последние animation handoff fixes только preflight. | Drag изменяет только выбранный shortcut; после reload position восстановлена и остаётся достижимой; размер/position не перекрывают критичные controls; действие открытия доступно клавиатурой и touch. | Browser drag/reload/keyboard/touch matrix. |
| STAB-DESK-07 | Декомпозиция desktop/editor не видна пользователю | **MISSING — implementation.** `portia-desktop.tsx` и `portia-editor.tsx` остаются oversized. | После разделения component boundaries все app ids, тексты, DOM semantics, storage keys, API calls, ordering и visual snapshots остаются прежними, кроме отдельно утверждённых fixes. | Before/after contract tests и zero-unapproved-diff visual review. |
| STAB-DESK-08 | Desktop переживает пустые/неполные данные | **PRESENT — validated.** ROB-01/03 и normalization regressions существуют. | Ни один app не падает при пустой коллекции или частичном upstream failure; пользователь видит различимые loading, empty, stale и error states и может повторить безопасное действие. | Fixture-driven E2E для каждой поверхности. |

## 3. Motion, паук, паутина, ярлыки и Вивьян

| ID | Пользовательская возможность / поведение | Текущее состояние | Acceptance для v1.3 | Обязательное доказательство |
|---|---|---|---|---|
| STAB-MOTION-01 | Motion следует понятной пользовательской настройке | **UNRESOLVED CONTRACT.** Current code имеет on/off и после загрузки игнорирует OS preference; planning описывает system/on/off. | До дальнейших изменений владелец утверждает один контракт. UI copy, boot script, CSS, Promotion и editor обязаны следовать ему одинаково. «Выключены» не оставляет бесконечных/отвлекающих движений и не скрывает content. | Figma/motion decision + automated mode matrix + owner check. |
| STAB-MOTION-02 | Boot animation не мешает повторным визитам | **PRESENT — validated.** Запуск один раз за session. | В одном tab session boot показывается максимум один раз; reload не блокируется повторной заставкой; reduce/off даёт короткое или мгновенное безопасное состояние по утверждённому контракту. | Cold/new-session/reload browser tests. |
| STAB-MOTION-03 | PNG-паук остаётся видимым и перемещается естественно по паутине | **IMPLEMENTED — preflight only** для последних lifecycle/gait fixes. PNG — закреплённое решение. | Пока паук включён, он не исчезает и не телепортируется после маршрута; идёт по нитям непрерывно; новый spawn/pose выбирается только после явного `Скрыть → Показать`; выключенный паук не оставляет точки/следы. | Deterministic seeded motion test + owner-approved recording at PC size. |
| STAB-MOTION-04 | Движение лап читается как утверждённая походка | **IMPLEMENTED — preflight only.** Front pair timing covered by tests; owner timing acceptance pending. | Передняя пара у лица ведёт шаг и делает редкий короткий hunting signal; задние лапы не дёргаются постоянно; footfall waves возникают от постановки лапы и затухают. | Figma/keyframe contract + slowed and normal-speed owner review. |
| STAB-MOTION-05 | Shortcut animation завершается без snap | **IMPLEMENTED — preflight only.** Source/style tests проходят; owner DPR 1.25 check pending. | Hover/focus запускает один semantic cycle; pointer exit не обрывает его; последний animated frame совпадает с resting geometry, viewBox, filter и quality; container не скачет. | Visual/video comparison at DPR 1 and 1.25 for every animated shortcut. |
| STAB-MOTION-06 | Вивьян остаётся читаемой и реагирует без раздражающего motion | **IMPLEMENTED — preflight only** для accent brightness; базовые советы/настроения present. | Assistant follows selected accent without neon/grey mismatch, bubble text readable, repeated click/recovery behavior deterministic, removed phrases disappear on poll, motion off/reduce не мешает ответу. | Accent matrix screenshots + click/idle/activity/offended browser flows. |
| STAB-MOTION-07 | Wallpapers не создают jank и выключаются полностью | **PRESENT — validated** для gel composite layer и static-off behavior; нет formal browser performance budget. | При включённом motion desktop interactions остаются responsive; при off все wallpapers статичны и полностью отрисованы; смена wallpaper не даёт flash/blank layer. | Performance trace на owner PC + visual mode snapshots. |
| STAB-MOTION-08 | Motion изменения сначала утверждаются, потом реализуются | **MISSING — contract/gate.** Repeated patch loop зафиксирован forensic report. | Для spider/web/Vivian/shortcut/window motion есть start, key states, end/rest frame, duration/easing, interruption и reduced/off behavior. Нельзя принимать механику unit-тестом, если владелец визуально отвергает результат. | Figma motion spec + owner verdict до code changes и visual regression после. |

## 4. «Повышение»: обязательный доказанный workflow

Все 49 исходных требований имеют кодовые и deterministic evidence, но Phase 14 остаётся **IMPLEMENTED — preflight only**. UAT ledger содержит 0 полностью принятых сценариев; live mutating suite требует isolated Supabase и намеренно пропускается. v1.3 не должна повторно проектировать flow, а должна доказать и при необходимости исправить его по следующим пользовательским контрактам.

| ID | Пользовательская возможность / поведение | Текущее состояние | Acceptance для v1.3 | Обязательное доказательство |
|---|---|---|---|---|
| STAB-PROM-01 | Участник без аккаунта проверяет состояние по нику | **IMPLEMENTED — deterministic.** | Listed nickname получает только safe projection; missing nickname создаёт ноль записей; sheet outage отличается от «ник не найден»; удаление строки немедленно закрывает status/actions. | Browser + staging database write-count assertions с temporary roster rows. |
| STAB-PROM-02 | Доступность действия и cooldown объясняются правдиво | **IMPLEMENTED — remediation preflight.** Старый UAT видел отсутствующие actions и `..` в дате. | Для каждого server state видна ровно допустимая ordinary/qualification action либо одна стабильная русская причина; calendar cooldown не выдумывает время; exact retake показывает server time; submit даёт явный success/refusal/error. | Eligibility matrix browser tests на точных границах 7/3/4/6/8/10/18 дней и retake. |
| STAB-PROM-03 | Первый принятый запрос атомарно привязывает устройство | **IMPLEMENTED — not live-proven.** Lookup read-only и atomic RPC покрыты mocks/SQL tests. | Lookup не bind-ит; accepted submit один раз ставит HttpOnly-backed binding; reload восстанавливает ник; другой ник получает нейтральный отказ; rejected submit не оставляет token/binding/request. | Isolated Supabase accepted/rejected round trips и browser cookie behavior. |
| STAB-PROM-04 | Повторные/конфликтующие запросы ограничены без утечки личности | **IMPLEMENTED — deterministic.** | Один активный запрос каждого вида на ник; waits 5/15/60 минут не продлеваются каждым retry; сообщение не раскрывает связанный ник; решение не обещает hardware attestation. | Staging race/rate-limit suite с двумя никами и устройствами. |
| STAB-PROM-05 | Ordinary promotion остаётся отдельным потоком | **IMPLEMENTED — browser acceptance missing.** | Reviewer выдаёт manual/random active-only duplicate-free ordered set; insufficient pool блокирует confirm с точной причиной; preview можно rebuild/replace; confirmed snapshot неизменяем; новый набор блокирован до изменения звания в sheet. | Reviewer + participant PC/phone round trip against staging. |
| STAB-PROM-06 | Qualification остаётся отдельным потоком | **IMPLEMENTED — browser/live acceptance missing.** | Доступна только на переходах 2→3, 4→5, 6→7; independent banks и quotas для single/multiple/free-text; reviewer подтверждает start; participant видит один вопрос, идёт только вперёд и не получает future questions/keys. | Staging flow со всеми типами вопросов и network payload inspection. |
| STAB-PROM-07 | Серверный 15-минутный тест переживает reload и честно завершается | **IMPLEMENTED — deterministic.** | Один deadline начинается при reviewer confirmation; reload сохраняет current question/deadline; CAS не принимает повтор/старый индекс; boundary timeout и offline завершают attempt один раз, сохраняя уже отправленные ответы. | Clock-controlled staging E2E + reload/conflict/offline cases. |
| STAB-PROM-08 | PC и phone имеют намеренно разное anti-cheat поведение | **IMPLEMENTED — real-device acceptance missing.** | После понятного warning PC focus/visibility/navigation loss завершает attempt; phone app/tab switch не завершает, но offline и deadline завершают; mode фиксируется сервером после start. Спуфинг initial classification остаётся документированным residual risk. | Real PC + phone UAT and server-state verification. |
| STAB-PROM-09 | Reviewer access и concurrent ownership защищены | **IMPLEMENTED — live race unproven.** | Editor без `promo` не видит workspace и получает 403; owner grant/revoke действует сразу; две reviewer claims дают ровно одного owner; release/force-release соблюдают роли; badges равны видимым queue rows, включая claimed. | Authenticated two-reviewer staging race + direct API denial. |
| STAB-PROM-10 | Банки реально редактируются на PC и phone | **IMPLEMENTED — remediation preflight only.** Старый UAT провалил count, CRUD и controls. | Required counts persist after reload; add/edit/disable/delete preserves typed data during save; save/saved/error/disabled states clear; answer keys выбираются рядом с вариантами, без zero-based indices; preview invalidates after mutation. | Authenticated reviewer PC/phone CRUD and reload round trip. |
| STAB-PROM-11 | Reviewer оценивает ответы, но итог принимает вручную | **IMPLEMENTED — live acceptance missing.** | Every answer получает mark; percentage derived; pass/fail chosen independently; technical failure can be overridden before final decision; participant sees only result and optional percent, not mistakes, keys, notes or reviewer identity. | Reviewer/participant paired E2E + response schema assertions. |
| STAB-PROM-12 | Retake и notification не создают ложные возможности | **IMPLEMENTED — deterministic.** | Failure proposes 2 days, reviewer may change/extend/release; requests blocked до server date; attempts unlimited; expiry gives one quiet quest-style toast only after wait was observed and opens Promotion. | Staging time travel/fixture + dismissal/reload/open-state browser cases. |
| STAB-PROM-13 | Закрытие и cleanup минимизируют данные | **IMPLEMENTED — mutating proof missing.** | Close transactionally removes detailed payload, retains at most three compact results; abandoned/expired data eligible after three days; cleanup does not delete unvalidated active workflow; UI shows unobtrusive cleanup hint. | Isolated database assertions before/after close and scheduled cleanup. |
| STAB-PROM-14 | Ошибки не маскируются успешным UI | **IMPLEMENTED — browser acceptance missing.** | Missing migration/RPC, database outage, sheet outage, stale response and validation refusal produce distinct safe states; no «заявка принята» до authoritative success; retry does not duplicate write. | Fault-injected E2E with API and RPC failure fixtures. |
| STAB-PROM-15 | Полный Promotion flow принят владельцем | **MISSING — evidence.** | Все participant/reviewer flows проходят подряд после clean reload на PC и phone, без stale local state; direct protected API checks included. | Закрытый owner UAT ledger с approved temporary data и 0 unresolved failures. |

## 5. Остальные приложения и редакторы

| ID | Пользовательская возможность / поведение | Текущее состояние | Acceptance для v1.3 | Обязательное доказательство |
|---|---|---|---|---|
| STAB-APP-01 | «База вирусов» быстро находит и читает dossier | **PRESENT — validated.** | Поиск по имени/коду, выбор записи, classification, mutations, scientist logs и locked levels сохраняют текущую семантику; empty/loading/error различимы; выбранная запись не исчезает из-за фонового poll без причины. | Browser flow с normal/empty/stale content. |
| STAB-APP-02 | «Сотрудники» сохраняют roster и локальные дополнения без потерь | **PRESENT — validated.** | Ровно 34 sheet slots; profile/Roblox fallback не стирает last good data; manual employee details/ratings не теряются; click portrait opens Roblox only when link valid; phone cards usable. | Upstream-degraded fixtures + editor save/reload. |
| STAB-APP-03 | «Сводка» разделяет новости и квесты | **PRESENT — validated.** | Published items, important ordering, active/upcoming/finished quest ordering и once-only nonblocking toast работают при live poll; reading active quests marks them seen без ложного popup. | Clock/poll/browser notification cases. |
| STAB-APP-04 | «Информация» и «Справочник» читаются и редактируются без изменения content model | **PRESENT — validated.** | Sections/cards/blocks сохраняют порядок и все шесть block types; guide starts folded; back control не закрывает card; tables/media/callouts render consistently; old saved data normalizes без потерь. | Representative content snapshots + edit/save/reload on PC/phone. |
| STAB-APP-05 | «Корзина» показывает file/virus на всю рабочую область и безопасно восстанавливает | **PRESENT — validated.** | Restore доступен только в editor с правами, delete irreversible только после ясного confirmation; formatting/order не переезжают к соседним records; empty state truthful. | Restore/delete permission matrix and content integrity assertions. |
| STAB-APP-06 | «Таблица» и «Устав» остаются полнооконными embedded documents | **PRESENT — validated** с known browser limitation. | Shared sandbox/headers сохраняются; +/- zoom всегда работает; Ctrl+wheel работает вне cross-origin iframe. Невозможность получить wheel event из focused cross-origin frame остаётся **ACCEPTED LIMITATION**, а не regression. | Browser zoom/click/sandbox checks and documented limitation. |
| STAB-APP-07 | Редактор не теряет правки и показывает authoritative save state | **PRESENT — validated**, последний bounded-list layout только preflight/visual pending. | Undo/redo, drafts during save, revision conflict, poll suppression, save-all, section permissions и per-field errors сохраняются; save success только после authoritative response; long lists scroll internally; natural headings не становятся obstructive sticky chrome. | Authenticated editor E2E с concurrent change, outage, long lists и phone layout. |
| STAB-APP-08 | WYSIWYG formatting остаётся одинаковым на PC/phone | **PRESENT — validated.** | Поле использует typography редактируемой области; formatting applies only to selected word/range; target marker — turquoise underline without fill; panel drag/touch selection не теряют range; save with open panel works. | Mouse/keyboard/touch selection flows and visual text comparison. |
| STAB-APP-09 | Права вкладок видны как отсутствие доступа, а не сломанный UI | **PRESENT — deterministic.** | Regular tabs follow owner grants/closed tabs; trusted Promotion closed by default; revoked sections cannot be changed through UI or site API; access lookup outage fails closed with an explicit Russian state. | Role matrix E2E + direct API assertions. |
| STAB-APP-10 | Каждое приложение имеет общий state contract | **MISSING — systematic evidence.** | Для всех apps проверяются loading, empty, populated, stale/degraded, permission denied и fatal error; actions disabled only with an understandable reason; retry does not destroy last good data. | Shared Playwright fixture matrix, без требования визуально унифицировать приложения в новый generic shell. |

## 6. Глобальный поиск

| ID | Пользовательская возможность / поведение | Текущее состояние | Acceptance для v1.3 | Обязательное доказательство |
|---|---|---|---|---|
| STAB-SEARCH-01 | Поиск охватывает весь существующий desktop content | **IMPLEMENTED — remediation preflight.** Source включает apps, employees, viruses, info/subsections, guide cards/blocks, published broadcasts, recycle files и recycled viruses. | Запрос находит каждую перечисленную surface по title/code/body/meta; `е/ё` и регистр не мешают; непубликованный content не утекает. | Provider-by-provider E2E fixtures. |
| STAB-SEARCH-02 | Результат открывает точное место-владельца | **IMPLEMENTED — partial browser proof.** Employee result interaction ждёт loaded roster session. | Virus выбирает dossier; employee — profile; info — нужный section/subsection; guide — card; broadcast — correct tab; recycle result — file; app — app window. Search window не остаётся modal blocker. | Click-through browser test для каждого result type. |
| STAB-SEARCH-03 | Search usable keyboard-first и на phone | **PRESENT — partial.** Ctrl+K hint существует; complete keyboard behavior не зафиксирован Playwright. | Ctrl/Cmd+K открывает/focuses input; Tab/arrow/Enter/Escape имеют утверждённое поведение; focus visible; results readable on phone; zero results и loading roster не выглядят одинаково. | Keyboard and touch Playwright scenarios. |
| STAB-SEARCH-04 | Search не показывает stale/private content | **MISSING — systematic evidence.** | После content poll удалённые records исчезают; closed/private editor data, answer keys и internal reviewer fields никогда не индексируются; degraded roster clearly marked or retains safe last-good behavior. | Data refresh and privacy assertions. |

## 7. Медиа и производительность

| ID | Пользовательская возможность / поведение | Текущее состояние | Acceptance для v1.3 | Обязательное доказательство |
|---|---|---|---|---|
| STAB-MEDIA-01 | Upload принимает только реальное поддерживаемое изображение | **PRESENT — audited.** Signature проверяется по bytes, не только browser MIME. | Spoofed/oversized/unsupported file отклоняется до публикации с ясной русской ошибкой; failed upload не стирает текущий URL/draft; успешный возвращает safe UUID URL. | API + authenticated editor browser uploads with valid/spoofed files. |
| STAB-MEDIA-02 | Media URL не создаёт unsafe scheme/path | **PRESENT — deterministic.** Разрешены local one-slash paths и HTTPS; protocol-relative/backslash/control chars очищаются. | Normalization, SQL constraint и rendering используют один contract; invalid legacy value даёт fallback, а не broken executable URL. | Shared contract tests + browser fallback. |
| STAB-MEDIA-03 | Активное изображение загружается раньше фоновых коллекций | **PRESENT — audited/preflight.** Active remote media получает preconnect/preload/fetch priority; background collections lazy. | Opening a record prioritizes only its hero/active media; offscreen list images не создают initial request storm; switching record не показывает старое image как новое. | Playwright network request ordering and cache-hit assertions. |
| STAB-MEDIA-04 | Uploaded immutable media эффективно кэшируется | **PRESENT — audited.** UUID uploads имеют годовой immutable cache. | Повторное открытие не скачивает неизменившийся UUID asset заново; новый upload получает новый URL; content revision invalidation не ломает media cache. | Response header and repeat-navigation browser evidence. |
| STAB-MEDIA-05 | Broken/slow external media не ломает content | **PRESENT — partial.** Fallback images ранее валидированы; broad HTTPS media policy остаётся. | Image/video failure leaves readable caption/content, stable layout and retry/open-external behavior where applicable; no app crash or infinite spinner. | Blocked/404/slow media fixtures across archive/info/guide/employees. |
| STAB-MEDIA-06 | Performance оценивается относительно зафиксированного baseline | **MISSING — evidence/budget.** Нет milestone-specific measured budgets. | До оптимизации фиксируются owner PC и phone traces. После изменений interaction, window drag, wallpaper and app-open metrics не хуже approved baseline; numeric budgets утверждаются в phase research, а не придумываются здесь. | Repeatable Lighthouse/Playwright trace or equivalent with device/network profile recorded. |
| STAB-MEDIA-07 | Media policy совместима с tightened CSP | **UNRESOLVED.** CSP пока допускает broad HTTPS media и `unsafe-inline`. | Внешние host needs инвентаризированы; allowlist/proxy policy не ломает текущие approved images/YouTube; rejected host показывает fallback. | CSP report-only run, approved host matrix and browser checks before enforcement. |

## 8. Accessibility и security как наблюдаемое поведение

| ID | Пользовательская возможность / поведение | Текущее состояние | Acceptance для v1.3 | Обязательное доказательство |
|---|---|---|---|---|
| STAB-A11Y-01 | Весь продукт управляется без мыши там, где control доступен на PC | **PRESENT — partial deterministic/runtime audit.** | Все buttons/links/tabs/listboxes/dialogs имеют name/role/state; focus visible и не теряется при open/close/confirm; dialogs trap/restore focus; shortcut drag имеет доступную альтернативу, если drag — единственный способ изменения. | Playwright keyboard journeys + automated accessibility scan. |
| STAB-A11Y-02 | Phone touch targets и content не перекрываются | **PRESENT — partial audit.** | Primary actions reachable, не требуют hover, не скрыты sticky bars/keyboard, controls имеют достаточную practical tap area, нет page-level horizontal overflow. | Real phone + emulated touch screenshots and interactions. |
| STAB-A11Y-03 | Русские labels/errors понятны и стабильны | **PRESENT — partial.** Runtime audit не нашёл unnamed buttons/images; Promotion copy раньше требовал fixes. | Нет пустых/joke labels, doubled punctuation или untranslated technical error; success/error/disabled reason объявлены и видимы; decorative images empty-alt, informative images meaningful-alt. | Copy assertions + accessibility tree snapshots. |
| STAB-A11Y-04 | Motion не препятствует использованию | **UNRESOLVED CONTRACT.** | Итоговая motion настройка применяется ко всем desktop/app/Promotion animations; off/reduce не оставляет looping movement, но content и feedback остаются понятны без animation. | Motion mode accessibility review, включая system preference decision. |
| STAB-SEC-01 | Роль пользователя ограничивает видимые и прямые действия | **PRESENT — deterministic; live proof missing.** | anon/authenticated/editor/reviewer/owner получают только разрешённые surfaces/data; denied direct API/table/RPC calls fail closed; revoke действует без новой сборки. | Isolated Supabase RLS/RPC matrix and browser role tests. |
| STAB-SEC-02 | Promotion secrets не попадают участнику | **IMPLEMENTED — deterministic.** | Network/UI никогда не содержит answer keys, future questions, internal notes, bank payload or reviewer identity; no-store действует для sensitive responses. | Browser network capture + schema allowlist tests. |
| STAB-SEC-03 | Browser hardening не ломает продукт | **PRESENT — audited** для current CSP/frame/nosniff/referrer/permissions/COOP/HSTS. | Headers присутствуют на всех relevant responses; iframe embedding запрещён где нужно; approved charter/sheet/video remain functional; CSP tightening проходит report-only до enforcement. | Runtime header crawl + embedded-document/video E2E. |
| STAB-SEC-04 | SQL hardening реально развёрнут | **MISSING — deployment evidence.** Repo SQL newer than earlier owner run. | Target staging/production schema fingerprints/functions/grants соответствуют canonical migrations; manual owner step имеет postflight assertions и recorded result. | Migration inventory + read-only production verification after staging acceptance. |
| STAB-SEC-05 | Security scan и dependency disposition закрыты | **MISSING — evidence.** Deep scan не стартовал из-за permission profile; production audit clean, dev tree имеет 5 transitive findings. | Codex Security scan запускается в подходящем managed profile; high findings fixed or explicitly accepted; production audit remains clean; lockfile changes не смешиваются с unrelated work. | Scan report, security diff, `npm audit --omit=dev`, dev finding disposition. |
| STAB-SEC-06 | Принятые риски названы честно | **ACCEPTED LIMITATIONS / OPEN DECISIONS.** Device binding не hardware attestation; initial desktop/phone classification spoofable; direct Supabase content-row risk ранее принят; public profile/storage exposure documented. | Release notes не обещают невозможную защиту. Каждый риск либо имеет owner waiver с scope, либо отдельное requirement; стабилизация не расширяет его молча. | Signed-off risk register tied to release verification. |

## 9. Release readiness

| ID | Release capability | Текущее состояние | Acceptance для v1.3 |
|---|---|---|---|
| STAB-REL-01 | Репозиторий проходит deterministic quality gates | **CURRENTLY PRESENT:** `npm test` 583 pass / 1 opt-in live skipped / 0 fail; последний audit также фиксирует typecheck, build, lint и production audit pass. | На release commit проходят test, typecheck, production build, full lint и production dependency audit; skipped test допустим только если соответствующий staging run приложен отдельно и прошёл. |
| STAB-REL-02 | Browser regression gate существует в репозитории | **MISSING.** | Committed Playwright suite проходит на чистом checkout с documented setup; no production mutation; retries не маскируют flaky behavior; artifacts сохранены. |
| STAB-REL-03 | Visual/a11y/console gates утверждены | **MISSING.** | Approved visual baselines, automated accessibility scan, keyboard journeys и zero-unexpected-console policy проходят на release commit. |
| STAB-REL-04 | Supabase staging доказывает data/security contracts | **MISSING.** | Fresh isolated project строится canonical migrations; anon/authenticated/editor/reviewer/owner, RLS, RPC, concurrent claim/admission/CAS/cleanup tests проходят с disposable fixtures. |
| STAB-REL-05 | Promotion принят end-to-end | **MISSING.** | Owner завершает PC/phone UAT на temporary data; participant, reviewer, bank CRUD, qualification, retake, cleanup and direct denial имеют accepted results; production data не использовались для destructive testing. |
| STAB-REL-06 | Desktop/motion принят владельцем | **MISSING for latest remediation.** | Symmetric window bounds, spider lifecycle/gait/palette, shortcut handoff, Vivian accent, qualification lock, search coverage and bounded editor layout приняты вместе после clean reload на PC/phone. |
| STAB-REL-07 | Planning и реализация снова согласованы | **MISSING.** Current Phase 14 plan counts/status conflict across artifacts. | Roadmap, requirements, summaries, verification and UAT describe один и тот же commit/state; carried risks перечислены явно; нет «complete» при blocked verification. |
| STAB-REL-08 | Release не меняет художественную основу без согласия | **REQUIRED CONSTRAINT.** | Final review сравнивает release с approved current-identity contract. Любой новый SVG/motion/font требует отдельного owner approval; PNG spider и текущие out-of-scope решения сохранены. |

## Table Stakes v1.3

Без этих возможностей milestone не является стабилизацией:

| Table stake | Почему обязательно | Complexity |
|---|---|---|
| Reproducible Playwright baseline | Без него decomposition и fixes снова создадут непойманный drift. | High |
| Approved Figma UI/motion contract | Повторный patch loop показал, что mechanics tests не заменяют visual acceptance. | Medium |
| Stable desktop/window behavior on PC and phone | Это основной способ использования всего продукта. | High |
| Isolated Supabase live proof | Promotion и permissions нельзя доказать mock/SQL-text тестами. | High |
| Fully accepted Promotion participant/reviewer workflow | v1.2 остановлен именно из-за отсутствия этого evidence. | High |
| Common app/editor state contracts | Loading/error/permission/long-list behavior должно быть предсказуемым без redesign. | Medium |
| Search coverage and correct handoff | Core value требует быстро находить запись и попадать в её owning surface. | Medium |
| Media/performance baseline | Текущий визуальный desktop не должен становиться тяжёлым или нестабильным. | Medium |
| Accessibility/security/release gates | Финальное «готово» должно быть проверяемым, а не основанным на старых галочках. | High |

## Differentiators, которые нужно сохранить

| Differentiator | Ценность | Правило стабилизации |
|---|---|---|
| PORTIA OS как рабочий стол лаборанта, а не generic wiki/admin | Одновременно immersion и рабочий справочник | Refactor не меняет shell и терминологию; generic app redesign не вводится. |
| Своя классификация вирусов и scientist logs | Каноничный in-world content | Не переименовывать и не упрощать domain terms. |
| Живая паутина, PNG-паук и Вивьян | Узнаваемая художественная часть | Motion утверждается как контракт и имеет off/reduce поведение. |
| Редактор внутри того же мира | Leadership обновляет сайт без кода | Ergonomics улучшается без потери revisions, permissions и WYSIWYG. |
| Promotion с ручным reviewer decision | Поддерживает реальные правила отряда | Не смешивать ordinary и qualification и не автоматизировать финальный pass/fail. |

## Anti-features: явно не строить в v1.3

| Anti-feature | Почему не входит | Вместо этого |
|---|---|---|
| Полный визуальный редизайн или generic component skin | Нарушит цель сохранить PORTIA OS и сделает baseline бессмысленным. | Зафиксировать текущую идентичность и исправлять доказанные дефекты. |
| Новая «единая система приложений» как продуктовая функция | Ранее отложена и требует отдельного обсуждения. | Внутренняя декомпозиция может использовать registry, но без нового пользовательского shell. |
| Виджет «Сводка» на desktop | Владелец явно запретил. | Сохранить отдельное приложение и toast. |
| SVG-паук | Владелец отверг; текущий PNG — часть identity. | Стабилизировать PNG motion и palette. |
| Загрузка доказательств Promotion на сайт | Доказательства передаются во внешнем мессенджере. | Сохранить task text/status flow. |
| Автоматический pass/fail по проценту | Решение всегда принимает reviewer. | Процент только помогает review. |
| Показ правильных ответов или конкретных ошибок участнику | Раскрывает question bank. | Только итог и optional percent. |
| Production-mutating verification | Риск реальным участникам и данным. | Disposable isolated Supabase + temporary roster fixtures. |
| Обещание аппаратной идентификации устройства | Веб-сайт этого не обеспечивает. | Честно описывать abuse resistance и residual risk. |

## Зависимости возможностей

```text
Current behavior inventory
  → approved Figma UI/motion contract
  → committed Playwright/visual/a11y baseline
  → architecture decomposition without drift
  → desktop + motion stabilization

Isolated Supabase + canonical migrations
  → RLS/RPC/concurrency proof
  → Promotion participant/reviewer PC+phone UAT

Shared app state contracts
  → editor/app stabilization
  → global search handoff proof
  → media/performance proof

All streams
  → security/dependency disposition
  → integrated release verification
  → owner release acceptance
```

## Рекомендация для roadmap

Приоритет — не новые capabilities, а доказательства в правильном порядке:

1. Зафиксировать product inventory, разрешить typography/motion contract drift и утвердить Figma baseline.
2. Создать non-mutating Playwright baseline для текущего desktop/apps/roles/states до decomposition.
3. Поднять disposable Supabase staging и доказать migrations/RLS/RPC/concurrency.
4. Декомпозировать desktop/editor под защитой before/after contract tests.
5. Закрыть owner-visible desktop/motion defects по утверждённому contract.
6. Провести полный Promotion live + reviewer + PC/phone acceptance.
7. Довести остальные apps/editor/search/media до общей evidence matrix.
8. Закрыть accessibility, security, dependencies, console, performance и final release gates.

## Confidence assessment

| Область | Confidence | Причина |
|---|---|---|
| Existing apps and editor behavior | HIGH | Подтверждено `PROJECT.md`, source inventory и большим deterministic suite. |
| Desktop/window fixes | MEDIUM | Unit/source tests проходят; physical PC и visual owner acceptance отсутствуют. |
| Motion/spider/assistant | MEDIUM | Последние mechanics/palette fixes покрыты preflight, но Figma и owner aesthetic verdict отсутствуют. |
| Promotion implementation | HIGH | 49 requirements имеют подробную code/test traceability. |
| Promotion live correctness | LOW | Mutating isolated test skipped; owner UAT не закрыт. |
| Search coverage | MEDIUM-HIGH | Providers и open-result routing видны в source/tests; полный data-backed click-through отсутствует. |
| Media/security headers | MEDIUM-HIGH | Audit и deterministic tests есть; CSP tightening/staging/deep scan не завершены. |
| Release readiness | HIGH | Отсутствующие gates явно подтверждены package/repository/UAT evidence. |

## Источники

- `.planning/PROJECT.md` — validated/active/out-of-scope capabilities и v1.3 goals.
- `.planning/forensics/report-20261029-192309.md` — implementation/planning drift, missing Playwright/Figma/staging/UAT evidence.
- `.planning/milestones/v1.2-INCOMPLETE-ROADMAP.md` и `v1.2-INCOMPLETE-REQUIREMENTS.md` — исходный Promotion scope и acceptance intent.
- `.planning/milestones/v1.2-incomplete-phases/PORTIA-14-prilozhenie-povyshenie/14-VERIFICATION.md` — deterministic evidence и live blockers.
- `.planning/milestones/v1.2-incomplete-phases/PORTIA-14-prilozhenie-povyshenie/14-UAT.md` — 40 owner scenarios, remediation state и незакрытые PC/phone/live checks.
- `.planning/audits/2026-10-29-full-site-audit.md` — runtime, security, media/performance findings and residual risks.
- `PRODUCT.md` — users, product purpose, app surface and brand commitments.
- `.impeccable/surfaces/components-portia-desktop-tsx.md` — existing but unreviewed direction contract; used only to identify drift, not as approved redesign authority.
- `components/portia-desktop.tsx`, `components/portia-editor.tsx`, Promotion components and `lib/*.test.ts` — current app registry, search providers, state behavior and deterministic contracts.
- `package.json` and local `npm test` on 2026-10-30 — no Playwright dependency/scripts; 584 tests, 583 pass, 1 isolated-live skip, 0 failures.

## Gaps requiring phase-specific research

- Exact Playwright browser/project matrix, fixture factory and visual-diff policy.
- Figma ownership, storage/export format and approval workflow.
- Final motion preference decision: current explicit on/off versus earlier system/on/off intent.
- Staging project lifecycle, secret handling, migration reset and disposable Google Sheet/roster strategy.
- Numeric performance budgets based on measured owner PC/phone baseline.
- CSP nonce/hash and external media allowlist/proxy design without breaking current embeds.
- Managed permission profile required for Codex Deep Security Scan.
