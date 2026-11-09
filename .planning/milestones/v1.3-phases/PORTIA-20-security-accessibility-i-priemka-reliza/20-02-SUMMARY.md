---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 02
subsystem: ui
tags: [react, canvas, png-export, offline-html, local-image, playwright]
requires:
  - phase: PORTIA-20
    provides: "20-01 local template builder with text draft and standalone HTML export"
provides:
  - "lib/portia-template-export.ts: decodeLocalTemplateImage, createTemplatePng, layoutTemplateCard, createStandaloneHtml(draft, image) with embedded data URL"
  - "Конструктор шаблона: Добавить/Убрать изображение, Скачать PNG, Скачать HTML, Повторить скачивание того же формата"
  - "Явный отказ PNG для слишком длинной карточки с предложением HTML, без молчаливой обрезки"
affects: [20-14 physical PC/phone UAT, final acceptance]
status: complete
actuals:
  tokens: 36000
  tasks: 2
  commits: 2
plan_head_before: 11489eda25aec9fde8fd1773c4bd2affa80d44a8
plan_head_after: 34d371fe0c1ce5d86aca030799e6946816434be7
tech-stack:
  added: []
  patterns:
    - "Image is validated in order: file size, declared MIME, magic bytes, browser decode, decoded pixel bounds; one user-facing refusal text"
    - "PNG card is laid out as a pure op list with an injected text measurer, so overflow is decided before encoding and the drawn lines are unit-testable"
    - "Export always shows the status for a minimum time, on success and on failure"
key-files:
  created: []
  modified:
    - components/portia-template-builder.tsx
    - lib/portia-template-export.ts
    - lib/portia-template-export.test.ts
    - tests/e2e/specs/template-builder.spec.ts
    - app/portia.css
key-decisions:
  - "Разрешены только PNG, JPEG и WebP до 5 МБ, сторона до 4096 px, до 12 млн px; SVG и GIF отклоняются (SVG может нести скрипты, GIF анимируется в HTML и не в PNG)."
  - "Declared MIME должен совпадать с сигнатурой файла; расширение имени не учитывается."
  - "Карточка PNG: ширина 1000 px, высота не более 8000 px (до 8 млн px, ниже лимитов canvas мобильных браузеров); длиннее - TemplatePngTooLargeError."
  - "Enter в поле формы больше не запускает скачивание HTML: форма только подавляет submit, скачивание идёт кнопками PNG/HTML."
requirements-completed: []
coverage:
  - id: D1
    description: "Локальное изображение после проверки MIME, сигнатуры, декодирования, байтов и пикселей видно в preview, встроено в offline HTML и нарисовано в PNG; нет внешнего URL"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-export.test.ts (17 tests: signature, bounds, decode refusals, HTML data URL, layout, PNG draw ops, zero fetch)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/specs/template-builder.spec.ts#a local image and long text reach the preview, the offline HTML and the PNG without any server write (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PNG содержит весь bounded preview и длинный текст; не помещается - явная ошибка и HTML вместо обрезки"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "template-builder.spec.ts#a card too long for PNG is refused with an HTML alternative that keeps every line (5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "E7 error: refused image and encoder/decoder failures keep the draft and offer 'Повторить скачивание'"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "template-builder.spec.ts#an unsupported, corrupt, oversized or unreadable image is refused...; #an encoding failure keeps the draft... (toBlob null/throw, no 2d context, Image decode failure)"
        status: pass
    human_judgment: false
  - id: D4
    description: "E7 overflow/long-text on a real phone and PC: visual adequacy of the PNG card and the window scrolling"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "template-builder.spec.ts#long unbroken text and a wide image stay inside the window... (emulated chromium-phone, webkit-phone, desktop)"
        status: pass
    human_judgment: true
    rationale: "Physical PC/phone check of how the PNG looks and how the window scrolls is owner UAT (20-14); emulated projects do not replace it."
duration: 45min
completed: 2026-11-04
---

# Phase 20 Plan 02: Локальное изображение и PNG/HTML в конструкторе шаблона Summary

Участник добавляет с устройства PNG, JPEG или WebP, видит его в предпросмотре карточки и скачивает ту же карточку как автономный HTML (изображение внутри файла, открывается offline) и как PNG (весь текст и картинка, рассчитанная заранее раскладка); ничего не уходит на сервер, длинная карточка не обрезается молча.

## Accomplishments

