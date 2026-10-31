# Phase 15 Tool Substitutions

**Decision date:** 2026-10-31  
**Owner request:** remove the external design-file and managed deep-scan prerequisites from the active plan.

## Active replacements

| Removed dependency | Repository-native replacement | Installed skill / tool | Evidence |
|---|---|---|---|
| External visual contract and quota-bound review | Six-pillar UI review, technical design audit, deterministic contact sheet and per-hash owner verdict | `gsd-ui-review`, `impeccable`, `playwright-pro` | `15-UI-REVIEW.md`, `15-LOCAL-UI-CONTRACT.md`, frame map, exact PNG hashes, approval ledger |
| Managed repository security scan | Deep cross-file code review plus local auth/API/RLS/header/CSP/upload/dependency/secret checks | `gsd-code-review`, Node test suite, `npm audit`, `rg`, Git | `15-SECURITY.md`, command matrix, findings and dispositions |

## Boundaries

- Historical external artifacts remain read-only provenance; they are not active gates and are not required to finish Phase 15.
- Local UI authority is immutable repository evidence plus named Qloxz verdicts, not an automatically trusted screenshot update.
- Local security review does not claim live penetration testing or production/staging proof. Those behaviors remain covered by isolated staging and owner UAT in later phases.
- Critical/high findings still block completion unless fixed or explicitly accepted by Qloxz with rationale and expiry.

## Additional skills found but not installed

- `vercel-labs/agent-skills@web-design-guidelines` — broad web UI review; the installed Impeccable/GSD combination already covers the active need.
- `owasp/secure-agent-playbook@web-security-review` — OWASP-oriented review; optional future addition, not a prerequisite.
- `jeffallan/claude-skills@playwright-expert` — overlaps the already installed `playwright-pro`.
