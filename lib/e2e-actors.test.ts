import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  actorAvailability,
  actorRoster,
  type ActorRole,
} from "../tests/e2e/fixtures/actors.ts";
import { probeSession, type VerifiedSession } from "../tests/e2e/fixtures/session-probe.ts";
import { MutationTargetBlockedError } from "../tests/e2e/fixtures/target-guard.ts";

const fixtureRoles: ActorRole[] = [
  "participant",
  "editor",
  "promo-reviewer",
  "owner",
];
const projectId = "abcdefghijklmnopqrst";
const safeEnvironment = {
  PORTIA_E2E_MUTATION_CONFIRM: "ISOLATED_TEST_PROJECT",
  PORTIA_E2E_TARGET_ENVIRONMENT: "isolated-test",
  PORTIA_E2E_TARGET_ID: projectId,
  PORTIA_E2E_SUPABASE_URL: `https://${projectId}.supabase.co/`,
  PORTIA_E2E_PRODUCTION_PROJECT_IDS: "productionproject000",
  PORTIA_E2E_ISOLATED_PROJECT_IDS: projectId,
};
const target = { environment: "isolated-test", projectId } as const;
const jwt = (iss: string) => `h.${Buffer.from(JSON.stringify({ iss })).toString("base64url")}.s`;
const goodToken = jwt(`https://${projectId}.supabase.co/auth/v1`);
const flags = {
  editor: { canEdit: true, canManageEditors: false, openTabs: ["a"] },
  "promo-reviewer": { canEdit: true, canManageEditors: false, openTabs: ["a", "promo"] },
  owner: { canEdit: true, canManageEditors: true, openTabs: ["a", "promo"] },
  participant: { canEdit: false, canManageEditors: false, openTabs: [] },
};
const fakeFetch = (answer: (url: string) => Response) =>
  (async (url: string) => answer(String(url))) as unknown as typeof fetch;
const jsonFetch = (body: unknown, status = 200) => fakeFetch(() => new Response(JSON.stringify(body), { status }));
const probe = (role: keyof typeof flags, fetchImpl: typeof fetch, accessToken = goodToken) =>
  probeSession(
    { role, target, baseURL: "http://127.0.0.1:3000", cookieHeader: "c=1", accessToken, participant: { nickname: "Run1" } },
    fetchImpl,
  );
const participantFetch = (status: unknown) =>
  fakeFetch((url) => new Response(JSON.stringify(url.includes("/api/access") ? flags.participant : status)));
const editorProof = await probe("editor", jsonFetch(flags.editor));

