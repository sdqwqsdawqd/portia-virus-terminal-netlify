# Roadmap: PORTIA OS — v1.3 «Стабилизация PORTIA OS»

## Overview

v1.3 превращает уже работающий PORTIA OS в доказуемо устойчивый релиз без редизайна: сначала фиксируются текущий образ, контракты и браузерный baseline, затем доказывается SQL-истина на изолированном Supabase staging, после чего обратимо разделяются перегруженные компоненты и точечно стабилизируются рабочий стол, «Повышение», остальные приложения, безопасность и релизный контур. Существующие русские тексты, app id, данные, PORTIA OS-палитра и шрифты, PNG-паук, паутина и Вивьян сохраняются, если владелец отдельно не утвердит изменение.

## Milestones

- ✅ **v1.0 Доработка** — Phases 1–5 (shipped 2026-10-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Закрытие замечаний** — Phases 6–13 (shipped 2026-10-27) — [archive](milestones/v1.1-ROADMAP.md)
- ⚠️ **v1.2 Повышение** — Phase 14 (incomplete; 17/19 plans, live/UAT gates carried into v1.3) — [archive](milestones/v1.2-INCOMPLETE-ROADMAP.md)
- 📋 **v1.3 Стабилизация PORTIA OS** — Phases 15–22 (planned)

## Phases

- [ ] **Phase 15: Восстановление контроля, контракты и браузерный baseline** — зафиксировать текущий PORTIA OS, получить Figma-одобрение и ввести воспроизводимый Playwright/visual/a11y/console gate
- [ ] **Phase 16: Канонический Supabase staging и SQL-истина** — доказать миграции, роли, RLS/RPC и конкурентные операции на изолированной базе
- [ ] **Phase 17: Обратимая декомпозиция рабочего стола и редактора** — выделить безопасные seams без изменения поведения, данных и визуального контракта
- [ ] **Phase 18: Рабочий стол, окна и живые анимации** — стабилизировать геометрию, настройки, ярлыки, PNG-паука, паутину и Вивьян по утверждённым эталонам
- [ ] **Phase 19: Доказательство «Повышения» и точечная стабилизация** — доказать весь participant/reviewer flow на staging и исправить только воспроизведённые разрывы
- [ ] **Phase 20: Стабилизация приложений, редактора, поиска и медиа** — привести остальные поверхности к проверяемым state, access, search и media-контрактам
- [ ] **Phase 21: Закрытие security, accessibility, CSP и зависимостей** — закрыть или явно принять подтверждённые риски и выполнить финальные технические гейты
- [ ] **Phase 22: Репетиция релиза и приёмка владельца** — повторить релиз с чистого checkout, сверить доказательства и получить физическую PC/phone UAT

## Phase Details

### Phase 15: Восстановление контроля, контракты и браузерный baseline
**Goal**: Текущий PORTIA OS зафиксирован как воспроизводимый и одобренный контракт до любых рефакторингов или точечных исправлений.
**Depends on**: Nothing (milestone start; Phase 14 remains an incomplete archive)
**Requirements**: STAB-BASE-01, STAB-BASE-02, STAB-BASE-03, STAB-BASE-04, STAB-BASE-05, STAB-BASE-06
**Success Criteria** (what must be TRUE):
  1. Владелец может сравнить desktop и phone в Figma с текущим сайтом и явно одобрить UI/motion-контракт; все предлагаемые изменения отмечены отдельно.
  2. Из чистого checkout запускается committed Playwright/axe suite для visitor, participant, editor, promo reviewer и owner на PC/phone, с фиксированными данными, временем, DPR, шрифтами и случайностью и без мутаций production.
  3. Одобренные visual baselines воспроизводят desktop, окна, «Повышение», редактор, паука, паутину, Вивьян и phone layout; снимки не становятся эталоном до владельческого одобрения.
  4. Неожиданная browser/console/network/CSP ошибка блокирует gate, а ожидаемый отказ виден как безопасное русское состояние; для каждой следующей фазы задана полная цепочка доказательств GSD.
**Acceptance gate**: Figma approval и продвижение candidate captures в baseline остаются открытыми до явного решения владельца.
**Plans**: 5 plans

Plans:
**Wave 1**

- [x] 15-01-PLAN.md — read-only current-state capture, dirty ownership ledger and explicit owner disposition (STAB-BASE-01, STAB-BASE-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 15-02-PLAN.md — exact Playwright/axe bootstrap, bounded browser projects and fail-closed target guard (STAB-BASE-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 15-03-PLAN.md — deterministic actor fixtures, browser diagnostics, semantic page objects and representative flows (STAB-BASE-02, STAB-BASE-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 15-04-PLAN.md — candidate-only visual/motion captures and authoritative CURRENT/PROPOSED Figma mapping (STAB-BASE-03, STAB-BASE-04)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 15-05-PLAN.md — named-owner approval, exact-byte baseline promotion and clean-checkout traceability (STAB-BASE-03, STAB-BASE-04, STAB-BASE-06)

**Cross-cutting constraints:**

- Do not modify product source in Phase 15; this phase establishes evidence and executable contracts only.
- Preserve all pre-existing dirty files until the owner records per-path disposition and touch permission.
- Never treat a skipped staging, Figma, device or owner gate as a pass; report it as BLOCKED or PENDING.
- Run package/browser work only from Node 22.13.x and never mutate a production-like Supabase target.
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
**Plans**: TBD

### Phase 17: Обратимая декомпозиция рабочего стола и редактора
**Goal**: Рабочий стол и редактор разделены на проверяемые seams, оставаясь для пользователя тем же PORTIA OS.
**Depends on**: Phase 15
**Requirements**: STAB-DESK-01, STAB-DESK-07
**Success Criteria** (what must be TRUE):
  1. Пользователь открывает один app id из ярлыка, start panel, taskbar или search и всегда получает одно восстановленное и сфокусированное окно без дубликата и потери состояния.
  2. После каждого шага декомпозиции существующие app ids, DOM semantics, CSS hooks, storage keys, API shapes, порядок и данные остаются совместимыми, а утверждённые desktop/phone snapshots не дрейфуют.
  3. Каждый extraction increment можно откатить отдельно, не возвращая уже доказанные соседние seams и не вводя новый generic app shell.
**Acceptance gate**: Декомпозиция начинается только после Phase 15 baseline и проходит parity-gate после каждого increment; намеренные UX-изменения сюда не входят.
**Plans**: TBD
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
**Acceptance gate**: Geometry на DPR 1/1.25, motion quality и long-session performance остаются открытыми до browser evidence и физического PC verdict владельца.
**Plans**: TBD
**UI hint**: yes

### Phase 19: Доказательство «Повышения» и точечная стабилизация
**Goal**: Существующий поток «Повышения» доказан на staging от безопасного поиска ника до ручного решения reviewer, пересдачи и очистки без утечек и ложных успехов.
**Depends on**: Phase 16
**Requirements**: STAB-PROM-01, STAB-PROM-02, STAB-PROM-03, STAB-PROM-04, STAB-PROM-05, STAB-PROM-06, STAB-PROM-07, STAB-PROM-08, STAB-PROM-09, STAB-PROM-10, STAB-PROM-11, STAB-PROM-12, STAB-PROM-13, STAB-PROM-14, STAB-PROM-15
**Success Criteria** (what must be TRUE):
  1. Участник без аккаунта видит только safe projection и одну допустимую ordinary/qualification action или стабильную русскую причину; outage, missing migration, stale response и validation refusal не маскируются под успех или «ник не найден».
  2. Первый принятый запрос атомарно создаёт binding и единственный активный flow; cooldown не продлевается от retry, reload восстанавливает состояние, а отказ не оставляет token, binding или request.
  3. Ordinary и qualification выдают только допустимые immutable наборы; qualification соблюдает переходы, типы вопросов, server deadline, CAS, PC/phone policy и никогда не раскрывает future questions или keys.
  4. Reviewer с актуальным `promo` grant управляет очередью и банками без потери typed data, единолично claims попытку, вручную выбирает итог, а participant получает только разрешённый результат; retake и cleanup соблюдают сроки и лимит истории.
  5. Владелец подряд принимает participant/reviewer, bank CRUD, ordinary, qualification, retake, cleanup и direct denial после clean reload на физическом PC и phone с временными данными и без unresolved failures.
**Acceptance gate**: Staging races/direct denials и полная owner PC/phone UAT обязательны; архивные отметки Phase 14 и preflight не закрывают фазу.
**Plans**: TBD
**UI hint**: yes

### Phase 20: Стабилизация приложений, редактора, поиска и медиа
**Goal**: Все остальные пользовательские поверхности устойчиво работают с полными, пустыми, устаревшими, частичными и запрещёнными данными на PC и phone.
**Depends on**: Phases 17 and 18
**Requirements**: STAB-DESK-08, STAB-APP-01, STAB-APP-02, STAB-APP-03, STAB-APP-04, STAB-APP-05, STAB-APP-06, STAB-APP-07, STAB-APP-08, STAB-APP-09, STAB-APP-10, STAB-SEARCH-01, STAB-SEARCH-02, STAB-SEARCH-03, STAB-SEARCH-04, STAB-MEDIA-01, STAB-MEDIA-02, STAB-MEDIA-03, STAB-MEDIA-04, STAB-MEDIA-05
**Success Criteria** (what must be TRUE):
  1. «База вирусов», «Сотрудники», «Сводка», «Информация», «Справочник», «Корзина», «Таблица» и «Устав» сохраняют валидированное поведение и различают loading, empty, populated, stale/degraded, permission denied и fatal error без уничтожения last-good state.
  2. Редактор на PC/phone сохраняет undo/redo, drafts during save, revision conflict, poll suppression, save-all, grants, per-field errors и WYSIWYG selection/range; success показывается только после authoritative ответа.
  3. Глобальный поиск keyboard-first находит только разрешённые опубликованные сущности, нормализует регистр и `е/ё`, открывает точную сущность в приложении-владельце и никогда не индексирует private editor/reviewer data или answer keys.
  4. Upload и URL normalization проверяют реальные bytes, размер, формат и scheme/path, не стирают draft при отказе и используют безопасный UUID URL либо устойчивый fallback для legacy/broken/slow media.
  5. Hero/media загружается с корректным приоритетом, offscreen collections lazy, immutable media кэшируется без повторного скачивания, а смена записи, ошибка сети или blocked host не дают stale image, app crash или infinite spinner.
**Acceptance gate**: Per-app desktop/phone matrix, authenticated editor journeys, search click-through и upload/cache/network evidence должны быть записаны до перехода к финальному CSP.
**Plans**: TBD
**UI hint**: yes

### Phase 21: Закрытие security, accessibility, CSP и зависимостей
**Goal**: Подтверждённые accessibility/security/dependency риски закрыты или честно оформлены как release blockers/waivers, не ломая одобренный контент и интерфейс.
**Depends on**: Phases 18, 19 and 20
**Requirements**: STAB-MEDIA-07, STAB-A11Y-01, STAB-A11Y-02, STAB-A11Y-03, STAB-A11Y-04, STAB-SEC-02, STAB-SEC-03, STAB-SEC-05
**Success Criteria** (what must be TRUE):
  1. PC controls имеют корректные name/role/state, видимый focus, dialog trap/restore и keyboard alternative; phone actions доступны touch, не перекрываются keyboard/sticky bars и не создают page-level overflow.
  2. Русские labels и объявляемые success/error/disabled reasons понятны, alt соответствует назначению, а off/reduced прекращает looping movement на всех поверхностях без потери content и feedback.
  3. Participant network/UI не получает answer keys, future questions, internal notes, bank payload или reviewer identity, а sensitive responses используют no-store.
  4. Инвентаризированные media hosts проходят CSP report-only до enforcement; security headers не ломают approved charter/sheet/video, а rejected host показывает устойчивый fallback без необъяснённых CSP/console errors.
  5. Managed Codex Security scan даёт реальный артефакт; high findings исправлены или явно приняты, production dependency audit чист, dev findings имеют disposition, а lockfile меняется отдельным проверяемым increment.
**Acceptance gate**: Отсутствие запущенного managed scan не считается pass; незакрытый high finding блокирует релиз согласно config.
**Plans**: TBD
**UI hint**: yes

### Phase 22: Репетиция релиза и приёмка владельца
**Goal**: Один и тот же release commit проходит чистую репетицию, безопасную проверку инфраструктуры и окончательную владельческую приёмку без скрытых или переименованных пробелов.
**Depends on**: Phase 21 (and therefore all prior v1.3 phases)
**Requirements**: STAB-SEC-06, STAB-REL-01, STAB-REL-02, STAB-REL-03, STAB-REL-05, STAB-REL-06, STAB-REL-07, STAB-REL-08
**Success Criteria** (what must be TRUE):
  1. Из clean checkout на release commit воспроизводимо проходят tests, typecheck, production build, full lint, production audit, Playwright, approved visuals, axe, keyboard journeys и zero-unexpected-console policy без скрытого retry-pass и без production mutations.
  2. Владелец на физическом PC/phone после clean reload принимает полный «Повышение», window bounds, qualification lock, PNG-паука, паутину, ярлыки, Вивьян, поиск и bounded editor layout с временными безопасными данными.
  3. Roadmap, requirements, summaries, verification, UAT и deployed evidence описывают один commit/state; blocked live check остаётся blocked, а не complete.
  4. Финальный review подтверждает сохранение PORTIA OS и принятых out-of-scope; release notes честно перечисляют spoofable mode/device binding, остальные accepted risks и все waivers без обещания hardware attestation.
**Acceptance gate**: Фаза не закрывается без физической owner PC/phone UAT, точного evidence ledger и отсутствия pending high-severity blocker.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution order:** 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22. Phase 17 непосредственно зависит от 15, а Phase 19 — от 16; номера сохраняют единый порядок milestone и не разрешают обход acceptance gates.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Восстановление контроля, контракты и браузерный baseline | 1/5 | In Progress|  |
| 16. Канонический Supabase staging и SQL-истина | 0/TBD | Not started | - |
| 17. Обратимая декомпозиция рабочего стола и редактора | 0/TBD | Not started | - |
| 18. Рабочий стол, окна и живые анимации | 0/TBD | Not started | - |
| 19. Доказательство «Повышения» и точечная стабилизация | 0/TBD | Not started | - |
| 20. Стабилизация приложений, редактора, поиска и медиа | 0/TBD | Not started | - |
| 21. Закрытие security, accessibility, CSP и зависимостей | 0/TBD | Not started | - |
| 22. Репетиция релиза и приёмка владельца | 0/TBD | Not started | - |

## Coverage

- v1.3 requirements mapped: **76/76**
- Orphaned requirements: **0**
- Duplicate mappings: **0**
- Granularity: **standard** (eight compact phases)

---
*Roadmap created: 2026-10-30 for PORTIA OS v1.3 «Стабилизация PORTIA OS»*
