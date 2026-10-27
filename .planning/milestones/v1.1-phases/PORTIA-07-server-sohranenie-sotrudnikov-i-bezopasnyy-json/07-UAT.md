---
status: complete
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
source: [07-VERIFICATION.md]
started: 2026-10-20T05:40:00Z
updated: 2026-10-20T05:35:13.374Z
---

## Current Test

[testing complete]

## Tests

### 1. Ник вне таблицы, набранный в другом регистре, сохраняется в написании Roblox (D-10)
expected: На http://localhost:3123 «+ ВНЕ ТАБЛИЦЫ» с ником в другом регистре (например JPPK070 для jppk070) — в списке показан jppk070; повторное добавление в другом регистре даёт «Уже есть в списке»; затем удалить сотрудника
result: pass

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
