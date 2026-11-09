# Phase 20: Security, accessibility и приёмка релиза — Pattern Map

**Mapped:** 2026-11-03  
**Files analyzed:** 22 touchpoints (including 3 proposed files)  
**Analogs found:** 22 / 22; all named existing analogs verified with `git ls-files`.

## File Classification

| New/modified file | Role | Data flow | Closest tracked analog | Match |
|---|---|---|---|---|
| `components/portia-wallpaper.tsx` | component | event-driven | same file, `components/portia-wallpaper-spider.tsx` | exact |
| `components/portia-wallpaper-spider.tsx` | component | event-driven | same file | exact |
| `lib/wallpaper-web.ts` | utility | transform | same file | exact |
| `app/portia.css` | config/style | event-driven | same file | exact |
| `components/portia-desktop.tsx` | component/store | event-driven | same file | exact |
| `components/portia-icons.tsx` | component | transform | same file | exact |
| `components/portia-desktop-documents.tsx` | component | request-response | same file | exact |
| `components/portia-promotion.tsx` | component | request-response | same file | exact |
| `components/portia-promotion-editor-main.tsx` | component | CRUD | same file | exact |
| `components/portia-promotion-ordinary-editor.tsx` | component | CRUD | same file | exact |
| `components/portia-promotion-qualification-editor.tsx` | component | CRUD | same file | exact |
| `components/portia-template-builder.tsx` (proposed) | component | file-I/O | `components/portia-desktop-dossier.tsx`, `components/portia-promotion.tsx` | role-match |
| `lib/portia-template-export.ts` (proposed) | utility | file-I/O | `lib/wallpaper-web.ts` (pure utility boundary) | partial |
| `components/portia-desktop-media.tsx` | component | request-response | same file | exact |
| `next.config.ts` | config | request-response | same file | exact |
| `lib/security-headers.test.ts` | test | request-response | same file | exact |
| `tests/e2e/specs/accessibility.spec.ts` | test | event-driven | same file | exact |
| `tests/e2e/fixtures/diagnostics.ts` | utility/test | event-driven | same file | exact |
| `tests/e2e/visual-candidates/*.spec.ts` | test | event-driven | `tests/e2e/visual-candidates/promotion.spec.ts` | exact |
| `tests/e2e/visual/*.spec.ts` | test | event-driven | `tests/e2e/visual/apps.spec.ts` | exact |
| `playwright.config.ts` | config | batch | same file | exact |
| `20-RELEASE-EVIDENCE.md` (proposed) | documentation | batch | `.planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-VERIFICATION.md` | role-match |

Paths for new files are planner choices, not requirements imposed by research. Existing paths are touchpoints from RESEARCH.md; avoid editing all of them unless the specific design requires it.

## Pattern Assignments

### Wallpaper, spider and motion

**Source:** `components/portia-wallpaper.tsx:5-7,15-36,207-229`; `components/portia-wallpaper-spider.tsx:7-19,235-272`; `components/portia-desktop.tsx:47-55,772,1688`.

```tsx
import { seeded, webGeometry } from "@/lib/wallpaper-web";
import { WallpaperSpider } from "./portia-wallpaper-spider";
const web = webPaths();
const WALLPAPER_FADE_MS = 500;
export function DesktopWallpaper({ kind }: { kind: string }) { /* existing kind switch */ }
const motionOn = () => root.dataset.motion !== "reduced" && root.dataset.motion !== "off";
watcher.observe(root, { attributes: true, attributeFilter: ["data-motion", "data-spider"] });
```

Use `webGeometry` for geometry and keep `LEG_PIVOTS` / `ARTWORK_HEADING` in spider (lines 13-19) synchronized with new artwork. Add the flask wallpaper to the existing `kind` switch and the settings allowlist (`portia-desktop.tsx:53`) and chooser (`:1686`); keep `wallpaper: "radar"` default (`:49`). Motion comes from `document.documentElement.dataset.motion` (`:772`), including a mid-animation transition to off. `app/portia.css:1452-1538` contains existing wallpaper and reduced/off selectors; add new selectors next to them.

### Targeted empty illustrations

**Source:** `components/portia-icons.tsx:149-176`; `components/portia-desktop.tsx:1513,1568,1576-1577,1618-1630`; `components/portia-desktop-documents.tsx:166`.

```tsx
export type PortiaIllustrationName = "dish" | "microscope" | "flask";
const illustrations: Record<PortiaIllustrationName, React.ReactNode> = { /* SVG nodes */ };
export function PortiaIllustration({ name, ...props }: { name: PortiaIllustrationName } & SVGProps<SVGSVGElement>) { /* SVG wrapper */ }
```

Extend with *named variants* and change only selected calls: info empty (`portia-desktop.tsx:1577`), news-only broadcast empty (`:1630`, branch by `broadcastTab`), guide empty (`portia-desktop-documents.tsx:166`). Archive/search/fatal/quest states reuse the original names and must retain their current drawings unless explicitly reviewed. Preserve text alongside SVG.

### Promotion participant/reviewer and template entry

**Source:** `components/portia-promotion.tsx:325,396`; `components/portia-promotion-editor-main.tsx:39-42,94-114`; `components/portia-desktop-dossier.tsx:41-60`.

