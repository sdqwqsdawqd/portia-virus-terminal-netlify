import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
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
