import assert from "node:assert/strict";
import test from "node:test";
import {
  auxiliarySignalDigest,
  buildDeviceCookie,
  coarseIpBucket,
  createDeviceToken,
  deviceBindingCookie,
  deviceBindingDecision,
  deviceTokenDigest,
  penaltyMinutes,
} from "./portia-device-binding.ts";

const secret = "test-secret-that-is-long-enough-for-device-binding";

test("device binding generates an opaque token and stores only a keyed digest", () => {
  const token = createDeviceToken(() => Buffer.alloc(32, 7));
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const digest = deviceTokenDigest(token, secret);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.ok(!digest.includes(token));
  assert.notEqual(digest, deviceTokenDigest(token, `${secret}-other`));
});

test("device cookie is durable, HttpOnly, secure and same-site lax", () => {
  assert.equal(deviceBindingCookie, "portia_promo_device");
  const cookie = buildDeviceCookie("opaque-token");
  assert.match(cookie, /^portia_promo_device=opaque-token;/);
  for (const flag of ["Path=/", "Max-Age=31536000", "HttpOnly", "Secure", "SameSite=Lax"]) {
    assert.ok(cookie.includes(flag), flag);
  }
});

test("device binding allows the same nickname, binds only a free pair and denies every conflict neutrally", () => {
  assert.equal(deviceBindingDecision(null, "alice", false), "bind");
  assert.equal(deviceBindingDecision("alice", "alice", true), "allow");
  assert.equal(deviceBindingDecision("bob", "alice", false), "deny");
  assert.equal(deviceBindingDecision(null, "alice", true), "deny");
});

test("device binding penalties escalate to 5, 15 and at most 60 minutes", () => {
  assert.deepEqual([0, 1, 2, 3, 20].map(penaltyMinutes), [0, 5, 15, 60, 60]);
});

test("IP and auxiliary client signals become bounded keyed buckets without raw values", () => {
  const first = new Request("https://example.test", { headers: {
    "x-nf-client-connection-ip": "203.0.113.42",
    "user-agent": "Example Browser/1.0",
    "accept-language": "ru-RU,ru;q=0.9",
    "sec-ch-ua-platform": '"Windows"',
  } });
  const sameNetwork = new Request("https://example.test", { headers: {
    "x-forwarded-for": "203.0.113.99, 10.0.0.1",
    "user-agent": "Example Browser/1.0",
    "accept-language": "ru-RU,ru;q=0.9",
    "sec-ch-ua-platform": '"Windows"',
  } });
  const ipA = coarseIpBucket(first.headers, secret);
  const ipB = coarseIpBucket(sameNetwork.headers, secret);
  assert.equal(ipA, ipB);
  assert.match(ipA, /^[a-f0-9]{32}$/);
  assert.ok(!ipA.includes("203.0.113"));
  const signal = auxiliarySignalDigest(first.headers, secret);
  assert.match(signal, /^[a-f0-9]{32}$/);
  assert.ok(!signal.includes("Example Browser"));
});
