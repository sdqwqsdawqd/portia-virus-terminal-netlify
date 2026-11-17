import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonObject, parseLimitedJsonObject } from "./request-json.ts";

test("parseJsonObject: empty, broken and non-object bodies give null", () => {
  for (const raw of ["", "not json", "[]", "null", "5", "\"x\"", "true"]) {
    assert.equal(parseJsonObject(raw), null, JSON.stringify(raw));
  }
});

test("parseJsonObject: a JSON object comes back as is", () => {
  assert.deepEqual(parseJsonObject("{}"), {});
  assert.deepEqual(parseJsonObject("{\"a\":1}"), { a: 1 });
  assert.deepEqual(parseJsonObject(" {\"id\":\"x\"} "), { id: "x" });
});

test("bounded JSON reader accepts split input and rejects an oversized stream", async () => {
  const encoder = new TextEncoder();
  const split = new Request("http://localhost/", { method: "POST", body: new ReadableStream({
    start(controller) { controller.enqueue(encoder.encode('{"nickname":')); controller.enqueue(encoder.encode('"Visitor_1"}')); controller.close(); },
  }), duplex: "half" } as RequestInit);
  assert.deepEqual(await parseLimitedJsonObject(split, 64), { nickname: "Visitor_1" });
  const oversized = new Request("http://localhost/", { method: "POST", body: "x".repeat(2048) });
  assert.equal(await parseLimitedJsonObject(oversized, 1024), null);
});
