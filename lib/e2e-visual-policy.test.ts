import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertVisualDiffAllowed,
  VISUAL_DIFF_CEILING,
  visualPolicyStates,
} from "../tests/e2e/fixtures/visual-policy.ts";

describe("Phase 15 visual policy", () => {
  test("declares all 23 approved visual states", () => {
    assert.equal(visualPolicyStates.length, 23);
    assert.equal(new Set(visualPolicyStates).size, 23);
  });

  test("rejects removal of a complete 16 by 32 pixel control on a static surface", () => {
    const removedControlPixels = 16 * 32;
    assert.ok(removedControlPixels < VISUAL_DIFF_CEILING);
    assert.throws(
      () => assertVisualDiffAllowed("desktop:clean", removedControlPixels),
      /PORTIA_VISUAL_DIFF/,
    );
  });

  test("each state enforces its declared bounded cap", () => {
    assert.doesNotThrow(() => assertVisualDiffAllowed("desktop:clean", 256));
    assert.throws(
      () => assertVisualDiffAllowed("desktop:clean", 257),
      /PORTIA_VISUAL_DIFF/,
    );
  });
});
