---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 08
subsystem: security
tags: [csp, report-only, nextjs-headers, playwright, media]
requires:
  - phase: PORTIA-19
    provides: PortiaImage placeholder and visible-only 15 s timeout (19-10, 19-15)
provides:
  - "Content-Security-Policy-Report-Only: стрикт-кандидат рядом с неизменной enforced политикой"
  - "Тест заголовков: оба CSP, frame/nosniff/referrer/permissions/COOP/HSTS и граница HTTP/HTTPS"
  - "20-MEDIA-CSP.md: инвентарь внешних media-хостов, disposition нарушений, ограничения LAN/HTTPS"
  - "Браузерный сценарий: заголовки в документе, одобренные фреймы, отказавший хост изображения"
affects: [20-final-acceptance, STAB-MEDIA-07, STAB-SEC-03]
status: complete
actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: b5edc2b6afc504ba7dff7356c74589b5b5cb3172
plan_head_after: 831696af065e808e9221db4bd0a6df306c5b1e75
tech-stack:
  added: []
  patterns:
    - "Report-only кандидат читается через securitypolicyviolation в diagnostics-фикстуре, без новой конечной точки"
    - "Сужение только директив, не нужных одобренным сценариям; тест запрещает расширять enforced"
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-MEDIA-CSP.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md
  modified:
    - next.config.ts
    - lib/security-headers.test.ts
    - tests/e2e/specs/media-states.spec.ts
    - tests/e2e/fixtures/diagnostics.ts
key-decisions:
  - "Кандидат сужает connect-src до 'self', font-src до 'self', media-src до 'self' https:, добавляет manifest-src 'self'; img-src https: и frame-src без изменений (D-05, D-06)."
  - "Новый report-endpoint не вводился (новая сетевая поверхность); нарушения собираются событием securitypolicyviolation."
  - "Enforcement кандидата не включался: нужен PC/phone UAT по D-05, он остаётся BLOCKED."
  - "components/portia-desktop-media.tsx не менялся: статичная заглушка D-07 уже есть, поведение закреплено тестом."
requirements-completed: []
coverage:
  - id: C1
    description: "Enforced CSP не изменена, кандидат доставляется только заголовком Report-Only, img-src https: сохранён"
    requirement: STAB-SEC-03
    verification:
      - kind: unit
        ref: "lib/security-headers.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: C2
    description: "Одобренные фреймы (Устав, Таблица) и отказавший хост изображения идут без CSP/console событий; заглушка статична, коробка не меняется"
    requirement: STAB-MEDIA-07
    verification:
      - kind: e2e
        ref: "tests/e2e/specs/media-states.spec.ts, chromium-desktop/dpr125/firefox/chromium-phone/webkit-phone"
        status: pass
    human_judgment: false
  - id: C3
    description: "PC/phone UAT по LAN, опубликованные HSTS/upgrade, данные для YouTube/GIF/Roblox, обложки «Справочника» (CR-01)"
    requirement: STAB-SEC-03
    verification:
      - kind: other
        ref: "20-MEDIA-CSP.md, разделы 4-6"
        status: unknown
    human_judgment: true
duration: 50min
completed: 2026-11-04
---

# Phase 20 Plan 08: Report-only CSP candidate and media fallback Summary

Рядом с неизменной enforced CSP добавлен строгий кандидат только в `Content-Security-Policy-Report-Only` (img-src https: сохранён), заголовки покрыты тестом, а браузерный сценарий доказывает одобренные фреймы и статичную заглушку отказавшего хоста; enforcement, физический LAN и опубликованный HTTPS остаются BLOCKED.

## Что сделано

- **Task 1 (3d7987a):** кандидат в `next.config.ts`; `lib/security-headers.test.ts` проверяет оба CSP-заголовка, точные значения referrer/nosniff/frame/permissions/COOP/HSTS, что кандидат не расширяет enforced ни в одной директиве, и разницу локального HTTP E2E и Netlify-сборки (`upgrade-insecure-requests`). `20-MEDIA-CSP.md` содержит инвентарь хостов и disposition.
- **Task 2 (831696a):** в `media-states.spec.ts` четыре новых теста: заголовки документа без CSP-события, фреймы «Устав» и «Таблица» под `frame-src`, отказавший хост изображения (тот же `boundingBox`, нет анимаций, имя на месте), и явный BLOCKED для CR-01.

