---
phase: 15
source: 15-REVIEW.md
review_commit: c958827
updated: 2026-11-01
---

# Phase 15 — диспозиция находок code review

12 находок: 0 critical, 6 warning, 6 info. WR-04 исправлена; остальные `open`.

Отдельно (замечание верификатора W1): `PORTIA_E2E_ALLOW_HTTP=1` больше не снимает `upgrade-insecure-requests` в сборках Netlify (`NETLIFY=true`).

| ID | Severity | Disposition | Reason |
|----|----------|-------------|--------|
| WR-01 | warning | open | — |
| WR-02 | warning | open | — |
| WR-03 | warning | open | — |
| WR-04 | warning | fixed | Preflight отказывает с `production-target`, если ref из `NEXT_PUBLIC_SUPABASE_URL` есть в `PORTIA_E2E_PRODUCTION_PROJECT_IDS`; тест в `lib/e2e-preflight.test.ts`. |
| WR-05 | warning | open | — |
| WR-06 | warning | open | — |
| IN-01 | info | open | — |
| IN-02 | info | open | — |
| IN-03 | info | open | — |
| IN-04 | info | open | — |
| IN-05 | info | open | — |
| IN-06 | info | open | — |
