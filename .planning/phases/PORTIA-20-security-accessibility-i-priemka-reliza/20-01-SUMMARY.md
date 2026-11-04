---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 01
subsystem: ui
tags: [react, nextjs, promotion, template-builder, offline-html, playwright]
requires:
  - phase: PORTIA-19
    provides: participant Promotion app with assigned task list
provides:
  - "«Создать шаблон» рядом с заданием в «Повышении» и отдельный локальный конструктор PortiaTemplateBuilder"
  - "lib/portia-template-export.ts: ограниченный TemplateDraft, escapeTemplateHtml, createStandaloneHtml, downloadTemplateBlob"
  - "Автономный HTML (inline CSS, CSP default-src 'none', без скриптов), открывающийся offline"
affects: [20-02, PNG/local-image export plans, final acceptance]
status: complete
actuals:
  tokens: 8500
  tasks: 2
  commits: 1
plan_head_before: 7ddbec049434eaafdbd637d98f209ad0b19a18d5
plan_head_after: 253fa4d25f60ab520c1bc7c25d7ac593a5aa264a
tech-stack:
  added: []
  patterns:
    - "Builder replaces the Promotion view via the hidden attribute: Promotion stays mounted (nickname, polling, qualification runner, scroll)"
    - "Export from an immutable draft snapshot; ref guard blocks a second download while preparing"
key-files:
  created:
    - components/portia-template-builder.tsx
    - lib/portia-template-export.ts
    - lib/portia-template-export.test.ts
    - tests/e2e/specs/template-builder.spec.ts
  modified:
    - components/portia-promotion.tsx
    - app/portia.css
key-decisions:
  - "Задание «создать шаблон» распознаётся по тексту задания (/шаблон/i): в данных нет отдельного признака типа задания."
  - "Черновик живёт в состоянии конструктора и теряется при выходе; выход с нескачанным текстом требует подтверждения (inline role=alertdialog, не window.confirm)."
  - "Preview и CSS конструктора используют токены --paper/--ink (не бирюзовые литералы): иначе падает lib/accent-theme.test.ts."
requirements-completed: [STAB-TMPL-01]
coverage:
  - id: D1
    description: "Кнопка «Создать шаблон» у задания открывает отдельный конструктор; «Повышение» сохраняет состояние при возврате"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "tests/e2e/specs/template-builder.spec.ts (2 tests x 5 projects, 10 passed, status stubbed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Скачивание автономного HTML с экранированным текстом, открывается offline, без write-запросов"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-export.test.ts (5 tests)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/specs/template-builder.spec.ts#participant builds a text template, downloads it and opens the HTML offline"
        status: pass
    human_judgment: false
  - id: D3
    description: "E7: пустой/частичный черновик, статус «Готовим файл…», блокировка повторного download, подтверждение выхода"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "tests/e2e/specs/template-builder.spec.ts#unsaved text asks before leaving and a partial draft stays honest"
        status: pass
    human_judgment: false
duration: 40min
completed: 2026-11-04
---

# Phase 20 Plan 01: Локальный конструктор шаблона досье Summary

Участник открывает «Создать шаблон» рядом с заданием в «Повышении», заполняет подписанные текстовые поля, скачивает автономный HTML-файл с экранированным текстом и открывает его без сети; ничего не уходит на сервер.

## Accomplishments

- `lib/portia-template-export.ts`: собственная ограниченная модель `TemplateDraft` (10 текстовых полей, без классификаций и журналов учёных), `escapeTemplateHtml`, `createStandaloneHtml` (inline CSS, мета-CSP `default-src 'none'; style-src 'unsafe-inline'; img-src data:`, нет `<script>`/`<link>`), `downloadTemplateBlob` (Blob, скрытая ссылка, `revokeObjectURL` через 10 с).
- `components/portia-template-builder.tsx`: форма с подписями, preview в виде карточки досье с «Не заполнено» для пустых полей, статус «Готовим файл…» (`role=status`) с блокировкой кнопки и ref-защитой от повторного запуска, экспорт из снимка черновика (параллельные правки не смешивают версии), ошибка «Не удалось подготовить файл. Повторите скачивание.» с кнопкой «Повторить скачивание», inline-подтверждение выхода «Черновик ещё не скачан» (Escape отменяет, фокус на «Остаться и скачать»).
- `components/portia-promotion.tsx`: кнопка «Создать шаблон» с пояснением «Работа скачивается на ваше устройство…» только у задания, содержащего «шаблон»; конструктор показывается рядом с `hidden` оболочкой «Повышения», поэтому ник, опрос, квалификация и прокрутка сохраняются; при возврате фокус на кнопке.
- Тесты: 5 unit-тестов (`npm test`: 1114 tests, 1111 pass, 0 fail, 3 skipped) и 2 e2e-сценария на 5 проектах Playwright (10 passed): кнопка → заполнение → скачивание → открытие файла в offline-контексте (0 http-запросов, нет диалогов, XSS-текст показан литералом) → отсутствие write-запросов к `/api`, `/api/uploads`, `*.supabase.co`.

## Task Commits

1. **Task 1 (tracer) + Task 2** — `253fa4d` `feat(20-01): add local template builder inside Promotion`

## Deviations from Plan

- **[Process] Две задачи в одном коммите.** Состояния E7 из Task 2 (пустой/частичный черновик, статус, подтверждение выхода) написаны вместе с tracer, поэтому отдельного diff для Task 2 не осталось. Причина: общий файл компонента и общий spec; разделение было бы искусственным.
- **[Rule 1 - Bug] Бирюзовые литералы в CSS.** Первая версия `.template-preview` использовала hex-цвета бирюзового семейства, что роняло `lib/accent-theme.test.ts` («no turquoise literal in the stylesheet»). Заменено на токены `--paper`, `--paper-2`, `--ink`, `--ink-soft`; тест зелёный. Коммит 253fa4d.
- **Ограничение e2e-доказательства.** Участник со staging недоступен (роли и staging остаются BLOCKED по CLAUDE.md), поэтому в spec подменяется только GET `/api/promotion/status?nickname=` (тестовый `page.route`, не через ledger фикстур). Это доказывает UI конструктора и локальный экспорт, но НЕ серверное поведение и НЕ аутентифицированную роль; в доказательство участника/staging не засчитывать.
- **Вне объёма этого плана:** PNG-экспорт и локальные изображения (D-24 в UI-SPEC) не реализованы; в 20-01 только текстовый черновик и HTML, как в `<files>` и задачах.

## Known Stubs

None. Все поля состояния конструктора питаются вводом участника.

## Threat Flags

None. Новых сетевых эндпоинтов, путей авторизации или схемы нет; пакеты не устанавливались (T-20-SC). T-20-01: шаблон не создаёт заявку и не меняет зачёт задания (в компоненте нет fetch), подтверждено проверкой write-запросов в e2e.

## Self-Check: PASSED

- FOUND: components/portia-template-builder.tsx, lib/portia-template-export.ts, lib/portia-template-export.test.ts, tests/e2e/specs/template-builder.spec.ts
- FOUND: commit 253fa4d (ancestor of HEAD)
- `npm exec tsc -- --noEmit` clean; eslint clean for changed files (pre-existing repo-wide lint errors untouched).
