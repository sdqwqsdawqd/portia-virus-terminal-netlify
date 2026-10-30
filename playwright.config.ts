import { defineConfig, devices } from "@playwright/test";

const localBaseURL = "http://127.0.0.1:3000";
const externalBaseURL = process.env.PORTIA_E2E_BASE_URL;
const baseURL = externalBaseURL ?? localBaseURL;
const isCI = Boolean(process.env.CI);
const visualCandidatesRequested = process.argv.some((argument) =>
  argument.replaceAll("\\", "/").includes("visual-candidates"),
);

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: visualCandidatesRequested ? [] : ["**/visual-candidates/**"],
  outputDir: "test-results/playwright",
  expect: {
    toHaveScreenshot: {
      pathTemplate: "{testDir}/visual/__screenshots__/{arg}{ext}",
    },
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/playwright/results.json" }],
  ],
  use: {
    baseURL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    colorScheme: "dark",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command:
          "npm run build && npm run start -- --hostname 127.0.0.1 --port 3000",
        url: localBaseURL,
        env: { PORTIA_E2E_ALLOW_HTTP: "1" },
        reuseExistingServer: false,
        timeout: 180_000,
      },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "chromium-dpr125",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1.25,
      },
    },
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "webkit-phone",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "chromium-phone",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
