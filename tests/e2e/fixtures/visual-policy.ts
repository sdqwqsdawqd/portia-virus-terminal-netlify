import type { Locator, Page } from "@playwright/test";

export const VISUAL_DIFF_CEILING = 2_300;

export type VisualState =
  | "desktop:clean"
  | "desktop:start-open"
  | "desktop:search-restored"
  | "desktop:search-maximized"
  | "desktop:search-minimized"
  | `application:${"virus-archive" | "employees" | "broadcasts" | "information" | "guide" | "trash" | "settings" | "search" | "table" | "charter"}`
  | "editor:visitor-denied"
  | "editor:signed-out-login"
  | `motion:shortcut-${"start" | "key" | "interruption" | "end" | "rest"}`
  | "promotion:participant-lookup";

type MaskRegion = "employees-live-data" | "external-document-frame";

type VisualPolicyDeclaration = Readonly<{
  maxDiffPixels: number;
  animations?: "allow" | "disabled";
  maskRegions?: readonly MaskRegion[];
}>;

const desktopPolicy = Object.freeze({ maxDiffPixels: 256 }) satisfies VisualPolicyDeclaration;
const applicationPolicy = Object.freeze({ maxDiffPixels: 2_300 }) satisfies VisualPolicyDeclaration;
const editorPolicy = Object.freeze({ maxDiffPixels: 2_300 }) satisfies VisualPolicyDeclaration;
const motionPolicy = Object.freeze({
  animations: "allow" as const,
  maxDiffPixels: 1_200,
}) satisfies VisualPolicyDeclaration;

const declarations: Record<VisualState, VisualPolicyDeclaration> = {
  "desktop:clean": desktopPolicy,
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
  "motion:shortcut-start": motionPolicy,
  "motion:shortcut-key": motionPolicy,
  "motion:shortcut-interruption": motionPolicy,
  "motion:shortcut-end": motionPolicy,
  "motion:shortcut-rest": motionPolicy,
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
  };
}

export function assertVisualDiffAllowed(state: VisualState, changedPixels: number) {
  const cap = declarations[state].maxDiffPixels;
  if (!Number.isInteger(changedPixels) || changedPixels < 0 || changedPixels > cap) {
    throw new Error(`[PORTIA_VISUAL_DIFF:${state}] ${changedPixels} > ${cap}`);
  }
}

export const visualPolicyStates = Object.freeze(
  Object.keys(declarations) as VisualState[],
);
