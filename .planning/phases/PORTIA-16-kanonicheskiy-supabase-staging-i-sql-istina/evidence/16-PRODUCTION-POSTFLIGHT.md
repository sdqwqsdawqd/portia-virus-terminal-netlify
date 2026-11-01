# 16-PRODUCTION-POSTFLIGHT: сравнение production fingerprint с canonical (план 16-14)

Итог: **DRIFT** (production != golden). Все отличия классифицированы, неизвестных нет. Исправление production вне Phase 16 (D5) и этим планом не выполнялось.

## Как снят fingerprint

| Поле | Значение |
|------|----------|
| Дата | 2026-11-01 |
| Кто выполнил | владелец, вручную, один read-only SELECT в Dashboard SQL Editor (D5). Агент к production не подключался, SQL повторно не гонял, `migration repair` не выполнялся |
| SQL | `supabase/fingerprint/portia_schema_fingerprint.sql`, sha256 `80c01284740fe1f2b25319e31f04dd1fd300c972f38524fb8209e5e976d71851` (владелец сверил на HEAD `95ba038`; файл не менялся с `cba878c`, 16-10; статическая read-only проверка `lib/phase16-fingerprint.test.ts` зелёная; тот же файл исполнен на изолированной базе в 16-10) |
| Файл результата | `evidence/fingerprint-production.json` (сырой вывод SQL Editor с UTF-8 BOM, компаратор снимает BOM, коммит `607e790`; коммит файла `eee182f`) |
| Схема / PG major | `portia-fingerprint-v1` / 17 (у golden и у изолированной цели тоже 17, major сопоставим) |
| Inventory production | 23 таблицы, 151 колонка, 120 constraints, 34 индекса, 18 policies, 5 cron, 1 bucket, **37 функций** (у golden 36) |
| Production-ref | в evidence не записан; `scan-evidence`: 0 находок |

## Сравнения

| Сравнение | Exit | Результат |
|-----------|------|-----------|
| `phase16-fingerprint-compare.mjs golden production` | 1 (comparable, не равны) | 4 отличающихся ключа, классификация ниже |
| `phase16-fingerprint-compare.mjs fingerprint-upgrade-legacy.json production` (U0) | 1 (comparable, не равны) | те же 4 ключа плюс `portia_editor_is_approved` (на production уже canonical `search_path=""`, в U0 legacy `search_path=public`) и без sequence (на production ACL sequence такой же, как в U0) |
| golden vs изолированная цель после `push` миграции 20261101000200 (`fingerprint-postdrop.json`) | 0 | равны: на каноническом build удаление двух overloads no-op, golden не менялся |

## Классификация отличий golden vs production

| Секция | Ключ | Где есть | Класс | Описание и риск | Исправление (вне Phase 16) |
|--------|------|----------|-------|-----------------|----------------------------|
| tables | `public.portia_promo_audit_events_id_seq` | оба, ACL разный | ожидаемое (дельта D9) | на production anon и authenticated имеют SELECT/UPDATE/USAGE на sequence (унаследованы default privileges), в golden только service_role. Риск низкий: identity-колонку anon/authenticated не используют, но это лишние права | миграция `20261101000100_portia_explicit_grants.sql` (16-10). НЕ применена к production |
| functions | `public.portia_promo_confirm_assignment(p_request_id uuid, p_items jsonb)` | только production | дрейф (устаревшая версия RPC) | legacy overload из `43895f8` (14-02), заменён (не удалён) в `4d527f6` rank-authoritative сигнатурой `(p_request_id, p_bank_id, p_bank_version, p_items)`. SECURITY DEFINER, EXECUTE у authenticated: может обходить проверки bank/version. Приложение его не вызывает (`app/api/promotion/banks/route.ts` использует новую сигнатуру); риск: прямой вызов PostgREST залогиненным пользователем с допуском | миграция `20261101000200_portia_drop_legacy_promo_overloads.sql` (`drop function if exists` ровно двух сигнатур). НЕ применена к production |
| functions | `public.portia_promo_confirm_test(p_request_id uuid, p_questions jsonb, p_client_mode text)` | только production | дрейф (то же) | legacy overload `(uuid, jsonb, text)` из `43895f8`, то же описание и риск | та же миграция `20261101000200` |
| functions | `public.rls_auto_enable()` | только golden | info (benign) | платформенная функция Supabase (event trigger, `returns event_trigger`, не из репозитория), присутствует на более новых проектах; на старом production её нет. Риск отсутствует | не требуется |

Прочее совпало: все остальные 36 функций (включая `portia_editor_is_approved` с `search_path=""` и тем же `src_sha256`), таблицы, колонки, constraints, индексы, policies, cron, bucket, extensions, roles, default ACL. Признаков дрейфа A1 (не применены phase12 STEP 2 или `search_path = ''` из `cc48ec8`) нет: тело и конфиг `portia_editor_is_approved` совпадают с canonical.

## Дельта production дальше: итог

Production == golden плюс/минус ровно: ACL sequence (закрывается `20261101000100`), два legacy overload (закрываются `20261101000200`), `rls_auto_enable` (info). Обе миграции не применены к production; решение о применении принимает владелец отдельно (вне фазы по D5), агент production не трогал.

## Что это значит для требований

- STAB-SEC-04: **Pending**. staging доказан (golden == U == final == postdrop), production DRIFT: пока обе миграции не применены владельцем и fingerprint не снят повторно (owner-run), равенство production canonical не доказано.
- Требуется owner-run шаг в будущей фазе: применить обе миграции к production, повторно снять fingerprint тем же SQL (sha256 выше), сравнить с golden (ожидается exit 0 с учётом info `rls_auto_enable`).
