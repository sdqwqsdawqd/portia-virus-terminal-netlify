import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyExpectedFaults,
  DiagnosticLedger,
  diagnosticAllowlist,
  redactDiagnosticText,
  sandboxedMeasureFrameScriptBlock,
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

describe("20-60 the sandboxed measuring frame (G1, T-20-141)", () => {
  // The text exactly as the Chromium run measured it (rehearsal 20-13 and the reproduction in 20-60): the trace snapshotter of Playwright
  // runs its own script in the hidden measureCardPage frame, which the product isolates with sandbox="allow-same-origin" on purpose.
  const measured: DiagnosticEntry = {
    kind: "console",
    source: "browser:",
    text: "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.",
  };
  const rule = sandboxedMeasureFrameScriptBlock;

  test("answers the measured entry and names the frame and the plan", () => {
    const result = applyExpectedFaults([measured], [rule]);
    assert.deepEqual(result.forgiven.map((item) => item.entry), [measured]);
    assert.deepEqual(result.remaining, []);
    assert.equal(rule.kind, "console");
    assert.equal(rule.source, "browser:");
    assert.match(rule.reason, /measureCardPage/);
    assert.match(rule.reason, /20-60/);
  });

  test("does not answer another source, another frame, another text, another kind or a longer text", () => {
    const otherSource: DiagnosticEntry = { ...measured, source: "browser:/api/promotion/status" };
    const noSource: DiagnosticEntry = { ...measured, source: "browser" };
    const otherHost: DiagnosticEntry = { ...measured, source: "browser:cdn.example" };
    const blankFrame: DiagnosticEntry = { ...measured, text: measured.text.replace("about:srcdoc", "about:blank") };
    const siteFrame: DiagnosticEntry = { ...measured, text: redactDiagnosticText(measured.text.replace("about:srcdoc", "http://127.0.0.1:3100/")) };
    const otherText: DiagnosticEntry = { ...measured, text: "Failed to load resource: the server responded with a status of 404 (Not Found)" };
    const policyRefusal: DiagnosticEntry = { ...measured, text: "Refused to execute inline script because it violates the following Content Security Policy directive" };
    const prefixed: DiagnosticEntry = { ...measured, text: `Uncaught: ${measured.text}` };
    const suffixed: DiagnosticEntry = { ...measured, text: `${measured.text} Extra.` };
    const otherKind: DiagnosticEntry = { kind: "requestfailed", source: "browser:", text: measured.text };
    const others = [otherSource, noSource, otherHost, blankFrame, siteFrame, otherText, policyRefusal, prefixed, suffixed, otherKind];
    const result = applyExpectedFaults(others, [rule]);
    assert.deepEqual(result.forgiven, []);
    assert.deepEqual(result.remaining, others);
  });

  test("belongs to one test through expectFault and is not in the global allowlist", () => {
    assert.equal(diagnosticAllowlist.length, 11);
    assert.equal(diagnosticAllowlist.some((row) => /Blocked script execution/.test(row.text)), false);
    assert.deepEqual(unexpectedDiagnostics([measured], "chromium-desktop"), [measured]);
    const ledger = new DiagnosticLedger();
    ledger.expectFault(rule);
    assert.equal(ledger.expectedFaults.length, 1);
    assert.equal(new DiagnosticLedger().expectedFaults.length, 0);
  });
});