- `lib/portia-template-export.ts`: `decodeLocalTemplateImage` (размер файла, заявленный MIME, сигнатура, декодирование браузером, границы пикселей; любая причина отказа даёт `TemplateImageError`), `createStandaloneHtml(draft, image)` с встроенным data URL (CSP файла `img-src data:`), `layoutTemplateCard` (чистый расчёт карточки 1000 px шириной с переносом слов и посимвольным разрезанием длинных слов), `createTemplatePng` (рисует по списку операций, `toBlob` с отказом на null, исключение и пустой Blob), `downloadTemplateBlob` принимает HTML-текст или Blob.
- `components/portia-template-builder.tsx`: «Добавить изображение» / «Убрать изображение», «Скачать PNG» и «Скачать HTML», «Повторить скачивание» повторяет именно тот формат, который упал; экспорт идёт из снимка черновика и изображения; во время чтения файла и подготовки кнопки, выбор файла и выход отключены; ошибка файла не стирает текст и не снимает ранее принятое изображение; ошибка слишком длинной карточки без кнопки повтора (повтор не поможет), с подсказкой про HTML.
- Тесты: 17 unit (`npm test`: 1173 tests, 1170 pass, 0 fail, 3 skipped) и 7 e2e-сценариев на 5 проектах Playwright (35 passed, retries=0, 0 skipped).
- E2E-доказательства: PNG скачивается и декодируется в браузере (ширина 1000, высота 2400-8000 px, красные пиксели картинки на месте, текстовые пиксели есть, футер внизу не обрезан); HTML содержит `<img src="data:image/png;base64,`, нет http(s) в src/href, нет script/link/url(); файл открывается в offline-контексте с нулём внешних запросов, картинка 64x32 загружена; 0 запросов записи к `/api`, `/api/uploads`, `*.supabase.co`; отказы (текст под видом PNG, SVG, JPEG под видом PNG, повреждённый PNG, ширина 4097, файл более 5 МБ, сбой декодера) показывают «Не удалось открыть изображение. Выберите другой файл.» при нетронутом тексте; сбои `toBlob` (null и SecurityError), 2d-контекста и декодирования дают «Не удалось подготовить файл. Повторите скачивание.», «Повторить скачивание» и сохранённый черновик; карточка из 2x1999 строк отклоняется для PNG, HTML сохраняет все 3998 строк.

## Task Commits

1. **Task 1** — `2822f8f` `feat(PORTIA-20-02): local image in preview, offline HTML and PNG export` (lib, lib-тесты, компонент, CSS)
2. **Task 2** — `34d371f` `test(PORTIA-20-02): e2e for local image export, refusals, encoder failures and long text`

## Deviations from Plan

- **[Process] Граница задач.** Логика Task 2 (отказ PNG для длинной карточки, повтор формата, статус) живёт в тех же файлах, что и Task 1, и написана вместе с ними; отдельным коммитом Task 2 выделены только e2e-доказательства. Как и в 20-01, разделение кода было бы искусственным.
- **[Scope] `app/portia.css` изменён**, хотя не указан в `files_modified`: стили `.template-figure`, `.template-field-title`, `.template-image-field` для изображения в preview и подписи группы. Другого места для них нет; бирюзовых литералов нет (`lib/accent-theme.test.ts` зелёный в `npm test`).
- **[Rule 1 - Bug] Рамка изображения закрашивала край картинки в PNG.** Первая раскладка рисовала 1 px рамку поверх краёв (1860 из 2048 красных пикселей). Рамка перенесена на 1 px наружу; e2e требует не менее 2008. Коммит 2822f8f.
- **[Rule 1 - Bug] Статус «Готовим файл…» пропадал при быстром сбое.** `Promise.all` отклонялся сразу, ошибка показывалась без статуса. Теперь минимальный показ статуса выдерживается и при ошибке. Коммит 2822f8f.
- **Изменение поведения 20-01:** Enter в поле формы раньше скачивал HTML; при двух форматах это двусмысленно, форма теперь только подавляет submit. Подсказка стала «Текущий черновик ещё не скачан/уже скачан» (учитывает изображение), строка в e2e 20-01 обновлена.
- **Окружение e2e.** Порт 3000 занят dev-сервером другой сессии (не трогал). Production-сборка собрана с `PORTIA_E2E_ALLOW_HTTP=1` (заголовок `upgrade-insecure-requests` запекается при сборке; без флага webkit-phone падал во всех тестах, включая неизменённые 20-01, из-за апгрейда подресурсов http до https), запущена `next start` на порту 3100 с `PORTIA_E2E_BASE_URL`, затем остановлена. Первый прогон webkit-phone без флага не засчитывается.

## BLOCKED / Limitations

- Физическая проверка PNG и прокрутки окна на настоящем PC и телефоне остаётся за 20-14 (owner UAT); эмулируемые проекты Playwright её не заменяют.
- Участник со staging недоступен: статус участника подменяется `page.route` (как в 20-01); это доказывает UI и локальный экспорт, но НЕ серверное поведение и НЕ аутентифицированную роль.
- Гонка «повторный выбор файла во время экспорта»: закрыта отключением выбора файла на время подготовки и экспортом из снимка (изображение и текст берутся один раз при старте); отдельного e2e на подмену файла во время подготовки нет (окно 400 мс, кнопка отключена).
- STAB-TMPL-01 уже стоит как Complete в REQUIREMENTS.md (отмечено раньше, при 20-01); этим планом отметка не менялась и не расширялась. Физическая приёмка конструктора PC/phone остаётся открытой в 20-14.

## Known Stubs

None.

## Threat Flags

None. T-20-02: экспорт не подменяет изображения ссылками (HTML несёт только data URL с MIME из allow-list сигнатур, PNG рисует то же изображение); новых endpoint, путей авторизации или хранилищ нет, `fetch`/`XMLHttpRequest`/storage в коде не используются. T-20-SC: пакеты не устанавливались.

## Self-Check: PASSED

- FOUND: components/portia-template-builder.tsx, lib/portia-template-export.ts, lib/portia-template-export.test.ts, tests/e2e/specs/template-builder.spec.ts, app/portia.css
- FOUND: commits 2822f8f, 34d371f (ancestors of HEAD; `rev-list` 11489ed..HEAD = 2)
- Acceptance: `node --experimental-strip-types --test lib/portia-template-export.test.ts` 17/17; `npm test` 0 fail; `npm exec tsc -- --noEmit` clean; eslint clean on the four plan files; `test:e2e -- --retries=0 tests/e2e/specs/template-builder.spec.ts` 35 passed, 0 skipped on 5 projects.
