import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyExpectedFaults,
  DiagnosticLedger,
  diagnosticAllowlist,
  unexpectedDiagnostics,
  type DiagnosticEntry,
} from "../tests/e2e/fixtures/diagnostics.ts";

const row = diagnosticAllowlist[0];
const exactEntry: DiagnosticEntry = Object.freeze({
  kind: row.kind,
  source: row.source,
  text: row.text,
});
const expiry = Date.parse(row.expires);

describe("Phase 15 diagnostic expiry", () => {
  test("accepts an exact allowlist row one millisecond before expiry", () => {
    assert.deepEqual(
      unexpectedDiagnostics([exactEntry], row.project, new Date(expiry - 1)),
      [],
    );
  });

  test("rejects the exact expiry instant and one millisecond after", () => {
    assert.deepEqual(
      unexpectedDiagnostics([exactEntry], row.project, new Date(expiry)),
      [exactEntry],
    );
    assert.deepEqual(
      unexpectedDiagnostics([exactEntry], row.project, new Date(expiry + 1)),
      [exactEntry],
    );
  });

  test("requires exact source, text and project matches", () => {
    const beforeExpiry = new Date(expiry - 1);
    const wrongSource = { ...exactEntry, source: `${exactEntry.source}:other` };
    const wrongText = { ...exactEntry, text: `${exactEntry.text} other` };

    assert.deepEqual(
      unexpectedDiagnostics([wrongSource], row.project, beforeExpiry),
      [wrongSource],
    );
    assert.deepEqual(
      unexpectedDiagnostics([wrongText], row.project, beforeExpiry),
      [wrongText],
    );
    assert.deepEqual(
      unexpectedDiagnostics([exactEntry], `${row.project}-other`, beforeExpiry),
      [exactEntry],
    );
  });
});

describe("20-25 expected faults (T-20-37)", () => {
  const aborted: DiagnosticEntry = { kind: "requestfailed", source: "fetch", text: "GET [url-redacted] net::ERR_FAILED" };
  const rule = { kind: "requestfailed" as const, source: "fetch", text: /ERR_FAILED/, reason: "the test aborts its own API" };

  test("keeps the global allowlist at 11 rows", () => {
    assert.equal(diagnosticAllowlist.length, 11);
  });

  test("forgives only an entry that matches kind, source and text", () => {
    const wrongSource: DiagnosticEntry = { ...aborted, source: "image" };
    const wrongText: DiagnosticEntry = { ...aborted, text: "GET [url-redacted] net::ERR_CONNECTION_RESET" };
    const wrongKind: DiagnosticEntry = { kind: "console", source: "fetch", text: aborted.text };
    const result = applyExpectedFaults([aborted, wrongSource, wrongText, wrongKind], [rule]);
    assert.deepEqual(result.forgiven.map((item) => item.entry), [aborted]);
    assert.deepEqual(result.remaining, [wrongSource, wrongText, wrongKind]);
  });

  test("never forgives csp, pageerror or hydration, and needs a reason", () => {
    const ledger = new DiagnosticLedger();
    for (const kind of ["csp", "pageerror", "hydration"] as const) {
      assert.throws(() => ledger.expectFault({ kind: kind as never, text: /./, reason: "x" }), /can never be an expected fault/);
    }
    assert.throws(() => ledger.expectFault({ ...rule, reason: " " }), /needs a reason/);
    ledger.expectFault(rule);
    assert.equal(ledger.expectedFaults.length, 1);
  });
});
