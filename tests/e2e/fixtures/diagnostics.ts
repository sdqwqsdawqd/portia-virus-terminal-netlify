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

export const diagnosticAllowlist: readonly DiagnosticAllowlistRow[] = [];

const hydrationPattern = /hydration|server rendered html|did not match|react error #418/i;
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

  record(entry: DiagnosticEntry) {
    this.entries.push(normalizedEntry(entry));
  }
}

export async function assertDiagnosticsClean(
  entries: readonly DiagnosticEntry[],
  testInfo: Pick<TestInfo, "attach" | "project">,
  attachmentName = "portia-diagnostics",
) {
  const normalized = entries.map(normalizedEntry);
  await testInfo.attach(attachmentName, {
    body: Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
  const unexpected = unexpectedDiagnostics(
    normalized,
    testInfo.project.name,
    new Date(deterministicDiagnosticNow),
  );
  if (unexpected.length) {
    throw new Error(
      `[PORTIA_E2E_DIAGNOSTICS] ${unexpected.length} unexpected runtime event(s); see redacted attachment.`,
    );
  }
}

const deterministicDiagnosticNow = "2026-10-30T06:00:00.000Z";

export async function installDiagnostics(page: Page, ledger: DiagnosticLedger) {
  page.on("console", (message) => {
    const text = message.text();
    if (hydrationPattern.test(text)) {
      ledger.record({ kind: "hydration", source: "console", text });
    } else if (message.type() === "error") {
      ledger.record({ kind: "console", source: "browser", text });
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
    ledger.record({
      kind: "response",
      source: response.request().resourceType(),
      text: `${response.request().method()} ${response.url()}`,
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
