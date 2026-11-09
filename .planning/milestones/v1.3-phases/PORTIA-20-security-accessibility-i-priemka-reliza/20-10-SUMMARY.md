---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 10
subsystem: security
tags: [asvs-l1, security-matrix, npm-audit, d-33, release-ledger, fail-closed-verify]
requires:
  - phase: PORTIA-20
    provides: 20-08 CSP report-only candidate, 20-09 projection evidence, 20-17 and 20-18 fixes of carried-over 19-REVIEW findings
provides:
  - "20-SECURITY-MATRIX.md: ASVS L1 coverage of eight areas, 17 findings with severity, evidence, status and owner, release ledger, no unresolved high"
  - "20-DEPENDENCY-AUDIT.md/.json: production audit 0 findings, 16 dev moderate findings each with exactly one disposition, carried-risk ledger for release notes"
  - "scripts/phase20-audit-check.mjs: --capture and fail-closed --verify (stale commit or manifest hash, missing, duplicate or masked dev disposition, production finding, unresolved high)"
  - "D-33 section: WR-03, WR-05, IN-01..IN-05 one row each, mirrored in 19-REVIEW-DISPOSITION.md"
affects: [20-15, 20-13, 20-21, 20-24, STAB-SEC-05, STAB-SEC-06]
status: complete
actuals:
  tokens: 23000
  tasks: 3
  commits: 4
commits: 4
plan_head_before: f25b885fcf4ca61f10e1511433b7b1ac52206a74
plan_head_after: 33dfb4a4aca073149e1cbf746c6dd68cf0988adc
tech-stack:
  added: []
  patterns:
    - "Markdown evidence parsed by section and table in a node test; fixtures prove that missing, duplicate, open and stale inputs are rejected"
    - "Audit report bound to a commit by ancestry plus sha256 of line-ending-normalized package.json and package-lock.json"
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-SECURITY-MATRIX.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-DEPENDENCY-AUDIT.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-DEPENDENCY-AUDIT.json
    - scripts/phase20-audit-check.mjs
    - lib/security-matrix.test.ts
  modified:
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-REVIEW-DISPOSITION.md
key-decisions:
  - "No high or critical finding was found; none was lowered. Nine medium findings go to the release ledger (D-09); STAB-SEC-06 wording is prepared in 20-DEPENDENCY-AUDIT.md for 20-15."
  - "register_attempt (STATE blocker): no caller in the app, purpose unconfirmed, revoke recommended; recorded as medium SEC20-03, migration not written or applied in this plan."
  - "IN-05 is a disposition under D-09 (production cannot be checked, D-14), not a silent close."
requirements-completed: []
requirements-partial:
  - "STAB-SEC-05: evidence delivered here; the shared-ID gate (requirements.ready-ids) blocks the mark because 20-13, 20-21 and 20-24 also declare it. Not marked by this plan."
  - "STAB-SEC-06: release notes are 20-15; this plan only supplies the risk ledger. Stays Pending."
coverage:
  - id: C1
    description: "Deep review and local ASVS L1 matrix over auth, API, RLS, headers, CSP, uploads, secrets, dependencies with finding ID, severity, evidence, status and owner; no unresolved high"
    requirement: STAB-SEC-05
    verification:
      - kind: unit
        ref: "lib/security-matrix.test.ts (32 tests)"
        status: pass
    human_judgment: true
    rationale: "Static review by the executor, no second reviewer and no new Postgres run; completeness of the finding list is a judgment, only its structure is machine-checked"
  - id: C2
    description: "Production audit clean; full audit stored and every dev advisory has exactly one disposition; stale, missing, duplicate and masked inputs are rejected"
    requirement: STAB-SEC-05
    verification:
      - kind: other
        ref: "node scripts/phase20-audit-check.mjs --verify"
        status: pass
      - kind: unit
        ref: "lib/security-matrix.test.ts audit fixtures"
        status: pass
    human_judgment: false
  - id: C3
    description: "D-33: seven carried-over 19-REVIEW findings with one row each (six fixed with commit and test, IN-05 disposition) mirrored in 19-REVIEW-DISPOSITION.md"
    requirement: STAB-SEC-05
    verification:
      - kind: unit
        ref: "lib/security-matrix.test.ts D-33 tests"
        status: pass
    human_judgment: false
duration: 35min
completed: 2026-11-04
---

# Phase 20 Plan 10: Deep review, security matrix and dependency audit Summary

Local ASVS L1 matrix with 17 findings and no high, production `npm audit` clean, 16 dev moderate advisories each carrying one disposition checked by a fail-closed script, and all seven carried-over 19-REVIEW findings (WR-03, WR-05, IN-01..IN-05) recorded once as fixed with commit and test or as a D-09 disposition.

## Что сделано

**Task 1 (aa39a4f).** `20-SECURITY-MATRIX.md`: прочитаны все 10 `app/api/**/route.ts`, `owner-login/actions.ts`, `proxy.ts`, `lib/supabase/*`, `lib/editor-access.ts`, `lib/image-upload.ts`, `lib/portia-device-binding.ts`, `next.config.ts` и baseline SQL (grants, RPC, политики); опора на receipts Phase 16 без выдачи статического чтения за новый Postgres PASS. 17 находок: 0 high, 9 medium (release ledger), 6 low, 2 info. `lib/security-matrix.test.ts`: пустая матрица, статус `open`, high без blocker, medium вне реестра, пропущенная область, несуществующий путь отвергаются.

