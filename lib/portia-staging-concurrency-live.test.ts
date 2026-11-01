import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test, type TestContext } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReceipt,
  createRun,
  isStagingLiveInvocation,
  requireStagingLiveTarget,
  writeReceipt,
  type Run,
  type StagingLiveTarget,
  type SuiteStatus,
} from "../tests/e2e/fixtures/staging-harness.ts";

// Concurrent live rounds (plan 16-09): N contenders x R rounds per race, every round on its own namespaced fixtures. Contenders use
// role clients (reviewers / anon); the admin client only seeds fixtures and reads the final state (Pitfall 12). Outside
// `npm run test:staging-live*` this file registers a skip and mutates nothing. The live run belongs to plan 16-12; until then BLOCKED.

type Outcome = "win" | "lose" | "idempotent" | "other";
type Response = { contender: string; value: unknown };

/** Maps an RPC return value to win/lose: claim returns boolean, admission and CAS return {code}. */
function outcomeOf(value: unknown): Outcome {
  if (value === true) return "win";
  if (value === false) return "lose";
  const reply = value as { code?: string; idempotent?: boolean } | null;
  if (reply?.code === "created") return "win";
  if (reply?.code === "accepted") return reply.idempotent === true ? "idempotent" : "win";
  if (reply?.code === "conflict" || reply?.code === "active-request" || reply?.code === "device-denied") return "lose";
  return "other";
}

/** Exactly one winner; every other response is a clean loss; the stored owner (when given) is the winner. */
function assertSingleWinner(responses: readonly Response[], finalRow?: { reviewer_id?: string | null }): string {
  const judged = responses.map((response) => ({ ...response, outcome: outcomeOf(response.value) }));
  const unexpected = judged.filter((item) => item.outcome !== "win" && item.outcome !== "lose");
  assert.equal(unexpected.length, 0, `unexpected response from ${unexpected.map((item) => item.contender).join(", ")}`);
  const winners = judged.filter((item) => item.outcome === "win");
  assert.equal(winners.length, 1, `expected exactly one winner, got ${winners.length}`);
  if (finalRow) assert.equal(finalRow.reviewer_id, winners[0].contender, "stored owner is not the winner");
  return winners[0].contender;
}

describe("single-winner assertion", () => {
  test("accepts one boolean winner and one CAS winner", () => {
    const claim = [{ contender: "a", value: false }, { contender: "b", value: true }, { contender: "c", value: false }];
    assert.equal(assertSingleWinner(claim, { reviewer_id: "b" }), "b");
    const cas = [{ contender: "a", value: { code: "conflict" } }, { contender: "b", value: { code: "accepted", idempotent: false } }];
    assert.equal(assertSingleWinner(cas), "b");
  });

  test("zero winners and two winners both fail", () => {
    assert.throws(() => assertSingleWinner([{ contender: "a", value: false }, { contender: "b", value: false }]), /exactly one winner/u);
    assert.throws(() => assertSingleWinner([{ contender: "a", value: true }, { contender: "b", value: true }]), /exactly one winner/u);
    assert.throws(() => assertSingleWinner([{ contender: "a", value: { code: "created" } }, { contender: "b", value: { code: "created" } }]), /exactly one winner/u);
  });

  test("a stored owner that is not the winner fails", () => {
    const responses = [{ contender: "a", value: false }, { contender: "b", value: true }];
    assert.throws(() => assertSingleWinner(responses, { reviewer_id: "a" }), /stored owner/u);
    assert.throws(() => assertSingleWinner(responses, { reviewer_id: null }), /stored owner/u);
  });

  test("an unexpected or idempotent response is not a loss", () => {
    assert.throws(() => assertSingleWinner([{ contender: "a", value: true }, { contender: "b", value: null }]), /unexpected response/u);
    assert.throws(() => assertSingleWinner([{ contender: "a", value: true }, { contender: "b", value: { code: "accepted", idempotent: true } }]), /unexpected response/u);
    assert.throws(() => assertSingleWinner([{ contender: "a", value: true }, { contender: "b", value: { code: "throttled" } }]), /unexpected response/u);
  });

  // test:staging-live:tracer filters by that word and runs only the role suite; a race named with it would be silently selected there.
  test("no subtest name carries the filter word of the role-suite script", () => {
    const source = readFileSync(new URL(import.meta.url), "utf8");
    const named = [...source.matchAll(/\b(race|test)\(\s*"([^"]*tracer[^"]*)"/gu)].map((match) => match[2]);
    assert.deepEqual(named, []);
  });
});

if (!isStagingLiveInvocation()) {
  test("staging live concurrency (skipped: run npm run test:staging-live)", { skip: "mutating live suite; not run by npm test" }, () => {});
} else {
  let target: StagingLiveTarget | undefined;
  let blocked = "";
  try {
    target = requireStagingLiveTarget();
  } catch (error) {
    blocked = error instanceof Error ? error.message : "unknown guard failure";
  }
  if (!target) test("guard: isolated staging target is required", () => assert.fail(`staging-live blocked: ${blocked}`));
  else registerLiveSuite(target);
}

function intEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`invalid-${name}: expected an integer in ${min}..${max}`);
  return value;
}

