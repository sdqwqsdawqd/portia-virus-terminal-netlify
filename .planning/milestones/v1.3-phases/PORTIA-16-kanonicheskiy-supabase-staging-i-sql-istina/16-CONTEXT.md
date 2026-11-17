# Phase 16: Канонический Supabase staging и SQL-истина — Context

**Source:** решения владельца (Qloxz) в чате 2026-11-01 после 16-RESEARCH.md; discuss-phase не запускался.

## Locked decisions

- **D1 — цель:** отдельный hosted-проект Supabase на Free-плане, поднятый только из canonical migrations. Не ветка Supabase и не локальный CLI/Docker. Владелец подтверждает свободный слот и создаёт проект сам (создание проекта — действие владельца).
- **D2/D3 — кто выполняет мутирующие шаги:** агент, с тестовыми ключами изолированного проекта. Ограничения:
  - ключи только изолированного тестового проекта; production-ключи и production service-role запрещены (CLAUDE.md);
  - ключи передаются через переменные окружения процесса, которые задаёт владелец; агент не читает и не печатает `.env*`, не пишет ключи в файлы, логи, receipts или коммиты;
  - `.claude/hooks/guard.mjs` сейчас блокирует команды со словом `service_role`. Агент guard **не меняет и не обходит**. План должен содержать `checkpoint:human-action`, где владелец сам вносит в guard узкое разрешение (например, только для конкретного wrapper-скрипта/команды против проверенного тестового ref), а агент затем проверяет, что production-ref по-прежнему блокируется;
  - каждый мутирующий запуск проходит target-guard (ref изолированного проекта, не из `PORTIA_E2E_PRODUCTION_PROJECT_IDS`) и fail-closed при несовпадении.
- **D4 — owner-fixture:** тестовый пользователь с каноническим email `qloxzick@gmail.com` (захардкожен в SQL как owner) на изолированном проекте, плюс правка `roster.json`. Это отдельный аккаунт тестового проекта, не production-аккаунт.
- **D5–D11 — приняты по рекомендации 16-RESEARCH.md:**
  - D5: production — только read-only fingerprint, который владелец запускает вручную в SQL Editor; повторный прогон SQL в production и migration repair вне фазы.
  - D6: 7 пиксельных application-сравнений с данными остаются BLOCKED без production-подобного seed.
  - D7: `supabase` CLI 2.122.0 ставится точной версией только после `checkpoint:human-verify` владельца (версия too-new).
  - D8: PG major изолированного проекта = production.
  - D9: явные grants (`service_role`, sequences) — forward-only миграцией после калибровки, с ревью `supabase-rls-reviewer`.
  - D10: проверка через Management API отложена.
  - D11: локальный Docker необязателен.

## Constraints carried from project rules

- Любые изменения `supabase/*.sql`, RLS, RPC, storage policies — ревью агентом `supabase-rls-reviewer`.
- BLOCKED никогда не записывается как pass. Live mutating staging-run и schema fingerprints обязательны (acceptance gate фазы).
- Существующие `supabase/portia_setup.sql`, `phase12_apply.sql`, `phase14_apply.sql` читаются текстовыми тестами по пути — не ломать их без parity-теста.
