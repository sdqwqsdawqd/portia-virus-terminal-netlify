import { expect, test } from "@playwright/test";

const boundedProjects = [
  "chromium-desktop",
  "chromium-dpr125",
  "firefox-desktop",
  "webkit-phone",
  "chromium-phone",
] as const;

test("[STAB-BASE-02] @smoke runner exposes only a bounded browser project", async ({}, testInfo) => {
  expect(boundedProjects).toContain(testInfo.project.name);
});
