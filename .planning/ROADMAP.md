# Roadmap: PORTIA OS — v1.3 «Стабилизация PORTIA OS»

## Overview

v1.3 превращает уже работающий PORTIA OS в доказуемо устойчивый релиз: сначала фиксируются текущий образ, контракты и браузерный baseline, затем доказывается SQL-истина на изолированном Supabase staging, после чего обратимо разделяются перегруженные компоненты и стабилизируются рабочий стол, «Повышение», остальные приложения, безопасность и релизный контур. По отдельному решению владельца Phase 20 включает визуальную переработку паука/паутины, новый фон с лабораторными колбами, рисунки колбы и микроскопа для пустых состояний, вкладку редактора и приложение «Повышение». Тёмная палитра, структура экранов «Повышения», остальные SVG, тексты, app id, данные и художественная основа PORTIA OS сохраняются до отдельного решения владельца.

## Milestones

- ✅ **v1.0 Доработка** — Phases 1–5 (shipped 2026-10-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Закрытие замечаний** — Phases 6–13 (shipped 2026-10-27) — [archive](milestones/v1.1-ROADMAP.md)
- ⚠️ **v1.2 Повышение** — Phase 14 (incomplete; 17/19 plans, live/UAT gates carried into v1.3) — [archive](milestones/v1.2-INCOMPLETE-ROADMAP.md)
- 📋 **v1.3 Стабилизация PORTIA OS** — Phases 15–22 (planned)

## Phases

- [x] **Phase 15: Восстановление контроля, контракты и браузерный baseline** — зафиксировать текущий PORTIA OS через локальный UI-review и ввести воспроизводимый Playwright/visual/a11y/console/security gate (completed 2026-11-02)
- [x] **Phase 16: Канонический Supabase staging и SQL-истина** — доказать миграции, роли, RLS/RPC и конкурентные операции на изолированной базе (completed 2026-11-01)
- [x] **Phase 17: Обратимая декомпозиция рабочего стола и редактора** — выделить безопасные seams без изменения поведения, данных и визуального контракта (completed 2026-11-01)
- [ ] **Phase 18: Рабочий стол, окна и живые анимации** — стабилизировать геометрию, настройки, ярлыки, PNG-паука, паутину и Вивьян по утверждённым эталонам
- [ ] **Phase 19: «Повышение», приложения, редактор, поиск и медиа** — доказать весь participant/reviewer flow на staging, исправить только воспроизведённые разрывы и привести остальные поверхности к проверяемым state, access, search и media-контрактам
- [ ] **Phase 20: Security, accessibility и приёмка релиза** — переработать внешний вид паука, фона, двух SVG-рисунков и «Повышения», добавить локальный конструктор шаблона досье, закрыть или явно принять подтверждённые риски, выполнить финальные технические гейты и получить физическую PC/phone UAT

## Phase Details

### Phase 15: Восстановление контроля, контракты и браузерный baseline

**Goal**: Текущий PORTIA OS зафиксирован как воспроизводимый и одобренный контракт до любых рефакторингов или точечных исправлений.
**Depends on**: Nothing (milestone start; Phase 14 remains an incomplete archive)
**Requirements**: STAB-BASE-01, STAB-BASE-02, STAB-BASE-03, STAB-BASE-04, STAB-BASE-05, STAB-BASE-06
**Success Criteria** (what must be TRUE):
  1. Владелец может сравнить repository-owned desktop и phone captures с текущим сайтом и явно одобрить UI/motion-контракт; все предлагаемые изменения отмечены отдельно.
  2. Из чистого checkout запускается committed Playwright/axe suite для visitor, participant, editor, promo reviewer и owner на PC/phone, с фиксированными данными, временем, DPR, шрифтами и случайностью и без мутаций production.
  3. Одобренные visual baselines воспроизводят desktop, окна, «Повышение», редактор, паука, паутину, Вивьян и phone layout; снимки не становятся эталоном до владельческого одобрения.
  4. Неожиданная browser/console/network/CSP ошибка блокирует gate, а ожидаемый отказ виден как безопасное русское состояние; для каждой следующей фазы задана полная цепочка доказательств GSD.

**Acceptance gate**: Локальный UI-review, per-hash approval и продвижение candidate captures в baseline остаются открытыми до явного решения владельца.
**Plans**: 20/20 plans complete

Plans:
**Wave 1**

- [x] 15-01-PLAN.md — read-only current-state capture, dirty ownership ledger and explicit owner disposition (STAB-BASE-01, STAB-BASE-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-02-PLAN.md — exact Playwright/axe bootstrap, bounded browser projects and fail-closed target guard (STAB-BASE-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 15-03-PLAN.md — deterministic actor fixtures, browser diagnostics, semantic page objects and representative flows (STAB-BASE-02, STAB-BASE-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 15-04-PLAN.md — candidate-only visual/motion captures and CURRENT/PROPOSED state mapping (STAB-BASE-03, STAB-BASE-04)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 15-05-PLAN.md — named-owner approval, exact-byte baseline promotion and clean-checkout traceability (STAB-BASE-03, STAB-BASE-04, STAB-BASE-06); plan complete, phase closure remains blocked by the recorded actor/device/security gates

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 15-06-PLAN.md — tracked clean-checkout preflight and fail-closed isolated-target guard (STAB-BASE-02, STAB-BASE-06)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 15-07-PLAN.md — read-only actor gate, explicit privileged blockers and Phase 16 handoff (STAB-BASE-02, STAB-BASE-06)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 15-08-PLAN.md — real-clock diagnostic expiry and centralized strict visual policy (STAB-BASE-03, STAB-BASE-05, STAB-BASE-06)

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 15-09-PLAN.md — read-only public/device/spider/web/Vivian/shortcut candidate coverage (STAB-BASE-03, STAB-BASE-04, STAB-BASE-06)

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 15-10-PLAN.md — machine-verified privileged BLOCKED ledger and Phase 16/19 recovery ownership (STAB-BASE-02, STAB-BASE-03, STAB-BASE-04, STAB-BASE-06)

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 15-11-PLAN.md — repository-native GSD/Impeccable UI review, capture/blocker synchronization and Qloxz verdict for every available hash (STAB-BASE-03, STAB-BASE-04, STAB-BASE-06)

**Wave 12** *(blocked on Wave 11 completion)*

- [x] 15-12-PLAN.md — exact-byte promotion/comparison for available approved hashes with separate blocked accounting (STAB-BASE-03, STAB-BASE-04, STAB-BASE-06)

**Wave 13** *(blocked on Wave 12 completion)*

- [x] 15-13-PLAN.md — signed top-level metadata verification and canonical snapshot-path correction (STAB-BASE-03, STAB-BASE-04, STAB-BASE-06)

**Wave 14** *(blocked on Wave 13 completion)*

- [x] 15-14-PLAN.md — deep GSD code review plus local auth/API/RLS/header/CSP/dependency/secret security matrix and finding disposition (STAB-BASE-02, STAB-BASE-05, STAB-BASE-06)

**Wave 15** *(blocked on Wave 14 completion)*

- [x] 15-15-PLAN.md — safe local clean-checkout, traceability refresh and honest gaps_found lifecycle verification (STAB-BASE-01..06); executed, phase remains gaps_found (concrete role/data/visual/device gaps owned by Phases 16/18/19/22)

**Wave 16** *(gap closure G6 only; blocked on Wave 15 completion)*

- [x] 15-16-PLAN.md — tracked candidate index so `--verify-ui-map` / `--verify-approval` pass in a clean checkout and still fail closed; G1-G5 untouched, no requirement status change (STAB-BASE-03, STAB-BASE-04, STAB-BASE-06)

**Wave 17** *(gap closure: in-repo review findings only, G1-G5 untouched; blocked on Wave 16 completion)*

- [x] 15-17-PLAN.md — preflight judges the same environment as the tests (shell-only mutation guard), accepts publishable or anon key, documents the intentional Node 22.13.x pin (WR-03, WR-05, WR-06; STAB-BASE-06)
- [x] 15-18-PLAN.md — unit test of the real `visualPolicy` instead of arithmetic, explicit check of the internal Playwright comparator (IN-05, IN-01 part 1; STAB-BASE-06)

**Wave 18** *(blocked on Wave 17 completion)*

- [x] 15-19-PLAN.md — E2E HTTP flag can never drop `upgrade-insecure-requests` in any Netlify build (behavioral test), owner fixation of the b535d14 exception, disposition of all 12 review findings (W1, W2; STAB-BASE-05, STAB-BASE-06)

**Gap closure 15-20** *(documentation only, after Phase 16; no dependencies, no code)*

- [x] 15-20-PLAN.md — G1-G5 reconciliation against Phase 16 evidence: G1 closed, G2 partial (7 PASS / 8 BLOCKED, Phases 18-19), G3/G4/G5 open with owner phases; pointer sections in unsigned trace docs, signed evidence untouched, no requirement status change (STAB-BASE-01..06)

**Cross-cutting constraints:**

- Do not modify product source in Phase 15; this phase establishes evidence and executable contracts only.
- Preserve all pre-existing dirty files until the owner records per-path disposition and touch permission.
- Never treat a skipped staging, local visual, device or owner gate as a pass; report it as BLOCKED or PENDING.
- Run package/browser work only from Node 22.13.x; the owner declined isolated staging, so Phase 15 must never use service-role authority or mutate the configured Supabase project.
- Security evidence is repository-local and reproducible: deep GSD review, tests, dependency audit, secret scan and explicit finding disposition. No external scanner is required.

**UI hint**: yes

### Phase 16: Канонический Supabase staging и SQL-истина

**Goal**: Канонические миграции и изолированный staging дают доказуемо одинаковую схему и безопасное поведение ролей, RLS/RPC и конкурентных операций.
**Depends on**: Phase 15
**Requirements**: STAB-SEC-01, STAB-SEC-04, STAB-REL-04
**Success Criteria** (what must be TRUE):
  1. Оператор может поднять свежий изолированный Supabase только из canonical migrations и получить тот же fingerprint функций, grants, policies и RLS, что на upgrade-пути staging.
  2. Anon, authenticated, editor, reviewer и owner через UI, API, таблицы и RPC могут читать и менять только разрешённые данные; revoke действует сразу и запрещённые действия fail-closed.
  3. Guarded live suite на disposable fixtures доказывает concurrent claim/admission/CAS/cleanup, RLS и RPC без обращения к production-данным и без повторного успешного победителя.

**Acceptance gate**: Live mutating staging-run и schema fingerprints обязательны; наличие SQL в Git или read-only inventory не считается прохождением.
**Plans:** 14/14 plans complete

Plans:
**Wave 1**
- [x] 16-01-PLAN.md — canonical baseline-миграция = portia_setup.sql без обёртки, parity-тест, заморозка legacy SQL, L0 upgrade-fixture, PORTIA-only teardown, SQL-ревью (STAB-REL-04, STAB-SEC-04)
- [x] 16-02-PLAN.md — read-only fingerprint SQL по pg_catalog и offline comparator, SQL-ревью (STAB-SEC-04)
- [x] 16-03-PLAN.md — аттестация цели (app binding, запрет внешнего base URL — IN-03, JWT iss) и guarded wrapper phase16-staging.mjs (STAB-SEC-01, STAB-REL-04)
- [x] 16-04-PLAN.md — владелец: проверка пакета supabase CLI (D7) и создание изолированного Free-проекта с PG major production (D1, D8); точная установка CLI (STAB-REL-04)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 16-05-PLAN.md — непрозрачный server-derived session proof (WR-01) и roster owner-fixture D4 (STAB-SEC-01)
- [x] 16-06-PLAN.md — harness live-проверок: единый guard, disposable identities, owner-fixture, cleanup/residual, редактированный receipt, sweep (STAB-REL-04, STAB-SEC-01)
- [x] 16-07-PLAN.md — владелец сужает guard и запускает сессию с ключами изолированного проекта; агент доказывает узость guard, ATTESTED и блокировку production-ref (STAB-SEC-01, STAB-REL-04)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 16-08-PLAN.md — каталожная матрица role x surface из SQL и live role-suite с revoke на выданных JWT (STAB-SEC-01, STAB-REL-04)
- [x] 16-09-PLAN.md — конкурентные раунды N x R: claim, admission, answer CAS, start_test, lease, cleanup; единый guard существующего live-теста (STAB-REL-04)
- [x] 16-10-PLAN.md — live: свежая сборка только из canonical migrations, калибровка fingerprint, явные grants D9 с ревью, golden (STAB-SEC-04, STAB-REL-04)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 16-11-PLAN.md — live: teardown до pristine, upgrade ladder L0 -> phase12 -> phase14 -> canonical, golden == upgrade, финальный канон (STAB-SEC-04, STAB-REL-04)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 16-12-PLAN.md — live: npm run test:staging-live (роли, RLS, RPC, Storage, revoke, конкурентность), receipts с residual 0 (STAB-SEC-01, STAB-REL-04)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 16-13-PLAN.md — Playwright: реальные role lanes через probeSession, API-матрица, revoke без re-login, HTTP CAS контента, G2 data-lanes (D6) (STAB-SEC-01, STAB-REL-04)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 16-14-PLAN.md — владелец: read-only production fingerprint (D5); postflight, итог 16-LIVE-RUN.md, честная трассировка (STAB-SEC-04, STAB-SEC-01, STAB-REL-04)

### Phase 17: Обратимая декомпозиция рабочего стола и редактора

**Goal**: Рабочий стол и редактор разделены на проверяемые seams, оставаясь для пользователя тем же PORTIA OS.
**Depends on**: Phase 15
**Requirements**: STAB-DESK-01, STAB-DESK-07
**Success Criteria** (what must be TRUE):
  1. Пользователь открывает один app id из ярлыка, start panel, taskbar или search и всегда получает одно восстановленное и сфокусированное окно без дубликата и потери состояния.
  2. После каждого шага декомпозиции существующие app ids, DOM semantics, CSS hooks, storage keys, API shapes, порядок и данные остаются совместимыми, а утверждённые desktop/phone snapshots не дрейфуют.
  3. Каждый extraction increment можно откатить отдельно, не возвращая уже доказанные соседние seams и не вводя новый generic app shell.

**Acceptance gate**: Декомпозиция начинается только после Phase 15 baseline и проходит parity-gate после каждого increment; намеренные UX-изменения сюда не входят.
**Plans:** 8/8 plans complete

Plans:
**Wave 1**
- [x] 17-01-PLAN.md — эталон parity-gate, инструмент чистого переноса, source-тесты по семействам файлов, закрепление STAB-DESK-07

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 17-02-PLAN.md — части редактора досье (классификация, поле картинки, перетаскивание, вкладки, диалог, форма досье) для 17.1

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 17-03-PLAN.md — просмотр досье и FormattedText в отдельном модуле для 17.1

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 17-04-PLAN.md — форматирование текста (FormattedTextarea, панель, ActiveFormatContext) для 17.1

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 17-05-PLAN.md — контракт открытия окна (STAB-DESK-01): чистые функции, инвентаризация D-06, e2e

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 17-06-PLAN.md — рамка окна и ярлыки рабочего стола в seam-модулях

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 17-07-PLAN.md — окна-документы и «Справочник» в seam-модуле, итог фазы

**Gap closure** *(после верификации)*
- [x] 17-08-PLAN.md — CR-01: шаг (d) window-reopen.spec.ts выводит поиск вперёд перед закрытием; CR-01 = fixed, браузерный прогон BLOCKED (ENV)

**UI hint**: yes

### Phase 18: Рабочий стол, окна и живые анимации

**Goal**: Рабочий стол одинаково надёжен на PC и phone, а его живая motion-система следует утверждённому контракту без потери художественной основы и производительности.
**Depends on**: Phase 17
**Requirements**: STAB-DESK-02, STAB-DESK-03, STAB-DESK-04, STAB-DESK-05, STAB-DESK-06, STAB-MOTION-01, STAB-MOTION-02, STAB-MOTION-03, STAB-MOTION-04, STAB-MOTION-05, STAB-MOTION-06, STAB-MOTION-07, STAB-MOTION-08, STAB-MEDIA-06
**Success Criteria** (what must be TRUE):
  1. На PC и phone окна перетаскиваются, изменяют размер, сворачиваются, разворачиваются и восстанавливаются в достижимых границах без потери состояния; активная квалификация корректно блокирует запрещённые действия и фон.
  2. Accent, wallpaper, icon size/position, motion и spider сохраняются независимо, переживают reload, а повреждённое storage безопасно возвращает только соответствующую настройку к default.
  3. Ярлык остаётся достижимым после drag и открывается мышью, клавиатурой и touch; его полный hover/focus cycle не сдвигает контейнер и заканчивается утверждённым статичным кадром.
  4. Boot, PNG-паук, волны паутины, обои и Вивьян воспроизводят одобренные full/reduced/off состояния без телепортаций, лишних следов, flash и смысловой зависимости от анимации.
  5. Воспроизводимые owner PC/phone traces показывают, что interaction, drag, wallpaper и app-open не хуже утверждённого baseline и укладываются в согласованные budgets.
  6. Сохраняя идею PORTIA OS, ярлыки и их анимации переработаны как единая система: внешний контейнер неподвижен, цикл не обрывается на pointer exit, а конечный и статичный кадры визуально и геометрически совпадают.
  7. Паук непрерывно проходит соседние сектора паутины без смещения исходной точки как обхода, рваных скачков и одностороннего следа; содержимое окон reflow-ится в доступных границах без потери важной информации и разрушения композиции.

**Acceptance gate**: Geometry на DPR 1/1.25, motion quality и long-session performance остаются открытыми до browser evidence и физического PC verdict владельца.
**Plans:** 7/7 plans executed

Plans:
**Wave 1**
- [x] 18-01-PLAN.md — три режима «Анимации» (on/reduced/off), D-10, инструкция замеров D-17, утверждение [PROPOSED] владельцем

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 18-02-PLAN.md — режимы во всех поверхностях: заставка один раз за вкладку, окна, Вивьян, обои; без системной настройки движения

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 18-03-PLAN.md — единая система циклов 12 ярлыков и безопасный drag ярлыка
- [x] 18-04-PLAN.md — окна: кивок D-14, геометрия на всех краях и DPR 1.25, блокировка квалификации, phone e2e

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 18-05-PLAN.md — паук и паутина: двусторонние волны, плавный ход, плотное тело, покачивание при пауке on/off

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 18-06-PLAN.md — формы редактора в колонках (D-15) с сортировкой, Вивьян не перекрывает окно на phone

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 18-07-PLAN.md — кандидаты motion-кадров, EXPECTED DRIFT, вердикт владельца, физический PC/phone и trace скорости

**UI hint**: yes

### Phase 19: «Повышение», приложения, редактор, поиск и медиа

**Goal**: Существующий поток «Повышения» доказан на staging от безопасного поиска ника до ручного решения reviewer, пересдачи и очистки без утечек и ложных успехов; все остальные пользовательские поверхности устойчиво работают с полными, пустыми, устаревшими, частичными и запрещёнными данными на PC и phone.
**Depends on**: Phases 16, 17 and 18
**Requirements**: STAB-PROM-01, STAB-PROM-02, STAB-PROM-03, STAB-PROM-04, STAB-PROM-05, STAB-PROM-06, STAB-PROM-07, STAB-PROM-08, STAB-PROM-09, STAB-PROM-10, STAB-PROM-11, STAB-PROM-12, STAB-PROM-13, STAB-PROM-14, STAB-PROM-15, STAB-DESK-08, STAB-APP-01, STAB-APP-02, STAB-APP-03, STAB-APP-04, STAB-APP-05, STAB-APP-06, STAB-APP-07, STAB-APP-08, STAB-APP-09, STAB-APP-10, STAB-SEARCH-01, STAB-SEARCH-02, STAB-SEARCH-03, STAB-SEARCH-04, STAB-MEDIA-01, STAB-MEDIA-02, STAB-MEDIA-03, STAB-MEDIA-04, STAB-MEDIA-05
**Merged**: 2026-11-02 по решению владельца из бывших Phase 19 («Доказательство «Повышения» и точечная стабилизация») и Phase 20 («Стабилизация приложений, редактора, поиска и медиа»).
**Success Criteria** (what must be TRUE):
  1. Участник без аккаунта видит только safe projection и одну допустимую ordinary/qualification action или стабильную русскую причину; outage, missing migration, stale response и validation refusal не маскируются под успех или «ник не найден».
  2. Первый принятый запрос атомарно создаёт binding и единственный активный flow; cooldown не продлевается от retry, reload восстанавливает состояние, а отказ не оставляет token, binding или request.
  3. Ordinary и qualification выдают только допустимые immutable наборы; qualification соблюдает переходы, типы вопросов, server deadline, CAS, PC/phone policy и никогда не раскрывает future questions или keys.
  4. Reviewer с актуальным `promo` grant управляет очередью и банками без потери typed data, единолично claims попытку, вручную выбирает итог, а participant получает только разрешённый результат; retake и cleanup соблюдают сроки и лимит истории.
  5. Владелец подряд принимает participant/reviewer, bank CRUD, ordinary, qualification, retake, cleanup и direct denial после clean reload на физическом PC и phone с временными данными и без unresolved failures.
  6. «База вирусов», «Сотрудники», «Сводка», «Информация», «Справочник», «Корзина», «Таблица» и «Устав» сохраняют валидированное поведение и различают loading, empty, populated, stale/degraded, permission denied и fatal error без уничтожения last-good state.
  7. Редактор на PC/phone сохраняет undo/redo, drafts during save, revision conflict, poll suppression, save-all, grants, per-field errors и WYSIWYG selection/range; success показывается только после authoritative ответа.
  8. Глобальный поиск keyboard-first находит только разрешённые опубликованные сущности, нормализует регистр и `е/ё`, открывает точную сущность в приложении-владельце и никогда не индексирует private editor/reviewer data или answer keys.
  9. Upload и URL normalization проверяют реальные bytes, размер, формат и scheme/path, не стирают draft при отказе и используют безопасный UUID URL либо устойчивый fallback для legacy/broken/slow media.
  10. Hero/media загружается с корректным приоритетом, offscreen collections lazy, immutable media кэшируется без повторного скачивания, а смена записи, ошибка сети или blocked host не дают stale image, app crash или infinite spinner.

**Acceptance gate**: Staging races/direct denials и полная owner PC/phone UAT «Повышения» обязательны; архивные отметки Phase 14 и preflight не закрывают фазу. Per-app desktop/phone matrix, authenticated editor journeys, search click-through и upload/cache/network evidence должны быть записаны до перехода к финальному CSP.
**Plans:** 20/22 plans executed (8 gap-closure plans 19-15..19-22)

Plans:
**Wave 1**
- [x] 19-01-PLAN.md — сквозной срез stale-состояния (D-05) и вердикты владельца по [PROPOSED] и допущениям фазы (STAB-DESK-08, STAB-APP-10)
- [x] 19-02-PLAN.md — upload по реальным байтам без потери черновика и единый URL-контракт (STAB-MEDIA-01, -02, -04)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 19-03-PLAN.md — инструмент приёмки: staging-ростер, seed/shift/residual/teardown через guarded wrapper (STAB-PROM-01, -13, -15)
- [x] 19-04-PLAN.md — UI участника «Повышения»: различимые состояния, срок без `..`, предупреждение режима, подсказка очистки (STAB-PROM-01..04, 06..08, 11..14)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 19-05-PLAN.md — UI reviewer: оценка ✓/✗, ручной итог, банки без потери данных, «Доступ закрыт» (STAB-PROM-05, 06, 09..12, 14)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 19-06-PLAN.md — живой seed, live/Playwright receipts и owner UAT «Повышения» на PC и phone (STAB-PROM-01..15) — принято владельцем под отклонением (вариант 2, прогон шагов 2–8 был на production); STAB-PROM-15 открыт, живая приёмка на staging в долге 19-14 / Phase 20
- [x] 19-08-PLAN.md — состояния 8 приложений: скелетон, empty, stale, fatal, denied, iframe-таймаут (STAB-DESK-08, STAB-APP-01..06, -10)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 19-07-PLAN.md — teardown только помеченных данных приёмки после «принято» (STAB-PROM-13, -15)
- [x] 19-09-PLAN.md — покой иконок ярлыков = конечный кадр (D-17, хвост STAB-MOTION-05)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 19-10-PLAN.md — медиа: скелетон, заглушка «Изображение недоступно», приоритеты загрузки (STAB-MEDIA-02, -03, -05)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 19-11-PLAN.md — глобальный поиск: allowlist-индекс, открытие точной записи с подсветкой, клавиатура (STAB-SEARCH-01..04)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 19-12-PLAN.md — редактор: единый статус, конфликт ревизии, частичное сохранение (STAB-APP-07)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 19-13-PLAN.md — редактор: rebase при фоновом обновлении, fail-closed по правам, WYSIWYG и прокрутка (STAB-APP-07..09)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 19-14-PLAN.md — browser-матрица приложений, editor journeys, search click-through, upload/cache evidence и вердикт владельца PC/phone

**Gap closure** (19-VERIFICATION.md, gaps_found 3/10)

**Gap Wave 1**
- [x] 19-15-PLAN.md — CR-01: таймеры картинок и фреймов только при видимости, браузерная регрессия свёрнутых кадров (STAB-MEDIA-02, -03, -05, STAB-APP-06)
- [x] 19-16-PLAN.md — WR-04 (опрос статуса не сбрасывает попытку) и WR-06 (reset-device для ников приёмки и кириллицы) (STAB-PROM-07, -09, -14)
- [x] 19-17-PLAN.md — acceptance-serve: сервер UAT только с доказанной привязкой к staging; WR-01, WR-02, seed v2 с никами PC/phone (STAB-PROM-13, -15)

**Gap Wave 2** *(blocked on Gap Wave 1)*
- [x] 19-18-PLAN.md — решение владельца по источнику «Сотрудников», guarded matrix-run для пустых и заполненных данных staging (STAB-DESK-08, STAB-APP-01..05, -10)

**Gap Wave 3**
- [x] 19-19-PLAN.md — прогон матрицы на базовых, populated и empty данных, CR-01 на свёрнутом «Справочнике», WR-07, статусы и disposition

**Gap Wave 4**
- [x] 19-20-PLAN.md — решение по run mw0rbyf6, повторные receipts, свежий acceptance-seed v2 и чек-лист с шагом 0 (STAB-PROM-01..15)

**Gap Wave 5**
- [ ] 19-21-PLAN.md — STAGING-BOUND, owner UAT шагов 0-11 и F9-F12 на PC и phone, вердикты (STAB-PROM-01..15)

**Gap Wave 6**
- [ ] 19-22-PLAN.md — teardown run повторной приёмки с residual 0 и итог STAB-PROM-15 (STAB-PROM-13, -15)

**UI hint**: yes

### Phase 20: Security, accessibility и приёмка релиза

**Goal**: По решению владельца переработаны внешний вид паука и паутины, фон/обои, SVG-рисунки, вкладка редактора и приложение «Повышение», где участник может открыть отдельный конструктор шаблона досье вируса и скачать результат без записи в базу. Подтверждённые accessibility/security/dependency риски закрыты или честно оформлены как release blockers/waivers; release commit проходит чистую репетицию и безопасную проверку инфраструктуры, а окончательная владельческая приёмка PC/phone имеет точную привязку к проверенному commit каждого устройства без скрытых или переименованных пробелов.
**Depends on**: Phase 19 (and therefore all prior v1.3 phases)
**Requirements**: STAB-MEDIA-07, STAB-A11Y-01, STAB-A11Y-02, STAB-A11Y-03, STAB-A11Y-04, STAB-SEC-02, STAB-SEC-03, STAB-SEC-05, STAB-SEC-06, STAB-VIS-01, STAB-VIS-02, STAB-VIS-03, STAB-VIS-04, STAB-TMPL-01, STAB-REL-01, STAB-REL-02, STAB-REL-03, STAB-REL-05, STAB-REL-06, STAB-REL-07, STAB-REL-08, STAB-SEARCH-05, STAB-SEARCH-06, STAB-SEARCH-07, STAB-CLASS-01, STAB-CLASS-02, STAB-CLASS-03, STAB-CLASS-04, STAB-EDIT-01, STAB-EDIT-02, STAB-EDIT-03, STAB-EDIT-04
**Merged**: 2026-11-02 по решению владельца из бывших Phase 21 («Закрытие security, accessibility, CSP и зависимостей») и Phase 22 («Репетиция релиза и приёмка владельца»).
**Success Criteria** (what must be TRUE):
  1. PC controls имеют корректные name/role/state, видимый focus, dialog trap/restore и keyboard alternative; phone actions доступны touch, не перекрываются keyboard/sticky bars и не создают page-level overflow.
  2. Русские labels и объявляемые success/error/disabled reasons понятны, alt соответствует назначению, а off/reduced прекращает looping movement на всех поверхностях без потери content и feedback.
  3. Participant network/UI не получает answer keys, future questions, internal notes, bank payload или reviewer identity, а sensitive responses используют no-store.
  4. Инвентаризированные media hosts проходят CSP report-only до enforcement; security headers не ломают approved charter/sheet/video, а rejected host показывает устойчивый fallback без необъяснённых CSP/console errors.
  5. Локальная security matrix даёт проверяемый отчёт; high findings исправлены или явно приняты, production dependency audit чист, dev findings имеют disposition, а lockfile меняется отдельным проверяемым increment.
  6. Из clean checkout на release commit воспроизводимо проходят tests, typecheck, production build, full lint, production audit, Playwright, approved visuals, axe, keyboard journeys и zero-unexpected-console policy без скрытого retry-pass и без production mutations.
  7. Владелец на физическом PC/phone после clean reload принимает полный «Повышение», window bounds, qualification lock, PNG-паука, паутину, ярлыки, Вивьян, поиск и bounded editor layout с временными безопасными данными.
  8. Roadmap, requirements, summaries, verification и deployed evidence описывают итоговый release commit/state, а UAT отдельно фиксирует проверенный commit для PC и phone. Если после полной PC/phone UAT исправлен только phone-дефект, прежний PC-вердикт сохраняется с его commit, полная phone UAT повторяется на новом commit, а технические gates повторяются на итоговом release commit. Blocked live check остаётся blocked, а не complete.
  9. Финальный review подтверждает сохранение PORTIA OS и принятых out-of-scope; release notes честно перечисляют spoofable mode/device binding, остальные accepted risks и все waivers без обещания hardware attestation.
  10. Тёмная палитра PORTIA OS сохранена; переработанные паук/паутина и два SVG-рисунка пустых состояний (колба в «Информации»/«Новостей пока нет», микроскоп в «Справочнике») приняты владельцем на PC и phone. Добавлен выбираемый фон с колбами на лабораторном штативе, независимым бурлением, переливами яркости и пузырьками; существующие фоны остаются доступными, новые baselines не принимаются автоматически.
  11. При сохранении структуры экранов вкладка редактора и приложение «Повышение» переработаны визуально и для удобства полного participant/reviewer flow на PC и phone; данные, права, сохранение и безопасные отказы работают по прежним функциональным требованиям, а новый вид принят владельцем.
  12. В «Повышении» доступна кнопка «Создать шаблон», открывающая отдельный конструктор карточки досье вируса для текста и локальных изображений. Участник скачивает самодостаточные PNG или HTML для передачи проверяющему вне сайта; файлы и изображения не записываются в реальные записи архива, Supabase database/storage или `/api/uploads`.

**Acceptance gate**: Неполное локальное покрытие отмечается явно; незакрытый high finding блокирует релиз согласно config. Фаза не закрывается без согласованного визуального контракта и принятия переработанного вида владельцем, физической owner PC/phone UAT, точного evidence ledger и отсутствия pending high-severity blocker.
**Plans**: 57/63 plans executed (24 + 7 gap closure по 20-VERIFICATION.md + 2 gap closure по вердикту владельца в 20-11 + 6 gap closure по вердикту владельца 2026-11-06, из них 20-38/20-39 — конструктор шаблона по D-52, + 8 gap closure по вердикту владельца 2026-11-07, D-53..D-57, + 7 gap closure по вердикту владельца в 20-47 и дополнению владельца 2026-11-07, D-59..D-64, + 4 gap closure по вердикту владельца в 20-54, D-65..D-67, + 5 gap closure после FAIL репетиции 20-13, D-69)
**UI hint**: yes

Plans:
**Wave 1**
- [x] 20-01-PLAN.md — сквозной локальный конструктор и автономный HTML
- [x] 20-08-PLAN.md — CSP report-only, media hosts и fallback
- [x] 20-09-PLAN.md — participant projection и no-store
- [x] 20-17-PLAN.md — D-33: WR-03 uploads 503/ранний size gate, WR-05 тексты и двойная отправка, IN-03 подтверждение «ОТОЗВАТЬ»
- [x] 20-18-PLAN.md — D-33: IN-01 GIF в тексте, IN-02/IN-04 скрипт приёмки, IN-05 disposition
- [x] 20-19-PLAN.md — поиск: ↑ в полях не уводит в поиск (D-44), случайные 5–10 рекомендаций (D-43), поиск без ударений (D-37)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 20-02-PLAN.md — локальные изображения, PNG и ошибки экспорта
- [x] 20-03-PLAN.md — новый паук и паутина, плотное тёмное тело с контуром (D-25..D-27), режимы движения, резкий паук в покое (D-45)
- [x] 20-10-PLAN.md — security matrix, dependency audit, риски и статусы находок 19-REVIEW (D-33)
- [x] 20-20-PLAN.md — новые классы вирусов: имена и чтение старых значений, текст «Классификация», девять иконок (D-35..D-39)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 20-04-PLAN.md — выбираемый фон лабораторных колб
- [x] 20-21-PLAN.md — SQL-миграция старых названий классов: ревью, решение владельца, только изолированный staging (D-36б)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 20-05-PLAN.md — адресные SVG пустых состояний
- [x] 20-06-PLAN.md — participant/reviewer переработка «Повышения»
- [x] 20-24-PLAN.md — приватное хранилище заметок редактора: таблица с RLS по вкладкам, /api/content/notes, решение владельца, только изолированный staging (D-47)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 20-16-PLAN.md — «Информация» на телефоне: список-навигация, «←», «Далее», раскрытие из поиска (D-28..D-32)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 20-07-PLAN.md — клавиатура, touch, labels и motion

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 20-11-PLAN.md — владельческое одобрение визуальных кандидатов (паук на трёх акцентах, D-26; паук в покое, D-45; иконки классов, D-39)
- [x] 20-22-PLAN.md — редактор: колонки «Информации» по 5, закреплённое «Добавить раздел» и приватные заметки «Справочника», перетаскивание (D-40..D-42, D-47)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 20-23-PLAN.md — редактор: разделы и подразделы «Сводки» и «Рекомендаций» с обратной совместимостью и приватными заметками (D-41, D-42, D-47)

**Wave 34** *(blocked on Gap Wave 33 completion)*
- [x] 20-12-PLAN.md — visual baselines с текущего кода после общего «принято» владельца (D-68, 20-58): @phase20 эталоны и точечно заменённые прежние на фиксированных данных (offline-обвязка), реестр phase20-baselines.json в --verify-promotion

**Wave 35** *(blocked on Wave 34 completion)*
- [x] 20-13-PLAN.md — clean-checkout техническая репетиция (D-68: общий вердикт владельца в протоколе, гейт ui-contract-offline, визуальные гейты на фиксированных данных)

**Wave 41** *(blocked on Gap Wave 40 completion: 20-59..20-63, D-69)*
- [ ] 20-14-PLAN.md — физическая owner UAT на PC и phone (+ «Информация» на телефоне, регрессия стабилизации, D-34, классы, поиск и редактор D-35..D-45, кадр картинок и кнопка раздела «Информации» D-62/D-63, окно выбора видимой части D-66/D-67)

**Wave 42** *(blocked on Wave 41 completion)*
- [ ] 20-15-PLAN.md — final commit, повтор gates и честная reconciliation (D-68: визуальная приёмка — общий вердикт 20-58 или действующее звено цепочки вердиктов, 63 плана)

**Gap closure (2026-11-04, по 20-VERIFICATION.md; выполняются до владельческого хвоста 20-11..20-15)**
- Gap Wave 1:
  - [x] 20-25-PLAN.md — полный lint без локальных инструментов, webkit-phone [STAB-MEDIA-03] без зависимости от порядка, шум диагностик и реестр 20-PLAYWRIGHT-WAIVERS.md
  - [x] 20-26-PLAN.md — security matrix на текущем HEAD (12 маршрутов, 5 миграций, свежесть), расследование 97d7abb (банки)
  - [x] 20-27-PLAN.md — журнал физической приёмки 20-UAT.md и fail-closed валидатор (Task 1 плана 20-14 заранее)
- Gap Wave 2:
  - [x] 20-28-PLAN.md — браузерная проверка ловушки фокуса квалификации (UI-contract stub), staging-сценарий клавишного переноса с одной отменой, перепрогон accessibility на HEAD
  - [x] 20-30-PLAN.md — fail-closed runner релизного гейта и его тесты (Task 1 плана 20-13 заранее)
- Gap Wave 3:
  - [x] 20-29-PLAN.md — перезапись кандидатов на HEAD после коммитов вне планов, проверка свежести ledger, классификация прежних эталонов (rebaseline-*)
- Gap Wave 4:
  - [x] 20-31-PLAN.md — черновик 20-RELEASE-NOTES.md (STAB-SEC-06) и честные статусы REQUIREMENTS.md с тестом

**Gap closure (2026-11-05, по вердикту владельца в 20-11; выполняются до 20-12. Волны хвоста сдвинуты: 20-12 → 11, 20-13 → 12, 20-14 → 13, 20-15 → 14)**
- Gap Wave 9:
  - [x] 20-32-PLAN.md — исправления по вердикту: светлый кант паука на очень тёмном «Своём» акценте (G1), правая половина «Транзитиума» без приглушения (G2), контраст мелких подписей «Архива», «Глобального поиска», «Корзины» не ниже 4.5:1 и axe без исключения (G3, D-10)
- Gap Wave 10:
  - [x] 20-33-PLAN.md — пересъёмка всех кандидатов на коммите исправлений, сброс в ОЖИДАЕТ строк с новыми байтами, rebaseline-* для эталонов, затронутых G3, повторный вердикт владельца (итог 2026-11-06: 51 принято, 28 «исправить» — паук и фон колб)

**Gap closure (2026-11-06, по вердикту владельца в 20-33: 16 строк паука и 12 строк фона колб «исправить»; выполняются строго по очереди до 20-12; плюс D-52 (конструктор шаблона) из 20-34 — 20-38 параллельно с 20-35, 20-39 после 20-36. Волны хвоста сдвинуты: 20-37 → 15, 20-12 → 16, 20-13 → 17, 20-14 → 18, 20-15 → 19)**
- Gap Wave 11:
  - [x] 20-34-PLAN.md — лист вопросов с превью и ответы владельца: паук как на логотипе (кант, цвет второй нити, размер; D-50) и полноценный фон колб (что изображено, доля экрана, стиль, цвета, движение, телефон; D-51)
- Gap Wave 12:
  - [x] 20-35-PLAN.md — паук как на логотипе владельца по D-50: белое тело с чёрным контуром, чёрные глаза, ноги-спирали ДНК, без вируса; ходьба, режимы движения, резкость в покое и различимость на трёх акцентах сохранены
  - [x] 20-38-PLAN.md — модель шаблона по форме карточки вируса редактора без записей учёных и её экспорт HTML/PNG с оформлением и локальными изображениями; тесты доказывают, что путь не пишет на сайт и не ходит в сеть (D-52)
- Gap Wave 13:
  - [x] 20-36-PLAN.md — фон «Лабораторные колбы» как полноценный детальный фон по D-51; контраст подписей 4.5:1 над любой частью рисунка, законченный кадр в «Уменьшены»/«Выключены»
- Gap Wave 14:
  - [x] 20-39-PLAN.md — конструктор шаблона в «Повышении» на тех же компонентах формы карточки, что редактор сайта (вкладки «Основное», «Описание», «Мутации», оформление текста), черновик только в конструкторе, редактор сайта не меняется; UI-контракт и кадры для 20-37 (D-52)
- Gap Wave 15:
  - [x] 20-37-PLAN.md — пересъёмка всех кандидатов на коммите после перерисовок и нового конструктора шаблона, раздел 12 ledger, строки template-builder-*, rebaseline-* для нового паука и фона, вердикт владельца и строгий гейт [выполнен 2026-11-07, outcome: stopped-for-fixes: вердикт владельца «исправить» по 36 строкам (паук, колбы, конструктор шаблона), решения D-53..D-57, нужен новый цикл gap closure, 20-12 не запускать]

**Gap closure (2026-11-07, по вердикту владельца в 20-37: 16 строк паука, 12 строк колб и 8 строк конструктора шаблона «исправить», решения D-53..D-57; выполняются строго по очереди до 20-12. Волны хвоста сдвинуты: 20-12 → 23, 20-13 → 24, 20-14 → 25, 20-15 → 26)**
- Gap Wave 16:
  - [x] 20-40-PLAN.md — паук без канта и без белого внутри ног, идентичен Spider.svg без вируса; нить цвета акцента (D-53 и уточнение владельца 2026-11-07)
  - [x] 20-45-PLAN.md — кнопка «ОФОРМЛЕНИЕ» редактора на общем FormatLaunchButton с исправленным доступным именем; постоянная охрана, что это единственная правка portia-editor.tsx (D-57)
- Gap Wave 17:
  - [x] 20-41-PLAN.md — шагают все 8 ног (размах из длины ноги), волна паутины на каждую постановку (приоритет волн шага над эхом); причина найдена симуляцией (D-53)
- Gap Wave 18:
  - [x] 20-42-PLAN.md — колбы: мерцающее пламя, движущаяся полка, тикающие часы, меньше пустого места; контраст в пик, бюджет анимаций 140/80 с обоснованием (D-54)
- Gap Wave 19:
  - [x] 20-43-PLAN.md — предпросмотр шаблона — настоящая карточка базы (общий VirusCardBody, окрашенные иконки классов), компактный конструктор с переключателем вида; публичное досье не меняется (D-55)
- Gap Wave 20:
  - [x] 20-44-PLAN.md — скачанные HTML и PNG из той же карточки (стили карточки в файле, PNG через SVG foreignObject), закрытая политика перед скачиванием (D-55, D-24, D-52)
- Gap Wave 21:
  - [x] 20-46-PLAN.md — подсказки по сайту сокращены или убраны по реестру 20-HINTS-INVENTORY.md с тестом; подсказки внутри portia-editor.tsx — по решению владельца (D-56)
- Gap Wave 22:
  - [x] 20-47-PLAN.md — пересъёмка всех кандидатов на коммите после D-53..D-57, раунд 13 ledger (34 отклонённые строки), rebaseline-*, галерея с роликами и экспортом, вердикт владельца и строгий гейт [выполнен 2026-11-07, outcome: stopped-for-fixes: 12 строк колб и template-builder-preview:pc «исправить», замечания владельца A/B, вопрос 1 не понят]

**Gap closure (2026-11-07, по вердикту владельца в 20-47 и дополнению владельца при планировании; решения D-59..D-64; выполняются строго по очереди — общая сборка `.next` и порт 3100 — до 20-12. Волны хвоста сдвинуты: 20-12 → 30, 20-13 → 31, 20-14 → 32, 20-15 → 33)**
- Gap Wave 23:
  - [x] 20-48-PLAN.md — колбы: убрать второй циферблат (манометр), оживить доски и волны у доски в пределе 140/80; записать D-59..D-64 в 20-CONTEXT.md (D-59)
- Gap Wave 24:
  - [x] 20-49-PLAN.md — конструктор шаблона: нет ложной ошибки после скачанного файла (пять проектов Playwright), «Предупреждение» не разрывается в карточке и файлах, архив без изменений (D-60, D-61)
- Gap Wave 25:
  - [x] 20-50-PLAN.md — «Информация» в редакторе: «+ ДОБАВИТЬ РАЗДЕЛ» сверху у вкладок разделов, как в «Справочнике», подраздел внизу; охрана файла редактора с реестром одобренных правок (D-62, D-64)
- Gap Wave 26:
  - [x] 20-51-PLAN.md — кадр картинки в данных и на сайте: ImageFraming, нормализация на сервере, показ выбранной части на шести поверхностях, без кадра — побайтно как сегодня (D-63)
- Gap Wave 27:
  - [x] 20-52-PLAN.md — кадр фото сотрудника: решение владельца, при «a» — миграция трёх столбцов, ревью supabase-rls-reviewer, только изолированный staging, OWNER-MIG (D-63)
- Gap Wave 28:
  - [x] 20-53-PLAN.md — выбор видимой части во всех вкладках редактора с картинками, предпросмотр = сайт, доступность, кандидатные кадры и шаги UAT (D-63, D-64)
- Gap Wave 29:
  - [x] 20-54-PLAN.md — пересъёмка всех кандидатов на H5, раунд 14 ledger (13 строк), раздел 15 (кадр и «Информация»), галерея с понятными вопросами, вердикт владельца и строгий гейт

**Gap closure (2026-11-08, по вердикту владельца в 20-54: 8 строк конструктора шаблона и 8 строк кадра картинок «исправить», решения D-65..D-67; выполняются строго по очереди — общая сборка `.next` и порт 3100 — до 20-12. Волны хвоста сдвинуты: 20-12 → 34, 20-13 → 35, 20-14 → 36, 20-15 → 37)**
- Gap Wave 30:
  - [x] 20-55-PLAN.md — карточка шаблона как «База вирусов»: классы три — способ распространения — три, на ПК всегда фото слева, на телефоне как архив на телефоне, «Предупреждение» цельное; архив без изменений; записать D-65..D-67 (D-65)
- Gap Wave 31:
  - [x] 20-56-PLAN.md — окно выбора видимой части как выбор баннера в Discord вместо трёх ползунков: компактный блок и «Изменить», рамка места показа, «Масштаб», «Сбросить»/«Отмена»/«Применить»; предпросмотр и рамка = сайт на восьми поверхностях (D-66, D-67)
- Gap Wave 32:
  - [x] 20-57-PLAN.md — окно выбора: перетаскивание пальцем и мышью, клавиатура, фокус и axe, телефон; кадры-кандидаты, UI-SPEC и шаг UAT (D-66, D-67)
- Gap Wave 33:
  - [x] 20-58-PLAN.md — D-68: таблица кадров и галереи сняты с процесса (тест ledger удалён, документы — история), явная offline-обвязка Supabase, обязательные функциональные проверки на H6, текстовый список изменений 20-55..20-57 и общий вердикт владельца

**Gap closure (2026-11-08, после FAIL репетиции 20-13 на c11adf6; решение владельца D-69 «Сначала исправления»; выполняются строго по очереди — порт 3100, общий реестр эталонов и раннер — до физической приёмки 20-14. Волны хвоста сдвинуты: 20-14 → 41, 20-15 → 42)**
- Gap Wave 36:
  - [x] 20-59-PLAN.md — раннер: явный и записанный npm (`--npm-cli`, строка `npm:` в протоколе, неисправность встроенного npm переносного Node 22.13.1 записана — G5) и одно правило пропусков по условию проекта на уровне гейта для ui-contract-offline, visual-approved, visual-phase20 и e2e-full (G4)
- Gap Wave 37:
  - [ ] 20-60-PLAN.md — причина консольного события `about:srcdoc` в тестах конструктора шаблона (воспроизведение раннером, матрица флагов и node_modules), исправление в месте причины с RED-тестом, зелёный ui-contract-offline; при изменении кода продукта — текст для владельца (G1)
- Gap Wave 38:
  - [ ] 20-61-PLAN.md — эталон `phone-webkit--webkit-phone`: полоса прокрутки Phase 15 изолирована сравнением сборок efbc140 и HEAD под одним WebKit; замена строкой реестра (принятое изменение или среда), исправление продукта или честно красный (G2)
- Gap Wave 39:
  - [ ] 20-62-PLAN.md — детерминированная сцена движения: кадры Вивьян одинаковы в двух прогонах (доведение анимаций, политика motion не меняется), сравнение с одобренными, гейт visual-approved раннера (G3)
- Gap Wave 40:
  - [ ] 20-63-PLAN.md — повторная релизная репетиция на новом release commit с `--npm-cli` и протокол 20-RELEASE-EVIDENCE.md; цепочка обновлённого вердикта владельца — только если код продукта изменён после 0c2a59d1d1a7 (G6)

## Progress

**Execution order:** 15 → 16 → 17 → 18 → 19 → 20 (2026-11-02: бывшие 19+20 объединены в 19, бывшие 21+22 — в 20). Phase 17 непосредственно зависит от 15, а Phase 19 — от 16; номера сохраняют единый порядок milestone и не разрешают обход acceptance gates.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Восстановление контроля, контракты и браузерный baseline | 20/20 | Complete    | 2026-11-02 |
| 16. Канонический Supabase staging и SQL-истина | 14/14 | Complete    | 2026-11-01 |
| 17. Обратимая декомпозиция рабочего стола и редактора | 8/8 | Complete    | 2026-11-01 |
| 18. Рабочий стол, окна и живые анимации | 7/7 | In Progress | - |
| 19. «Повышение», приложения, редактор, поиск и медиа | 20/22 | In Progress | - |
| 20. Security, accessibility и приёмка релиза | 57/63 | In Progress | - |

## Coverage

- v1.3 requirements mapped: **76/76**
- Orphaned requirements: **0**
- Duplicate mappings: **0**
- Granularity: **standard** (six phases after the 2026-11-02 merge of 19+20 and 21+22)

---
*Roadmap created: 2026-10-30 for PORTIA OS v1.3 «Стабилизация PORTIA OS»*
