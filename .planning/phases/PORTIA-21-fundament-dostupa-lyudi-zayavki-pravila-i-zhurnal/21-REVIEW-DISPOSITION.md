---
phase: PORTIA-21
source: 21-REVIEW.md
created: 2026-11-09
---

# Phase 21: разбор находок code review

Каждая находка по умолчанию `open`, пока владелец или следующий план не решит иначе. Миграция заморожена: SQL-находки (IN-01, IN-02) закрываются только новой forward-only миграцией или шагом в 21-MIGRATION-APPLY.md.

| ID | Severity | Кратко | Disposition |
|---|---|---|---|
| WR-01 | warning | Живой прогон матрицы пишет на стенде через `portia_access_set_closure`, а тест утверждает, что пробы «инертны» | open |
| WR-02 | warning | Тест «ACC-04 parity» не может упасть: TS-регулярку сравнивают с ней же | open |
| WR-03 | warning | Инвариант «секрет подписи не равен секрету устройства» не проверяется в коде | open |
| WR-04 | warning | Защита self-decision по `requested_by` зависит от клиента, которым Фаза 23 вызовет submit, и этот контракт нигде не закреплён | open |
| WR-05 | warning | `submitAccessRequest` бросает обычный `Error`, хотя модуль обещает `AccessStoreError`; код `invalid` из TS недостижим | open |
| IN-01 | info | Неявная зависимость от pgcrypto в схеме `extensions` | open |
| IN-02 | info | Impossible-state guard: проверки `level-above-own` никогда не срабатывают | open |
| IN-03 | info | Указатели `source` в матрице проверяются слабо: 204 номера строк, а имя объекта не сверяется | open |
| IN-04 | info | Часть тестов читает SQL с комментариями, в отличие от остальных файлов | open |
| IN-05 | info | Копии вспомогательных функций в пяти тестовых файлах с разной семантикой | open |
| IN-06 | info | Мёртвая замена в тесте политики очистки | open |
| IN-07 | info | `AccessStoreError` теряет SQLSTATE | open |
| IN-08 | info | Мелочи в `access-session.ts`: `.slice(0, 64)` ничего не делает, и хелперы cookie продублированы | open |
| IN-09 | info | Хрупкие проверки точного текста и точных количеств | open |
