# Roadmap: PORTIA OS — доработка сайта

## Milestones

- ✅ **v1.0 Доработка** — Phases 1–5 (shipped 2026-10-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Закрытие замечаний** — Phases 6–13 (shipped 2026-10-27) — [archive](milestones/v1.1-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 Доработка (Phases 1–5) — SHIPPED 2026-10-19</summary>

- [x] Phase 1: Исправление багов (4/4 plans)
- [x] Phase 2: Внешний вид (6/6 plans)
- [x] Phase 3: Редактор (8/8 plans)
- [x] Phase 03.1: Стабилизация (6/6 plans)
- [x] Phase 03.2: Сотрудники и Сводка (8/8 plans)
- [x] Phase 03.3: Сотрудники вне таблицы и гайды в Информации (4/4 plans)
- [x] Phase 4: пропущена владельцем
- [x] Phase 5: Оформление текста (7/7 plans)

</details>

<details>
<summary>✅ v1.1 Закрытие замечаний (Phases 6–13) — SHIPPED 2026-10-27</summary>

- [x] Phase 6: Учёт замечаний и страховка данных (4/4 plans)
- [x] Phase 7: Сервер: сохранение сотрудников и безопасный JSON (4/4 plans)
- [x] Phase 8: Сотрудники без потерь на экране (4/4 plans)
- [x] Phase 9: Целостность контента (7/7 plans)
- [x] Phase 10: Рабочий стол: устойчивость, встроенные документы, доступность (9/9 plans)
- [x] Phase 11: Редактор: панель оформления и тексты (8/8 plans)
- [x] Phase 12: Права редакторов и безопасность доступа (8/8 plans)
- [x] Phase 13: Приложение «Справочник» (5/5 plans)

</details>

## Next

### 🚧 v1.2 Повышение (Planned)

**Milestone Goal:** Создать отдельное приложение для запросов на повышение и квалификационных проверок, не смешивая эти процессы и не доверяя критичные решения клиенту.

- [ ] **Phase 14: Приложение «Повышение»** — полный поток обычных повышений и отдельных квалификационных проверок: данные, права, запросы, банки, задания, тесты, кулдауны, пересдачи, история и очистка

## Phase Details

### Phase 14: Приложение «Повышение»

**Goal:** Реализовать целиком безопасное приложение «Повышение», в котором обычные задания и квалификационные проверки остаются раздельными процессами, но поставляются и проверяются в рамках одного этапа.
**Depends on:** v1.1 complete
**Requirements:** PROM-01, PROM-02, PROM-03, PROM-04, PROM-05, PROM-06, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08, COOL-01, COOL-02, COOL-03, COOL-04, COOL-05, QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06, QUAL-07, QUAL-08, QUAL-09, QUAL-10, QUAL-11, QUAL-12, QUAL-13, RETRY-01, RETRY-02, RETRY-03, RETRY-04, RETRY-05, PERM-01, PERM-02, PERM-03, EDIT-01, EDIT-02, EDIT-03, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06

**Success Criteria:**

1. Участник без аккаунта вводит ник в отдельном окне «Повышение», получает только безопасное публичное состояние и может отправить допустимый запрос.
2. Данные ника и звания читаются только из `Portia!A61:E85`, а серверные сроки, уникальные ограничения и rate limit защищают от преждевременных и повторных запросов.
3. В trusted-вкладке `promo`, закрытой по умолчанию, проверяющий отдельно управляет запросами, банками обычных заданий и банками квалификационных вопросов.
4. Обычное повышение поддерживает ручную и случайную выдачу с preview, неизменяемый набор, все заданные кулдауны, квалификационные границы рангов и особое задание для Эксперта вирусолога.
5. Квалификационная проверка поддерживает ручную и случайную сборку, три типа вопросов, пошаговое прохождение без возврата, общий серверный лимит 15 минут и серверный контроль дедлайна.
6. ПК-защита завершает попытку при потере фокуса, видимости или выходе после понятного предупреждения; на телефоне проверка работает без этой защиты.
7. Проверяющий вручную отмечает ответы и отдельно принимает решение, а участник видит итог и необязательный процент без правильных ответов и конкретных ошибок.
8. После провала действует изменяемый срок пересдачи с предложением двух дней, блокировкой нового запроса и единичным уведомлением после окончания ожидания; число попыток не ограничено.
9. Закрытие процессов транзакционно удаляет подробные payload, сохраняет максимум три кратких результата и очищает брошенные либо просроченные данные через три дня.
10. Весь поток успешно проходит автоматические проверки, production build и владельческую UAT на ПК и телефоне, включая прямые запросы к защищённым API.

**Plans:** 12/14 plans executed

- [x] `14-01-PLAN.md` — rules and authoritative sheet loader
- [x] `14-02-PLAN.md` — database contract, atomic RPCs and trusted tab
- [x] `14-03-PLAN.md` — public status, device binding and request APIs
- [x] `14-04-PLAN.md` — reviewer queues, claims, banks and snapshots
- [x] `14-05-PLAN.md` — participant application and ordinary-task flow
- [x] `14-07-PLAN.md` — qualification engine and protected APIs
- [x] `14-06-PLAN.md` — reviewer workspace and bank management
- [x] `14-08-PLAN.md` — participant/reviewer qualification interfaces
- [x] `14-09-PLAN.md` — retake notification and owner SQL rollout gate
- [x] `14-10-PLAN.md` — atomic admission, answer CAS and server test lease
- [x] `14-11-PLAN.md` — API contract migration and qualification heartbeat integration
- [x] `14-12-PLAN.md` — identity, outage, cooldown, notification and cleanup lifecycle fixes
- [ ] `14-13-PLAN.md` — mandatory Promotion UI review remediation
- [ ] `14-14-PLAN.md` — real database verification, owner rollout and PC/phone UAT
