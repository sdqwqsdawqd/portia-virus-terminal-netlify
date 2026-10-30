import type { Page, Route } from "@playwright/test";
import publicContent from "./data/public-content.json" with { type: "json" };

export type ExternalRouteEntry = Readonly<{
  host: string;
  path: string;
  fulfilled: true;
}>;

export class ExternalRouteLedger {
  readonly entries: ExternalRouteEntry[] = [];

  record(url: URL) {
    this.entries.push(
      Object.freeze({ host: url.hostname, path: url.pathname, fulfilled: true }),
    );
  }
}

export const externalFixtureHosts = [
  "docs.google.com",
  "users.roblox.com",
  "thumbnails.roblox.com",
] as const;
const allowedExternalHosts = new Set<string>(externalFixtureHosts);

async function fulfillExternal(route: Route, ledger: ExternalRouteLedger) {
  const url = new URL(route.request().url());
  if (!allowedExternalHosts.has(url.hostname)) {
    throw new Error(`[PORTIA_E2E_ROUTE_BLOCKED] ${url.hostname}`);
  }
  ledger.record(url);
  if (url.hostname === "docs.google.com") {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: publicContent.google.sheetHtml,
    });
    return;
  }
  const body = url.hostname === "users.roblox.com"
    ? publicContent.roblox.users
    : publicContent.roblox.thumbnails;
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

export async function installExternalRoutes(
  page: Page,
  ledger: ExternalRouteLedger,
) {
  await page.route("https://docs.google.com/**", (route) =>
    fulfillExternal(route, ledger));
  await page.route("https://users.roblox.com/**", (route) =>
    fulfillExternal(route, ledger));
  await page.route("https://thumbnails.roblox.com/**", (route) =>
    fulfillExternal(route, ledger));
}

export function assertNoOwnApiFulfilled(entries: readonly ExternalRouteEntry[]) {
  for (const entry of entries) {
    if (entry.path === "/api" || entry.path.startsWith("/api/")) {
      throw new Error("[PORTIA_E2E_OWN_API_MOCKED] own /api route was fulfilled");
    }
    if (!allowedExternalHosts.has(entry.host)) {
      throw new Error("[PORTIA_E2E_EXTERNAL_ROUTE_UNLISTED]");
    }
  }
}
