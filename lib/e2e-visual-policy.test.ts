import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "@playwright/test";
import {
  VISUAL_DIFF_CEILING,
  visualPolicy,
  visualPolicyStates,
} from "../tests/e2e/fixtures/visual-policy.ts";

// Same call shape as the approved specs; locator() only records the selector it was asked for.
const fakePage = { locator: (selector: string) => ({ selector }) } as unknown as Page;

function maskSelectors(state: (typeof visualPolicyStates)[number]) {
  const policy = visualPolicy(fakePage, state);
  return policy.mask?.map((locator) => (locator as unknown as { selector: string }).selector);
}

describe("Phase 15 visual policy", () => {
  test("declares all 26 approved visual states", () => {
    assert.equal(visualPolicyStates.length, 26);
    assert.equal(new Set(visualPolicyStates).size, 26);
  });

  test("no state exceeds the ceiling and every state compares at device scale", () => {
    for (const state of visualPolicyStates) {
      const policy = visualPolicy(fakePage, state);
      assert.ok(policy.maxDiffPixels <= VISUAL_DIFF_CEILING, state);
      assert.equal(policy.scale, "device", state);
    }
  });

  test("desktop states reject removal of a complete 16 by 32 pixel control", () => {
    const desktopStates = visualPolicyStates.filter((state) => state.startsWith("desktop:"));
    assert.equal(desktopStates.length, 8);
    for (const state of desktopStates) {
      assert.ok(visualPolicy(fakePage, state).maxDiffPixels < 16 * 32, state);
    }
  });

  test("only employees, table and charter mask regions", () => {
    assert.deepEqual(maskSelectors("application:employees"), [".personnel-app"]);
    assert.deepEqual(maskSelectors("application:table"), ["iframe"]);
    assert.deepEqual(maskSelectors("application:charter"), ["iframe"]);
    const masked = new Set(["application:employees", "application:table", "application:charter"]);
    const unmasked = visualPolicyStates.filter((state) => !masked.has(state));
    assert.equal(unmasked.length, 23);
    for (const state of unmasked) {
      const policy = visualPolicy(fakePage, state);
      assert.equal(policy.mask, undefined, state);
      assert.equal(policy.maskColor, undefined, state);
    }
    for (const state of masked) {
      assert.equal(visualPolicy(fakePage, state as (typeof visualPolicyStates)[number]).maskColor, "#0c1715", state);
    }
  });
});
