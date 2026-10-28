import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const invokedDirectly = process.env.npm_lifecycle_event === "test:promotion-live";
const readOnlyPreflight = process.env.PORTIA_PROMO_LIVE_CONFIRM === "READ_ONLY_PREFLIGHT";
const requiredEnvironment = [
  "PORTIA_PROMO_LIVE_URL",
  "PORTIA_PROMO_LIVE_ANON_KEY",
] as const;
const mutationEnvironment = ["PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY"] as const;
const missingEnvironment = [...requiredEnvironment, ...(readOnlyPreflight ? [] : mutationEnvironment)].filter((name) => !process.env[name]);
const mutationGuard = "ISOLATED_TEST_PROJECT";

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
} else if (missingEnvironment.length || (!readOnlyPreflight && process.env.PORTIA_PROMO_LIVE_CONFIRM !== mutationGuard)) {
  test("live Promotion database verification requires an isolated-project guard", () => {
    assert.fail(`Refusing live mutation. Set ${missingEnvironment.join(", ") || "the required credentials"} and PORTIA_PROMO_LIVE_CONFIRM=${mutationGuard}; use READ_ONLY_PREFLIGHT only for deployed RPC inventory.`);
  });
} else if (readOnlyPreflight) {
  const client = createClient(process.env.PORTIA_PROMO_LIVE_URL!, process.env.PORTIA_PROMO_LIVE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  test("deployed Promotion RPC inventory matches participant, reviewer and bank routes", async () => {
    await verifyRpcInventory(client);
    assert.equal(rpcInventory.length, 18);
  });
} else {
  const url = process.env.PORTIA_PROMO_LIVE_URL!;
  const anonKey = process.env.PORTIA_PROMO_LIVE_ANON_KEY!;
  const serviceKey = process.env.PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY!;
  const runId = `${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const fixturePrefix = `__portia_live_${runId}`;
  if (!fixturePrefix.startsWith("__portia_live_") || fixturePrefix.length > 48) throw new Error("unsafe-live-fixture-prefix");

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anonymous = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const userIds: string[] = [];
  const editorEmails: string[] = [];
  const nicknameKeys = new Set<string>();
  const bucketKeys = new Set<string>();
  let reviewerA: SupabaseClient;
  let reviewerB: SupabaseClient;
  let noPromo: SupabaseClient;
  let reviewerAId = "";

  const token = (label: string) => createHash("sha256").update(`${fixturePrefix}:${label}`).digest("hex");
  const nickname = (label: string) => {
    const value = `${fixturePrefix}_${label}`.slice(0, 64).toLowerCase();
    nicknameKeys.add(value);
    return value;
  };
  const bucket = (label: string) => {
    const value = `${fixturePrefix}:bucket:${label}`;
    bucketKeys.add(value);
    return value;
  };
  const requireData = <T>(result: { data: T | null; error: { message: string } | null }, label: string): T => {
    assert.equal(result.error, null, `${label}: ${result.error?.message ?? "unknown error"}`);
    assert.notEqual(result.data, null, `${label}: missing data`);
    return result.data as T;
  };

  async function createReviewer(label: string, promo: boolean) {
    const email = `portia-live-${runId}-${label}@example.invalid`;
    const password = `Live-${randomBytes(18).toString("base64url")}!9`;
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(created.error, null, created.error?.message);
    assert.ok(created.data.user?.id);
    userIds.push(created.data.user!.id);
    editorEmails.push(email);
    if (promo) {
      const editor = await service.from("portia_editors").upsert({ email, closed_tabs: [], granted_tabs: ["promo"] });
      assert.equal(editor.error, null, editor.error?.message);
    }
    const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    assert.equal(signedIn.error, null, signedIn.error?.message);
    return { client, id: created.data.user!.id };
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

  async function cleanup() {
    const keys = [...nicknameKeys];
    if (keys.length) {
      await service.from("portia_promo_audit_events").delete().in("nickname_key", keys);
      await service.from("portia_promo_results").delete().in("nickname_key", keys);
      await service.from("portia_promo_requests").delete().in("nickname_key", keys);
      await service.from("portia_promo_qualification_requests").delete().in("nickname_key", keys);
      await service.from("portia_promo_device_bindings").delete().in("nickname_key", keys);
    }
    if (bucketKeys.size) await service.from("portia_promo_attempt_buckets").delete().in("bucket_key", [...bucketKeys]);
    if (editorEmails.length) await service.from("portia_editors").delete().in("email", editorEmails);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  }

  describe("live Promotion concurrency, lease and RLS", { concurrency: false }, () => {
    before(async () => {
      await verifyRpcInventory(anonymous);
      const a = await createReviewer("reviewer-a", true); reviewerA = a.client; reviewerAId = a.id;
      reviewerB = (await createReviewer("reviewer-b", true)).client;
      noPromo = (await createReviewer("no-promo", false)).client;
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
