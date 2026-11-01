import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, describe, test, type TestContext } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReceipt,
  createRun,
  isStagingLiveInvocation,
  OwnerFixtureForeignError,
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
          // A foreign (unmarked) owner account is refused by the harness: the delete race cannot run on this target, which is not a pass.
          if (error instanceof OwnerFixtureForeignError || (error instanceof Error && error.message.startsWith("admin-grant-missing"))) {
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

    // ---- fixtures shared by the remaining races ----

    const anon = () => env().client("anon");
    const tokenOf = (tag: string, round: number) => createHash("sha256").update(`${env().prefix}:${tag}:${round}`).digest("hex");
    const bucketOf = (tag: string, round: number, index = 0) => `${env().prefix}:bucket:${tag}${round}:${index}`;
    const contenders = <T>(make: (index: number) => T) => Array.from({ length: N }, (_, index) => make(index));
    const submit = (key: string, tokenHash: string, bucket: string) =>
      anon().rpc("portia_promo_submit_request", {
        p_kind: "ordinary",
        p_nickname: key,
        p_nickname_key: key,
        p_title_id: "academic",
        p_target_id: "intern",
        p_token_hash: tokenHash,
        p_risk_bucket: `${env().prefix}:risk`,
        p_bucket_key: bucket,
        p_ip_bucket: `${env().prefix}:ip`,
      });
    const rowsOf = async (table: string, column: string, values: string[], label: string) =>
      must<Array<Record<string, string>>>(await admin().from(table).select("*").in(column, values), label);

    // A qualification attempt with a device binding, like createAttempt in portia-promotion-live.test.ts.
    async function makeAttempt(tag: string, round: number, status: "prepared" | "active", leaseOffsetMs = 60_000) {
      const key = nick(tag, round);
      const tokenHash = tokenOf(tag, round);
      must(await admin().from("portia_promo_device_bindings").insert({ nickname_key: key, token_hash: tokenHash }).select("id").single(), `${tag} binding`);
      const request = must<{ id: string }>(
        await admin().from("portia_promo_qualification_requests").insert({ nickname: key, nickname_key: key, title_id: "intern", transition_id: "laboratory-assistant", status: "testing", reviewer_id: reviewers[0].id }).select("id").single(),
        `${tag} request`,
      );
      const now = Date.now();
      const attempt = must<{ id: string }>(
        await admin().from("portia_promo_attempts").insert({
          request_id: request.id,
          reviewer_id: reviewers[0].id,
          status,
          client_mode: "desktop",
          current_question_index: 0,
          ...(status === "active"
            ? {
                started_at: new Date(now - 1_000).toISOString(),
                deadline_at: new Date(now + 15 * 60_000).toISOString(),
                last_seen_at: new Date(now - 1_000).toISOString(),
                lease_expires_at: new Date(now + leaseOffsetMs).toISOString(),
              }
            : {}),
        }).select("id").single(),
        `${tag} attempt`,
      );
      const questions = must<Array<{ id: string }>>(
        await admin().from("portia_promo_attempt_questions").insert([0, 1].map((sortOrder) => ({
          attempt_id: attempt.id,
          question_type: "single",
          snapshot_text: `${env().prefix} question ${tag} ${sortOrder}`,
          snapshot_options: ["A", "B"],
          answer_key: 0,
          sort_order: sortOrder,
        }))).select("id,sort_order").order("sort_order"),
        `${tag} questions`,
      );
      return { attemptId: attempt.id, requestId: request.id, tokenHash, questionId: questions[0].id };
    }

    // admission: N anon contenders, one nickname, one device -> one active request and one binding (partial unique index + advisory locks).
    race("admission-same-nickname", async () => {
      for (let round = 0; round < R; round += 1) {
        const key = nick("sam", round);
        const tokenHash = tokenOf("sam", round);
        const results = await Promise.all(contenders((index) => submit(key, tokenHash, bucketOf("sam", round, index))));
        const values = results.map((result) => reply(result, `same-nickname round ${round}`) as { code: string; requestId?: string } | null);
        assertSingleWinner(values.map((value, index) => ({ contender: String(index), value })));
        assert.ok(values.every((value) => value?.code === "created" || value?.code === "active-request"), `same-nickname round ${round}: unexpected codes`);
        const requests = await rowsOf("portia_promo_requests", "nickname_key", [key], "same-nickname requests");
        assert.equal(requests.length, 1, `same-nickname round ${round}: active requests`);
        assert.equal(requests[0].id, values.find((value) => value?.code === "created")?.requestId, `same-nickname round ${round}: stored request is not the created one`);
        assert.equal((await rowsOf("portia_promo_device_bindings", "nickname_key", [key], "same-nickname bindings")).length, 1, `same-nickname round ${round}: bindings`);
      }
    });

    // admission: two nicknames on one device token at once -> at most one active request, the token stays bound to the winner's nickname.
    race("admission-split-device", async () => {
      for (let round = 0; round < R; round += 1) {
        const keys = [nick("spa", round), nick("spb", round)];
        const tokenHash = tokenOf("spl", round);
        const results = await Promise.all(contenders((index) => submit(keys[index % 2], tokenHash, bucketOf("spl", round, index))));
        const values = results.map((result) => reply(result, `split-device round ${round}`) as { code: string } | null);
        assertSingleWinner(values.map((value, index) => ({ contender: String(index), value })));
        const winner = values.findIndex((value) => value?.code === "created") % 2;
        values.forEach((value, index) => {
          if (value?.code === "created") return;
          assert.equal(value?.code, index % 2 === winner ? "active-request" : "device-denied", `split-device round ${round}: contender ${index}`);
        });
        const requests = await rowsOf("portia_promo_requests", "nickname_key", keys, "split-device requests");
        assert.deepEqual(requests.map((row) => row.nickname_key), [keys[winner]], `split-device round ${round}: active requests`);
        const bindings = await rowsOf("portia_promo_device_bindings", "token_hash", [tokenHash], "split-device bindings");
        assert.deepEqual(bindings.map((row) => row.nickname_key), [keys[winner]], `split-device round ${round}: token bindings`);
      }
    });

    // answer CAS: N different nonces on one question -> one accepted, the rest conflict; the winner's nonce repeated is idempotent.
    race("answer-cas", async () => {
      for (let round = 0; round < R; round += 1) {
        const fixture = await makeAttempt("cas", round, "active");
        const answer = (nonce: string) =>
          anon().rpc("portia_promo_answer_question", { p_attempt_id: fixture.attemptId, p_question_id: fixture.questionId, p_expected_question_index: 0, p_answer: 0, p_nonce: nonce, p_token_hash: fixture.tokenHash });
        const nonces = contenders((index) => `nonce-${env().runId}-r${round}-c${index}`);
        const results = await Promise.all(nonces.map(answer));
        const values = results.map((result) => reply(result, `cas round ${round}`));
        const winner = assertSingleWinner(values.map((value, index) => ({ contender: nonces[index], value })));
        const readState = async () => ({
          answers: (await rowsOf("portia_promo_answers", "attempt_id", [fixture.attemptId], "cas answers")).length,
          index: must<{ current_question_index: number }>(await admin().from("portia_promo_attempts").select("current_question_index").eq("id", fixture.attemptId).single(), "cas attempt").current_question_index,
        });
        assert.deepEqual(await readState(), { answers: 1, index: 1 }, `cas round ${round}: state after the race`);
        const repeated = (await Promise.all([answer(winner), answer(winner)])).map((result) => reply(result, `cas repeat round ${round}`) as { code: string; idempotent?: boolean } | null);
        assert.ok(repeated.every((value) => value?.code === "accepted" && value.idempotent === true), `cas round ${round}: repeated nonce must be idempotent`);
        assert.deepEqual(await readState(), { answers: 1, index: 1 }, `cas round ${round}: state after the repeated nonce`);
      }
    });

    // start_test: desktop and phone at once -> one client_mode is fixed, the other mode is refused, the mode never changes afterwards.
    race("start-test-client-mode", async () => {
      for (let round = 0; round < R; round += 1) {
        const fixture = await makeAttempt("mod", round, "prepared");
        const modes = contenders((index) => (index % 2 === 0 ? "desktop" : "phone"));
        const call = (mode: string) => anon().rpc("portia_promo_start_test", { p_attempt_id: fixture.attemptId, p_token_hash: fixture.tokenHash, p_client_mode: mode });
        const values = (await Promise.all(modes.map(call))).map((result) => reply(result, `start_test round ${round}`) as string | null);
        const stored = must<{ status: string; client_mode: string }>(await admin().from("portia_promo_attempts").select("status,client_mode").eq("id", fixture.attemptId).single(), "start_test state");
        assert.equal(stored.status, "active", `start_test round ${round}: status`);
        modes.forEach((mode, index) => {
          if (mode === stored.client_mode) assert.notEqual(values[index], null, `start_test round ${round}: ${mode} contender was refused although its mode won`);
          else assert.equal(values[index], null, `start_test round ${round}: ${mode} contender was accepted although ${stored.client_mode} won`);
        });
        const deadlines = new Set(values.filter((value) => value !== null).map((value) => new Date(value as string).getTime()));
        assert.equal(deadlines.size, 1, `start_test round ${round}: start ran more than once`);
        const other = stored.client_mode === "desktop" ? "phone" : "desktop";
        assert.equal(reply(await call(other), "start_test other mode"), null, `start_test round ${round}: late ${other} call must be refused`);
        const projection = await anon().rpc("portia_promo_current_test", { p_attempt_id: fixture.attemptId, p_token_hash: fixture.tokenHash, p_client_mode: other });
        assert.equal(reply(projection, "current_test other mode"), null, `start_test round ${round}: current_test must refuse the other mode`);
        const after = must<{ client_mode: string }>(await admin().from("portia_promo_attempts").select("client_mode").eq("id", fixture.attemptId).single(), "start_test mode after");
        assert.equal(after.client_mode, stored.client_mode, `start_test round ${round}: client_mode changed`);
      }
    });

    // lease: heartbeat and current_test (which runs the expiry) at once. Rounds cycle through a long-expired lease, a long-valid lease and a
    // lease about to expire; the invariant for all of them: the attempt is either extended or failed, never both, and never resurrected.
    race("heartbeat-vs-expire", async () => {
      for (let round = 0; round < R; round += 1) {
        const phase = round % 3;
        const fixture = await makeAttempt("hb", round, "active", phase === 0 ? -600_000 : phase === 1 ? 600_000 : 250); // wide margins keep phases 0/1 deterministic under client/server clock skew
        const beat = () => anon().rpc("portia_promo_heartbeat_test", { p_attempt_id: fixture.attemptId, p_token_hash: fixture.tokenHash });
        const results = await Promise.all(contenders((index) =>
          index % 2 === 0 ? beat() : anon().rpc("portia_promo_current_test", { p_attempt_id: fixture.attemptId, p_token_hash: fixture.tokenHash, p_client_mode: "desktop" })));
        const beats = results.map((result, index) => ({ index, value: reply(result, `lease round ${round}`) as { code: string } | null })).filter((item) => item.index % 2 === 0);
        const codes = new Set(beats.map((item) => item.value?.code));
        assert.equal(codes.size, 1, `lease round ${round}: heartbeats disagree (${[...codes].join(", ")})`);
        const code = [...codes][0];
        if (phase === 0) assert.equal(code, "inactive", `lease round ${round}: expired lease was extended`);
        if (phase === 1) assert.equal(code, "active", `lease round ${round}: valid lease was refused`);
        const readState = async () => must<{ status: string; technical_failure: string | null }>(await admin().from("portia_promo_attempts").select("status,technical_failure").eq("id", fixture.attemptId).single(), "lease state");
        const stored = await readState();
        if (code === "active") assert.equal(stored.status, "active", `lease round ${round}: heartbeat extended the lease but the attempt is ${stored.status}`);
        else {
          assert.equal(code, "inactive", `lease round ${round}: unexpected heartbeat code`);
          assert.deepEqual(stored, { status: "failed", technical_failure: "connection-lost" }, `lease round ${round}: heartbeat refused but the attempt is not failed`);
          const request = must<{ status: string }>(await admin().from("portia_promo_qualification_requests").select("status").eq("id", fixture.requestId).single(), "lease request");
          assert.equal(request.status, "failed", `lease round ${round}: request status`);
        }
        assert.equal((reply(await beat(), "lease repeat") as { code: string }).code, code, `lease round ${round}: the attempt changed state on a repeated heartbeat`);
        assert.equal((await readState()).status, stored.status, `lease round ${round}: status changed afterwards`);
      }
    });

    // release / reject / delete against claim on one held request: whatever the order, one consistent end state and one owner at most.
    let owner: Contender | undefined;
    race("release-reject-delete-vs-claim", async () => {
      const run = env();
      if (!owner) {
        const client = await run.createOwnerFixture();
        const user = await client.auth.getUser();
        assert.ok(user.data.user?.id, "owner id is missing");
        owner = { id: user.data.user.id, client };
      }
      const holder = reviewers[0];
      for (let round = 0; round < R; round += 1) {
        const kind = round % 2 === 0 ? "ordinary" : "qualification";
        const table = kind === "ordinary" ? "portia_promo_requests" : "portia_promo_qualification_requests";
        const key = nick("rrd", round);
        const held = { nickname: key, nickname_key: key, status: "claimed", reviewer_id: holder.id };
        const request = must<{ id: string }>(
          await admin().from(table).insert(kind === "ordinary" ? { ...held, title_id: "academic", target_title_id: "intern" } : { ...held, title_id: "intern", transition_id: "laboratory-assistant" }).select("id").single(),
          `held request round ${round}`,
        );
        const args = { p_kind: kind, p_request_id: request.id };
        const actors = [
          { name: "release", call: () => holder.client.rpc("portia_promo_release_request", { ...args, p_force: false }) },
          { name: "reject", call: () => holder.client.rpc("portia_promo_reject_request", { ...args, p_internal_note: "race" }) },
          { name: "delete", call: () => owner!.client.rpc("portia_promo_delete_request", args) },
          ...reviewers.slice(1).map((reviewer) => ({ name: `claim:${reviewer.id}`, call: () => reviewer.client.rpc("portia_promo_claim_request", args) })),
        ];
        const results = await Promise.all(actors.map((actor) => actor.call()));
        const values = actors.map((actor, index) => ({ name: actor.name, value: reply(results[index], `${actor.name} round ${round}`) }));
        const valueOf = (name: string) => values.find((item) => item.name === name)?.value;
        const claimWins = values.filter((item) => item.name.startsWith("claim:") && item.value === true);
        const removers = ["reject", "delete"].filter((name) => valueOf(name) === true);
        assert.ok(claimWins.length <= 1, `round ${round}: ${claimWins.length} claim winners`);
        assert.ok(removers.length <= 1, `round ${round}: both reject and delete succeeded`);
        const read = await admin().from(table).select("status,reviewer_id").eq("id", request.id).maybeSingle();
        assert.equal(read.error, null, `round ${round}: final read: ${read.error?.message}`);
        if (read.data === null) assert.equal(removers.length, 1, `round ${round}: the request vanished without a successful reject or delete`);
        else {
          assert.equal(removers.length, 0, `round ${round}: ${removers.join("+")} succeeded but the request still exists`);
          assert.equal(valueOf("release"), true, `round ${round}: the holder's release must succeed while the request exists`);
          if (claimWins.length === 1) assert.deepEqual(read.data, { status: "claimed", reviewer_id: claimWins[0].name.slice("claim:".length) }, `round ${round}: owner is not the claim winner`);
          else assert.deepEqual(read.data, { status: "pending", reviewer_id: null }, `round ${round}: released request is not pending and free`);
        }
      }
    });

    // cleanup vs admission: an aged bucket row that submit refreshes must survive a concurrent portia_promo_cleanup().
    race("cleanup-vs-admission", async () => {
      for (let round = 0; round < R; round += 1) {
        const key = nick("cln", round);
        const tokenHash = tokenOf("cln", round);
        const aged = new Date(Date.now() - 4 * 86_400_000).toISOString();
        const stale = (index: number) => ({ bucket_key: bucketOf("cln", round, index), ip_bucket: `${env().prefix}:ip`, updated_at: aged });
        must(await admin().from("portia_promo_attempt_buckets").insert([stale(0), stale(1)]).select("bucket_key"), `aged buckets round ${round}`);
        const [cleanups, submits] = [
          [admin().rpc("portia_promo_cleanup"), admin().rpc("portia_promo_cleanup")],
          contenders(() => submit(key, tokenHash, bucketOf("cln", round, 0))),
        ];
        const [cleaned, results] = await Promise.all([Promise.all(cleanups), Promise.all(submits)]);
        for (const result of cleaned) {
          if (result.error?.code === "42501") throw new Error("admin-grant-missing: portia_promo_cleanup denied (42501); admin grants are calibrated in plan 16-10 (D9)");
          assert.equal(result.error, null, `cleanup round ${round}: ${result.error?.message}`);
        }
        const values = results.map((result) => reply(result, `cleanup round ${round}`));
        assertSingleWinner(values.map((value, index) => ({ contender: String(index), value })));
        assert.equal((await rowsOf("portia_promo_requests", "nickname_key", [key], "cleanup requests")).length, 1, `cleanup round ${round}: active requests`);
        const untouched = await rowsOf("portia_promo_attempt_buckets", "bucket_key", [bucketOf("cln", round, 1)], "cleanup control bucket");
        assert.equal(untouched.length, 0, `cleanup round ${round}: cleanup did not run, so the race proves nothing`);
        const refreshed = await rowsOf("portia_promo_attempt_buckets", "bucket_key", [bucketOf("cln", round, 0)], "cleanup bucket");
        assert.equal(refreshed.length, 1, `cleanup round ${round}: the bucket row refreshed by submit was deleted`);
        assert.ok(Date.parse(refreshed[0].updated_at) > Date.now() - 86_400_000, `cleanup round ${round}: bucket row was not refreshed`);
      }
    });
  });
}
