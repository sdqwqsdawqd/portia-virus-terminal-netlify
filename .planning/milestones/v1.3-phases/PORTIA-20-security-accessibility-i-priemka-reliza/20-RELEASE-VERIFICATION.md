# 20-RELEASE-VERIFICATION: статусы требований Phase 20 на итоговом release commit

FRC: `a05a6019e867a39a42e2d33b9e4f176d281bc659`. Статусы совпадают с реестром 20-RECONCILIATION.md и REQUIREMENTS.md. Для STAB-VIS-01..04, STAB-TMPL-01 и STAB-REL-08 визуальная часть доказательства — общий вердикт владельца 20-58 (D-68) и эталоны 20-12 (фиксированные данные), а часть «на PC/phone» — принятый риск D-70, не PASS. Эта проверка агента отличается от независимой GSD 20-VERIFICATION.md, которая появляется после выполнения фазы.

| ID | Статус | Источник | FRC |
|---|---|---|---|
| STAB-MEDIA-07 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-A11Y-01 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-A11Y-02 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-A11Y-03 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-A11Y-04 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-SEC-02 | PASS | 20-SECURITY-MATRIX.md; unit-гейт FRC (1683 pass, 0 fail) | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-SEC-03 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-SEC-05 | PASS | 20-SECURITY-MATRIX.md (охват маршрутов и файлов); audit-prod и audit-evidence PASS на FRC | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-SEC-06 | PASS | 20-RELEASE-NOTES.md (status final, release_commit = FRC); --verify-docs | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-VIS-01 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-VIS-02 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-VIS-03 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-VIS-04 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-TMPL-01 | PASS | ui-contract-offline PASS 150/0/14 на FRC (offline D-68); unit-гейт FRC | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-REL-01 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-REL-02 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-REL-03 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-REL-05 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-REL-06 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-REL-07 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-REL-08 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-SEARCH-05 | PASS | unit-гейт FRC (lib/search-recommendations и др.); 20-RELEASE-EVIDENCE.md, D-43/D-44/D-37 | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-SEARCH-06 | PASS | unit-гейт FRC (lib/search-index и др.); 20-RELEASE-EVIDENCE.md, D-43/D-44/D-37 | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-SEARCH-07 | PASS | unit-гейт FRC (lib/portia-desktop и др.); 20-RELEASE-EVIDENCE.md, D-43/D-44/D-37 | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-CLASS-01 | PASS | unit-гейт FRC (lib/virus-classes); 20-CLASS-MIGRATION-EVIDENCE.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-CLASS-02 | PASS | unit-гейт FRC (lib/portia-content-normalize); 20-CLASS-MIGRATION-EVIDENCE.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-CLASS-03 | PASS | 20-CLASS-MIGRATION-EVIDENCE.md (staging, фикстура); production — ОЖИДАЕТ ВЛАДЕЛЬЦА, не PASS агента | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-CLASS-04 | PASS | unit-гейт FRC; 20-RELEASE-EVIDENCE.md, D-35..D-45 | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-EDIT-01 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-EDIT-02 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-EDIT-03 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |
| STAB-EDIT-04 | Принятый долг (D-70) | 20-RECONCILIATION.md, реестр «Принятые долги (D-70)»; 20-UAT.md | a05a6019e867a39a42e2d33b9e4f176d281bc659 |

Приёмка на устройствах: ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)
Итог релиза: BLOCKED
