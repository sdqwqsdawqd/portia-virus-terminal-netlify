import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  actorAvailability,
  actorRoster,
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
};

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

  test("safe staging releases role declarations without sharing authority", () => {
    for (const role of fixtureRoles) {
      const result = actorAvailability(role, safeEnvironment);
      assert.equal(result.status, "READY");
      if (result.status === "READY") assert.equal(result.actor.role, role);
    }
  });

  test("a production-listed project remains blocked before role setup", () => {
    const result = actorAvailability("editor", {
      ...safeEnvironment,
      PORTIA_E2E_PRODUCTION_PROJECT_IDS: projectId,
    });
    assert.equal(result.status, "BLOCKED");
  });
});
