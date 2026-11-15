---
phase: "24"
slug: "urovni-dopuska-i-zakrytie-soderzhimogo"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 24 — Security

> Контракт безопасности фазы: реестр угроз, принятые риски, журнал аудита.
> Реестр взят из блоков `<threat_model>` планов 24-01..24-11 (составлен при планировании). Проверка: агент `gsd-security-auditor`, ASVS 1, block_on high, 2026-11-15. Подробные доказательства (file:line) — в `24-RLS-REVIEW.md` и `24-SECURITY-MATRIX.md`.
> Закрытие угроз доказано статикой кода и локальными тестами (351/351 связанных тестов; полный набор 2101 pass, 0 fail). Живые линии — BLOCKED, ниже; они не засчитаны как PASS.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Сервер → браузер посетителя (GET /api/content) | Ответ строится по зрителю; закрытое опускается на сервере | Содержимое записей по уровню допуска 1–5 |
| Браузер редактора → сервер (PUT /api/content) | Сохранение содержимого; отказ копии «для зрителя», нормализация иерархии | Полное содержимое, уровни |
| Браузер → кэш устройства (localStorage) | Копия ответа с ключом зрителя | Содержимое по уровню |
| Аноним → Supabase PostgREST (`portia_content`) | Прямое чтение по публичному ключу в обход сайта | Полное содержимое (переданный риск, Phase 25) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-24-01 | I | `lib/level-redact.ts` / GET | high | mitigate | Ответ по именам полей, фильтр закрытого, тесты-приманки 1–5 | closed |
| T-24-02 | I | заголовки GET | high | mitigate | `noStoreHeaders` во всех ответах GET, без тега кэша | closed |
| T-24-03 | S/E | GET при закрытом режиме | high | mitigate | 401 до чтения строки; сбой проверки → 503 | closed |
| T-24-04 | I | `slot` в ответе | medium | mitigate | HMAC-SHA256 с меткой `slot:`, 22 символа | closed |
| T-24-05 | T | компоненты React | medium | mitigate | Клиент не импортирует модули очистки; закрытость только с сервера | closed |
| T-24-06 | I | прямое anon-чтение `portia_content` | high | transfer | Phase 25 (SEC-01); `PROJECT.md:141`, матрица | closed (transfer) |
| T-24-07 | T/I | нормализатор `level`/`lockedLevel` | high | mitigate | Мусор → 5, нет поля у записи учёного → 1 | closed |
| T-24-08 | E | `appLevels` при закрытой «Информации» | medium | mitigate | `sectionOfKey("appLevels") = "info"`, 403 | closed |
| T-24-09 | T | ребёнок доступнее раздела | medium | mitigate | `effectiveLevel` в очистке, `raiseChildLevels` в PUT | closed |
| T-24-10 | I | кэш устройства | high | mitigate | Ключ зрителя, сброс при несовпадении | closed |
| T-24-11 | I | поздний ответ опроса | medium | mitigate | Порядок по номеру запроса до приёма | closed |
| T-24-12 | I | отозванный посетитель | high | mitigate | Очистка обоих кэшей и `onAccessLost` при 401 | closed |
| T-24-13 | I | `RedactedDocument` | medium | mitigate | Полосы только из id | closed |
| T-24-14 | I | `formattedText` | high | mitigate | Allow-list префиксов и открытых id | closed |
| T-24-15 | I | «Корзина» | high | mitigate | Наследование уровня вируса; битая ссылка → 5 (RLS24-01) | closed |
| T-24-16 | I | рекомендации поиска | high | mitigate | Удаление строк, называющих закрытое | closed |
| T-24-17 | I | ссылка «Устава» | medium | mitigate | Серверный `lib/embedded-documents.ts`, выдача по допуску | closed |
| T-24-18 | I | закрытый раздел | medium | mitigate | Один узел без детей и ключей | closed |
| T-24-19 | R | документы SEC-07 | low | mitigate | Фраза SEC-07 в PROJECT.md и релизной заметке | closed |
| T-24-20 | I | закрытая запись учёного | high | mitigate | Пересборка `{id,title,scientist,lockedLevel,content:[],withheld:true}` | closed |
| T-24-21 | I | свободный текст сводок/помощника | low | accept | Записан в PROJECT.md:142, релизной заметке | closed (accept) |
| T-24-22 | T | PUT: копия «для зрителя» | high | mitigate | 422 `viewer-copy` до чтения/записи; ключ `redaction` в любом виде (RLS24-04) | closed |
| T-24-23 | T | PUT: ребёнок доступнее раздела | medium | mitigate | `raiseChildLevels`, `levelsRaised` | closed |
| T-24-24 | T | изменённый клиент редактора шлёт усечённую копию без маркеров | medium | accept | Accepted Risks Log AR-24-02 | closed (accept) |
| T-24-25 | T | значение уровня из формы | low | mitigate | Радио из `ACCESS_LEVELS`, зажим нормализатором | closed |
| T-24-26 | E | ослабление `access-foundation.test.ts` | low | mitigate | Только +2 пути в allow-list; запреты не менялись | closed |
| T-24-27 | T | редактор с копией «для зрителя» | high | mitigate | Нет sync/сохранения/форм + серверный 422 | closed |
| T-24-28 | T | ребёнок ниже раздела в черновике | low | mitigate | `min=effectiveLevel`, `raiseChildren`, серверная нормализация | closed |
| T-24-29 | I | разметка заглушек в списках | medium | mitigate | Только `level`, `index`, `listItem`, ключ `slot` | closed |
| T-24-30 | I | окно после понижения | high | mitigate | `reconcileSelection` до `setContent` | closed |
| T-24-31 | I | ссылка «Устава» в клиенте/DOM | medium | mitigate | В `embeddedApps` только `sheet`; остаток — SEC-07 | closed |
| T-24-32 | I | поиск предлагает закрытый «Устав» | low | mitigate | `searchApps` без `charter` | closed |
| T-24-33 | R | документы доказательств | medium | mitigate | `lib/phase24-evidence.test.ts` запрещает PASS живых линий | closed |
| T-24-34 | I/T | e2e-прогон | medium | mitigate | `page.route("**/api/**")`, abort неизвестного, ключи пусты | closed |
| T-24-35 | I | прямое anon-чтение `portia_content` | high | transfer | Phase 25 (SEC-01), строка матрицы | closed (transfer) |
| T-24-36 | I | формы заглушки | medium | mitigate | Пропсы только уровень/вариант/индекс | closed |
| T-24-37 | T | заглушка как элемент управления | low | mitigate | Нет обработчиков, ссылок, `data-*` | closed |
| T-24-38 | I | `reconcileSelection` после понижения | medium | mitigate | Возвращает только `id`, `lostSlot`, `lostLevel` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-24-01 | T-24-21 | Свободный текст сводок и фраз помощника не уровневый; записан в `PROJECT.md:142` и `24-RELEASE-NOTES.md` | владелец (решение фазы, D-19) | 2026-11-15 |
| AR-24-02 | T-24-24 | Изменённый клиент редактора может прислать усечённую копию без маркеров и стереть скрытое. Редактор и так может писать в Supabase напрямую (D-11, `PROJECT.md:139,141`); путь с ключом `redaction` закрыт RLS24-04 (`2cabb1b`); принятие заявлено в `24-06-PLAN.md` и `24-06-SUMMARY.md:66`, здесь записано в журнал | владелец («мне все понравилось», 2026-11-15) | 2026-11-15 |
| AR-24-03 | RLS24-02, RLS24-03, RLS24-08, RLS24-09 | Низкие находки RLS-ревью без утечки; отложены в Phase 25 (`24-RLS-REVIEW.md`, матрица) | владелец | 2026-11-15 |

*Accepted risks do not resurface in future audit runs.*

### Переданные риски
- T-24-06 / T-24-35 (SEC-01): прямое анонимное чтение `portia_content` по публичному ключу обходит серверную очистку. Передано Phase 25. Если миграция `20261114000000` попадёт в production раньше Phase 25, закрытие будет только видимостью.

### BLOCKED (не засчитано как PASS)
- Живые роли и аутентификация, Postgres/RLS (`portia_can_edit()`), RPC шлюза, живая запись/CAS.
- Netlify CDN: заголовки и `Set-Cookie` на GET (RLS24-08).
- Живая смена уровня и отзыв (T-24-10/11/12/30) — проверено только на подменённом `/api/**`.
- staging, production, физические устройства, скринридер; листинг Storage и сид в статической оболочке (Phase 25).
- `bash .claude/skills/portia-check/run.sh` не отработал (сломан npm временного Node); записаны прямые эквиваленты.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 38 | 38 | 0 | `gsd-security-auditor` (37 закрыто по коду/документам; T-24-24 закрыт записью AR-24-02 оркестратором после принятия владельцем) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15 (статика и локальные тесты; живые линии BLOCKED, см. выше)
