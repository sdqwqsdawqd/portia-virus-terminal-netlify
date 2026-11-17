import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRun, requireStagingLiveTarget, type Run, type StagingLiveTarget } from "../tests/e2e/fixtures/staging-harness.ts";

// Active under `npm run test:promotion-live` and under `npm run test:staging-live*`. The mutating branch goes through the single
// guard (requireStagingLiveTarget) shared with the other live suites; READ_ONLY_PREFLIGHT (RPC inventory only) is unchanged.
const lifecycleEvent = process.env.npm_lifecycle_event ?? "";
const invokedDirectly = lifecycleEvent === "test:promotion-live" || lifecycleEvent.startsWith("test:staging-live");
const readOnlyPreflight = process.env.PORTIA_PROMO_LIVE_CONFIRM === "READ_ONLY_PREFLIGHT";
const requiredEnvironment = [
  "PORTIA_PROMO_LIVE_URL",
  "PORTIA_PROMO_LIVE_ANON_KEY",
] as const;
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);

const inertUuid = "00000000-0000-4000-8000-000000000000";
const rpcInventory: Array<[string, Record<string, unknown> | undefined]> = [
  ["portia_promo_resolve_device", { p_token_hash: "x".repeat(64) }],
  ["portia_promo_public_status", { p_nickname_key: "__portia_rpc_probe", p_title_id: "academic", p_token_hash: null }],
  ["portia_promo_submit_request", { p_kind: "ordinary", p_nickname: "__portia_rpc_probe", p_nickname_key: "__portia_rpc_probe", p_title_id: "academic", p_target_id: "trainee", p_token_hash: "short", p_risk_bucket: "", p_bucket_key: "__portia_rpc_probe", p_ip_bucket: "" }],
  ["portia_promo_reviewer_state", undefined],
  ["portia_promo_claim_request", { p_kind: "ordinary", p_request_id: inertUuid }],
  ["portia_promo_release_request", { p_kind: "ordinary", p_request_id: inertUuid, p_force: false }],
  ["portia_promo_reject_request", { p_kind: "ordinary", p_request_id: inertUuid, p_internal_note: "probe" }],
  ["portia_promo_delete_request", { p_kind: "ordinary", p_request_id: inertUuid }],
  ["portia_promo_approve_assignment", { p_request_id: inertUuid }],
  ["portia_promo_override_failure", { p_attempt_id: inertUuid }],
  ["portia_promo_release_retake", { p_attempt_id: inertUuid }],
  ["portia_promo_grade_answer", { p_answer_id: inertUuid, p_correct: false }],
  ["portia_promo_finalize_attempt", { p_attempt_id: inertUuid, p_passed: false, p_percent: 0, p_retake_days: 2 }],
  ["portia_promo_reset_device", { p_nickname_key: "__portia_rpc_probe" }],
  ["portia_promo_bank_state", undefined],
  ["portia_promo_bank_command", { p_action: "probe", p_payload: {} }],
  ["portia_promo_confirm_assignment", { p_request_id: inertUuid, p_bank_id: inertUuid, p_bank_version: "probe", p_items: [] }],
  ["portia_promo_confirm_test", { p_request_id: inertUuid, p_bank_id: inertUuid, p_bank_version: "probe", p_questions: [] }],
];

async function verifyRpcInventory(client: SupabaseClient) {
  for (const [name, args] of rpcInventory) {
    const result = await client.rpc(name, args);
    const code = result.error?.code ?? "";
    assert.ok(code !== "PGRST202" && code !== "42883", `${name}: deployed signature is missing or mismatched (${code})`);
    assert.notEqual(code, "42P01", `${name}: deployed function references a missing table`);
  }
}

