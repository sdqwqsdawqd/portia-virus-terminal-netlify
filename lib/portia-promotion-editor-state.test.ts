import assert from "node:assert/strict";
import test from "node:test";
import { requestForActiveQueue } from "./portia-promotion-editor-state.ts";

test("switching request type never shows a card from the previous queue", () => {
  const ordinary = [{ requestId: "ordinary", nickname: "A" }];
  const qualification = [{ requestId: "qualification", nickname: "B" }];
  assert.equal(requestForActiveQueue(ordinary, "ordinary")?.nickname, "A");
  assert.equal(requestForActiveQueue(qualification, "ordinary")?.nickname, "B");
  assert.equal(requestForActiveQueue([], "ordinary"), null);
});
