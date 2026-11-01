# Phase 16: Канонический Supabase staging и SQL-истина - Research

**Researched:** 2026-11-01
**Domain:** Supabase (Postgres/RLS/RPC/Auth/Storage), канонические миграции, schema fingerprint, live concurrency/role-suite на изолированной цели
**Confidence:** HIGH по состоянию репозитория; MEDIUM по поведению hosted Supabase (в этой сессии нет живой цели, ничего не выполнялось); LOW по состоянию production-схемы (не наблюдаемо без owner-run запроса)

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md отсутствует: владелец выбрал планирование без `/gsd-discuss-phase`. Ниже ограничения, которые заменяют CONTEXT.md (источники: запрос оркестратора, `CLAUDE.md`, ROADMAP Phase 16). Решения владельца, которых нет, вынесены в раздел «Open owner decisions» и не считаются принятыми.

### Locked Decisions
- Никакого production Supabase, реальных secret keys и service-role credentials. Production не мутируется. Изменения БД только в изолированный test branch/project.
- Реальные `.env*` не читать и не печатать (`.env.example` можно).
- Не изменять, не stage-ить, не коммитить owner-пути: `.planning/milestone.lock`, `.planning/forensics/`, `.planning/milestones/v1.2-incomplete-research/`, `.planning/quick/261028-c9g-portia-promotion-1-8/`, `.planning/ui-reviews/`.
- Stage только по явным путям (`git add -A`, `git add .`, `git stash`, `git clean`, `git reset --hard` запрещены).
- BLOCKED-доказательства не записывать как pass. Authenticated roles, Postgres/RLS execution, staging/production и физические устройства остаются BLOCKED, пока их не докажет фаза.
- Figma и Codex Security удалены из плана и не возвращаются.
- Для любых изменений `supabase/*.sql`, RLS, RPC, storage policies в планах обязателен прогон агента `supabase-rls-reviewer`.
- Acceptance gate ROADMAP: «Live mutating staging-run и schema fingerprints обязательны; наличие SQL в Git или read-only inventory не считается прохождением.»

### Claude's Discretion
- Структура `supabase/migrations/`, способ вычисления fingerprint, дизайн live-suite и fixtures, декомпозиция на планы, выбор между вариантами изолированной цели (с рекомендацией, но финальное решение за владельцем).

### Deferred Ideas (OUT OF SCOPE)
- Не записаны (CONTEXT.md нет). Из ROADMAP: Phase 17 (декомпозиция), Phase 18 (motion/visual replace), Phase 19 (полный Promotion flow на staging), Phase 22 (физические PC/phone UAT) не входят. Visual/motion/pixel-baseline работа не входит.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Next.js App Router, React 19, TS, Tailwind 4, `@supabase/ssr`, Netlify. Владелец пишет по-русски, отвечать по-русски.
- Хук `.claude/hooks/guard.mjs` блокирует Bash/PowerShell-команды, текст которых совпадает с `/service[_-]?role/i` (и любое касание `.env*`, `git add -A`, owner-путей). Реальный факт этой сессии: «Blocked by project guard: service_role credentials are forbidden in this project.» Следствие для планов: любая команда, в тексте которой есть это слово, не может быть запущена агентом по дизайну; mutating live-run с admin-ключом запускает владелец в своём терминале.
- Команды: `npm test` (`node --experimental-strip-types --test lib/*.test.ts`), `npm exec tsc -- --noEmit`, `npm run lint`, `npm run build`; visual manifest: `--verify-promotion` да, `--verify` (режим по умолчанию) никогда.
- Референсный Node 22.13.1 (может лежать в `%TEMP%\portia-node-v22.13.1\...`); машинный Node 24.21.0. [VERIFIED: `node --version` = v24.21.0; `ls $TEMP` содержит `portia-node-v22.13.1`]
- Любые SQL/RLS/RPC/storage изменения: агент `supabase-rls-reviewer` (read-only, Read/Grep/Glob; всё, что требует живого Postgres, он обязан помечать BLOCKED). [VERIFIED: `.claude/agents/supabase-rls-reviewer.md`]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAB-SEC-01 | Anon, authenticated, editor, reviewer и owner видят и изменяют только разрешённые данные; запрещённые UI/API/table/RPC действия fail-closed, revoke действует без rebuild. | Каталожная role×surface матрица (раздел «Role/RLS matrix»), live-suite на PostgREST/GoTrue с настоящими JWT, Playwright revoke-lane через `/api/access`, живая проверка, что revoke действует на уже выданный JWT (политики читают `portia_editors` в момент запроса). |
| STAB-SEC-04 | Staging и production schema fingerprints, functions, grants и RLS соответствуют canonical migrations; ручной production step имеет записанный postflight. | Read-only fingerprint SQL (один SELECT, детерминированный, `pg_catalog`), golden-файл, сравнение fresh vs upgrade vs staging vs production; production-прогон только owner-run. |
| STAB-REL-04 | Fresh isolated Supabase строится canonical migrations; role/RLS/RPC и concurrent claim/admission/CAS/cleanup tests проходят на disposable fixtures. | `supabase/migrations/` baseline + forward-only, guarded apply-wrapper, расширение существующего `lib/portia-promotion-live.test.ts`, run-scoped fixtures с cleanup receipt и sweep. |
</phase_requirements>

## Summary

