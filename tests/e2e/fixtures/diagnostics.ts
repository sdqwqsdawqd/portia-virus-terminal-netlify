import type { Page, TestInfo } from "@playwright/test";

export type DiagnosticKind =
  | "console"
  | "pageerror"
  | "requestfailed"
  | "response"
  | "hydration"
  | "csp";

export type DiagnosticEntry = Readonly<{
  kind: DiagnosticKind;
  source: string;
  text: string;
  status?: number;
}>;

export type DiagnosticAllowlistRow = Readonly<{
  kind: DiagnosticKind;
  source: string;
  text: string;
  project: string;
  requirement: string;
  reason: string;
  owner: string;
  expires: string;
}>;

const promotionUnboundProjects = [
  "chromium-desktop",
  "chromium-dpr125",
  "firefox-desktop",
  "webkit-phone",
  "chromium-phone",
] as const;

// 20-08 (D-05): WebKit logs this console error for ANY policy delivered as Content-Security-Policy-Report-Only without a
// report-to/report-uri, and says the policy then has no effect there. The candidate has no collector on purpose (violations are
// read from securitypolicyviolation events), so WebKit observes nothing and Chromium/Firefox are the observation lanes.
// The text is exact: changing the candidate in next.config.ts fails this row loudly, which forces a fresh review.
const webkitReportOnlyNotice: DiagnosticAllowlistRow = {
  kind: "console",
  source: "browser",
  text: "The Content Security Policy 'default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; media-src 'self' https:; worker-src 'self' blob:; manifest-src 'self'; frame-src [url-redacted] [url-redacted] [url-redacted] [url-redacted] was delivered in report-only mode, but does not specify a 'report-to'; the policy will have no effect. Please either add a 'report-to' directive, or deliver the policy via the 'Content-Security-Policy' header.",
  project: "webkit-phone",
  requirement: "STAB-SEC-03",
  reason: "WebKit ignores a report-only policy that has no report-to; the candidate is observed in Chromium and Firefox.",
  owner: "phase-20-csp-candidate",
  expires: "2027-01-31T00:00:00.000Z",
};

export const diagnosticAllowlist: readonly DiagnosticAllowlistRow[] = [...promotionUnboundProjects.flatMap(
  (project) => [
    {
      kind: "response" as const,
      source: "fetch",
      text: "GET /api/promotion/status -> 404",
      project,
      requirement: "STAB-BASE-02",
      reason: "An unbound device is the expected first-visit Promotion state.",
      owner: "promotion-api-contract",
      expires: "2027-01-31T00:00:00.000Z",
    },
    {
      kind: "console" as const,
      source: "browser:/api/promotion/status",
      text: "Failed to load resource: the server responded with a status of 404 (Not Found)",
      project,
      requirement: "STAB-BASE-02",
      reason: "The browser mirrors the expected unbound-device 404 to its console.",
      owner: "promotion-api-contract",
      expires: "2027-01-31T00:00:00.000Z",
    },
  ],
), webkitReportOnlyNotice];

// 20-25 (T-20-37): a fault THIS test causes on purpose (an aborted own API, a held frame, a cancelled image). Rules belong to one test,
// match by kind + resource type (or console source) + error text, and are applied when the test ends, so an event that arrives after
// the test body finished is judged by the same rule. The global allowlist above is not touched. csp, pageerror and hydration events
// can never be expected: they are product defects, not a fault the test injects.
export type ExpectedFaultRule = Readonly<{
  kind: Exclude<DiagnosticKind, "csp" | "pageerror" | "hydration">;
  /** Resource type for requestfailed/response entries, console source for console entries. Omit to match any. */
  source?: string | RegExp;
  /** Matched against the redacted text: URLs are already `[url-redacted]`, so a host name is not available in requestfailed/console text. */
  text: RegExp;
  reason: string;
}>;

const neverExpected: readonly DiagnosticKind[] = ["csp", "pageerror", "hydration"];

function ruleMatches(rule: ExpectedFaultRule, entry: DiagnosticEntry) {
  if (rule.kind !== entry.kind) return false;
  if (rule.source !== undefined) {
    const sourceMatches = typeof rule.source === "string" ? rule.source === entry.source : rule.source.test(entry.source);
    if (!sourceMatches) return false;
  }
  return rule.text.test(entry.text);
}

export function applyExpectedFaults(entries: readonly DiagnosticEntry[], rules: readonly ExpectedFaultRule[]) {
  const remaining: DiagnosticEntry[] = [];
  const forgiven: { rule: ExpectedFaultRule; entry: DiagnosticEntry }[] = [];
  for (const entry of entries) {
    const rule = rules.find((candidate) => ruleMatches(candidate, entry));
    if (rule) forgiven.push({ rule, entry });
    else remaining.push(entry);
  }
  return { remaining, forgiven };
}

const hydrationPattern =/hydration|server rendered html|did not match|react error #418/i;
const secretPattern =
  /(?:bearer\s+|token[=:]\s*|key[=:]\s*|cookie[=:]\s*)[^\s,;]+|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi;

