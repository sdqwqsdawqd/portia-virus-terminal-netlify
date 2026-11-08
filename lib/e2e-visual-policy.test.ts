import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import type { Page } from "@playwright/test";
import {
  VISUAL_DIFF_CEILING,
  phase20Surfaces,
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
  const phase20States = visualPolicyStates.filter((state) => state.startsWith("phase20:"));
  const phase15States = visualPolicyStates.filter((state) => !state.startsWith("phase20:"));

  test("declares all 26 approved visual states", () => {
    assert.equal(phase15States.length, 26);
    assert.equal(new Set(phase15States).size, 26);
  });

  test("declares one phase20 state per Phase 20 surface (17 surfaces, D-68)", () => {
    assert.equal(phase20States.length, 17);
    assert.equal(new Set(phase20States).size, 17);
    assert.equal(visualPolicyStates.length, 26 + 17);
    assert.deepEqual(phase20States, phase20Surfaces.map((surface) => `phase20:${surface}`));
    for (const state of phase20States) {
      assert.ok(visualPolicy(fakePage, state).maxDiffPixels <= VISUAL_DIFF_CEILING, state);
    }
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

  test("internal Playwright comparator exists and Playwright is pinned to 1.64.1", () => {
    const { utils } = createRequire(import.meta.url)("playwright-core/lib/coreBundle") as {
      utils?: { getComparator?: (mimeType: string) => unknown };
    };
    assert.equal(typeof utils?.getComparator, "function");
    assert.equal(typeof utils?.getComparator?.("image/png"), "function");
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    assert.equal(pkg.devDependencies["@playwright/test"], "1.64.1");
  });

  test("only employees, table and charter mask regions", () => {
    assert.deepEqual(maskSelectors("application:employees"), [".personnel-app"]);
    assert.deepEqual(maskSelectors("application:table"), ["iframe"]);
    assert.deepEqual(maskSelectors("application:charter"), ["iframe"]);
    const masked = new Set(["application:employees", "application:table", "application:charter"]);
    const unmasked = visualPolicyStates.filter((state) => !masked.has(state));
    assert.equal(unmasked.length, 23 + phase20States.length);
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
