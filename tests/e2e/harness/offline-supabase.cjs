"use strict";

// Test-only harness (Phase 20-58, D-68). Preloaded into the Next SERVER process of a throwaway worktree:
//   PORTIA_E2E_OFFLINE_SUPABASE=1 NODE_OPTIONS="--require=<abs path>/tests/e2e/harness/offline-supabase.cjs" node node_modules/next/dist/bin/next start ...
// It exists for runs WITHOUT a data source (no real Supabase, no staging, no production). It replaces exactly two things:
//   1. dns.lookup: any name under .supabase.co fails at once with ENOTFOUND instead of waiting for the resolver timeout;
//   2. fetch: GET /rest/v1/portia_content of the invented project below answers 200 with an empty row list, so the page
//      renders its default (starting) content. Every other request keeps the original behavior, i.e. fails as it would offline.
// Result under this harness is the UI contract on starting content. It is NOT evidence about real data and must be
// recorded as "offline stub", never as a pass on real data. Product code never imports this file (unit test in lib/).
// Without PORTIA_E2E_OFFLINE_SUPABASE=1 loading the file changes nothing except exposing OFFLINE_ENV.

const OFFLINE_FLAG = "PORTIA_E2E_OFFLINE_SUPABASE";
const OFFLINE_HOST = "abcdefghijklmnopqrst.supabase.co";

// Single source of the invented public values for 20-12 and 20-13 (no server-side key, no production value).
const OFFLINE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: `https://${OFFLINE_HOST}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_dummy0123456789abcdefghijklmnop",
  PORTIA_PROMOTION_DEVICE_SECRET: "dummy-device-secret-0123456789-abcdefghijklmnop",
});

// The harness never runs next to a staging or mutation setup.
const REFUSING_ENV = Object.freeze([
  "PORTIA_E2E_MUTATION_CONFIRM",
  "PORTIA_E2E_TARGET_ENVIRONMENT",
  "PORTIA_E2E_TARGET_ID",
  "PORTIA_E2E_SUPABASE_URL",
  "PORTIA_E2E_ISOLATED_PROJECT_IDS",
  "PORTIA_E2E_PRODUCTION_PROJECT_IDS",
  "PORTIA_STAGING_DB_URL",
]);

function refuse(reason) {
  const error = new Error(`[PORTIA_OFFLINE_HARNESS_REFUSED] ${reason}`);
  error.code = "PORTIA_OFFLINE_HARNESS_REFUSED";
  throw error;
}

function install(env) {
  if (env.NEXT_PUBLIC_SUPABASE_URL !== OFFLINE_ENV.NEXT_PUBLIC_SUPABASE_URL) {
    refuse("NEXT_PUBLIC_SUPABASE_URL is not the invented offline project address; the harness serves only that address");
  }
  for (const name of REFUSING_ENV) {
    if (typeof env[name] === "string" && env[name].trim() !== "") {
      refuse(`${name} is set; the harness does not run next to staging or mutation settings`);
    }
  }

  // CommonJS preload for NODE_OPTIONS --require: require() is the only way to load the module synchronously here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dns = require("node:dns");
  const originalLookup = dns.lookup;
  dns.lookup = function offlineLookup(hostname, options, callback) {
    if (typeof hostname === "string" && hostname.toLowerCase().endsWith(".supabase.co")) {
      const done = typeof options === "function" ? options : callback;
      const error = Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
        code: "ENOTFOUND",
        errno: -3008,
        syscall: "getaddrinfo",
        hostname,
      });
      process.nextTick(done, error);
      return {};
    }
    return originalLookup.apply(this, arguments);
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = function offlineFetch(input, init) {
    try {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const method = String((init && init.method) || (typeof input === "object" && input !== null && "method" in input ? input.method : "GET")).toUpperCase();
      if (url.protocol === "https:" && url.hostname === OFFLINE_HOST && url.pathname === "/rest/v1/portia_content" && method === "GET") {
        return Promise.resolve(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
      }
    } catch {
      // not a URL we can read: fall through to the original fetch
    }
    return originalFetch.apply(this, arguments);
  };
}

if (process.env[OFFLINE_FLAG] === "1") install(process.env);

module.exports = { OFFLINE_ENV, OFFLINE_FLAG, OFFLINE_HOST };
