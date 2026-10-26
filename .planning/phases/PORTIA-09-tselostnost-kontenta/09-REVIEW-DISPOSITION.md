---
phase: PORTIA-09
review: 09-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Wave pulses on the web never die out, so the 8-slot pool can fill with invisible pulses and stop new footfall waves"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Normalizer's id guarantees are incomplete (duplicate ids, scientist log ids, recycle file ids)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Derived ids are not \"position only\", which contradicts the comment and weakens the stability claim"
  - id: IN-01
    severity: info
    disposition: open
    title: "`!today` guards in `portia-desktop.tsx` are now dead code"
  - id: IN-02
    severity: info
    disposition: open
    title: "The request body is fully read before the size limit is applied"
  - id: IN-03
    severity: info
    disposition: open
    title: "Error colour is hardcoded and duplicated; `contentBodyBytes` comment overstates the bound"
---

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | fixed in 2994ab5; BG-01; echoes under PULSE_MIN_PEAK (0.04) stop spreading; test "waves die out: with no new footfalls every slot is free again within 10 s, from any thread" (node --experimental-strip-types --test lib/wallpaper-web.test.ts), fails with the floor set to 0 |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