type DbResult<T> = { data: T | null; error: { code?: string; message: string } | null };
type Contender = { id: string; client: SupabaseClient };

function registerLiveSuite(live: StagingLiveTarget) {
  // Calibration knobs (research A9): the values actually used are written into the receipt suite keys.
  const N = intEnv("PORTIA_STAGING_RACE_N", 6, 2, 12);
  const R = intEnv("PORTIA_STAGING_RACE_R", 10, 1, 50);

  describe("staging live concurrency", { concurrency: false }, () => {
    let run: Run | undefined;
    const reviewers: Contender[] = [];
    const statuses: Record<string, SuiteStatus> = {};
    const env = () => {
      if (!run) throw new Error("before hook did not finish");
      return run;
    };
    const admin = () => env().admin;

    // Admin read/write; a denied admin grant (42501) means the race cannot run here: BLOCKED (D9, plan 16-10), never a pass.
    function must<T>(result: DbResult<T>, label: string): T {
      if (result.error) {
        if (result.error.code === "42501") throw new Error(`admin-grant-missing: ${label} denied (42501); admin grants are calibrated in plan 16-10 (D9)`);
        throw new Error(`${label}: ${result.error.message}`);
      }
      assert.notEqual(result.data, null, `${label}: missing data`);
      return result.data as T;
    }
    // Role-client RPC: any error is a failure of the race, not a loss for the contender.
    function reply<T>(result: DbResult<T>, label: string): T | null {
      assert.equal(result.error, null, `${label}: ${result.error?.message}`);
      return result.data;
    }

    function race(name: string, body: () => Promise<void>) {
      test(`race: ${name}`, async (t: TestContext) => {
        const key = `concurrency-${name}-n${N}-r${R}`;
        try {
          await body();
          statuses[key] = "PASS";
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("admin-grant-missing")) {
            statuses[key] = "BLOCKED";
            t.skip(`BLOCKED: ${error.message}`);
            return;
          }
          statuses[key] = "FAIL";
          throw error;
        }
      });
    }

    const nick = (tag: string, round: number) => `${env().prefix}_${tag}${round}`;

    before(async () => {
      run = createRun(live);
      for (let i = 0; i < N; i += 1) {
        const client = await run.createIdentity(`rev-${i}`, { grantedTabs: ["promo"] });
        const user = await client.auth.getUser();
        assert.ok(user.data.user?.id, "reviewer id is missing");
        reviewers.push({ id: user.data.user.id, client });
      }
    });

    after(async () => {
      const current = run;
      if (!current) return;
      const problems: string[] = [];
      try {
        await current.cleanup();
      } catch (error) {
        problems.push(error instanceof Error ? error.message : "cleanup failed");
      }
      const receipt = await buildReceipt(current, statuses);
      const path = writeReceipt(receipt, current.secrets(), "concurrency");
      console.log(`staging-live concurrency (N=${N}, R=${R}): receipt status ${receipt.status} (${path})`);
      assert.deepEqual(problems, [], `cleanup problems: ${problems.join("; ")}`);
      assert.ok(Object.values(receipt.residual).every((count) => count === 0), `residual after cleanup: ${JSON.stringify(receipt.residual)}`);
    });

    // claim: N reviewers on one fresh request per round; ordinary and qualification requests alternate.
    race("claim", async () => {
      for (let round = 0; round < R; round += 1) {
        const kind = round % 2 === 0 ? "ordinary" : "qualification";
        const key = nick("clm", round);
        const created =
          kind === "ordinary"
            ? await admin().from("portia_promo_requests").insert({ nickname: key, nickname_key: key, title_id: "academic", target_title_id: "intern" }).select("id").single()
            : await admin().from("portia_promo_qualification_requests").insert({ nickname: key, nickname_key: key, title_id: "intern", transition_id: "laboratory-assistant" }).select("id").single();
        const request = must<{ id: string }>(created, `claim fixture round ${round}`);
        const results = await Promise.all(reviewers.map((reviewer) => reviewer.client.rpc("portia_promo_claim_request", { p_kind: kind, p_request_id: request.id })));
        const responses = results.map((result, index) => ({ contender: reviewers[index].id, value: reply(result, `claim round ${round}`) }));
        const table = kind === "ordinary" ? "portia_promo_requests" : "portia_promo_qualification_requests";
        const stored = must<{ status: string; reviewer_id: string | null }>(await admin().from(table).select("status,reviewer_id").eq("id", request.id).single(), `claim state round ${round}`);
        assertSingleWinner(responses, stored);
        assert.equal(stored.status, "claimed", `claim round ${round}: status`);
      }
    });
  });
}