export function redactDiagnosticText(value: unknown) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s)\]}]+/gi, "[url-redacted]")
    .replace(secretPattern, "[secret-redacted]")
    .replace(/[A-Za-z0-9_-]{48,}/g, "[opaque-redacted]")
    .slice(0, 1_000);
}

function isAllowed(entry: DiagnosticEntry, projectName: string, now: Date) {
  return diagnosticAllowlist.some(
    (row) =>
      row.kind === entry.kind &&
      row.source === entry.source &&
      row.text === entry.text &&
      row.project === projectName &&
      Date.parse(row.expires) > now.getTime(),
  );
}

export function unexpectedDiagnostics(
  entries: readonly DiagnosticEntry[],
  projectName: string,
  now = new Date(),
) {
  return entries.filter((entry) => !isAllowed(entry, projectName, now));
}

function normalizedEntry(entry: DiagnosticEntry): DiagnosticEntry {
  return Object.freeze({
    ...entry,
    source: redactDiagnosticText(entry.source),
    text: redactDiagnosticText(entry.text),
  });
}

export class DiagnosticLedger {
  readonly entries: DiagnosticEntry[] = [];
  readonly expectedFaults: ExpectedFaultRule[] = [];

  /** Register a fault this test causes. Call it BEFORE the action that causes it. */
  expectFault(rule: ExpectedFaultRule) {
    if (neverExpected.includes(rule.kind)) {
      throw new Error(`[PORTIA_E2E_EXPECT_FAULT] kind "${rule.kind}" can never be an expected fault`);
    }
    if (!rule.reason.trim()) {
      throw new Error("[PORTIA_E2E_EXPECT_FAULT] an expected fault needs a reason");
    }
    this.expectedFaults.push(rule);
  }

  record(entry: DiagnosticEntry) {
    this.entries.push(normalizedEntry(entry));
  }
}

export async function assertDiagnosticsClean(
  entries: readonly DiagnosticEntry[],
  testInfo: Pick<TestInfo, "attach" | "project">,
  attachmentName = "portia-diagnostics",
  expectedFaults: readonly ExpectedFaultRule[] = [],
) {
  const normalized = entries.map(normalizedEntry);
  await testInfo.attach(attachmentName, {
    body: Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
  const { remaining, forgiven } = applyExpectedFaults(normalized, expectedFaults);
  if (expectedFaults.length) {
    const applied = expectedFaults.map((rule) => ({
      kind: rule.kind,
      source: rule.source === undefined ? null : String(rule.source),
      text: String(rule.text),
      reason: rule.reason,
      matched: forgiven.filter((item) => item.rule === rule).length,
    }));
    await testInfo.attach(`${attachmentName}-expected-faults`, {
      body: Buffer.from(`${JSON.stringify(applied, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });
  }
  const unexpected = unexpectedDiagnostics(
    remaining,
    testInfo.project.name,
    new Date(),
  );
  if (unexpected.length) {
    throw new Error(
      `[PORTIA_E2E_DIAGNOSTICS] ${unexpected.length} unexpected runtime event(s); see redacted attachment.`,
    );
  }
}

export async function installDiagnostics(page: Page, ledger: DiagnosticLedger) {
  page.on("console", (message) => {
    const text = message.text();
    const locationUrl = message.location().url;
    let source = "browser";
    try {
      const location = new URL(locationUrl);
      source = location.origin === new URL(page.url()).origin
        ? `browser:${location.pathname}`
        : `browser:${location.hostname}`;
    } catch {}
    if (hydrationPattern.test(text)) {
      ledger.record({ kind: "hydration", source: "console", text });
    } else if (message.type() === "error") {
      ledger.record({ kind: "console", source, text });
    }
  });
  page.on("pageerror", (error) => {
    ledger.record({ kind: "pageerror", source: "browser", text: error.message });
  });
  page.on("requestfailed", (request) => {
    ledger.record({
      kind: "requestfailed",
      source: request.resourceType(),
      text: `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`,
    });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const responseUrl = new URL(response.url());
    let target = responseUrl.hostname;
    try {
      if (responseUrl.origin === new URL(page.url()).origin) target = responseUrl.pathname;
    } catch {}
    ledger.record({
      kind: "response",
      source: response.request().resourceType(),
      text: `${response.request().method()} ${target} -> ${response.status()}`,
      status: response.status(),
    });
  });
  await page.exposeBinding("__portiaRecordCsp", (_source, payload: unknown) => {
    const candidate = payload as { directive?: unknown; blocked?: unknown };
    ledger.record({
      kind: "csp",
      source: String(candidate.directive ?? "unknown"),
      text: String(candidate.blocked ?? "blocked"),
    });
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const record = (
        window as typeof window & {
          __portiaRecordCsp?: (payload: unknown) => Promise<void>;
        }
      ).__portiaRecordCsp;
      void record?.({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      });
    });
  });
}
