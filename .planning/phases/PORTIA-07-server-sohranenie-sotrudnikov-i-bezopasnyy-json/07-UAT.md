---
status: testing
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
source: [07-VERIFICATION.md]
started: 2026-10-20T05:40:00Z
updated: 2026-10-20T05:40:00Z
---

## Current Test

number: 1
name: Ник вне таблицы, набранный в другом регистре, сохраняется в написании Roblox (D-10)
expected: |
  В списке и в ответе POST /api/employees ник показан в написании Roblox (jppk070), а не как набрано;
  повторное добавление в другом регистре даёт «Уже есть в списке». После проверки сотрудник удалён.
awaiting: user response

## Tests

### 1. Ник вне таблицы, набранный в другом регистре, сохраняется в написании Roblox (D-10)
expected: На http://localhost:3123 «+ ВНЕ ТАБЛИЦЫ» с ником в другом регистре (например JPPK070 для jppk070) — в списке показан jppk070; повторное добавление в другом регистре даёт «Уже есть в списке»; затем удалить сотрудника
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
