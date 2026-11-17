import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

import { accessIpBucket, accessIpGroup } from "./access-session.ts";
import { coarseIpBucket } from "./portia-device-binding.ts";

// RLS21-08: the access path has its own IP grouping. The Promotion helper takes the first four text groups of an IPv6
// address, so `::` compression gave every host of a /64 (and, with a free /48, 65536 networks) its own bucket. Access
// canonicalises the address first and groups IPv6 by /48. Promotion buckets are not touched (lib/portia-device-binding.ts).

const secret = "k".repeat(40);
const withIp = (value: string) => new Headers({ "x-nf-client-connection-ip": value });

test("IPv6 is grouped by /48 after canonicalisation: compressed, expanded, upper case, bracketed and zoned forms are one group", () => {
  const forms = [
    "2001:db8::5",
    "2001:0db8:0000:0000:0000:0000:0000:0005",
    "2001:DB8:0:0:0:0:0:5",
    "[2001:db8::5]",
    "2001:db8::5%eth0",
    "2001:db8:0:0:0:0:0:5",
    "  2001:db8::5  ",
  ];
  for (const form of forms) assert.equal(accessIpGroup(withIp(form)), "2001:0db8:0000::/48", form);
  assert.equal(new Set(forms.map((form) => accessIpBucket(withIp(form), secret))).size, 1);
});

test("hosts and subnets inside one /48 collapse to one bucket, a different /48 is another bucket", () => {
  const sameNetwork = ["2001:db8::5", "2001:db8::6", "2001:db8:0:1::7", "2001:db8:0:ffff::1", "2001:db8:0:ffff:ffff:ffff:ffff:ffff"];
  const buckets = new Set(sameNetwork.map((value) => accessIpBucket(withIp(value), secret)));
  assert.equal(buckets.size, 1, "a free /48 must not buy more than one bucket");
  assert.notEqual(accessIpBucket(withIp("2001:db8:1::5"), secret), accessIpBucket(withIp("2001:db8::5"), secret));
  assert.notEqual(accessIpBucket(withIp("2001:db9::5"), secret), accessIpBucket(withIp("2001:db8::5"), secret));
  assert.equal(accessIpGroup(withIp("2001:db8:1::5")), "2001:0db8:0001::/48");
});

test("the compression trap of the Promotion helper does not exist for access", () => {
  // Promotion text grouping: `2001:db8::5` and `2001:db8::6` land in different buckets there. Access must not repeat it.
  assert.equal(accessIpGroup(withIp("2001:db8::5")), accessIpGroup(withIp("2001:db8::6")));
  assert.equal(accessIpGroup(withIp("::1")), "0000:0000:0000::/48");
  assert.equal(accessIpGroup(withIp("::")), "0000:0000:0000::/48");
  assert.equal(accessIpGroup(withIp("fe80::1%eth0")), "fe80:0000:0000::/48");
});

test("IPv4-mapped IPv6 is the IPv4 address (dotted and hex tail), IPv4 stays on /24", () => {
  assert.equal(accessIpGroup(withIp("203.0.113.9")), "203.0.113.0/24");
  assert.equal(accessIpGroup(withIp("::ffff:203.0.113.9")), "203.0.113.0/24");
  assert.equal(accessIpGroup(withIp("::FFFF:203.0.113.200")), "203.0.113.0/24");
  assert.equal(accessIpGroup(withIp("0:0:0:0:0:ffff:cb00:7109")), "203.0.113.0/24");
  assert.equal(accessIpGroup(withIp("::ffff:cb00:7109")), "203.0.113.0/24");
  const plain = accessIpBucket(withIp("203.0.113.9"), secret);
  assert.equal(accessIpBucket(withIp("203.0.113.200"), secret), plain);
  assert.equal(accessIpBucket(withIp("::ffff:203.0.113.77"), secret), plain);
  assert.notEqual(accessIpBucket(withIp("203.0.114.9"), secret), plain);
  assert.equal(accessIpGroup(withIp("2001:db8::cb00:7109")), "2001:0db8:0000::/48", "only ::ffff:0:0/96 is mapped");
});

test("an embedded IPv4 tail on a non-mapped IPv6 address is read as two groups, not as a separate network", () => {
  assert.equal(accessIpGroup(withIp("2001:db8::203.0.113.9")), "2001:0db8:0000::/48");
});

test("garbage and missing headers fall into the shared unknown group", () => {
  for (const value of ["", "not-an-ip", "1.2.3", "256.1.1.1", "01.2.3.4", "12345::1", "2001:db8::1::2", "1:2:3:4:5:6:7:8:9", "::ffff:999.1.1.1", "[2001:db8::5", "2001:db8::5]"]) {
    assert.equal(accessIpGroup(withIp(value)), "unknown", JSON.stringify(value));
  }
  assert.equal(accessIpGroup(new Headers()), "unknown");
  assert.equal(accessIpBucket(new Headers(), secret), accessIpBucket(withIp("garbage"), secret));
});

test("header precedence is the one of the Promotion path: Netlify header, then the first x-forwarded-for entry, then x-real-ip", () => {
  const all = new Headers({ "x-nf-client-connection-ip": "198.51.100.7", "x-forwarded-for": "203.0.113.9, 10.0.0.1", "x-real-ip": "192.0.2.1" });
  assert.equal(accessIpGroup(all), "198.51.100.0/24");
  assert.equal(accessIpGroup(new Headers({ "x-forwarded-for": "2001:db8::5, 10.0.0.1", "x-real-ip": "192.0.2.1" })), "2001:0db8:0000::/48");
  assert.equal(accessIpGroup(new Headers({ "x-real-ip": "192.0.2.1" })), "192.0.2.0/24");
});

test("the bucket is a 32-hex keyed digest of the group, in an access label that differs from the Promotion bucket", () => {
  const bucket = accessIpBucket(withIp("2001:db8::5"), secret);
  assert.match(bucket, /^[0-9a-f]{32}$/);
  assert.equal(bucket, createHmac("sha256", secret).update("access-ip:2001:0db8:0000::/48").digest("hex").slice(0, 32));
  assert.notEqual(accessIpBucket(withIp("2001:db8::5"), "z".repeat(40)), bucket, "keyed");
  assert.notEqual(accessIpBucket(withIp("203.0.113.9"), secret), coarseIpBucket(withIp("203.0.113.9"), secret), "domain separation from Promotion");
  assert.throws(() => accessIpBucket(withIp("203.0.113.9"), "short"), /at least 32/);
});

test("Promotion buckets stay byte-identical: the shared helper and its IPv6 behaviour are untouched", () => {
  assert.equal(coarseIpBucket(withIp("203.0.113.9"), secret), createHmac("sha256", secret).update("ip:203.0.113.0/24").digest("hex").slice(0, 32));
  assert.equal(coarseIpBucket(withIp("2001:db8:1:2:3:4:5:6"), secret), createHmac("sha256", secret).update("ip:2001:db8:1:2::/64").digest("hex").slice(0, 32));
  const source = readFileSync(new URL("./portia-device-binding.ts", import.meta.url), "utf8");
  assert.ok(source.includes('if (value.includes(":")) return `${value.split(":").slice(0, 4).join(":")}::/64`;'));
});
