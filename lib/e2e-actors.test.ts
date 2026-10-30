import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  actorAvailability,
  actorRoster,
  type ActorSessionProof,
  type ActorRole,
} from "../tests/e2e/fixtures/actors.ts";

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
const editorProof: ActorSessionProof = Object.freeze({
  role: "editor",
  status: "VERIFIED",
  source: "server-probe",
});

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
});