```tsx
const response = await fetch(value ? `/api/promotion/status?nickname=${encodeURIComponent(value)}` : "/api/promotion/status", { cache: "no-store" });
const isDenied = (response: Response, body: Record<string, unknown>) => response.status === 403 && typeof body.code !== "string";
const skeleton = <div className="promotion-skeleton" aria-busy="true" aria-label="Загрузка"><span /><span /><span /></div>;
```

Retain the existing participant API calls, reviewer guard, denied state and retryable message handling. `components/portia-promotion-editor-main.tsx:112-114` demonstrates `setBusy`, response validation, `catch` with retained form state, and `finally`. Build the template entry in participant UI without passing the archive `Virus` model into the builder: `VirusRecord` (`portia-desktop-dossier.tsx:41-60`) includes classifications and scientist logs. Copy visual section structure only, with a restricted local draft model. The new builder needs labelled fields, preview, local image selection, PNG and HTML download; its draft stays in React state for the current session.

### Local image and export

**Source:** `components/portia-desktop-media.tsx:37-73` for loading/error presentation; `components/portia-desktop-dossier.tsx:175-185` for dossier sections. No tracked source provides an exact browser-only PNG plus self-contained HTML export analog. Use the platform File/Canvas/Blob/URL APIs described in RESEARCH.md. Keep the export utility pure where possible; escape user text in HTML, embed validated local image bytes, revoke temporary object URLs, and report decode/export failures while retaining the draft. Add focused utility and browser tests for offline HTML, PNG content, long text and absence of `/api/uploads` or Supabase requests.

### CSP and media fallback

**Source:** `next.config.ts:3-45`; `lib/security-headers.test.ts:1-10,20-58`; `components/portia-desktop-media.tsx:37-73`.

```ts
const allowHttpForE2E = process.env.PORTIA_E2E_ALLOW_HTTP === "1" && process.env.NETLIFY !== "true" && !process.env.CONTEXT;
const upgradeInsecureRequests = !development && !allowHttpForE2E;
// headers array currently includes:
{ key: "Content-Security-Policy", value: contentSecurityPolicy }
```

Existing enforced CSP is the baseline. Add stricter candidate as `Content-Security-Policy-Report-Only` during inventory, explain each violation, then gate enforcement on physical PC/phone evidence. Retain `img-src https:` and distinguish LAN HTTP evidence from published HTTPS/HSTS. `PortiaImage` already uses `onError={() => setState(..."failed")}` (`:72`): extend failed state with a static visual placeholder and visible «Изображение недоступно» text without layout collapse.

### E2E, accessibility, visual and release evidence

**Source:** `tests/e2e/specs/accessibility.spec.ts:1-50`; `tests/e2e/visual-candidates/promotion.spec.ts:1-43`; `tests/e2e/fixtures/diagnostics.ts:62-85,101-142`; `playwright.config.ts:20-37`.

```ts
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";
test("[STAB-BASE-03] capture safe participant Promotion lookup", async ({ page, browser, determinism }, testInfo) => {
  // captureCandidate records the candidate separately from approved baselines.
});
```

Extend axe and manual keyboard/touch journeys on affected surfaces. Candidate captures remain separate from approved `tests/e2e/visual/` snapshots; use `recordBlockedCandidate` for unavailable private states. Collect CSP reports with the diagnostics fixture's redaction and allowlist pattern, without secrets. Final evidence must record exact release commit and technical gates, each physical device step with PASS/FAIL/BLOCKED, screenshot for deviations, separate PC/phone verdicts, and the allowed phone-only retest lineage. Current Phase 19 verifier gaps and BLOCKED states remain explicit until retested.

## Shared Patterns

| Concern | Tracked source | Apply to |
|---|---|---|
| Motion | `components/portia-desktop.tsx:772,998-999`; `components/portia-wallpaper-spider.tsx:235-272` | Spider, flask wallpaper, UI transitions; off reaches terminal state immediately |
| Safe API projection | `app/api/promotion/test/route.ts:12-47`; `app/api/promotion/reviewer/route.ts:14-27` | Participant/reviewer regression; assert response bodies, not only hidden UI |
| Request errors and guards | `components/portia-promotion-editor-main.tsx:39-42,94-114` | Promotion redesign; keep denied state and draft retention |
| Visual baselines | `tests/e2e/visual-candidates/promotion.spec.ts:6-43` | New art and Promotion before owner approval |
| Diagnostic redaction | `tests/e2e/fixtures/diagnostics.ts:62-85,131-142` | CSP report inventory and release ledger |
| Header assertions | `lib/security-headers.test.ts:9-58` | Enforced/report-only CSP and HTTP/HTTPS conditions |

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `lib/portia-template-export.ts` | utility | file-I/O | No existing tracked client-side PNG and embedded-image HTML export; use RESEARCH.md platform API guidance. |

## Metadata

**Search scope:** `components/`, `lib/`, `app/`, `tests/e2e/`, `next.config.ts`, planning verification documents.  
**Tracked-source gate:** existing analogs checked with `git ls-files`; no install/runtime mirror paths used.  
**Pattern extraction date:** 2026-11-03.
