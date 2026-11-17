import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const source = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const upload = readFileSync(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8");

test("every response receives baseline browser hardening without blocking approved embeds and HTTPS media", () => {
  for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.ok(source.includes(`key: "${header}"`), header);
  }
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /object-src 'none'/);
  assert.match(source, /img-src 'self' data: blob: https:/);
  assert.match(source, /frame-src https:\/\/docs\.google\.com https:\/\/sdqwqsdawqd\.github\.io/);
  assert.match(source, /upgradeInsecureRequests \? \["upgrade-insecure-requests"\] : \[\]/);
});

const ENV_KEYS = ["NODE_ENV", "PORTIA_E2E_ALLOW_HTTP", "NETLIFY", "CONTEXT"] as const;
type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>;

// Imports the real next.config.ts under the given environment; a unique query forces re-evaluation.
async function headersFor(label: string, env: Env): Promise<Map<string, string>> {
  const proc = process.env as Record<string, string | undefined>; // Next types make NODE_ENV read-only
  const saved = ENV_KEYS.map((key) => [key, proc[key]] as const);
  try {
    for (const key of ENV_KEYS) {
      if (env[key] === undefined) delete proc[key];
      else proc[key] = env[key];
    }
    const mod = (await import(new URL(`../next.config.ts?case=${label}`, import.meta.url).href)) as { default: NextConfig };
    const rules = await mod.default.headers!();
    return new Map(rules[0].headers.map((header) => [header.key, header.value] as const));
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete proc[key];
      else proc[key] = value;
    }
  }
}

async function cspFor(label: string, env: Env): Promise<string> {
  return (await headersFor(label, env)).get("Content-Security-Policy")!;
}

const UPGRADE = "upgrade-insecure-requests";
const FRAME_HOSTS = "frame-src https://docs.google.com https://sdqwqsdawqd.github.io https://www.youtube.com https://www.youtube-nocookie.com";
const directives = (policy: string) => new Map(policy.split("; ").map((part) => [part.split(" ")[0], part] as const));

test("CSP keeps upgrade-insecure-requests in production, including every Netlify build, unless only the local E2E server sets the flag", async () => {
  const prod = { NODE_ENV: "production" };
  assert.ok((await cspFor("prod", prod)).includes(UPGRADE), "production without flag");
  assert.ok(!(await cspFor("flag", { ...prod, PORTIA_E2E_ALLOW_HTTP: "1" })).includes(UPGRADE), "local E2E server");
  assert.ok((await cspFor("netlify", { ...prod, PORTIA_E2E_ALLOW_HTTP: "1", NETLIFY: "true" })).includes(UPGRADE), "NETLIFY=true");
  assert.ok((await cspFor("ctx-prod", { ...prod, PORTIA_E2E_ALLOW_HTTP: "1", CONTEXT: "production" })).includes(UPGRADE), "CONTEXT=production");
  assert.ok((await cspFor("ctx-preview", { ...prod, PORTIA_E2E_ALLOW_HTTP: "1", CONTEXT: "deploy-preview" })).includes(UPGRADE), "CONTEXT=deploy-preview");
  assert.ok((await cspFor("flag-true", { ...prod, PORTIA_E2E_ALLOW_HTTP: "true" })).includes(UPGRADE), "flag must be exactly 1");
  const dev = await cspFor("dev", { NODE_ENV: "development" });
  assert.ok(!dev.includes(UPGRADE), "development");
  assert.match(dev, /script-src [^;]*'unsafe-eval'/);
});

test("public UUID uploads are immutable-cached and verified by file signature", () => {
  assert.match(upload, /imageExtensionFromSignature/);
  assert.match(upload, /cacheControl: "31536000"/);
  assert.match(upload, /detectedExtension !== declaredExtension/);
});

test("20-08 (D-05): the enforced policy stays and the stricter candidate is delivered only as Content-Security-Policy-Report-Only", async () => {
  const headers = await headersFor("report-only", { NODE_ENV: "production" });
  const enforced = headers.get("Content-Security-Policy");
  const candidate = headers.get("Content-Security-Policy-Report-Only");
  assert.ok(enforced && candidate, "both CSP headers are present");
  assert.notEqual(enforced, candidate);
  // The enforced policy keeps its approved shape: https images, the approved frame hosts, the production upgrade.
  assert.match(enforced, /img-src 'self' data: blob: https:/);
  assert.ok(enforced.includes(FRAME_HOSTS));
  assert.ok(enforced.includes(UPGRADE));
  assert.match(enforced, /connect-src 'self' https: wss:/);
  assert.ok(!source.includes('key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy }'), "the candidate is its own value");
});

test("20-08 (D-06): the candidate keeps img-src https:, the approved frame hosts and widens nothing beyond the enforced policy", async () => {
  const headers = await headersFor("candidate", { NODE_ENV: "production" });
  const enforced = directives(headers.get("Content-Security-Policy")!);
  const candidate = directives(headers.get("Content-Security-Policy-Report-Only")!);
  assert.equal(candidate.get("img-src"), "img-src 'self' data: blob: https:");
  assert.equal(candidate.get("frame-src"), FRAME_HOSTS);
  assert.ok(!headers.get("Content-Security-Policy-Report-Only")!.includes(UPGRADE), "upgrade-insecure-requests is ignored in a report-only policy");
  assert.ok(!/\*/.test(headers.get("Content-Security-Policy-Report-Only")!), "no wildcard source");
  for (const [name, value] of candidate) {
    if (!enforced.has(name)) continue; // a directive the enforced policy leaves to default-src
    const allowed = new Set(enforced.get(name)!.split(" ").slice(1));
    for (const token of value.split(" ").slice(1)) assert.ok(allowed.has(token), `${name}: candidate token ${token} is not in the enforced policy`);
  }
  assert.match(candidate.get("connect-src")!, /^connect-src 'self'$/);
});

test("20-08: every other browser hardening header carries its exact value", async () => {
  const headers = await headersFor("hardening", { NODE_ENV: "production" });
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Cross-Origin-Opener-Policy"), "same-origin-allow-popups");
  assert.equal(headers.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  assert.equal(headers.get("Strict-Transport-Security"), "max-age=63072000; includeSubDomains; preload");
});

test("20-08 (D-08/D-14): the local HTTP E2E server drops only the upgrade; HSTS and the upgrade stay configured for published HTTPS", async () => {
  // LIMITATION: this proves the configuration, not browser behaviour. A browser ignores HSTS on plain HTTP, so a LAN or
  // 127.0.0.1 run is not evidence of published-HTTPS HSTS/upgrade properties (D-14: no published-site probe).
  const local = await headersFor("local-http", { NODE_ENV: "production", PORTIA_E2E_ALLOW_HTTP: "1" });
  const published = await headersFor("published-https", { NODE_ENV: "production", NETLIFY: "true", PORTIA_E2E_ALLOW_HTTP: "1" });
  assert.ok(!local.get("Content-Security-Policy")!.includes(UPGRADE));
  assert.ok(published.get("Content-Security-Policy")!.includes(UPGRADE));
  for (const headers of [local, published]) {
    assert.equal(headers.get("Strict-Transport-Security"), "max-age=63072000; includeSubDomains; preload");
    assert.equal(headers.get("Content-Security-Policy-Report-Only"), local.get("Content-Security-Policy-Report-Only"));
  }
});