**Task 2 (59f90d2, 264c5ce).** `scripts/phase20-audit-check.mjs --capture` запускает `npm.cmd audit --omit=dev --json` и `npm.cmd audit --json` на одном commit (отказ при грязных manifest-файлах и при смене HEAD) и сохраняет нормализованные находки. `--verify` сверяет JSON, markdown и дерево. Результат на commit `59f90d2`: production exit 0, 0 находок; полный audit exit 1, 16 moderate (один advisory `GHSA-g3hv-75wg-m249` в minimatch и 15 транзитивных пакетов ESLint-цепочки), все `accepted` как dev-only. `package.json` и `package-lock.json` не менялись, `npm audit fix` не запускался.

**Task 3 (33dfb4a).** Раздел «Перенесённые находки 19-REVIEW (D-33)»: WR-03 (`2bb0b38`), WR-05 и IN-03 (`062f256`), IN-01 (`87d7769`), IN-02 и IN-04 (`a8a0395`) fixed с именами тестов; IN-05 disposition по D-09. В `19-REVIEW-DISPOSITION.md` изменены только эти 7 строк и строка легенды (`disposition-20` добавлен). Диапазон `264c5ce..HEAD`: 8 строк добавлено, 8 удалено.

## Значимые находки (все medium идут в релизный отчёт по D-09)

- SEC20-03 и SEC20-04: анонимные RPC `bind_device`, `register_attempt` без вызывающего и прямой `submit_request` (обход проверки ростера маршрута). Рекомендован forward-only revoke; не применён.
- SEC20-08: любой редактор пишет и удаляет объекты `portia-media`; решение владельца (MEDIUM-8 Phase 16) не получено.
- SEC20-12: CSP сохраняет `unsafe-inline` и `img-src https:`, enforcement кандидата заблокирован до PC/phone UAT (D-05).
- SEC20-16 и SEC20-17: подделываемый начальный режим теста и привязка устройства без аппаратной аттестации (материал для STAB-SEC-06).
- SEC20-02 (low, найдено в этом review): `PUT /api/content`, `/api/employees`, `/api/editors` отвечают 403 вместо 503 при сбое проверки прав (класс WR-03, fail-closed, не исправлялось).

## Verification

- `node --experimental-strip-types --test lib/security-matrix.test.ts`: 32 pass, 0 fail.
- `node scripts/phase20-audit-check.mjs --verify`: exit 0.
- `npm test`: 1209 tests, 1206 pass, 0 fail, 3 skipped. `npm exec tsc -- --noEmit`: чисто. ESLint по новым файлам: 0 замечаний.
- Acceptance Task 3: `grep -cE "^\| (WR-03|WR-05|IN-0[1-5]) "` по матрице = 7; тот же шаблон с `open|phase-20` по 19-REVIEW-DISPOSITION.md = 0 (baseline 7).

## Deviations from Plan

**1. [Rule 1 - Bug] Привязка отчёта к commit.** План требует «сверять commit с HEAD». Строгое равенство невозможно: коммит самого отчёта сдвигает HEAD, а параллельная сессия Phase 19 коммитит в ту же ветку. `--verify` проверяет, что записанный commit — предок HEAD, и сравнивает sha256 `package.json` и `package-lock.json` с рабочим деревом; смена любого манифеста делает отчёт устаревшим. Файлы хешируются с нормализацией CRLF после первого снимка (`264c5ce`), чтобы значение не зависело от autocrlf.

**2. ID dev-находок.** `npm audit` даёт один advisory на 16 затронутых пакетов, поэтому ID: GHSA для собственного advisory, `via:<пакет>` для транзитивных узлов. Каждый ID требует ровно одну строку disposition.

**3. Требования не отмечены.** `requirements.ready-ids` блокирует STAB-SEC-05 (20-13, 20-21, 20-24 тоже декларируют его) и STAB-SEC-06 (закрывается release notes в 20-15). `requirements-completed` пуст. В `REQUIREMENTS.md` STAB-SEC-05 уже стоит `[x] Complete` с коммитов 20-17/20-18 при незавершённых 20-13, 20-21, 20-24; это не менялось.

**Total deviations:** 1 auto-fixed (Rule 1), 2 заметки. **Impact:** содержание плана выполнено; семантика «stale» уточнена.

## Не доказано (BLOCKED / LIMITATION)

- Новое выполнение RPC, политик и grants под Postgres: BLOCKED (используются receipts Phase 16 и статика).
- Опубликованный HTTPS (HSTS, upgrade-insecure-requests): LIMITATION по D-14.
- Роль reviewer на staging, статус-тело участника по реальному нику, физические PC/phone UAT, enforcement CSP: BLOCKED.
- Review выполнен одним исполнителем, без второго независимого ревьюера; `supabase-rls-reviewer` не запускался, SQL не менялся.

## Known Stubs

None.

## Threat Flags

None: новых конечных точек, файловых путей и схем нет; T-20-10 (high не понижались, hardware attestation не обещана), T-20-21 (тест отвергает пропуск, дубль, open, fixed без теста), T-20-SC (пакеты не устанавливались).

## Self-Check: PASSED

- Файлы существуют: 20-SECURITY-MATRIX.md, 20-DEPENDENCY-AUDIT.md, 20-DEPENDENCY-AUDIT.json, scripts/phase20-audit-check.mjs, lib/security-matrix.test.ts, 19-REVIEW-DISPOSITION.md.
- Коммиты в HEAD: aa39a4f, 59f90d2, 264c5ce, 33dfb4a.
