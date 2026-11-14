import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { accessIpBucket, accessTokenDigest } from "./access-session.ts";
import { submitAccessRequest, type AccessRpcClient, type SubmitResult } from "./access-store.ts";
import { ACCESS_SUBMIT_UNAUTHORIZED_ALERT, accessSubmitStatus, reportAccessSubmit } from "./access-request-reply.ts";

// Explicit test values, never real secrets.
const submitSecret = "k".repeat(43);
const sessionSecret = "s".repeat(40);
const token = "a".repeat(43);

function sink() {
  const lines: unknown[][] = [];
  return { lines, alert: (...args: unknown[]) => { lines.push(args); } };
}

test("unauthorized submit is logged once per reply as an alert without the secret, signature, nickname, token hash or IP bucket (G-PORTIA-23-3-log)", async () => {
  const tokenHash = accessTokenDigest(token, sessionSecret);
  const ipBucket = accessIpBucket(new Headers({ "x-forwarded-for": "203.0.113.7" }), sessionSecret);
  const calls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
  const client: AccessRpcClient = {
    rpc(fn, args) {
      calls.push({ fn, args });
      return Promise.resolve({ data: { code: "unauthorized" }, error: null });
    },
  };
  const result = await submitAccessRequest(client, { nickname: "Visitor_1", origin: "sheet", tokenHash, ipBucket, submitSecret });
  assert.deepEqual(result, { code: "unauthorized" });
  assert.equal(calls.length, 1);
  const signature = String(calls[0].args?.p_signature);
  assert.match(signature, /^[0-9a-f]{64}$/);

  const first = sink();
  reportAccessSubmit(result, first.alert);
  assert.deepEqual(first.lines, [[ACCESS_SUBMIT_UNAUTHORIZED_ALERT]]);

  const line = ACCESS_SUBMIT_UNAUTHORIZED_ALERT;
  assert.equal(typeof line, "string");
  assert.doesNotMatch(line, /[\r\n]/);
  assert.ok(line.includes("PORTIA_ACCESS_SUBMIT_SECRET"));
  for (const value of [submitSecret, sessionSecret, token, signature, "Visitor_1", tokenHash, ipBucket, "203.0.113.7"]) {
    assert.ok(!line.includes(value), "full value");
    assert.ok(!line.includes(value.slice(0, 8)), "value prefix");
  }

  // Every reply, not once per process.
  reportAccessSubmit(result, first.alert);
  assert.equal(first.lines.length, 2);
  assert.equal(accessSubmitStatus("unauthorized"), 503);
});

test("other submit codes are not logged and keep their HTTP status", () => {
  const results: Array<[SubmitResult, number]> = [
    [{ code: "created" }, 200],
    [{ code: "pending" }, 200],
    [{ code: "approved" }, 200],
    [{ code: "invalid" }, 400],
    [{ code: "throttled" }, 429],
    [{ code: "device-busy" }, 503],
    [{ code: "unavailable" }, 503],
    [{ code: "cooldown", retryAt: "2026-11-15T18:00:00Z" }, 409],
    [{ code: "unauthorized" }, 503],
  ];
  for (const [result, status] of results) {
    const recorder = sink();
    reportAccessSubmit(result, recorder.alert);
    assert.equal(recorder.lines.length, result.code === "unauthorized" ? 1 : 0, result.code);
    assert.equal(accessSubmitStatus(result.code), status, result.code);
  }
});

test("the request route reports every result and keeps its reply (G-PORTIA-23-3-log)", () => {
  const route = readFileSync(fileURLToPath(new URL("../app/api/access/request/route.ts", import.meta.url)), "utf8");
  for (const part of [
    'from "@/lib/access-request-reply"',
    "reportAccessSubmit(result);",
    "const status = accessSubmitStatus(result.code);",
    "return Response.json(result, { status, headers });",
    '["created", "pending", "approved"].includes(result.code) && !existingToken',
  ]) assert.ok(route.includes(part), part);
  assert.equal(route.split("console.").length - 1, 1);
  assert.ok(route.includes('console.error("PORTIA access request failed"'));
  assert.doesNotMatch(route, /result\.code === "invalid" \? 400/);
});
