---
phase: "PORTIA-23"
slug: "vhod-po-niku-povyshenie-i-ego-regressii"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-11-15"
evidence: offline
---

# Phase PORTIA-23 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Источник реестра: блоки `<threat_model>` в 23-01..23-12-PLAN.md (составлены при планировании).
> Все доказательства офлайн: код, текст миграций, тесты (`node --test lib/*.test.ts` на Node 22.13.1: 1929 тестов, 1926 pass, 0 fail, 3 skipped — опциональные live-наборы). Ни одна база, проект Supabase, `.env*`, staging, production или устройство не затрагивались. Live Postgres/RLS, прямые анонимные вызовы RPC, конкуренция, staging/production, браузер и физические устройства остаются BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА — это не PASS.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → /api/access/request, /api/access/editor-request | недоверенные ник, origin, cookie; сервер подписывает поля | ник (личное), токен устройства |
| browser → GET /api/access/status | cookie устройства и сессии Supabase; решение строится на сервере | токен, сессия редактора |
| server → Supabase PostgREST RPC | подпись сервера, digest устройства, ответы и ошибки RPC | HMAC, digest, коды ошибок |
| server → browser (decision JSON) | клиент монтирует рабочий стол только по mode/allowed | решение доступа |
| browser/anon → promotion RPC | прямые вызовы PostgREST в обход HTTP-маршрутов | идентичность участника |
| browser → promotion / bank API | недоверенные nickname/kind/ID/текст | команды банка вопросов |
| local file → template builder/export | недоверенные размеры и имя изображения; только локально | изображение, кадр |
| server → log sink | строка тревоги unauthorized | константный текст без значений |
| browser storage → gate UI | флаг уведомления в localStorage | "1" |
| agent → owner database / evidence | агент пишет только текст; миграции применяет владелец (D-72) | SQL, записи проверок |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-23-01 | Spoofing | request route | high | mitigate | `app/api/access/request/route.ts:14-29` лимит тела, parseNicknameInput, allowlist origin, digest/IP/подпись на сервере; `lib/access-session.ts:57-76` (DB-проверка HMAC офлайн) | closed |
| T-23-02 | Information disclosure | gate/status | high | mitigate | начальный `checking` (`components/portia-access-gate.tsx:26,121`), `app/page.tsx` без desktop (test `access-gate.test.ts:81-85`), no-store + 503 (`status/route.ts:23,26`), editor-first `lib/access-gate.ts:55-58` | closed |
| T-23-03 | Information disclosure | request/status | high | mitigate | нейтральный `unavailable` (foundation SQL `:267,284`), статус только по своему токену; test «submit replies stay neutral» (офлайн) | closed |
| T-23-04 | Denial of service | submit RPC | medium | mitigate | advisory locks и лимиты (foundation SQL `:234-235,258`), `ACCESS_REQUEST_LIMITS` `lib/access-store.ts:43-50` (live конкуренция BLOCKED) | closed |
| T-23-05 | Spoofing | promotion identity/editor request | high | mitigate | `editor-request/route.ts:13-21,38-39`; SQL `requested_by = auth.uid()`; `20261113...:31,35,60-65`; `lib/promotion-participant.ts:20,24` (SQL офлайн) | closed |
| T-23-06 | Elevation of privilege | direct promotion RPC | high | mitigate | `20261113...:213-222` revoke 10 legacy entry points; обёртки с подписью и participant key (`:82-209`); expected-authz anon = 42501 (live BLOCKED) | closed |
| T-23-07 | Tampering | migration/authz parity | high | mitigate | forward-only (нет drop/truncate/delete), fingerprint и authz-пины, RLS-ревью раунды 1–3 | closed |
| T-23-08 | Spoofing | promotion routes | high | mitigate | все participant-маршруты через `resolvePromotionParticipant`; `portia-promotion-api.test.ts:257-261` | closed |
| T-23-09 | Information disclosure | status/UI | high | mitigate | `lib/portia-promotion-api.ts:222` 423 при `denied` до проекции; test `:426` | closed |
| T-23-10 | Repudiation | request cards | medium | mitigate | `portia-promotion.tsx:439-451` успех только после created-ответа, затем loadStatus; `portia-promotion-ui.test.ts:113-121,160-172` | closed |
| T-23-11 | Tampering | bank command | high | mitigate | `requirePromotionReviewer` (`banks/route.ts:33,42`), `parsePromotionBankCommand`, SQL `portia_has_tab_grant('promo')` | closed |
| T-23-12 | Denial of service | bank saves | medium | mitigate | 64 KiB в маршруте и SQL, maxLength 4000, `busy` с `finally` | closed |
| T-23-13 | Tampering | local crop state | medium | mitigate | `normalizeImageFraming` (`lib/image-framing.ts:22-37`), `setTemplateImageFraming` (`portia-template-dossier.ts:228-240`) | closed |
| T-23-14 | Information disclosure | template export | medium | mitigate | нет fetch/supabase/storage в модулях шаблона; тесты import-graph и network-off | closed |
| T-23-15 | Repudiation | evidence ledger | high | mitigate | `23-LIVE-EVIDENCE.md` команда/цель/вердикт по каждой линии; `phase23-evidence.test.ts:42` | closed |
| T-23-16 | Elevation of privilege | direct RPC live gate | high | mitigate | анонимная негативная матрица `expected-authz.json`, RLS23-01 исправлен; live gate не заявлен как PASS (BLOCKED) | closed |
| T-23-17 | Elevation of privilege | missing-closure fallback | medium | mitigate | заменён T-23-22: узкое распознавание `lib/access-gate.ts:21,26-30`, fallback «open» удалён | closed |
| T-23-18 | Spoofing | editor-first branch | high | mitigate | `lib/access-gate.ts:47-58` только `canEdit && !unavailable`; тесты `access-gate.test.ts:34,203,251` | closed |
| T-23-19 | Denial of service | editorAccess на опросе 5 с | low | accept | см. Accepted Risks AR-23-01 | closed |
| T-23-20 | Information disclosure | fallback warning | low | mitigate | константа + `{ sqlState }` через onceWarn (`lib/access-gate.ts:42,44,66`) | closed |
| T-23-21 | Tampering | client bundle | low | mitigate | type-only импорты (`access-gate-view.ts:3`, `portia-access-gate.tsx:5`); test `:397-404` | closed |
| T-23-22 | Elevation of privilege | missing-closure branch | medium | mitigate | `lib/access-gate.ts:59-69` closed/none, недоступный редактор → 503 | closed |
| T-23-23 | Spoofing | гостевая форма у редактора (WR-04) | low | mitigate | `access-gate-view.ts:24-26,33,35` всё требует `!editor`; test `:280` | closed |
| T-23-24 | Information disclosure | текст исключения в форме (WR-03) | low | mitigate | `accessSubmitFailure` (`access-gate-view.ts:59-75`); test `:379-395` | closed |
| T-23-25 | Tampering | тесты и реальный Supabase | low | mitigate | `https://probe.invalid` + injected fetch (`access-gate.test.ts:107-128`) | closed |
| T-23-26 | Denial of service | стоимость опроса 5 с | low | accept | см. AR-23-02 | closed |
| T-23-27 | Elevation of privilege | closure default | medium | mitigate | `20261114...:18,20-21,34` всё ON; set_closure только владелец; `access-closure.test.ts` (офлайн) | closed |
| T-23-28 | Tampering | повторный прогон миграции | low | mitigate | update только при `updated_by is null`; on conflict do nothing (`20261114...:20-25`) | closed |
| T-23-29 | Elevation of privilege | grants closure_enabled() | medium | mitigate | revoke → grant как в foundation (`20261114...:37-39`); authz/fingerprint пины | closed |
| T-23-30 | Repudiation | изменение флага без журнала | low | accept | см. AR-23-03 | closed |
| T-23-31 | Information disclosure | content APIs при закрытии | medium | transfer | передано Phase 25 (SEC-01..05, REQUIREMENTS.md:141-145); владельцу сказано в 23-MIGRATION-APPLY.md:20 | closed |
| T-23-32 | Tampering | непроверенный SQL / устаревшая матрица | high | mitigate | раунды ревью 0046f80 → 12eecb1 → 7cb8702; diff покрытых путей после 7cb8702 пуст; security-matrix и phase23-evidence тесты | closed |
| T-23-33 | Information disclosure | утечка секрета в инструкции | medium | mitigate | только имена; guarded psql insert; проверка `length(secret) >= 32` без select значения | closed |
| T-23-34 | Denial of service | частичное/не то применение | medium | mitigate | backup, read-only pre-check, dry-run, стоп на первой ошибке, порядок (23-MIGRATION-APPLY.md); исполняет владелец | closed |
| T-23-35 | Spoofing | устаревший кэш PostgREST | low | mitigate | `notify pgrst` (`20261114...:41`), HTTP-проверка с повтором при PGRST202; шлюз fail-closed | closed |
| T-23-36 | Repudiation | проверки владельца как pass агента | low | mitigate | всё BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА; тест отвергает PASS | closed |
| T-23-37 | Information disclosure | строка тревоги unauthorized | medium | mitigate | `lib/access-request-reply.ts:10-22` константа; `access-request-reply.test.ts:19-52,74-86` | closed |
| T-23-38 | Denial of service | объём лога при отказах подписи | low | accept | см. AR-23-04 | closed |
| T-23-39 | Information disclosure | флаг уведомления в localStorage | low | accept | см. AR-23-05 | closed |
| T-23-40 | Elevation of privilege | accessGateLayout и флаг | medium | mitigate | `desktop` только из `mode === "open" \|\| allowed` (`access-gate-view.ts:21,29`); хранилище не вход раскладки; тесты `:269-345` | closed |
| T-23-41 | Tampering | матрица после правки маршрута | high | mitigate | коммит матрицы 7cb8702 = раунд 3 ревью; `access-request-reply.ts` в покрытых путях | closed |
| T-23-SC | Tampering | установка пакетов | high (01–07) / low (08–12) | mitigate / accept | `git diff 255ec54 HEAD -- package.json package-lock.json` пуст; для 08–12 см. AR-23-06 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-23-01 | T-23-19 | Анонимный опрос не ходит в Supabase (`lib/editor-access.ts:23`); test: 1 запрос на опрос | план 23-08 (threat model) | 2026-11-15 |
| AR-23-02 | T-23-26 | Бюджет опроса измерен и закреплён тестом (1 / 2 / 4 запроса, без чтения closure) | план 23-09 (threat model) | 2026-11-15 |
| AR-23-03 | T-23-30 | Переключения закрытия не журналируются (Phase 21 D-07); `updated_at` и история миграций фиксируют время | план 23-10 (threat model) | 2026-11-15 |
| AR-23-04 | T-23-38 / RLS23-07 | Тревога пишется только при уже сломанной конфигурации; строка короткая и константная; ограничение лога спрятало бы тревогу | план 23-12, ревью раунд 3 | 2026-11-15 |
| AR-23-05 | T-23-39 | Флаг хранит только "1", ошибки хранилища = нет уведомления | план 23-12 (threat model) | 2026-11-15 |
| AR-23-06 | T-23-SC (08–12) | Пакеты не устанавливались | планы 23-08..23-12 | 2026-11-15 |
| AR-23-07 | RLS23-05 | Ручной повторный прогон 20261114 после внеполосного OFF; предупреждение в 23-MIGRATION-APPLY.md | ревью раунд 2 (low, accepted) | 2026-11-15 |
| AR-23-08 | RLS23-08 | Тело 503 содержит `unauthorized`, одинаково для любого ника | ревью раунд 3 (low, accepted) | 2026-11-15 |

*Accepted risks do not resurface in future audit runs.*

**Transfer:** T-23-31 → Phase 25 (SEC-01..05): `/api/content` и `/api/employees` GET публичны до Phase 25; seed-контент (`defaultPortiaContent`) всё ещё в клиентском бандле шлюза (`portia-access-gate.tsx:8`) → Phase 25 SEC-03.

**Ниже порога, не блокирует (информационно):**
- RLS23-04 (medium): HMAC действия теста (`20261113...:152`) не связывает `p_title_id`, ответ, nonce и режим; подпись только серверная, окно 5 минут. Относится к T-23-06.
- WR-01: `app/api/promotion/test/route.ts` без try/catch → голый 500 (open в 23-REVIEW-DISPOSITION.md).
- WR-05: editor-request заменяет гостевой cookie — намеренно (T-23-05).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 42 | 42 | 0 | gsd-security-auditor (ASVS L1, offline) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15 (агент, офлайн; live-линии BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА)