describe("Phase 15 actor roster", () => {
  test("declares visitor, participant, editor, reviewer and owner cleanup ownership", () => {
    assert.deepEqual(
      actorRoster.actors.map((actor) => actor.role),
      ["visitor", ...fixtureRoles],
    );
    for (const actor of actorRoster.actors) {
      assert.ok(actor.id);
      assert.ok(actor.lifecycleOwner);
      assert.ok(actor.cleanup);
    }
  });

  test("keeps tracked roster data sanitized", () => {
    const source = readFileSync(
      new URL("../tests/e2e/fixtures/data/roster.json", import.meta.url),
      "utf8",
    );
    assert.ok(!source.includes("@"));
    assert.ok(!/password|token|cookie|service[_-]?role/i.test(source));
  });

  test("visitor is ready while every role lane is blocked without staging", () => {
    assert.equal(actorAvailability("visitor", {}).status, "READY");
    for (const role of fixtureRoles) {
      assert.equal(actorAvailability(role, {}).status, "BLOCKED");
    }
  });

  test("safe target strings alone never release privileged role declarations", () => {
    for (const role of fixtureRoles) {
      const result = actorAvailability(role, safeEnvironment);
      assert.equal(result.status, "BLOCKED");
      if (result.status === "BLOCKED") {
        assert.equal(result.code, "AUTHENTICATED_SESSION_UNPROVEN");
      }
    }
  });

  test("a matching server proof releases only its isolated role lane", () => {
    const editor = actorAvailability("editor", safeEnvironment, editorProof);
    assert.equal(editor.status, "READY");
    if (editor.status === "READY") {
      assert.equal(editor.actor.role, "editor");
      assert.equal(editor.sessionProof, editorProof);
    }

    const reviewer = actorAvailability("promo-reviewer", safeEnvironment, editorProof);
    assert.equal(reviewer.status, "BLOCKED");
    if (reviewer.status === "BLOCKED") {
      assert.equal(reviewer.code, "AUTHENTICATED_SESSION_UNPROVEN");
    }
  });

  test("a production-listed project remains blocked before role setup", () => {
    const result = actorAvailability(
      "editor",
      { ...safeEnvironment, PORTIA_E2E_PRODUCTION_PROJECT_IDS: projectId },
      editorProof,
    );
    assert.equal(result.status, "BLOCKED");
    if (result.status === "BLOCKED") assert.equal(result.code, "TARGET_NOT_ISOLATED");
  });

  test("unknown and overlapping target inventories remain blocked before session proof", () => {
    const unknown = actorAvailability("editor", {
      ...safeEnvironment,
      PORTIA_E2E_ISOLATED_PROJECT_IDS: "uvwxyzabcdefghijklmn",
    }, editorProof);
    assert.equal(unknown.status, "BLOCKED");
    if (unknown.status === "BLOCKED") assert.equal(unknown.code, "TARGET_NOT_ISOLATED");

    const overlap = actorAvailability("editor", {
      ...safeEnvironment,
      PORTIA_E2E_PRODUCTION_PROJECT_IDS: `uvwxyzabcdefghijklmn,${projectId}`,
    }, editorProof);
    assert.equal(overlap.status, "BLOCKED");
    if (overlap.status === "BLOCKED") assert.equal(overlap.code, "TARGET_NOT_ISOLATED");
  });

  test("a literal of the old proof shape no longer releases a lane (WR-01)", () => {
    const forged = { role: "editor", status: "VERIFIED", source: "server-probe" } as unknown as VerifiedSession;
    const result = actorAvailability("editor", safeEnvironment, forged);
    assert.equal(result.status, "BLOCKED");
    if (result.status === "BLOCKED") assert.equal(result.code, "AUTHENTICATED_SESSION_UNPROVEN");
  });

  test("a proof is bound to its own role and target", () => {
    assert.equal(actorAvailability("owner", safeEnvironment, editorProof).status, "BLOCKED");
    const other = "uvwxyzabcdefghijklmn";
    const otherEnv = {
      ...safeEnvironment,
      PORTIA_E2E_TARGET_ID: other,
      PORTIA_E2E_SUPABASE_URL: `https://${other}.supabase.co/`,
      PORTIA_E2E_ISOLATED_PROJECT_IDS: other,
    };
    assert.equal(actorAvailability("editor", otherEnv, editorProof).status, "BLOCKED");
  });

  test("probeSession mints a proof for every role the server confirms", async () => {
    for (const role of ["promo-reviewer", "owner"] as const) {
      const proof = await probe(role, jsonFetch(flags[role]));
      assert.equal(actorAvailability(role, safeEnvironment, proof).status, "READY");
    }
    const participant = await probe("participant", participantFetch({ nickname: "run1" }));
    assert.equal(actorAvailability("participant", safeEnvironment, participant).status, "READY");
  });

  test("probeSession rejects a foreign issuer before any request", async () => {
    let calls = 0;
    const spy = fakeFetch(() => { calls++; return new Response("{}"); });
    await assert.rejects(
      probe("editor", spy, jwt("https://uvwxyzabcdefghijklmn.supabase.co/auth/v1")),
      (e: unknown) => e instanceof MutationTargetBlockedError && e.code === "issuer-mismatch",
    );
    assert.equal(calls, 0);
  });

  test("probeSession mints nothing on a bad server answer or wrong role flags", async () => {
    const code = (c: string) => (e: unknown) => e instanceof MutationTargetBlockedError && e.code === c;
    await assert.rejects(probe("editor", jsonFetch({}, 503)), code("session-probe-failed"));
    await assert.rejects(probe("editor", fakeFetch(() => new Response("nope"))), code("session-probe-failed"));
    await assert.rejects(probe("editor", jsonFetch(flags.owner)), code("session-role-mismatch"));
    await assert.rejects(probe("editor", jsonFetch(flags["promo-reviewer"])), code("session-role-mismatch"));
    await assert.rejects(probe("participant", jsonFetch(flags.editor)), code("session-role-mismatch"));
    await assert.rejects(probe("participant", participantFetch({ error: "x" })), code("session-role-mismatch"));
  });
});