В репозитории три SQL-файла, а не одна истина. `supabase/portia_setup.sql` (1676 строк, один `begin; ... commit;`) уже является надмножеством: его promotion-часть побайтно совпадает с телом `supabase/phase14_apply.sql` (diff от строки «-- Promotion application» отличается только блоком Media/storage в setup и блоком POST-APPLY ASSERTIONS/ROLLBACK GUIDANCE в apply). `phase12_apply.sql` — owner-runbook (STEP 0..4: preflight-select'ы, STEP 2 apply, STEP 2b validate, STEP 3 check, STEP 4 rollback) и нужен как путь обновления, а не как источник схемы. Реальный задокументированный дрейф: коммит `cc48ec8` заменил `set search_path = public` на `set search_path = ''` во всех helper-функциях ПОСЛЕ ранних owner-запусков, а `phase14_apply.sql` helper'ы не переопределяет (только проверяет `to_regprocedure`). Что именно применено в production, из репозитория не узнать ([ASSUMED] A1) — это и есть смысл STAB-SEC-04.

Главная ловушка выбора цели: Supabase branch не равен «fresh из canonical migrations». Dashboard-branch «reads your base project's migration history … If there's no migration history, the branch uses a schema dump of the base project», то есть клонирует (дрейфующую) production-схему; GitHub-интеграция запускает миграции репозитория, но «changes pushed to `main` are automatically deployed to your project» — это канал мутации production, противоречащий hard rules. Branching только на Pro ($25/мес) плюс ≈$0.01344/ч за ветку (≈$9.7/мес всегда включённая). Рекомендуемая цель: отдельный hosted Supabase project (Free: до 2 активных проектов, пауза после недели неактивности) — полностью развязан с production, с собственными ключами, `https://<20-символьный-ref>.supabase.co` (ровно то, что требует существующий `target-guard.ts`). Локальный стек (Docker + CLI) — полезный внутренний цикл, но Docker на машине отсутствует, а `target-guard.ts`/preflight отвергают `http://127.0.0.1`.

Вторая ловушка — Supabase breaking change 30 октября 2026: новые таблицы в `public` больше не получают default-grants для `anon`/`authenticated`/`service_role`, существующие объекты сохраняют гранты. Fresh-проект из тех же миграций получит иные ACL (прежде всего `service_role` и sequences), чем legacy production. Поэтому «grants» в fingerprint нельзя выводить из default privileges: либо canonical-миграция делает нужные гранты явными (рекомендация), либо fingerprint сравнивает только явные PUBLIC/anon/authenticated и калибруется первым прогоном.

**Primary recommendation:** Сделать `supabase/migrations/` единственной deployable историей (baseline = текущий `portia_setup.sql` без `begin/commit`, затем forward-only), заморозить `portia_setup.sql`/`phase12_apply.sql`/`phase14_apply.sql` как байт-стабильные fixtures пути обновления (их читают 4 текстовых теста), доказывать равенство read-only fingerprint (`pg_catalog`) на трёх путях (fresh canonical, upgrade-ladder, staging) на отдельном hosted проекте, а mutating live-run (роли + конкурентность + cleanup receipt) выполнять владельцу в своём терминале (checkpoint:human-action), агент готовит код, wrapper-guard и проверяет редактированные receipts.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Авторизация чтения/записи (editor/owner/reviewer) | Database (RLS + `security definer` helpers) | API route (`getEditorAccess`) | Правила живут в `portia_can_edit/_tab/_is_owner/_has_tab_grant`; сайт и политики не должны расходиться (`lib/editor-access.ts`). |
| Атомарность claim/admission/CAS/lease | Database (RPC, advisory locks, partial unique indexes, `FOR UPDATE`) | — | Конкурентность решается в Postgres; TS не должен дублировать state machine. |
| Revision CAS контента | API route (`PUT /api/content`: `update ... eq("revision", baseRevision)`) | Database (PK, RLS) | Выигрыш определяет условный UPDATE/INSERT с кодом 23505; проверяется через HTTP. |
| Ограничение разделов контента для restricted editor | API route | — | Принятый риск D-11: БД не проверяет разделы; матрица обязана фиксировать «allowed at DB level», а не «denied». |
| Fingerprint схемы | Database (read-only SELECT по `pg_catalog`) | Node comparator (offline) | Только каталог знает реальную схему; сравнение и golden — чистая функция. |
| Isolated target + secrets | Operator (owner shell/Dashboard) | Next.js build env | Ключи и DB password не попадают к агенту; хук `guard.mjs` это обеспечивает. |
| Server-derived session proof (WR-01) | API route `/api/access` (server boundary) | Playwright fixture | Единственный server-derived источник `{canEdit, canManageEditors, openTabs}`. |
| Идентичности и cleanup fixtures | Test harness (admin API на изолированной цели) | Database (RPC cleanup) | Только harness создаёт/удаляет disposable users; receipts доказывают отсутствие остатка. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase` (CLI, dev-dep) | 2.122.0, exact [WARNING: flagged as suspicious (too-new, 9 дней) — verify before using] | `migration new`, `db push --db-url`, `db query --remote=<url> --read-only -f`, `migration list`, опционально `start/db reset` | Уже выбран milestone-исследованием (`.planning/research/STACK.md:14,69`); npm: `bin dist/supabase.js`, зависимости `jose`, `eciesjs`, `scripts.postinstall` отсутствует, repo `github.com/supabase/cli`, 7.85M скачиваний/нед [VERIFIED: npm view + gsd package-legitimacy]. Verdict SUS только по причине `too-new`. |
| `@supabase/supabase-js` | 2.117.3 (уже в `package.json`) | Клиенты live-suite, `auth.admin.*` на изолированной цели | Уже используется в `lib/portia-promotion-live.test.ts`; `@supabase/ssr` 0.12.7 остаётся. |
| `node:test` + `--experimental-strip-types` | Node 22.13.1 | Offline unit tests (comparator, parity, guard) и env-gated live suite | Конвенция проекта (`npm test`). |
| `@playwright/test` | 1.64.1 (уже есть) | Role lanes `tests/e2e/specs/roles.spec.ts` | Уже есть; нужен производитель proof. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg` | 8.23.1 (OK по legitimacy) | Две прямые сессии для детерминированного lock-barrier теста | Только если владелец даст DB URL; НЕ требуется для baseline-плана (HTTP-уровень конкурентности достаточен). Не в `node_modules` сейчас. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Отдельный hosted project | Supabase branch | Pro-only, связан с production-проектом и его migration history/dump, GitHub-интеграция = канал деплоя в production. Не рекомендуется. |
| Отдельный hosted project | Local `supabase start` (Docker) | $0 и мгновенный reset, но Docker отсутствует; guard требует https+`supabase.co`; не доказывает hosted-поведение. Хорош как опциональный dev-loop. |
| Read-only fingerprint SQL | `supabase db diff` / `pg_dump --schema-only` | Нужны Docker/`pg_dump` (оба отсутствуют), вывод шумный (owners, OID-зависимый порядок), не production-friendly. |
| Каталожный SQL-SELECT | pgTAP (`supabase test db`) | Нужен `pgtap` + helpers, транзакционный rollback скрывает commit-time конкуренцию; не доказывает PostgREST/GoTrue путь. Не нужен. |
| Hosted live-suite | PGlite (WASM Postgres) | Нет `pg_cron` (миграция делает `create extension if not exists pg_cron;`, [ASSUMED] A14), одна сессия = нет конкуренции, правка SQL для запуска ломает «canonical». Отвергнуто. |

**Installation (после human-verify из-за SUS):**
```bash
npm install --save-dev --save-exact supabase@2.122.0
```

**Version verification:** `npm view supabase version` -> 2.122.0, `time.modified 2026-10-30`, `2.122.0` опубликована 2026-10-23, предыдущая 2.121.0 — 2026-10-14. `npm view pg version` -> 8.23.1. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| supabase | npm | версия 2.122.0 — 9 дней, пакет многолетний | ~7.85M/нед | github.com/supabase/cli | SUS (`too-new`) | Flagged — planner обязан поставить `checkpoint:human-verify` перед `npm install` (или закрепить 2.121.0 по решению владельца) |
| pg | npm | многолетний (8.23.1, 2026-09-30) | ~90.5M/нед | github.com/brianc/node-postgres | OK | Approved, но только как опциональная зависимость (см. Supporting) |
| @electric-sql/pglite | npm | версия 0.5.14 — 1 день | ~36M/нед | github.com/electric-sql/pglite | SUS (`too-new`) | НЕ рекомендуется (отвергнут по техническим причинам); не устанавливать |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `supabase` (planner вставляет checkpoint:human-verify), `@electric-sql/pglite` (не используется)

*Имя пакета `supabase` подтверждено Context7 (`/supabase/cli`, версии v2.122.0 в списке) и milestone STACK.md; `scripts.postinstall` для 2.122.0 не задан.*

## Architecture Patterns

### System Architecture Diagram

```text
 git: supabase/migrations/*.sql  ──(1) guarded apply wrapper──►  ISOLATED hosted project  (fresh)
        │   (baseline = portia_setup body                          │
        │    + forward-only)                                       ├─(2) fingerprint.sql (read-only) ─► F.json
        │                                                          │
 git: supabase/upgrade-fixtures/ ─(3) teardown PORTIA objects      │
   legacy L0 (8508d71 setup)       (== pristine fp) then apply ──► same project (upgrade ladder)
   + phase12 STEP 2/2b                                             ├─(4) fingerprint.sql ───────────► U.json
   + phase14_apply.sql                                             │
                                                                   │   Node comparator (offline): F == U ?  F == golden ?
 owner (Dashboard SQL Editor, READ-ONLY) ──► production ──────────►└── P.json pasted by owner ──────► F == P ?  (STAB-SEC-04 postflight)

 owner shell (keys only in env)           ┌──────────────────────────────────────────────────────┐
  npm run test:staging-live ─────────────►│ target-guard + app-binding + JWT iss host attestation │
                                          └───────────────┬──────────────────────────────────────┘
                                                          ▼
          harness: admin API creates run-scoped identities (owner*, editor, restricted editor, promo reviewer A/B, outsider)
                   │                                     (* owner email = canonical portia_owner_email(), см. D4)
                   ├─ role/RLS/RPC matrix  (anon | outsider | editor | restricted | reviewer | owner) via PostgREST/Storage/RPC
                   ├─ concurrency rounds   (Promise.all N contenders × R rounds: claim, admission, answer CAS, start_test mode, content revision, cleanup)
                   ├─ Playwright lanes     (UI login → /api/access server-probe → opaque proof → role lane → revoke → denied without re-login)
                   └─ cleanup + sweep ───► receipt.json (counts, residual == 0, redacted) ──► owner commits/pastes into evidence
```

### Recommended Project Structure
```text
supabase/
├── config.toml                              # supabase init; [db] major_version = production major (D8)
├── .gitignore                               # supabase/.temp НЕ коммитить; никогда не link-ить production
├── migrations/
│   ├── <ts>_portia_baseline.sql             # = portia_setup.sql без begin;/commit; (parity test)
│   └── <ts>_portia_explicit_grants.sql      # только если калибровка fingerprint покажет разницу default privileges (D9)
├── portia_setup.sql, phase12_apply.sql, phase14_apply.sql   # ЗАМОРОЖЕНЫ байт-в-байт (читаются 4 тестами)
├── upgrade-fixtures/
│   └── L0_pre_phase12_portia_setup.sql      # git show 8508d71:supabase/portia_setup.sql (269 строк)
├── fingerprint/
│   ├── portia_schema_fingerprint.sql        # read-only SELECT, owner-runnable в production SQL Editor
│   └── expected/<pgmajor>.fingerprint.json  # golden = fingerprint свежей canonical-сборки (после review)
└── teardown/portia_teardown.sql             # drop только PORTIA-объектов; результат == pristine fingerprint
scripts/
├── phase16-staging.mjs                      # guarded wrapper: target-guard ДО любого вызова CLI; apply/fingerprint/teardown
└── phase16-fingerprint-compare.mjs          # offline сравнение секций (+ unit tests на синтетических JSON)
tests/e2e/fixtures/
├── target-attestation.ts                    # app↔target binding, JWT iss host, no external base URL
└── session-probe.ts                         # единственный производитель opaque proof (WR-01)
lib/
└── portia-staging-live.test.ts              # (или расширение portia-promotion-live.test.ts) role/RLS/concurrency/cleanup
.planning/phases/PORTIA-16-.../evidence/     # F/U/P json, run receipt (редактированный), 16-LIVE-RUN.md
```

### Pattern 1: Canonical migrations без поломки текстовых тестов
**What:** `portia_setup.sql`, `phase12_apply.sql`, `phase14_apply.sql` читаются тестами по пути: `lib/portia-sql.test.ts` (`phase12_apply.sql`, `portia_setup.sql`), `lib/portia-promotion-db.test.ts` (setup+apply), `lib/portia-promotion-security.test.ts` (`phase14_apply.sql`), `lib/portia-qualification-ui.test.ts` (`portia_setup.sql`). Перемещение/правка ломает тесты. Поэтому baseline-миграция — копия тела setup, а файлы остаются byte-stable; `lib/` parity-тест доказывает `migration body == setup minus wrapper`.
**When to use:** сразу; любое изменение схемы дальше только новым timestamped forward-only файлом (expand/contract для RPC, см. `.planning/research/ARCHITECTURE.md` «Canonical SQL decision»).
**Example:**
```ts
// Source: паттерн parity; вызывается из lib/portia-canonical-parity.test.ts (нового)
const setup = readFileSync("supabase/portia_setup.sql", "utf8");
const body = setup.replace(/^begin;\s*$/m, "").replace(/^commit;\s*$/m, "");
assert.equal(normalizeEol(readMigration("portia_baseline")), normalizeEol(body));
```
**Tag:** [ASSUMED] A3: CLI оборачивает миграцию сам, поэтому `begin;/commit;` в файле миграции убираем (проверить на первом `db push`).

### Pattern 2: Детерминированный schema fingerprint (pg_catalog)
**What:** один read-only SELECT возвращает jsonb с секциями; каждая секция имеет `sha256`; сравнение показывает diff секции, а не только хеш.
**Что включать (все строки сортируются `collate "C"`, OID/owner/timestamps/ordinals исключены):**
- functions (`public.portia\_%`): имя + `pg_get_function_identity_arguments` (имена параметров = контракт PostgREST named args), `pg_get_function_result`, `prosecdef`, `provolatile`, `proconfig` (`search_path`), `sha256(prosrc)`, ACL по грантополучателям PUBLIC/anon/authenticated/service_role через `aclexplode(coalesce(proacl, acldefault('f', proowner)))`;
- tables/sequences (`public.portia\_%`): `relkind`, `relrowsecurity`, `relforcerowsecurity`, ACL (`acldefault('r'|'s', relowner)` при NULL), column ACL (`attacl`, нужен для `grant update (closed_tabs, granted_tabs)`), колонки по ИМЕНИ (type через `format_type`, notnull, default `pg_get_expr`, identity, generated) БЕЗ `attnum` (порядок колонок отличается между путями); constraints (`pg_get_constraintdef` + `convalidated` — `NOT VALID` у `portia_employee_profiles_photo_url_local` реальное состояние), indexes (`pg_get_indexdef`);
- policies: `pg_policy` для `public.portia\_%` и `storage.objects` c `polname like '%PORTIA%'`: cmd, permissive, роли (polroles `0` = PUBLIC), `pg_get_expr(polqual)`, `pg_get_expr(polwithcheck)`;
- storage bucket `portia-media` (явно выбранные колонки `id, name, public, file_size_limit, allowed_mime_types`, потому что набор колонок `storage.buckets` зависит от версии Storage);
- cron job `portia-promo-cleanup` (`schedule`, `command`, `active`; без `jobid`);
- meta: `server_version_num / 10000` (сравнивать только одинаковый major), список расширений без версий.
**Source of truth для включаемых объектов:** [VERIFIED: supabase/portia_setup.sql, объекты из inventory-скрипта] 20 таблиц (`portia_content`, `portia_editors`, `portia_employee_profiles`, `portia_manual_employees` + 16 `portia_promo_*`), 35 функций (7 helper + 28 `portia_promo_*`), 18 `create policy` (4 на `portia_editors`, 3 на `portia_content`, 3 на `portia_employee_profiles`, 4 на `portia_manual_employees`, 4 на `storage.objects`), 4 индекса, `pg_cron`, bucket `portia-media`.
**Example (эскиз, НЕ выполнялся: [ASSUMED] A11, синтаксис проверить на изолированном PG первой задачей):**
```sql
-- supabase/fingerprint/portia_schema_fingerprint.sql  (READ-ONLY: единственный SELECT, без DDL и без строк данных)
with fn as (
  select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as k,
    jsonb_build_object(
      'returns', pg_get_function_result(p.oid), 'secdef', p.prosecdef, 'volatility', p.provolatile,
      'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
      'src_sha256', encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'),
      'acl', (select coalesce(jsonb_agg(g order by g collate "C"), '[]'::jsonb) from (
               select distinct (case a.grantee when 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end) || ':' || a.privilege_type as g
               from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated','service_role')) s)
    ) as v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'portia\_%'
),
pol as (
  select ns.nspname || '.' || c.relname || ':' || p.polname as k,
    jsonb_build_object('cmd', p.polcmd, 'permissive', p.polpermissive,
      'roles', (select coalesce(jsonb_agg(case r when 0 then 'PUBLIC' else pg_get_userbyid(r) end order by 1), '[]'::jsonb) from unnest(p.polroles) r),
      'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid)) as v
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace ns on ns.oid = c.relnamespace
  where (ns.nspname = 'public' and c.relname like 'portia\_%') or (ns.nspname = 'storage' and c.relname = 'objects' and p.polname like '%PORTIA%')
)
-- ... rel/columns/constraints/indexes/bucket/cron аналогично ...
select jsonb_pretty(jsonb_build_object(
  'schema', 'portia-fingerprint-v1',
  'pg_major', current_setting('server_version_num')::int / 10000,
  'sections', jsonb_build_object(
     'functions', (select jsonb_object_agg(k, v order by k collate "C") from fn),
     'policies',  (select jsonb_object_agg(k, v order by k collate "C") from pol))));
```
Хеш секции считать в Node от `JSON.stringify` с отсортированными ключами (не в SQL), чтобы comparator был чистой функцией.

### Pattern 3: Upgrade ladder на одной изолированной БД
Free-план даёт 2 активных проекта и один из них — production (если у владельца нет другого), поэтому два параллельных изолированных проекта не гарантированы ([ASSUMED] A10). Последовательность на одном проекте: (0) pristine fingerprint сразу после создания; (1) fresh canonical -> `F`; (2) `teardown` PORTIA-объектов, проверить `fingerprint == pristine`; (3) `L0 setup (8508d71)` -> `phase12 STEP 2 (+2b)` -> `phase14_apply.sql` -> `U`; (4) comparator `F == U`; (5) teardown и итоговая canonical-сборка для live-suite. Teardown делать PORTIA-only, а НЕ `drop schema public cascade` (теряются schema-level default privileges и usage-гранты Supabase). Перед STEP 2 (и 2b) нужен подтверждённый owner-пользователь в `auth.users` (его guard: `raise exception 'PORTIA: почта владельца не подтверждена, ничего не применено'`).

### Pattern 4: Guarded wrapper вокруг CLI
Все mutating вызовы (`db push --db-url`, apply/teardown, `db query -f`) идут только через `scripts/phase16-staging.mjs`, который до любого spawn вызывает `requireSafeMutationTargetFromEnvironment` и сверяет host из DB URL/ref. Отказ при: `supabase link` на production, наличии `supabase/.temp/project-ref`, `--linked`/bare `--remote`, ref не из isolated-списка. Причина: `db reset --remote` «drops all user schemas»; bare `--remote` бьёт по linked-проекту.

### Pattern 5: Target attestation (закрывает WR-01, IN-03, W4, IN-06 п.2 частично)
(a) `PORTIA_E2E_SUPABASE_URL` должен совпадать по host с `NEXT_PUBLIC_SUPABASE_URL` (сейчас сравнения нет, см. «Phase 15 handoff»); (b) в mutation-режиме `PORTIA_E2E_BASE_URL` запрещён (внешний сервер = неизвестный backend); (c) после входа disposable-identity декодировать access token: host из claim `iss` (`https://<ref>.supabase.co/auth/v1`) обязан равняться ожидаемому host — это server-derived подтверждение, что логин произошёл на аттестованной цели; (d) `/api/access` вызывается с cookie-сессией и сравнивается с ожидаемой ролью, только затем модуль `session-probe.ts` выпускает opaque proof (class с `#brand`/`unique symbol`, конструктор не экспортируется); юнит-тесты минтят proof через инжектируемый `fetch`, а не через литерал-объект. [CITED: iss — стандартный claim GoTrue JWT; точное значение подтвердить в первом прогоне, [ASSUMED] A15]

### Anti-Patterns to Avoid
- **Считать branch «fresh из миграций»:** Dashboard-branch воспроизводит migration history/schema dump базового проекта. [CITED: supabase.com/docs/guides/deployment/branching/dashboard]
- **`supabase db reset --remote`, `supabase link` на production, bare `--remote`:** одна опечатка = разрушение production. Только wrapper + explicit `--db-url`.
- **Утверждать «denied» для того, что принято:** D-11 (restricted editor пишет любой раздел `portia_content` на уровне БД) и SEC-M1 (`portia_editor_is_approved` отдаёт anon оракул approve-состояния) должны быть строками матрицы «ACCEPTED», не «исправляться» молча.
- **Правка канонической SQL ради зелёного теста:** найденная гонка/дыра чинится новой forward-only миграцией + ревью `supabase-rls-reviewer`, не правкой замороженных файлов.
- **Фиксировать fingerprint с owner'ами и attnum:** будет ложное расхождение local vs hosted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Применение миграций + журнал | Свой SQL-runner | `supabase db push --db-url`, `supabase migration list` | Журнал `supabase_migrations`, dry-run, прозрачность. [CITED: cli docs `db push`] |
| Выполнение read-only SQL на удалённой цели | Свой клиент `pg` | `supabase db query --remote=<url> --read-only -f file.sql` | Печатает `Target:` в stderr, режим read-only. [CITED: cli docs `db query`] |
| Создание подтверждённых disposable users | Sign-up через почту/Inbucket | `auth.admin.createUser({ email_confirm: true })` на изолированной цели | Не рассылает письма, обходит 2 письма/час SMTP-лимит. [CITED: supabase.com/docs/guides/auth/auth-smtp] |
| Доказательство конкурентности | Mock Supabase / последовательные вызовы | Реальные одновременные HTTP RPC (Promise.all, N>=6 контендеров × R>=10 раундов) | Мок не доказывает RLS и конкуренцию (PITFALLS §«мок Supabase»). |
| Различение «нет прав» и «запрещено логикой» | Разбор текста ошибок ad hoc | Каталожная матрица: `42501` (нет EXECUTE/GRANT/RLS WITH CHECK) vs `P0001` (`forbidden`, `owner-required`) vs возвращаемый boolean/`code` | Стабильные коды вместо строк. |
| Хеш схемы | `pg_dump` + diff | Fingerprint SELECT (выше) | `pg_dump`/`psql` отсутствуют, вывод зависит от версий/owners. |

**Key insight:** граница доверия — Postgres; любые «проверки» в TS или на моках не заменяют каталог и реальный PostgREST/GoTrue.

## Isolated target: варианты

| Вариант | Стоимость | Развязка с production | Fit c репозиторием | Секреты | Вердикт |
|---------|-----------|-----------------------|--------------------|---------|---------|
| **A. Отдельный hosted project (Free)** | $0; лимит 2 активных проекта; пауза через 1 неделю неактивности [CITED: supabase.com/pricing] | Полная: свои ключи, Auth, Storage | `https://<ref>.supabase.co`, 20 символов — проходит `target-guard.ts`/preflight как есть | Ключи и DB password только у владельца | **Рекомендуется** |
| B. Branch (Pro) | $25/мес Pro + ≈$0.01344/ч (≈$9.68/мес = 0.01344×24×30) [CITED: manage-your-usage/branching; расчёт мой]; Compute Credits ветки не покрывают | Слабая: клон проекта-основы; Dashboard-ветка берёт его migration history или schema dump (production без истории = дамп дрейфа); GitHub-интеграция деплоит `main` в production | Ref 20 символов подходит | Ключи ветки отдельные | Не сейчас |
| C. Local CLI + Docker | $0 | Полная | `http://127.0.0.1:54321` не проходит guard (нужен loopback allow-list = security-правка с тестами); Docker и `supabase` отсутствуют на машине | Локальные ключи — публичные demo-значения (`supabase status -o env`) | Только как опциональный inner-loop |
| D. PGlite | $0 | Полная | Нет `pg_cron`, одна сессия | — | Отвергнут |

Стоит помнить про Free: проект паузится через неделю; перед запуском `unpause`, иначе ENOTFOUND/таймауты (как в 15-BASELINE-RESULTS «ENOTFOUND на каждом /api/…»). Подключение к БД: direct `db.<ref>.supabase.co:5432` на Free только IPv6; для IPv4-машины — shared pooler session mode `aws-N-<region>.pooler.supabase.com:5432` с пользователем `postgres.<ref>`. [CITED: supabase.com/docs/guides/database/connecting-to-postgres]

## Phase 15 handoff (что Phase 16 обязана разблокировать)

| Артефакт | Факт (verbatim) | Что делает Phase 16 |
|----------|-----------------|---------------------|
| G1 (`15-VERIFICATION.md:148`) | «`grep server-probe` … только `tests/e2e/fixtures/actors.ts:25,89` (тип и проверка); производителя proof нет … participant/editor/promo-reviewer/owner = BLOCKED `TARGET_NOT_ISOLATED`. WR-01 отложен на Phase 16.» | `session-probe.ts` + аттестация + изолированная цель; снять BLOCKED только с cleanup receipt. |
| `15-ROLE-GATE.md` условия | «1. immutable target attestation that excludes production identity; 2. a server-derived session proof matching the requested role; 3. positive and negative authorization decisions from the real server boundary; 4. an idempotent cleanup receipt for disposable identities and namespaced data.» | Это и есть definition of done для вывода ролей из BLOCKED. |
| G2 (`15-VERIFICATION.md:149`) | «Read backing для 15 data-dependent lanes … Записано как BLOCKED (DATA)» | Изолированный проект + seed даёт backing для API-lanes; пиксельные сравнения с утверждёнными PNG зависят от идентичности контента (см. D6). |
| WR-01 (`15-REVIEW-DISPOSITION.md:31`) | «Непрозрачный proof имеет смысл только вместе с производителем server-probe (G1)… Phase 16.» | Opaque brand + единственный producer. `lib/e2e-actors.test.ts` сейчас конструирует proof литералом (WR-01 в `15-REVIEW.md:76`) — переписать на инжектируемый `fetch`. |
| IN-03 (`15-REVIEW-DISPOSITION.md:39`) | «Отказ от проверки ключей сборки при внешнем `PORTIA_E2E_BASE_URL` ослабляет gate и снимает deny-list WR-04: это решение о безопасности для Phase 16» | Рекомендация: в mutation-режиме `PORTIA_E2E_BASE_URL` запрещён вообще; visitor-режим не менять. |
| W4/IN-06 п.2 | guard опирается на операторские списки; «удалённая проверка через Management API в Phase 16» | Заменить частично JWT-`iss` аттестацией; Management API (нужен PAT, доступный ко всем проектам аккаунта, включая production) отложить (D10). |
| Расхождение guard'ов | Live-тест: `const mutationGuard = "ISOLATED_TEST_PROJECT";` (`lib/portia-promotion-live.test.ts:14`) с env `PORTIA_PROMO_LIVE_*`; E2E-guard: `const mutationConfirmation = "ISOLATED_TEST_PROJECT";` (`target-guard.ts:1`) с обязательными списками production/isolated | Live-suite обязан вызывать тот же `requireSafeMutationTargetFromEnvironment` и сверять `PORTIA_PROMO_LIVE_URL` host == `PORTIA_E2E_SUPABASE_URL` host. |
| Host-правило | `const expectedHost = \`${projectId}.supabase.co\`;` (`target-guard.ts:104`), ref `/^[a-z0-9]{20}$/` (`:47,:67`) | Hosted-вариант A/B совместим; локальный нет. |
| Привязка app↔target | Mutation-guard читает `PORTIA_E2E_SUPABASE_URL`; приложение читает `NEXT_PUBLIC_SUPABASE_URL` (`lib/supabase/env.ts`); preflight сверяет только production-список по `NEXT_PUBLIC_SUPABASE_URL` | Отсутствие сравнения двух URL — пробел, закрывается Pattern 5(a). [VERIFIED: чтение `target-guard.ts`, `phase15-e2e-preflight.mjs`, `env.ts`] |
| Roster owner | `"id": "owner-fixture" ... "lifecycleOwner": "repository-owner", "cleanup": "pre-existing owner account; never delete or modify"` (`roster.json:34-38`) | В изолированной БД «pre-existing» аккаунта нет: нужна правка roster (owner-fixture на изолированной цели = disposable) — решение D4. |

## Каноническая схема: что нашлось

- **Owner identity захардкожена:** `create or replace function public.portia_owner_email() ... select 'qloxzick@gmail.com'::text;` (`supabase/portia_setup.sql:99-106`). Следствие: owner-lane на изолированной цели требует пользователя с этим email (D4); функцию подменять только для staging нельзя без исключения в fingerprint.
- **Дрейф helper'ов:** `git show cc48ec8 -- supabase`: `-set search_path = public` -> `+set search_path = ''` (13 замен в `phase12_apply.sql` + `portia_setup.sql`). `phase14_apply.sql` helper'ы не переопределяет, только `to_regprocedure(...)` + `portia_is_owner()` preflight.
- **Идемпотентность setup:** все DDL `if not exists`/`create or replace`/`drop policy if exists`; начальный `do $$` guard падает только если owner существует и email не подтверждён; завершается `notify pgrst, 'reload schema'`. [VERIFIED: portia_setup.sql:5-20, 96-97, 1676]
- **pg_cron + cleanup:** `create extension if not exists pg_cron;` (`:1623`), `perform cron.schedule('portia-promo-cleanup', '17 3 * * *', 'select public.portia_promo_cleanup()');` (`:1630`). `portia_promo_cleanup()` удаляет `portia_promo_attempt_buckets` старше 3 дней и `cron.job_run_details` старше 7 дней, возвращает 0 (`phase14_apply.sql:1076-1090`); EXECUTE у него отозван у public/anon/authenticated (`portia_setup.sql:1594`) — вызывается только привилегированной ролью/cron.
- **Storage:** `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('portia-media','portia-media', true, 4194304, array['image/png','image/jpeg','image/webp','image/gif'])` (`:1635-`), 4 storage policy через `portia_can_edit()`.
- **Конкурентные примитивы** (все в Postgres): claim — `update ... set status = 'claimed', reviewer_id = auth.uid() ... where id = p_request_id and status = 'pending' and reviewer_id is null;` (`phase14_apply.sql:605-610`, возврат `found`); admission — три `pg_advisory_xact_lock(hashtextextended('promo:bucket:'|'promo:nickname:'|'promo:token:' ...))` (`:438-440`) + `for update` по bucket/binding + частичные unique-индексы `portia_promo_one_active_request` (`:71-73`) и `portia_promo_one_active_qualification_request`; answer CAS — `for update` по attempt, unique индекс `portia_promo_answer_nonce`, ответы `accepted`/`conflict`, `idempotent` (`:904-948`); `start_test` — `update ... where status = 'prepared'` (иммутабельность `client_mode`); lease — `portia_promo_expire_stale_attempt` вызывается из heartbeat/start/current; confirm_* — stale-bank проверка по `md5(updated_at ...)` с `for update`; контент — revision CAS в `app/api/content/route.ts` (`.eq("revision", baseRevision)`, 409 при отсутствии строки или `23505`).
- **Сводка grants** (все RPC `revoke all ... from public, anon, authenticated`, затем точечный `grant execute`): anon+authenticated: `bind_device`, `resolve_device`, `register_attempt`, `submit_request`, `public_status`, `start_test`, `heartbeat_test`, `current_test`, `answer_question`, `fail_attempt`; только authenticated: `reset_device`, `reviewer_state`, `approve_assignment`, `bank_state`, `bank_command`, `claim_request`, `release_request`, `reject_request`, `delete_request`, `confirm_assignment`, `confirm_test`, `grade_answer`, `finalize_attempt`, `override_failure`, `release_retake`, `close`; никто (кроме привилегированных): `cleanup`, `expire_stale_attempt` (`phase14_apply.sql:1226-1284`). Внутри функций дополнительно `portia_has_tab_grant('promo')` ('forbidden') и `portia_is_owner()` ('owner-required' для `delete_request`, force-release).
- **Promo-таблицы:** RLS включён, `revoke all ... from public, anon, authenticated`, политик нет — прямой доступ любой JWT-роли должен давать `42501`, а не пустой результат.
- **Все 18 `create policy`** относятся к 4 public-таблицам и `storage.objects`; `portia_editors`: select (свой email или owner), insert/delete/update только owner, колоночный `grant update (closed_tabs, granted_tabs)` (`portia_setup.sql:215`).
- **Существующий live-suite** (`lib/portia-promotion-live.test.ts`, 275 строк): уже покрывает claim (2 ревьюера), admission same/split device, answer CAS (разные и повторный nonce), `client_mode`-иммутабельность, expired lease; но: один раунд на гонку, прямые table-inserts через admin-клиент, cleanup best-effort без проверки остатка и receipt, домен `@example.invalid`, нет owner/editor/restricted/outsider, нет storage/content/editors матрицы, нет cleanup-RPC теста, нет revoke-теста, `rpcInventory.length` = 18 из 28 promo-RPC. [VERIFIED: чтение файла]

## Role/RLS matrix (каркас для live-suite)

Роли: `anon` (без JWT; participant = anon + device token), `outsider` (authenticated, нет строки в `portia_editors`), `editor-full` (нет closed_tabs, нет promo), `editor-restricted` (closed_tabs содержит `employees`), `promo-reviewer` (editor + `granted_tabs=['promo']`), `owner`.

| Поверхность | anon | outsider | editor-full | editor-restricted | promo-reviewer | owner |
|-------------|------|----------|-------------|-------------------|----------------|-------|
| `portia_content` select | allow | allow | allow | allow | allow | allow |
| `portia_content` insert/update | 42501 | RLS deny | allow | allow (ACCEPTED D-11, БД не проверяет разделы) | allow | allow |
| `portia_editors` select | 0 rows/deny | 0 rows | только своя | только своя | только своя | все |
| `portia_editors` insert/delete/update tabs | 42501 | deny | deny | deny | deny | allow; update других колонок (напр. `email`) = 42501 (column grant) |
| employee_profiles / manual_employees write | 42501 | deny | allow | deny (`employees` закрыт) | allow | allow |
| Storage `portia-media` read | allow | allow | allow | allow | allow | allow |
| Storage write/delete | deny | deny | allow | allow | allow | allow; mime/size (4 MiB, 4 типа) обязательно |
| `portia_promo_*` таблицы напрямую | 42501 | 42501 | 42501 | 42501 | 42501 | 42501 (даже owner) |
| Reviewer RPC (claim, state, banks, grade…) | 42501 | 42501 | `forbidden` | `forbidden` | allow | allow |
| Owner-only RPC (`delete_request`, force release) | 42501 | 42501 | `forbidden`/`owner-required` | то же | `owner-required` | allow |
| Participant RPC (submit, public_status, answer…) | allow | allow | allow | allow | allow | allow |
| `portia_promo_cleanup`, `expire_stale_attempt` | 42501 | 42501 | 42501 | 42501 | 42501 | 42501 |
| `portia_editor_is_approved` | allow (ACCEPTED SEC-M1) | allow | allow | allow | allow | allow |

Реализация: каталожная — тест перебирает ВСЕ `portia_*` функции из fingerprint/каталога, вызывает с инертными (namespaced) аргументами под каждой ролью и сверяет с закоммиченным `expected-authz.json`; функция, которой нет в таблице, роняет тест (новый RPC без решения не пройдёт). Осторожно: `bind_device`/`submit_request` с валидной формой аргументов создают строки — использовать run-префикс и очищать.

**Revoke «сразу»:** три теста на уже выданных JWT без повторного входа: (1) owner удаляет `portia_editors` строку -> следующие table/RPC/Storage вызовы editor'а = deny; (2) owner убирает `promo` из `granted_tabs` -> reviewer RPC = `forbidden`; (3) удалить auth user (`portia_email_confirmed()` читает `auth.users`) -> deny. Сервер читает доступ каждый раз заново (`getEditorAccess` без кэша, `/api/access` = `force-dynamic`, `noStoreHeaders`). [VERIFIED: lib/editor-access.ts, app/api/access/route.ts]

## Конкурентные тесты: как запускать безопасно

- **Форма:** каждая гонка = N одновременных контендеров × R раундов (каждый раунд свои fixture-строки), assert «ровно один победитель» + проверка итогового состояния в БД (не только ответов). Рекомендуемые минимумы: N=6, R=10 (подбираются калибровкой, [ASSUMED] A9 — HTTP-запросы через PostgREST перекрываются не гарантированно).
- **Набор:** claim ×N ревьюеров; admission same-nickname и split-device (nickname A/B на одном token); answer CAS (разные nonce, повторный nonce, stale index); `start_test` desktop vs phone одновременно (победитель фиксирует `client_mode`); lease: heartbeat vs expire; content revision CAS (`baseRevision` одинаков у N редакторов -> одна 200, остальные 409; `baseRevision=0` insert -> 23505->409); `portia_promo_cleanup` параллельно с admission на старой bucket-строке (строка, обновлённая submit'ом, не должна быть удалена); `release/reject/delete` vs `claim` на одной заявке. Победитель никогда не повторяется: считать `true`-ответы и сверять `reviewer_id` единственный.
- **Опционально детерминированно (pg-сессии):** lock-barrier (A держит `pg_advisory_xact_lock`, B стартует и висит, A коммитит) — требует DB URL и `pg`; не часть baseline-плана.
- **Rate-limits Auth (hosted):** `/auth/v1/token` 150/5 мин на IP, sign-in/sign-up 30/5 мин на IP [CITED: supabase.com/docs/guides/auth/rate-limits, local config docs]. Логиниться один раз на identity и переиспользовать сессии; Playwright login по UI — один раз на роль (storageState).
- **Time-зависимость:** lease 45 с и deadline 15 мин — прямая подмена `lease_expires_at` через admin-клиент (как делает существующий `createAttempt`), а не ожидание.
- **Fixtures:** все ключи с префиксом `__portia_live_<runId>`; `runId` из времени+случайных байт; emails `portia-live-<runId>-<label>@...`.

## Disposable identities и cleanup receipts

- **Создание:** `auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { portia_run: runId } })` (метка нужна, чтобы cleanup удалял только свои аккаунты). Пароли генерируются на запуск и живут только в памяти.
- **Email-домен:** существующий код использует `@example.invalid`; приём hosted GoTrue для admin-создания не проверен ([ASSUMED] A2). Первый прогон обязан это подтвердить; запасной вариант — домен, который GoTrue принимает.
- **Cleanup:** порядок — promo-строки (audit, results, requests обоих видов, bindings, buckets) -> `portia_editors` -> storage objects с префиксом -> `portia_content`/profiles тестовые строки -> auth users по `app_metadata.portia_run`. Каждый шаг проверяет `error` (в текущем коде ошибки удаления игнорируются).
- **Receipt (редактированный JSON, коммитится в evidence):** `runId`, commit SHA, sha256 префикс ref (не сам ref/ключи/emails), версия CLI/PG major, счётчики created/deleted по категориям, итоговый `residual` по категориям (должен быть 0: promo rows, editors rows, auth users, storage objects), результат тестов, sha256 receipt. Идемпотентный `sweep` удаляет всё `__portia_live_*` старше порога для упавших запусков.
- **Owner-lane:** в изолированной БД нет pre-existing owner: fixture-пользователь с `portia_owner_email()` создаётся и удаляется harness'ом (D4).

## Runtime State Inventory

Фаза не rename, но это миграция схемы с невидимым состоянием.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Production `portia_*` данные и фактическая схема (применены ли phase12 STEP 2 / phase14 — неизвестно, A1); в изолированный проект production-данные НЕ копируются (branch «Include data» запрещён) | Owner-run read-only fingerprint в production, без изменения данных |
| Live service config | Dashboard-настройки: Confirm email (STEP 0 в phase12), SMTP, лимиты Auth, настройка «Automatically expose new tables» (changelog 45329) в production и в новом проекте | Зафиксировать значения в `16-LIVE-RUN.md` для isolated; production — owner-run, только чтение скриншотом/текстом |
| OS-registered state | pg_cron job `portia-promo-cleanup` живёт в БД (не в git) | Входит в fingerprint (`cron.job`) |
| Secrets/env vars | `PORTIA_PROMOTION_DEVICE_SECRET`, `NEXT_PUBLIC_SUPABASE_*` в `.env.local`/Netlify — production; live-suite требует admin-ключ изолированного проекта и DB password | Для изолированного запуска задавать ТОЛЬКО в shell владельца; не переиспользовать production device secret; агент не читает `.env*` |
| Build artifacts | `.next/` может содержать inlined production `NEXT_PUBLIC_SUPABASE_URL`; `supabase/.temp/project-ref` после `link` | Mutation-запуск: shell-переменные перекрывают `.env.local`; `webServer` пересобирает; wrapper отказывает при `.temp/project-ref` |

## Common Pitfalls

### Pitfall 1: Default privileges Supabase изменились 30.10.2026
**What goes wrong:** fresh проект из тех же миграций имеет другие ACL, чем legacy production: `service_role` может не получить доступ к `portia_*` таблицам (42501 на fixture-insert), sequences `portia_promo_audit_events_id_seq` без default-грантов. Fingerprint F != P при совпадающем SQL.
**Why it happens:** «tables in public … not reachable through the Data API until you grant access»; «Existing objects keep their current grants». [CITED: supabase.com/changelog/45329]
**How to avoid:** первым шагом снять fingerprint свежей canonical-БД и pristine-проекта; различия по `service_role`/sequences закрыть явной forward-only миграцией (`grant ... to service_role`, `revoke all on sequence ... from anon, authenticated`), которая для production — no-op; ревью `supabase-rls-reviewer`. Не включать в fingerprint грантополучателей кроме PUBLIC/anon/authenticated/service_role.
**Warning signs:** `permission denied for table portia_promo_requests` под admin-ключом; diff только в `acl`.
**Tag:** влияние на именно эту схему [ASSUMED] A4 до калибровки.

### Pitfall 2: Branch клонирует дрейф, а не canonical
См. Anti-Patterns. Следствие: «fresh == upgrade» доказывает не то.

### Pitfall 3: Guard-хук блокирует слово из сегодняшнего live-теста
Любая команда агента с именем env-переменной admin-ключа блокируется (даже `grep`). Это сигнал менять подход (owner-run), а не обходить переименованием.

### Pitfall 4: Тихий пропуск как pass
Live-тест `skip`-ится без env; `READ_ONLY_PREFLIGHT` проверяет только наличие RPC (`PGRST202`/`42883`), не права и не конкуренцию. Evidence обязан различать PASS/BLOCKED/SKIP; пустой receipt или `residual` не 0 = fail.

### Pitfall 5: Порядок колонок и валидация constraint
`attnum` различается между путями (ALTER ADD COLUMN); fingerprint без ординалов. `portia_employee_profiles_photo_url_local` создаётся `NOT VALID` и валидируется, только если нет плохих строк (иначе STEP 2b) — `convalidated` входит в fingerprint, состояния legacy-БД с плохими строками дадут реальное расхождение.

### Pitfall 6: phase12 STEP 2 падает без подтверждённого owner
Guard `if not exists (select 1 from auth.users where lower(email) = public.portia_owner_email() and email_confirmed_at is not null)` -> exception. Upgrade-ladder должен сначала создать owner fixture. Остальные STEP (0,1,3,4) — read-only/ручные, исполняются только STEP 2 и 2b (так же извлекает `lib/portia-sql.test.ts` через `step()`).

### Pitfall 7: Collation/PG major
Сортировка без `collate "C"` и сравнение разных major дают ложные diff; `pg_get_expr`/`pg_get_constraintdef` форматирование может отличаться между major. Сравнивать только одинаковый `pg_major`; изолированный проект создавать на том же major, что production (D8).

### Pitfall 8: Приложение под тестом смотрит не туда
`NEXT_PUBLIC_*` вшиваются при `npm run build`. `.env.local` — production. Shell-переменные имеют приоритет над env-файлами, но устаревший `.next` или внешний `PORTIA_E2E_BASE_URL` оставляют production backend. Закрывается Pattern 5.

### Pitfall 9: Миграции с `begin;/commit;` внутри
Файл setup — одна транзакция с явными `begin;`/`commit;`; CLI сам управляет транзакцией и записью журнала ([ASSUMED] A3). Убрать обёртку в baseline и держать parity-тест.

### Pitfall 10: Free-проект на паузе / лимит IPv6
Пауза через неделю; direct host только IPv6. Проверять `unpause` и использовать pooler session mode.

### Pitfall 11: Реальные race-баги
Живой прогон может найти настоящую гонку. План обязан содержать contingency: forward-only fix-миграция, повтор fingerprint (golden пересчитывается и ревьюится), повторный live-run; нельзя «подкрутить» assertion.

### Pitfall 12: `service_role` как «просто ключ» в тестах
Admin-ключ обходит RLS: пользоваться им только для fixtures/верификации; каждое поведенческое утверждение делать клиентом нужной роли, иначе тест ничего не доказывает.

## Code Examples

### Target attestation (эскиз)
```ts
// tests/e2e/fixtures/target-attestation.ts — Source: расширение target-guard.ts (MutationTargetBlockedError, blocked-коды)
export function assertAppBoundToTarget(env: Readonly<Record<string, string | undefined>>) {
  const target = requireSafeMutationTargetFromEnvironment(env);
  const app = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (app.hostname.toLowerCase() !== `${target.projectId}.supabase.co`) {
    throw new MutationTargetBlockedError("app-target-mismatch", ["NEXT_PUBLIC_SUPABASE_URL", "PORTIA_E2E_SUPABASE_URL"]);
  }
  if (env.PORTIA_E2E_BASE_URL) throw new MutationTargetBlockedError("external-base-url", ["PORTIA_E2E_BASE_URL"]);
  return target;
}
export const issuerHost = (accessToken: string) =>
  new URL(JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString()).iss).hostname;
```

### Opaque proof (эскиз)
```ts
// tests/e2e/fixtures/session-probe.ts — единственное место, создающее proof
declare const brand: unique symbol;
const minted = new WeakSet<object>();
export type VerifiedSession = Readonly<{ role: ActorRole; [brand]: true }>;
export async function probeSession(role, cookieJar, fetchImpl = fetch): Promise<VerifiedSession> {
  const res = await fetchImpl(`${base}/api/access`, { headers: { cookie: cookieJar } });
  const access = await res.json();           // {canEdit, canManageEditors, openTabs, tabsEnforced}
  expectRole(role, access);                   // сверка с ожидаемой ролью
  const proof = Object.freeze({ role }) as VerifiedSession; minted.add(proof);
  return proof;                               // actorAvailability проверяет minted.has(proof)
}
```

### Фаза сравнения fingerprint (эскиз)
```js
// scripts/phase16-fingerprint-compare.mjs — чистая функция, покрывается unit-тестами на JSON-фикстурах
export function diffFingerprints(a, b) {
  if (a.pg_major !== b.pg_major) return { comparable: false, reason: "pg-major" };
  const out = {};
  for (const section of Object.keys({ ...a.sections, ...b.sections })) {
    const keys = new Set([...Object.keys(a.sections[section] ?? {}), ...Object.keys(b.sections[section] ?? {})]);
    for (const k of keys) if (stable(a.sections[section]?.[k]) !== stable(b.sections[section]?.[k])) (out[section] ??= []).push(k);
  }
  return { comparable: true, equal: Object.keys(out).length === 0, diff: out };
}
```

### Читать production-fingerprint (owner-run, read-only)
Владелец вставляет содержимое `supabase/fingerprint/portia_schema_fingerprint.sql` (один SELECT) в Dashboard SQL Editor production, копирует единственный jsonb-результат в `evidence/fingerprint-production.json`. Агент production не касается. Файл не содержит данных и секретов (только структуру).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Default grants `anon/authenticated/service_role` на каждую новую таблицу `public` | Явный `GRANT` обязателен | New projects 2026-05-30 (opt-out с 04-28); existing projects 2026-10-30 [CITED: changelog 45329] | ACL fresh != legacy; миграции должны быть самодостаточными |
| JWT `anon` / `service_role` | `sb_publishable_...` / `sb_secret_...` (+ legacy ещё работают) [CITED: supabase.com/docs/guides/getting-started/api-keys] | 2025-2026 | Код уже предпочитает publishable (`lib/supabase/env.ts`); `auth.admin` работает с secret key |
| `supabase db query --linked` | bare `--remote` / `--remote=<ref\|branch\|url>`; `--read-only` | CLI 2.x [CITED: cli docs] | Использовать `--remote=<url>` + `--read-only` |
| `psql`/`pg_dump` для инспекции | `supabase db query` через Management API или direct URL | — | На машине нет `psql`/Docker |

**Deprecated/outdated:** bare `--remote` в скриптах (бьёт по linked-проекту) — запрещён wrapper'ом; `portia_setup.sql` как многократно редактируемый deploy-скрипт — заморозить (ARCHITECTURE.md §Canonical SQL decision).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Применённость phase12 STEP 2 / phase14 / search_path-фикса в production неизвестна | Summary, Runtime State | Меняет только ожидания владельца; закрывается owner-run fingerprint |
| A2 | Hosted GoTrue принимает admin-создание пользователей с `@example.invalid` | Disposable identities | Fixtures не создаются; фикс — другой домен, 1 строка |
| A3 | `supabase db push` оборачивает миграцию сам, `begin;/commit;` в файле не нужны | Pattern 1, Pitfall 9 | Если нужны/мешают — baseline отличается от setup обёрткой; parity-тест подстроить |
| A4 | Пост-30.10 fresh-проект не даёт `service_role`/sequence default-гранты на эти таблицы | Pitfall 1 | Если даёт — миграция explicit grants не нужна (но безвредна) |
| A5 | Production и новый проект на одном PG major | Pitfall 7 | Fingerprint несопоставим (comparator сообщит `comparable:false`) |
| A6 | `supabase db query ... -o json` существует для машинного вывода | Don't Hand-Roll | Иначе вставлять результат вручную (owner-run) |
| A7 | `create extension if not exists pg_cron;` проходит из SQL на fresh hosted проекте без Dashboard-шага | Каноническая схема | Нужен manual checkpoint «включить pg_cron» |
| A8 | `insert into storage.buckets` внутри миграции работает на fresh hosted (и local reset) | Каноническая схема | Нужен отдельный шаг создания bucket'а |
| A9 | N=6 × R=10 HTTP-контендеров достаточно, чтобы гонки реально перекрывались | Конкурентные тесты | Ложная уверенность; усилить lock-barrier тестом (`pg`) |
| A10 | У владельца есть свободный слот Free (<2 активных проектов) или платный план | Isolated target | Вариант A недоступен -> Pro/ветка или локальный Docker |
| A11 | Эскиз fingerprint SQL синтаксически/семантически верен | Pattern 2 | Первая задача плана — выполнить и откалибровать на изолированной БД |
| A12 | `db push --db-url` через shared pooler session mode работает для CLI 2.122.0 | Isolated target | Использовать direct host (IPv6) или SQL Editor paste |
| A13 | Лимиты Auth (150/5 мин token, 30/5 мин sign-in) применимы и не мешают при переиспользовании сессий | Конкурентные тесты | Harness падает 429; ввести повторное использование/паузы |
| A14 | PGlite не поддерживает `pg_cron` | Alternatives | Если поддерживает — вариант D становится возможным inner-loop |
| A15 | `iss` в access token = `https://<ref>.supabase.co/auth/v1` | Pattern 5 | Подправить правило извлечения host |

## Open owner decisions

Блокирующие Wave 0 (planner ставит `checkpoint:decision`):

- **D1 Тип изолированной цели.** Рекомендация: отдельный hosted project на Free (вариант A), не branch и не только local. Нужно: подтвердить свободный слот (A10), имя (`portia-staging`), регион. Альтернатива: Pro+branch (≈$25/мес + ≈$9.7/мес) — не рекомендуется из-за связи с production.
- **D2 Политика секретов и исполнения.** Рекомендация: агент никогда не держит admin-ключ и DB password (CLAUDE.md + хук); все mutating шаги (apply, teardown, live-run) выполняет владелец в своём терминале с ключами в shell-env; агент готовит код/wrapper и проверяет редактированные receipts. Иначе владелец сам должен изменить `CLAUDE.md`/`guard.mjs` (агент их не меняет).
- **D3 Кто и когда запускает live-run.** Рекомендация: владелец, командой `npm run test:staging-live` (после ручного `unpause`), перед закрытием фазы и перед каждым релизным кандидатом; CI в проекте нет.
- **D4 Owner-fixture на изолированной цели.** Рекомендация: создать disposable пользователя с каноническим `portia_owner_email()` (`qloxzick@gmail.com`) в изолированном проекте (письма не уходят при admin-создании) и обновить `roster.json` (owner-fixture = disposable на изолированной цели). Альтернатива: подмена функции только на staging = исключение в fingerprint (хуже).

Можно принять по умолчанию, если владелец не возражает:

- **D5 Production postflight.** Владелец вручную запускает read-only fingerprint SQL в production SQL Editor и сохраняет вывод; повторный прогон идемпотентного canonical SQL в production и сверка migration history (`supabase migration repair`) НЕ входят в Phase 16 (production-мутация).
- **D6 Охват G2.** Рекомендация: Phase 16 закрывает API/role-lanes и даёт seed (`portia_content` main, минимальные профили) для не-пиксельных data-lanes; 7 пиксельных application-сравнений с утверждёнными PNG остаются BLOCKED, пока seed не воспроизводит утверждённый контент. Нужен ответ: в Phase 16 или перенос.
- **D7 Установка `supabase` CLI** (SUS: too-new). Нужен `checkpoint:human-verify`; опционально закрепить 2.121.0.
- **D8 PG major.** Владелец называет major production (Dashboard -> Infrastructure); изолированный проект и `config.toml [db] major_version` — тот же.
- **D9 Явные гранты `service_role`/sequences** новой forward-only миграцией — принимать по результату калибровки fingerprint (после ревью `supabase-rls-reviewer`).
- **D10 Management API read-only проверка проекта (IN-06 п.2).** Рекомендация: отложить (PAT аккаунта достаёт до production); JWT-`iss` аттестация достаточна для Phase 16.
- **D11 Локальный Docker inner-loop.** Опционально; требует Docker Desktop (владелец) и расширения guard на loopback (security-правка с тестами) — по умолчанию не делаем.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22.13.1 | `npm test`, Playwright preflight | ✓ (в `%TEMP%\portia-node-v22.13.1`, может исчезнуть) | 22.13.1 / default 24.21.0 | Default Node 24 для `npm test`; Playwright preflight требует 22.13.x |
| npm | install CLI | ✓ | 11.19.0 | — |
| Docker | local `supabase start/db reset` | ✗ (`docker: command not found`) | — | Hosted project (D1-A) |
| Supabase CLI | migrations/db query | ✗ (`supabase: command not found`) | — | Установка `supabase@2.122.0` (D7) либо ручной SQL Editor |
| psql / pg_dump | инспекция | ✗ | — | Fingerprint SELECT через `db query`/SQL Editor |
| `gh` | не требуется | ✓ 2.102.0 | — | — |
| Изолированный Supabase проект, ключи, DB password | вся фаза | неизвестно (проверить нельзя без секретов; Supabase MCP не вызывался) | — | Блокирует live-run: BLOCKED до D1-D3 |
| Production Supabase | запрещён | — | — | — |

**Missing dependencies with no fallback:** изолированная цель (D1) и ключи у владельца — без них live-run, fingerprint F/U и снятие BLOCKED невозможны; всё остальное (миграции, comparator, parity, guard-тесты, harness-код) делается offline.
**Missing dependencies with fallback:** Docker/CLI/psql — см. выше.

## Validation Architecture

> `workflow.nyquist_validation: false` в `.planning/config.json`, но оркестратор явно потребовал этот раздел; включён.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 22.13.1, `--experimental-strip-types`); Playwright 1.64.1 для role-lanes |
| Config file | нет (глобы в `package.json`); `playwright.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `/portia-check` (или `bash .claude/skills/portia-check/run.sh`), затем owner-run `npm run test:staging-live` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAB-REL-04 | baseline migration == setup minus wrapper; миграции упорядочены/forward-only | unit (offline) | `node --experimental-strip-types --test lib/portia-canonical-parity.test.ts` | ❌ Wave 0 |
| STAB-SEC-04 | comparator: equal/diff/major-mismatch на синтетических JSON | unit (offline) | `node --experimental-strip-types --test lib/phase16-fingerprint.test.ts` | ❌ Wave 0 |
| STAB-SEC-04 | fresh F == upgrade U == golden на изолированной БД | live (owner-run) | `node scripts/phase16-staging.mjs verify-fingerprints` | ❌ Wave 0 |
| STAB-SEC-04 | production P == golden | owner-run read-only | вывод вручную -> `phase16-fingerprint-compare.mjs` | ❌ Wave 0 |
| STAB-SEC-01 | матрица роль×поверхность (table/RPC/storage), revoke на живом JWT | live (owner-run) | `npm run test:staging-live` | ❌ (расширить `lib/portia-promotion-live.test.ts`) |
| STAB-SEC-01 | UI: login по `/owner-login`, `/api/access` proof, роль-lane, revoke без re-login | e2e (owner-run) | `npm run test:e2e:mutation` (после реализации) | ✅ `roles.spec.ts` частично (4 lane BLOCKED) |
| STAB-REL-04 | claim/admission/CAS/start_test/content CAS/cleanup конкурентные раунды | live (owner-run) | `npm run test:staging-live` | ⚠️ частично в `portia-promotion-live.test.ts` |
| STAB-REL-04 | target-guard + app-binding + opaque proof | unit (offline) | `node --experimental-strip-types --test lib/e2e-target-guard.test.ts lib/e2e-actors.test.ts` | ✅ (расширить) |

### Sampling Rate
- **Per task commit:** `npm test` (offline, без сети и секретов)
- **Per wave merge:** `/portia-check` (tests, tsc, lint, visual manifest, `--verify-promotion`)
- **Phase gate:** owner-run live-run + F/U/P fingerprint + cleanup receipt (`residual == 0`) записаны в evidence; иначе фаза остаётся `gaps_found`, а live-доказательства BLOCKED

### Wave 0 Gaps
- [ ] `lib/portia-canonical-parity.test.ts` — baseline == setup, имена файлов миграций, запрет правок замороженных файлов (хеш)
- [ ] `lib/phase16-fingerprint.test.ts` + `scripts/phase16-fingerprint-compare.mjs`
- [ ] `supabase/config.toml`, `supabase/migrations/<ts>_portia_baseline.sql`, `supabase/fingerprint/*.sql`, `supabase/teardown/*.sql`, `supabase/upgrade-fixtures/L0_*.sql`
- [ ] `scripts/phase16-staging.mjs` (guarded wrapper) + unit tests (отказ без списков, при `.temp/project-ref`, при совпадении с production)
- [ ] `tests/e2e/fixtures/target-attestation.ts`, `session-probe.ts`; переписать forge в `lib/e2e-actors.test.ts`
- [ ] Харнесс live-suite: identities, matrix `expected-authz.json`, receipts, sweep
- [ ] Framework install: `npm install --save-dev --save-exact supabase@2.122.0` (после human-verify)

## Security Domain

### Applicable ASVS Categories (level 1, `security_enforcement: true`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (GoTrue) пароли; Confirm email включён в production (STEP 0); harness использует `email_confirm: true` только на изолированной цели |
| V3 Session Management | yes | `@supabase/ssr` cookie-сессии; revoke проверяется на живых JWT (политики читают БД в момент запроса) |
| V4 Access Control | yes | RLS + `security definer` helpers + column grants; каталожная матрица `expected-authz.json` |
| V5 Input Validation | yes | CHECK-констрейнты и length-проверки в RPC (уже в SQL); harness-фикстуры валидируются префиксом |
| V6 Cryptography | yes | device token — хеш (`token_hash`), не вручную изобретать; секреты только в shell владельца |
| V13/V14 Config | yes | Guarded wrapper, target-guard, запрет production-ref, отсутствие admin-ключа в Next runtime |

### Known Threat Patterns for Supabase RLS/RPC

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `security definer` без pinned `search_path` | Elevation | `set search_path = ''` (в setup везде; тест `portia-sql.test.ts` запрещает `search_path = public`); fingerprint включает `proconfig` |
| Лишний `EXECUTE` для anon/PUBLIC | Info disclosure / Tampering | Явные `revoke all ... from public, anon, authenticated` + fingerprint ACL + каталожная матрица |
| Таблица без RLS / без явных грантов (после 30.10.2026) | Info disclosure | `relrowsecurity` в fingerprint; promo-таблицы без политик = 42501 |
| Мутация production тестом | Tampering | target-guard списки + app-binding + JWT `iss` + запрет `PORTIA_E2E_BASE_URL` + owner-run |
| Утечка admin-ключа/DB password в логи/evidence | Info disclosure | Receipt редактирован (sha256 ref, без ключей/emails/cookies); хук блокирует команды с ключом; ключи только в env владельца |
| Гонка двух победителей (claim/admission/CAS) | Tampering | Атомарные UPDATE/advisory locks/partial unique; доказательство N×R раундов + проверка итогового состояния |
| Existence oracle `portia_editor_is_approved` | Info disclosure | ACCEPTED (SEC-M1), явно в матрице |
| Запись restricted editor в закрытые разделы напрямую в БД | Tampering | ACCEPTED (D-11), явно в матрице; не «исправлять» в Phase 16 без решения владельца |

## Рекомендуемая декомпозиция на планы (для planner)

1. **16-00 Wave 0 / checkpoints:** `checkpoint:decision` D1-D4 (+D6,D8), `checkpoint:human-verify` D7.
2. **Канон:** `supabase init`, baseline-миграция, parity-тест, upgrade-fixtures L0, заморозка; ревью `supabase-rls-reviewer` (обязательно).
3. **Fingerprint:** SQL, comparator + unit tests, teardown SQL, golden-политика.
4. **Guard/attestation:** wrapper, app-binding, запрет внешнего base URL в mutation, unified live guard, opaque proof + `session-probe`; обновить roster/README/`.env.example` (только комментарии; не `.env`).
5. **Live-suite:** identities, role/RLS/RPC матрица (каталожная), revoke-тесты, конкурентные раунды, cleanup RPC, receipts+sweep.
6. **Playwright role-lanes:** подключить producer proof к `roles.spec.ts`; data-lanes G2 по D6.
7. **`checkpoint:human-action`:** создать проект, unpause, apply fresh -> F, teardown -> pristine, upgrade -> U, final canonical, owner-run live-run, owner-run production fingerprint P; агент проверяет и коммитит только редактированные evidence.
8. **Верификация/трассировка:** `16-LIVE-RUN.md`, обновление REQUIREMENTS/ROADMAP только при реальном PASS; BLOCKED остаётся BLOCKED до live-run; если live-run нашёл гонку — fix-миграция + повтор.

## Open Questions

1. **Какая именно схема сейчас в production?**
   - Что знаем: репозиторные файлы и дрейф `cc48ec8`; MILESTONES: manual-employees SQL применён.
   - Что неясно: применены ли phase12 STEP 2 и phase14.
   - Рекомендация: owner-run fingerprint (D5); до этого STAB-SEC-04 по production = PENDING.
2. **Какие из 15 BLOCKED (DATA) lanes зависят от Google Sheet, а не только от БД?**
   - Знаем: lanes бьют `/api/content`, `/api/access`, `/api/employees`.
   - Неясно: зависимость `/api/employees` от внешнего Sheet в изолированном режиме.
   - Рекомендация: Wave 0 инвентаризировать по коду `lib/portia-employees.ts` до решения D6.
3. **Нужен ли `pg` для детерминированного lock-barrier?**
   - Рекомендация: нет в baseline; добавить, только если калибровка N×R показывает редкие пересечения (A9).

## Sources

### Primary (HIGH confidence)
- Репозиторий (читался в этой сессии): `supabase/portia_setup.sql`, `phase12_apply.sql`, `phase14_apply.sql`, `lib/portia-promotion-live.test.ts`, `lib/portia-sql.test.ts`, `lib/portia-promotion-db.test.ts`, `tests/e2e/fixtures/{actors,target-guard,test}.ts`, `tests/e2e/fixtures/data/roster.json`, `scripts/phase15-e2e-preflight.mjs`, `app/api/{access,content}/route.ts`, `app/owner-login/actions.ts`, `lib/editor-access.ts`, `lib/supabase/env.ts`, `.claude/hooks/guard.mjs`, `.claude/settings.json`, `.planning/phases/PORTIA-15-baseline/{15-VERIFICATION,15-REVIEW,15-REVIEW-DISPOSITION}.md`, `evidence/{15-ROLE-GATE,15-BASELINE-RESULTS,15-ENVIRONMENT}.md`, `.planning/research/{ARCHITECTURE,STACK,PITFALLS}.md`, `git show cc48ec8 -- supabase`.
- npm registry + gsd package-legitimacy: `supabase` 2.122.0 (SUS too-new), `pg` 8.23.1 (OK), `@electric-sql/pglite` 0.5.14 (SUS too-new).
- Context7 `/supabase/cli`, `/websites/supabase`: `db push/query/reset/dump`, `test db`, API keys, connection modes, Auth rate limits, branching.

### Secondary (MEDIUM confidence)
- supabase.com/docs/guides/deployment/branching (+ `/dashboard`, `/platform/manage-your-usage/branching`), supabase.com/pricing, supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically (WebFetch, прочитано в сессии).

### Tertiary (LOW confidence)
- Сторонние статьи DEV/Medium о датах changelog 45329 (расходятся в датах) — использовать только официальный changelog; фактическое влияние на эту схему — A4.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH — CLI выбран milestone-исследованием и подтверждён npm/Context7; SUS по возрасту версии.
- Architecture: HIGH для репозиторных частей (читал файлы), MEDIUM для hosted-поведения (не запускалось).
- Pitfalls: HIGH для guard/хука/SQL-дрейфа/branch-семантики; MEDIUM для default-privileges эффекта (A4).
- Fingerprint SQL: MEDIUM — эскиз не исполнялся (A11).

**Research date:** 2026-11-01
**Valid until:** 2026-11-08 (Supabase CLI и платформенные дефолты меняются быстро; пересмотреть D7 и A4 при старте планирования)
