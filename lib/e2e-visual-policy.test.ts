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

  // D-69 (G3, 20-62): the motion scene is made repeatable by controlling time and Animation objects in the scene, never by the policy.
  describe("motion scene determinism (D-69, G3)", () => {
    const motionStates = visualPolicyStates.filter((state) => state.startsWith("motion:"));
    const sceneSource = readFileSync(new URL("../tests/e2e/visual/motion.spec.ts", import.meta.url), "utf8");
    const determinismSource = readFileSync(new URL("../tests/e2e/fixtures/determinism.ts", import.meta.url), "utf8");
    const helperBody = /export async function settleAnimations[\s\S]*?\r?\n\}\r?\n/u.exec(determinismSource)?.[0] ?? "";

    test("the motion policy is pinned: animations allow, 2300 px, threshold 0.3, no mask", () => {
      assert.deepEqual(motionStates, [
        "motion:web-rest",
        "motion:vivian-idle",
        "motion:vivian-activity",
        "motion:vivian-offended",
        "motion:vivian-recovery",
      ]);
      for (const state of motionStates) {
        const policy = visualPolicy(fakePage, state);
        assert.equal(policy.animations, "allow", state);
        assert.equal(policy.maxDiffPixels, 2_300, state);
        assert.equal(policy.threshold, 0.3, state);
        assert.equal(policy.mask, undefined, state);
        assert.equal(policy.maskColor, undefined, state);
      }
    });

    test("the scene settles animations before every comparison, in source order", () => {
      assert.match(sceneSource, /import \{[^}]*\bsettleAnimations\b[^}]*\} from "\.\.\/fixtures\/determinism"/u);
      let from = 0;
      for (const state of motionStates) {
        const call = `compare("${state}")`;
        const at = sceneSource.indexOf(call, from);
        assert.ok(at > from, `${call} is missing or out of order`);
        assert.ok(sceneSource.slice(from, at).includes("settleAnimations("), `settleAnimations( must run before ${call}`);
        from = at + call.length;
      }
    });

    test("the scene does not hide, mask or disable what the frames prove", () => {
      assert.doesNotMatch(sceneSource, /animations:\s*"disabled"|addStyleTag|\bmask\b|maxDiffPixels|threshold/u);
      assert.doesNotMatch(sceneSource, /toBeHidden|\.hide\(|visibility|display:\s*none/u);
    });

    test("settleAnimations exists and acts only on Animation objects", () => {
      assert.ok(helperBody.length > 0, "export async function settleAnimations is missing in determinism.ts");
      assert.match(helperBody, /PORTIA_MOTION_SETTLE_TIMEOUT/u);
      assert.match(helperBody, /getAnimations/u);
      assert.match(helperBody, /\.finished\b/u);
      assert.match(helperBody, /\.pause\(\)/u);
      assert.match(helperBody, /currentTime/u);
      assert.doesNotMatch(
        helperBody,
        /\.style\b|setAttribute|removeAttribute|classList|\.hidden\b|visibility|display\s*[:=]|addStyleTag|innerHTML|textContent|\.remove\(|\.cancel\(|playbackRate/u,
      );
    });
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
