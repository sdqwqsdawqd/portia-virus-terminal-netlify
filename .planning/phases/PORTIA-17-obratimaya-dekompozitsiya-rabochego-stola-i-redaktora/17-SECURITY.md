---
phase: "17"
slug: "obratimaya-dekompozitsiya-rabochego-stola-i-redaktora"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (17-01..17-08 `<threat_model>`); verified at ASVS L1 (grep-depth + guard tests), auditor not spawned per short-circuit rule.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| рабочее дерево → git-коммит increment | перенос кода в продукт; изменение строки при «переносе» меняет поведение | исходный код |
| локальный Playwright → утверждённые снимки | прогон может переписать эталонные PNG | визуальные эталоны |
| редактор → /api/uploads | загрузка картинки только через колбэк onUpload из PortiaEditor | файлы пользователя |
| части досье → конструктор 17.1 | модуль без сервера; серверная логика дала бы путь записи | контент досье |
| публичный контент → рендер досье | тексты и медиа-ссылки рендерятся в DOM | публичный контент |
| ввод редактора → contentEditable | текст и стили пользователя рендерятся в DOM поля | ввод редактора |
| localStorage → позиция панели | сохранённое смещение читается при открытии | смещение панели |
| участник квалификации → рабочий стол / окно «Повышение» | антисписывание: нельзя открывать другие окна и управлять locked-окном | состояние квалификации |
| сторонние документы → вкладка PORTIA | iframe исполняет чужие скрипты | сторонний контент |
| исполнитель → доказательства фазы / локальные секреты | SUMMARY/disposition определяют закрытие STAB-DESK-01; preflight требует NEXT_PUBLIC_SUPABASE_* | доказательства, секреты |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-17-01 | Tampering | increment Phase 17 | medium | mitigate | `scripts/phase17-move-parity.mjs` (exit 1 на изменённую строку), запускался в verify планов-переносов | closed |
| T-17-02 | Information disclosure | phase17-move-parity.mjs, lib/component-source.ts | low | mitigate | ни один из файлов не обращается к `.env*` (grep `env` = 0) | closed |
| T-17-03 | Tampering | tests/e2e/visual/__screenshots__ | high | mitigate | `git diff 55f51d6..HEAD -- tests/e2e/visual/__screenshots__` пуст | closed |
| T-17-04 | Elevation of privilege | components/portia-editor-dossier.tsx | medium | mitigate | `lib/dossier-parts.test.ts` запрещает fetch, /api/, Supabase, ревизии и серверные lib; загрузка только через проп `onUpload` | closed |
| T-17-05 | Information disclosure | ImageEditorField предпросмотр | low | mitigate | `referrerPolicy="no-referrer"` в portia-editor-dossier.tsx | closed |
| T-17-06 | Tampering | FormattedText / embeddedMediaUrl | medium | mitigate | нет `dangerouslySetInnerHTML` в components/*.tsx; `referrerPolicy="no-referrer"` в portia-desktop-dossier.tsx | closed |
| T-17-07 | Elevation of privilege | components/portia-desktop-dossier.tsx | low | mitigate | `lib/dossier-parts.test.ts` (39/39 pass вместе с guard-тестами) | closed |
| T-17-08 | Tampering | renderRichTextEditor / FormattedTextarea | medium | mitigate | перенос байт-в-байт под parity-инструментом; HTML-строк нет | closed |
| T-17-09 | Tampering | localStorage `portia-format-panel-v1` | low | mitigate | ключ в `components/portia-editor-rich-text.tsx:618`, закреплён `lib/portia-desktop.test.ts:142` | closed |
| T-17-10 | Elevation of privilege | openApp / focusApp при qualificationLocked | medium | mitigate | первая инструкция обеих — `if (qualificationLocked && appId !== "promotion") return;` (portia-desktop.tsx:747, 840) | closed |
| T-17-11 | Denial of service | exitTimers при повторном открытии | low | mitigate | отмена exitTimers не менялась (17-05 SUMMARY); e2e window-reopen (а)-(б) — подтверждено владельцем в 17-UAT | closed |
| T-17-12 | Elevation of privilege | AppWindow `locked` | medium | mitigate | `locked` блокирует drag/resize (строки 94, 117), `role="dialog"`/`aria-modal`; `lib/portia-qualification-ui.test.ts` pass | closed |
| T-17-13 | Elevation of privilege | iframe sandbox (embedSandbox) | high | mitigate | ровно два iframe в portia-desktop-documents.tsx, оба `sandbox={embedSandbox}`; значение без `allow-top-navigation` | closed |
| T-17-14 | Denial of service | слушатели масштаба | low | mitigate | 5 addEventListener / 5 removeEventListener в portia-desktop-documents.tsx; тест ZOOM-01 | closed |
| T-17-15 | Repudiation | 17-08-SUMMARY.md, 17-REVIEW-DISPOSITION.md | medium | mitigate | агентский прогон записан `BLOCKED (ENV)` с выводом preflight, не как pass (17-08-SUMMARY.md:59); владельческий pass отдельно помечен в 17-UAT | closed |
| T-17-16 | Information disclosure | обход preflight Playwright | medium | mitigate | `.env*` не читались, переменные не задавались вручную; `.claude/hooks/guard.mjs` | closed |
| T-17-SC | Tampering | npm installs | low | mitigate | `git diff 55f51d6..HEAD -- package.json package-lock.json` пуст | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 17 | 17 | 0 | gsd-secure-phase orchestrator (ASVS L1, grep + guard tests) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01
