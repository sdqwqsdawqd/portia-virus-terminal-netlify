import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonObject } from "./request-json.ts";

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