if (!invokedDirectly) {
  test("live Promotion database verification is opt-in", { skip: "run npm run test:promotion-live against an isolated Supabase test project" }, () => {});
} else if (readOnlyPreflight) {
  if (missingEnvironment.length) {
    test("live Promotion database verification requires read-only credentials", () => {
      assert.fail(`Refusing live verification. Set ${missingEnvironment.join(", ")}; READ_ONLY_PREFLIGHT only lists deployed RPCs.`);
    });
  } else {
    const client = createClient(process.env.PORTIA_PROMO_LIVE_URL!, process.env.PORTIA_PROMO_LIVE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    test("deployed Promotion RPC inventory matches participant, reviewer and bank routes", async () => {
      await verifyRpcInventory(client);
      assert.equal(rpcInventory.length, 18);
    });
  }
} else {
  let live: StagingLiveTarget | undefined;
  let blocked = "";
  try {
    live = requireStagingLiveTarget(process.env);
  } catch (error) {
    blocked = error instanceof Error ? error.message : "unknown guard failure";
  }
  if (!live) {
    test("live Promotion database verification requires an isolated-project guard", () => {
      assert.fail(`Refusing live mutation: ${blocked}. Use READ_ONLY_PREFLIGHT only for deployed RPC inventory.`);
    });
  } else registerMutatingSuite(live);
}

function registerMutatingSuite(live: StagingLiveTarget) {
  const anonymous = createClient(live.url, live.publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // Identities, fixtures prefix, cleanup and residual check come from the shared harness (run-marked users, ordered purge).
  let run: Run | undefined;
  let fixturePrefix = "";
  let service: SupabaseClient;
  let reviewerA: SupabaseClient;
  let reviewerB: SupabaseClient;
  let noPromo: SupabaseClient;
  let reviewerAId = "";

  const token = (label: string) => createHash("sha256").update(`${fixturePrefix}:${label}`).digest("hex");
  const nickname = (label: string) => `${fixturePrefix}_${label}`.slice(0, 64).toLowerCase();
  const bucket = (label: string) => `${fixturePrefix}:bucket:${label}`;
  const requireData = <T>(result: { data: T | null; error: { message: string } | null }, label: string): T => {
    assert.equal(result.error, null, `${label}: ${result.error?.message ?? "unknown error"}`);
    assert.notEqual(result.data, null, `${label}: missing data`);
    return result.data as T;
  };

  async function createReviewer(current: Run, label: string, promo: boolean) {
    const client = await current.createIdentity(label, promo ? { grantedTabs: ["promo"] } : undefined);
    const user = await client.auth.getUser();
    assert.equal(user.error, null, user.error?.message);
    assert.ok(user.data.user?.id);
    return { client, id: user.data.user!.id };
  }

  async function createAttempt(label: string, status: "prepared" | "active" = "active", leaseOffsetMs = 45_000) {
    const key = nickname(label);
    const tokenHash = token(label);
    requireData(await service.from("portia_promo_device_bindings").insert({ nickname_key: key, token_hash: tokenHash }).select("id").single(), `${label} binding`);
    const request = requireData<{ id: string }>(await service.from("portia_promo_qualification_requests").insert({
      nickname: key,
      nickname_key: key,
      title_id: "intern",
      transition_id: "laboratory-assistant",
      status: "testing",
      reviewer_id: reviewerAId,
    }).select("id").single(), `${label} request`);
    const now = Date.now();
    const attempt = requireData<{ id: string }>(await service.from("portia_promo_attempts").insert({
      request_id: request.id,
      reviewer_id: reviewerAId,
      status,
      client_mode: "desktop",
      current_question_index: 0,
      ...(status === "active" ? {
        started_at: new Date(now - 1_000).toISOString(),
        deadline_at: new Date(now + 15 * 60_000).toISOString(),
        last_seen_at: new Date(now - 1_000).toISOString(),
        lease_expires_at: new Date(now + leaseOffsetMs).toISOString(),
      } : {}),
    }).select("id").single(), `${label} attempt`);
    const questions = requireData<Array<{ id: string; sort_order: number }>>(await service.from("portia_promo_attempt_questions").insert([0, 1].map((sortOrder) => ({
      attempt_id: attempt.id,
      question_type: "single",
      snapshot_text: `${fixturePrefix} question ${label} ${sortOrder}`,
      snapshot_options: ["A", "B"],
      answer_key: 0,
      sort_order: sortOrder,
    }))).select("id,sort_order").order("sort_order"), `${label} questions`);
    return { attemptId: attempt.id, requestId: request.id, tokenHash, questions };
  }

  async function submitRequest(label: string, key: string, tokenHash: string) {
    return anonymous.rpc("portia_promo_submit_request", {
      p_kind: "ordinary",
      p_nickname: key,
      p_nickname_key: key,
      p_title_id: "academic",
      p_target_id: "intern",
      p_token_hash: tokenHash,
      p_risk_bucket: `${fixturePrefix}:risk`,
      p_bucket_key: bucket(label),
      p_ip_bucket: `${fixturePrefix}:ip`,
    });
  }

  // The old cleanup ignored every error; run.cleanup() throws on any failed step and the residual must be zero in every category.
  async function cleanup() {
    if (!run) return;
    await run.cleanup();
    const residual = await run.residual();
    assert.ok(Object.values(residual).every((count) => count === 0), `residual after cleanup: ${JSON.stringify(residual)}`);
  }

  describe("live Promotion concurrency, lease and RLS", { concurrency: false }, () => {
    before(async () => {
      run = createRun(live);
      fixturePrefix = run.prefix;
      service = run.admin;
      await verifyRpcInventory(anonymous);
      const a = await createReviewer(run, "reviewer-a", true); reviewerA = a.client; reviewerAId = a.id;
      reviewerB = (await createReviewer(run, "reviewer-b", true)).client;
      noPromo = (await createReviewer(run, "no-promo", false)).client;
    });
    after(cleanup);

    test("promo reviewers succeed while anon and non-promo users cannot read or invoke reviewer state", async () => {
      const anonRead = await anonymous.from("portia_promo_requests").select("id").limit(1);
      const noPromoRead = await noPromo.from("portia_promo_requests").select("id").limit(1);
      assert.ok(anonRead.error, "anon direct table read must be denied");
      assert.ok(noPromoRead.error, "authenticated non-promo direct table read must be denied");
      assert.ok((await noPromo.rpc("portia_promo_reviewer_state")).error, "non-promo reviewer RPC must be denied");
      const promoState = await reviewerA.rpc("portia_promo_reviewer_state");
      assert.equal(promoState.error, null, promoState.error?.message);
      assert.ok(promoState.data && Array.isArray(promoState.data.ordinary));
    });

    test("parallel claim produces exactly one assignee", async () => {
      const key = nickname("claim");
      const row = requireData<{ id: string }>(await service.from("portia_promo_requests").insert({ nickname: key, nickname_key: key, title_id: "academic", target_title_id: "intern" }).select("id").single(), "claim fixture");
      const claims = await Promise.all([reviewerA, reviewerB].map((client) => client.rpc("portia_promo_claim_request", { p_kind: "ordinary", p_request_id: row.id })));
      claims.forEach((claim) => assert.equal(claim.error, null, claim.error?.message));
      assert.equal(claims.filter((claim) => claim.data === true).length, 1);
      assert.equal(claims.filter((claim) => claim.data === false).length, 1);
      const stored = requireData<{ reviewer_id: string; status: string }>(await service.from("portia_promo_requests").select("reviewer_id,status").eq("id", row.id).single(), "claimed row");
      assert.equal(stored.status, "claimed");
      assert.ok(stored.reviewer_id);
    });

    test("atomic admission creates one request and cannot split one device across two nicknames", async () => {
      const sameKey = nickname("submit-same"); const sameToken = token("submit-same");
      const same = await Promise.all([submitRequest("submit-same", sameKey, sameToken), submitRequest("submit-same", sameKey, sameToken)]);
      same.forEach((result) => assert.equal(result.error, null, result.error?.message));
      assert.deepEqual(same.map((result) => result.data.code).sort(), ["active-request", "created"]);
      const sameRows = requireData<Array<{ id: string }>>(await service.from("portia_promo_requests").select("id").eq("nickname_key", sameKey), "same admission rows");
      assert.equal(sameRows.length, 1);
      const resolved = await anonymous.rpc("portia_promo_resolve_device", { p_token_hash: sameToken });
      assert.equal(resolved.error, null, resolved.error?.message);
      assert.equal(resolved.data, sameKey);
      const restored = await anonymous.rpc("portia_promo_public_status", { p_nickname_key: sameKey, p_title_id: "academic", p_token_hash: sameToken });
      assert.equal(restored.error, null, restored.error?.message);
      assert.equal(restored.data.binding, "allowed");
      assert.equal(restored.data.ordinary?.status, "pending");

      const keyA = nickname("split-a"); const keyB = nickname("split-b"); const sharedToken = token("split-device");
      const split = await Promise.all([submitRequest("split-a", keyA, sharedToken), submitRequest("split-b", keyB, sharedToken)]);
      split.forEach((result) => assert.equal(result.error, null, result.error?.message));
      assert.equal(split.filter((result) => result.data.code === "created").length, 1);
      assert.equal(split.filter((result) => result.data.code === "device-denied").length, 1);
      const bindings = requireData<Array<{ nickname_key: string }>>(await service.from("portia_promo_device_bindings").select("nickname_key").eq("token_hash", sharedToken), "split bindings");
      assert.equal(bindings.length, 1);
    });

    test("answer CAS advances once for different and repeated nonces", async () => {
      const different = await createAttempt("answer-different");
      const differentResults = await Promise.all(["nonce-different-0001", "nonce-different-0002"].map((nonce) => anonymous.rpc("portia_promo_answer_question", {
        p_attempt_id: different.attemptId,
        p_question_id: different.questions[0].id,
        p_expected_question_index: 0,
        p_answer: 0,
        p_nonce: nonce,
        p_token_hash: different.tokenHash,
      })));
      differentResults.forEach((result) => assert.equal(result.error, null, result.error?.message));
      assert.equal(differentResults.filter((result) => result.data.code === "accepted").length, 1);
      assert.equal(differentResults.filter((result) => result.data.code === "conflict").length, 1);
      const stale = await anonymous.rpc("portia_promo_answer_question", { p_attempt_id: different.attemptId, p_question_id: different.questions[0].id, p_expected_question_index: 0, p_answer: 0, p_nonce: "nonce-different-stale", p_token_hash: different.tokenHash });
      assert.equal(stale.error, null, stale.error?.message); assert.equal(stale.data.code, "conflict");

      const repeated = await createAttempt("answer-repeated"); const repeatedNonce = "nonce-repeated-0001";
      const repeatedResults = await Promise.all([0, 1].map(() => anonymous.rpc("portia_promo_answer_question", { p_attempt_id: repeated.attemptId, p_question_id: repeated.questions[0].id, p_expected_question_index: 0, p_answer: 0, p_nonce: repeatedNonce, p_token_hash: repeated.tokenHash })));
      repeatedResults.forEach((result) => assert.equal(result.error, null, result.error?.message));
      assert.ok(repeatedResults.every((result) => result.data.code === "accepted"));
      assert.equal(repeatedResults.filter((result) => result.data.idempotent === false).length, 1);
      assert.equal(repeatedResults.filter((result) => result.data.idempotent === true).length, 1);
      const stored = requireData<{ current_question_index: number }>(await service.from("portia_promo_attempts").select("current_question_index").eq("id", repeated.attemptId).single(), "repeated attempt");
      assert.equal(stored.current_question_index, 1);
    });

    test("client mode is immutable and an expired heartbeat lease fails the attempt", async () => {
      const prepared = await createAttempt("mode", "prepared");
      const desktop = await anonymous.rpc("portia_promo_start_test", { p_attempt_id: prepared.attemptId, p_token_hash: prepared.tokenHash, p_client_mode: "desktop" });
      assert.equal(desktop.error, null, desktop.error?.message); assert.ok(desktop.data);
      const phone = await anonymous.rpc("portia_promo_start_test", { p_attempt_id: prepared.attemptId, p_token_hash: prepared.tokenHash, p_client_mode: "phone" });
      assert.equal(phone.error, null, phone.error?.message); assert.equal(phone.data, null);

      const expired = await createAttempt("lease-expired", "active", -1_000);
      const projection = await anonymous.rpc("portia_promo_current_test", { p_attempt_id: expired.attemptId, p_token_hash: expired.tokenHash, p_client_mode: "desktop" });
      assert.equal(projection.error, null, projection.error?.message);
      const stored = requireData<{ status: string; technical_failure: string }>(await service.from("portia_promo_attempts").select("status,technical_failure").eq("id", expired.attemptId).single(), "expired attempt");
      assert.equal(stored.status, "failed");
      assert.equal(stored.technical_failure, "connection-lost");
    });
  });
}
