import type { Locator, Page } from "@playwright/test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

export const VISUAL_DIFF_CEILING = 2_300;

export type VisualState =
  | "desktop:clean"
  | "desktop:dpr125"
  | "desktop:phone-chromium"
  | "desktop:phone-webkit"
  | "desktop:start-open"
  | "desktop:search-restored"
  | "desktop:search-maximized"
  | "desktop:search-minimized"
  | `application:${"virus-archive" | "employees" | "broadcasts" | "information" | "guide" | "trash" | "settings" | "search" | "table" | "charter"}`
  | "editor:visitor-denied"
  | "editor:signed-out-login"
  | "motion:web-rest"
  | `motion:vivian-${"idle" | "activity" | "offended" | "recovery"}`
  | "promotion:participant-lookup";

type MaskRegion = "employees-live-data" | "external-document-frame";

type VisualPolicyDeclaration = Readonly<{
  maxDiffPixels: number;
  animations?: "allow" | "disabled";
  maskRegions?: readonly MaskRegion[];
  threshold?: number;
}>;

const desktopPolicy = Object.freeze({ maxDiffPixels: 256 }) satisfies VisualPolicyDeclaration;
const applicationPolicy = Object.freeze({ maxDiffPixels: 2_300 }) satisfies VisualPolicyDeclaration;
const editorPolicy = Object.freeze({ maxDiffPixels: 2_300 }) satisfies VisualPolicyDeclaration;
const motionPolicy = Object.freeze({
  animations: "allow" as const,
  maxDiffPixels: VISUAL_DIFF_CEILING,
  threshold: 0.3,
}) satisfies VisualPolicyDeclaration;

type ImageComparison = { errorMessage: string; diff?: Buffer } | null;
type ImageComparator = (
  actual: Buffer,
  expected: Buffer,
  options: { maxDiffPixels: number; threshold?: number },
) => ImageComparison;

// shortcut: internal Playwright API, verified for the pinned @playwright/test 1.64.1; re-check on every Playwright upgrade.
const require = createRequire(import.meta.url);
const { utils: playwrightUtils } = require("playwright-core/lib/coreBundle") as {
  utils?: { getComparator?: (mimeType: string) => ImageComparator };
};
if (typeof playwrightUtils?.getComparator !== "function") {
  throw new Error("[PORTIA_VISUAL_COMPARATOR_MISSING] playwright-core utils.getComparator not found; expected @playwright/test 1.64.1");
}
const comparePng = playwrightUtils.getComparator("image/png");

const declarations: Record<VisualState, VisualPolicyDeclaration> = {
  "desktop:clean": desktopPolicy,
  "desktop:dpr125": desktopPolicy,
  "desktop:phone-chromium": desktopPolicy,
  "desktop:phone-webkit": desktopPolicy,
  "desktop:start-open": desktopPolicy,
  "desktop:search-restored": desktopPolicy,
  "desktop:search-maximized": desktopPolicy,
  "desktop:search-minimized": desktopPolicy,
  "application:virus-archive": applicationPolicy,
  "application:employees": { ...applicationPolicy, maskRegions: ["employees-live-data"] },
  "application:broadcasts": applicationPolicy,
  "application:information": applicationPolicy,
  "application:guide": applicationPolicy,
  "application:trash": applicationPolicy,
  "application:settings": applicationPolicy,
  "application:search": applicationPolicy,
  "application:table": { ...applicationPolicy, maskRegions: ["external-document-frame"] },
  "application:charter": { ...applicationPolicy, maskRegions: ["external-document-frame"] },
  "editor:visitor-denied": editorPolicy,
  "editor:signed-out-login": editorPolicy,
  "motion:web-rest": motionPolicy,
  "motion:vivian-idle": motionPolicy,
  "motion:vivian-activity": motionPolicy,
  "motion:vivian-offended": motionPolicy,
  "motion:vivian-recovery": motionPolicy,
  "promotion:participant-lookup": applicationPolicy,
};

function maskLocator(page: Page, region: MaskRegion): Locator {
  switch (region) {
    case "employees-live-data":
      return page.locator(".personnel-app");
    case "external-document-frame":
      return page.locator("iframe");
  }
}

export function visualPolicy(page: Page, state: VisualState) {
  const declaration = declarations[state];
  if (declaration.maxDiffPixels > VISUAL_DIFF_CEILING) {
    throw new Error(`[PORTIA_VISUAL_POLICY_CEILING:${state}]`);
  }
  const mask = declaration.maskRegions?.map((region) => maskLocator(page, region));
  return {
    animations: declaration.animations,
    mask,
    maskColor: mask?.length ? "#0c1715" : undefined,
    maxDiffPixels: declaration.maxDiffPixels,
    scale: "device" as const,
    threshold: declaration.threshold,
  };
}

export async function compareApprovedScreenshot(page: Page, state: VisualState, name: string) {
  if (!/^[a-z0-9-]+\.png$/u.test(name)) {
    throw new Error(`[PORTIA_VISUAL_SNAPSHOT_NAME:${name}]`);
  }
  const policy = visualPolicy(page, state);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const localImages = [...document.images].filter((image) => {
      try {
        return new URL(image.currentSrc || image.src, location.href).origin === location.origin;
      } catch {
        return false;
      }
    });
    await Promise.all(localImages.map((image) => image.decode().catch(() => undefined)));
  });
  const actual = await page.screenshot({
    animations: policy.animations ?? "disabled",
    caret: "hide",
    mask: policy.mask,
    maskColor: policy.maskColor,
    scale: policy.scale,
  });
  const expected = readFileSync(path.resolve(
    process.cwd(),
    "tests/e2e/visual/__screenshots__",
    name,
  ));
  const comparison = comparePng(actual, expected, {
    maxDiffPixels: policy.maxDiffPixels,
    threshold: policy.threshold,
  });
  if (comparison) {
    throw new Error(`[PORTIA_VISUAL_DIFF:${state}] ${comparison.errorMessage}`);
  }
}

export const visualPolicyStates = Object.freeze(
  Object.keys(declarations) as VisualState[],
);