## Результаты проверок

- `node --experimental-strip-types --test lib/security-headers.test.ts`: 7 из 7 пройдены (вместе с `lib/e2e-diagnostics.test.ts`: 10 из 10).
- `npm run test:e2e -- --retries=0 --workers=1 tests/e2e/specs/media-states.spec.ts`: 34 пройдено, 5 skipped (BLOCKED, см. ниже), 1 упал: `webkit-phone` «never answers 15s» (существовал до плана, см. Deferred).
- Широкий прогон chromium-desktop + firefox-desktop по visitor, app-states, desktop-windows, media-offscreen, media-states: 80 пройдено, 0 записей `csp`; 3 падения не связаны с CSP.
- `tsc --noEmit` и eslint по изменённым файлам чистые.

## Отклонения от плана

**1. [Rule 3 - Blocking] WebKit-уведомление о report-only без report-to**
- **Найдено в:** Task 2 (полный прогон всех проектов).
- **Проблема:** WebKit пишет console error «delivered in report-only mode, but does not specify a report-to; the policy will have no effect» на каждой странице, и diagnostics-фикстура валила бы все webkit-phone тесты.
- **Решение:** одна строка allowlist (точный текст, project `webkit-phone`, STAB-SEC-03, истекает 2027-01-31) в `tests/e2e/fixtures/diagnostics.ts` вместо новой конечной точки сбора. Смена кандидата ломает строку громко и требует пересмотра. Побочно: WebKit кандидат не наблюдает, наблюдают Chromium и Firefox.
- **Файл вне списка плана:** `tests/e2e/fixtures/diagnostics.ts`. **Коммит:** 3d7987a.

**2. [Rule 1 - Bug] WebKit-формулировка ошибки изображения**
- В `forgiveImageFaults` добавлена формулировка WebKit «Cannot load image ... due to access control checks» рядом с «Failed to load resource». **Коммит:** 831696a.

**3. Компонент не менялся.** `components/portia-desktop-media.tsx` уже даёт статичную заглушку, подпись и точный русский текст без смены размеров (D-07); добавлять код не требовалось, поведение закреплено тестом.

## Не доказано (BLOCKED / LIMITATION, не PASS)

- PC/phone UAT по LAN (D-05, D-08): не проводился; tightening и перевод кандидата в enforcement запрещены.
- Опубликованные HSTS и `upgrade-insecure-requests` (D-14): LIMITATION; HTTP/LAN их не доказывает.
- Нулевой результат report-only для YouTube-блоков, GIF-хостов и Roblox-аватаров: BLOCKED (DATA), на цели нет данных.
- Phase 19 CR-01 (обложки свёрнутого «Справочника»): остаётся открытым, evidence в 19-19; в `media-states.spec.ts` skip с пометкой BLOCKED. Этот план его не закрывает.
- Skipped 5: это CR-01-запись по одному разу на каждый из 5 проектов; не засчитано как PASS.

## Deferred Issues

См. `deferred-items.md`: нестабильный `webkit-phone` тест 15 с (воспроизводится и без Report-Only заголовка, то есть до 20-08) и три диагностических падения чужих спеков без записей `csp`.

## Known Stubs

None.

## Threat Flags

None: новых конечных точек и путей доступа к файлам нет; T-20-08 выполнен (img-src https: не сужен, report-only не включён как enforcement); T-20-SC: пакеты не устанавливались.

## Self-Check: PASSED

- FOUND: next.config.ts, lib/security-headers.test.ts, tests/e2e/specs/media-states.spec.ts, tests/e2e/fixtures/diagnostics.ts, 20-MEDIA-CSP.md, deferred-items.md
- FOUND commits: 3d7987a, 831696a
