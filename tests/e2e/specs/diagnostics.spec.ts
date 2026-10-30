import type { TestInfo } from "@playwright/test";
import {
  assertDiagnosticsClean,
  type DiagnosticEntry,
} from "../fixtures/diagnostics";
import {
  assertNoOwnApiFulfilled,
  externalFixtureHosts,
} from "../fixtures/external-routes";
import { expect, test } from "../fixtures/test";

test("[STAB-BASE-05] @smoke real root has deterministic runtime and no unexpected diagnostics", async ({ page, determinism }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  const runtime = await page.evaluate(() => ({
    now: new Date().toISOString(),
    random: JSON.parse(
      window.sessionStorage.getItem("portia-e2e-random-probe") ?? "[]",
    ) as number[],
    settings: window.localStorage.getItem("portia-desktop-settings-v1"),
    revision: window.sessionStorage.getItem("portia-e2e-fixture-revision"),
  }));
  expect(runtime.now).toBe("2026-10-30T06:00:00.000Z");
  expect(runtime.random).toEqual([
    0.4454130679368973,
    0.42297563678584993,
    0.7578889396972954,
  ]);
  expect(runtime.settings).toBe(JSON.stringify(determinism.settings));
  expect(runtime.revision).toBe(determinism.revision);
});

const diagnosticProbes: DiagnosticEntry[] = [
  { kind: "console", source: "browser", text: "token=super-secret-value" },
  { kind: "pageerror", source: "browser", text: "boom https://secret.invalid/path" },
  { kind: "requestfailed", source: "fetch", text: "GET https://secret.invalid/api failed" },
  { kind: "response", source: "fetch", text: "GET https://secret.invalid/api", status: 500 },
  { kind: "hydration", source: "console", text: "Hydration did not match https://secret.invalid" },
  { kind: "csp", source: "script-src", text: "https://secret.invalid/script.js" },
];

test("[STAB-BASE-05] every diagnostic class enters the redacted failing path", async ({}, testInfo) => {
  for (const [index, probe] of diagnosticProbes.entries()) {
    let failure: unknown;
    try {
      await assertDiagnosticsClean([probe], testInfo, `diagnostic-probe-${index}`);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toContain("PORTIA_E2E_DIAGNOSTICS");
    const attachment = (testInfo as TestInfo).attachments.find(
      (candidate) => candidate.name === `diagnostic-probe-${index}`,
    );
    const body = attachment?.body?.toString("utf8") ?? "";
    expect(body).not.toContain("super-secret-value");
    expect(body).not.toContain("https://secret.invalid");
    expect(body).toContain("redacted");
  }
});

test("[STAB-BASE-05] external fixtures are named and own API fulfillment is rejected", async () => {
  expect(externalFixtureHosts).toEqual([
    "docs.google.com",
    "users.roblox.com",
    "thumbnails.roblox.com",
  ]);
  expect(() =>
    assertNoOwnApiFulfilled([
      { host: "127.0.0.1", path: "/api/content", fulfilled: true },
    ])).toThrow("PORTIA_E2E_OWN_API_MOCKED");
});
