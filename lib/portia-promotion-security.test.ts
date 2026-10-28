import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { promotionReviewerDecision, createPreviewToken, verifyPreviewToken } from "./portia-promotion-reviewer.ts";

const sql = readFileSync(new URL("../supabase/phase14_apply.sql", import.meta.url), "utf8");
const route = (name: string) => readFileSync(new URL(`../app/api/promotion/${name}/route.ts`, import.meta.url), "utf8");

function sqlFunction(name: string) {
  const start = sql.toLowerCase().indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const end = sql.indexOf("$$;", start);
  assert.ok(end > start, `${name} has a body`);
  return sql.slice(start, end + 3);
}

test("security regression: direct table access is denied and a reviewer without promo is rejected", () => {
  const tables = [...sql.matchAll(/create table if not exists public\.(portia_promo_[a-z_]+)/gi)].map((match) => match[1]);
  assert.ok(tables.length >= 16);
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} RLS`);
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"), `${table} revoke`);
  }
  assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete|all)[^;]*on\s+(?:table\s+)?public\.portia_promo_[^;]*\b(?:anon|authenticated)\b/i);
  assert.equal(promotionReviewerDecision(true, { canEdit: true, canManageEditors: false, openTabs: ["employees"], tabsEnforced: true }), "forbidden");
  for (const name of ["reviewer", "banks"]) assert.match(route(name), /requirePromotionReviewer/);
});

test("security regression: client timestamps cannot control cooldowns or the qualification deadline", () => {
  for (const name of ["status", "requests", "test"]) {
    const source = route(name);
    assert.doesNotMatch(source, /body\.(?:now|serverNow|startedAt|deadlineAt|availableAt|retakeAt)/);
  }
  const confirm = sqlFunction("portia_promo_confirm_test");
  const start = sqlFunction("portia_promo_start_test");
  const answer = sqlFunction("portia_promo_answer_question");
  assert.match(confirm, /status[\s\S]*'prepared'/i);
  assert.match(start, /deadline_at = now\(\) \+ interval '15 minutes'/i);
  assert.match(answer, /a\.status = 'active' and now\(\) < a\.deadline_at/i);
  assert.doesNotMatch(confirm + start + answer, /p_(?:now|deadline|started|client_time)/i);
});

test("security regression: public routes avoid wildcard reads and forbidden response fields", () => {
  const names = ["status", "requests", "test", "reviewer", "banks"];
  for (const name of names) assert.doesNotMatch(route(name), /select\(\s*["']\*["']\s*\)/, name);

  const testRoute = route("test");
  const projectionStart = testRoute.indexOf("function safeProjection");
  const projectionEnd = testRoute.indexOf("async function current", projectionStart);
  const projection = testRoute.slice(projectionStart, projectionEnd);
  for (const forbidden of ["answerKey", "technicalFailure", "reviewerCorrect", "internalNote", "tokenHash", "riskBucket", "questions"]) {
    assert.ok(!projection.includes(forbidden), forbidden);
  }
  const publicStatus = sqlFunction("portia_promo_public_status");
  for (const forbidden of ["answer_key", "reviewer_id", "internal_note", "token_hash", "risk_bucket"]) {
    assert.ok(!publicStatus.includes(`'${forbidden}'`), forbidden);
  }
});

test("security regression: duplicate active requests and two-reviewer claims are atomic", () => {
  assert.match(sql, /create unique index if not exists portia_promo_one_active_request[\s\S]*where status in \('pending', 'claimed', 'assigned', 'awaiting-sheet-change'\)/i);
  assert.match(sql, /create unique index if not exists portia_promo_one_active_qualification_request[\s\S]*where status in \('pending', 'claimed', 'approved', 'testing', 'grading'\)/i);

  const claim = sqlFunction("portia_promo_claim_request");
  assert.match(claim, /where id = p_request_id and status = 'pending' and reviewer_id is null/gi);
  assert.match(claim, /return found;/i);
  const reviewer = route("reviewer");
  assert.match(reviewer, /data !== true[\s\S]*claim-conflict[\s\S]*status: 409/);
});

test("security regression: admission and answer advancement are serialized", () => {
  const submit = sqlFunction("portia_promo_submit_request");
  assert.match(submit, /pg_advisory_xact_lock/);
  assert.match(submit, /portia_promo_attempt_buckets[\s\S]*portia_promo_device_bindings[\s\S]*portia_promo_(?:requests|qualification_requests)/i);
  const answer = sqlFunction("portia_promo_answer_question");
  assert.match(answer, /p_expected_question_index integer/i);
  assert.match(answer, /current_question_index[\s\S]*for update/i);
  assert.match(answer, /set current_question_index = current_question_index \+ 1/i);
});

test("security regression: stale test leases fail closed and device mode is immutable", () => {
  const expire = sqlFunction("portia_promo_expire_stale_attempt");
  assert.match(expire, /lease_expires_at <= now\(\)[\s\S]*status = 'failed'/i);
  assert.match(expire, /technical_failure = coalesce\(technical_failure, 'connection-lost'\)/i);
  const heartbeat = sqlFunction("portia_promo_heartbeat_test");
  assert.match(heartbeat, /portia_promo_expire_stale_attempt\(p_attempt_id\)/i);
  assert.match(heartbeat, /a\.status = 'active'/i);
  assert.match(heartbeat, /lease_expires_at = now\(\) \+ interval '45 seconds'/i);
  const current = sqlFunction("portia_promo_current_test");
  assert.doesNotMatch(current, /set client_mode\s*=/i);
  assert.match(current, /a\.client_mode = p_client_mode/i);
});

test("security regression: lookup stays private and atomic admission owns binding", () => {
  const statusRoute = route("status");
  const api = readFileSync(new URL("./portia-promotion-api.ts", import.meta.url), "utf8");
  assert.match(statusRoute, /createPromotionApiDependencies/);
  assert.doesNotMatch(statusRoute, /portia_promo_device_bindings/);
  assert.doesNotMatch(api, /supabase\.rpc\("portia_promo_bind_device"/);
  assert.match(api, /supabase\.rpc\("portia_promo_resolve_device"/);
  const resolve = sqlFunction("portia_promo_resolve_device");
  assert.match(resolve, /token_hash = p_token_hash and reset_at is null/i);
  assert.doesNotMatch(resolve, /jsonb_agg|select \*/i);
  const submit = sqlFunction("portia_promo_submit_request");
  assert.match(submit, /token_hash = p_token_hash and reset_at is null[\s\S]*for update/i);
  assert.match(submit, /insert into public\.portia_promo_device_bindings/i);
  const reset = sqlFunction("portia_promo_reset_device");
  assert.match(reset, /portia_has_tab_grant\('promo'\)/i);
  assert.match(reset, /portia_is_owner\(\)/i);
  assert.match(reset, /portia_promo_audit_events[\s\S]*device-reset/i);
});

test("security regression: stale or tampered previews cannot be confirmed", () => {
  const secret = "phase-14-security-regression-secret-value";
  const token = createPreviewToken({ kind: "ordinary", bankId: "bank", version: "v1", ids: ["one"], expiresAt: 100 }, secret);
  assert.deepEqual(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "v1", now: 100 }, secret), ["one"]);
  assert.equal(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "v2", now: 100 }, secret), null);
  assert.equal(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "v1", now: 101 }, secret), null);
  assert.equal(verifyPreviewToken(`${token}x`, { kind: "ordinary", bankId: "bank", version: "v1", now: 100 }, secret), null);
  assert.match(route("banks"), /verifyPreviewToken[\s\S]*stale-preview[\s\S]*status: 409/);
  assert.doesNotMatch(route("banks"), /snapshot_text|answer_key/);
  assert.match(sqlFunction("portia_promo_confirm_assignment"), /p_bank_version[\s\S]*md5\([\s\S]*source\.task_text/i);
  assert.match(sqlFunction("portia_promo_confirm_test"), /p_bank_version[\s\S]*source\.question_text[\s\S]*source\.answer_key/i);
});

test("security regression: only the current question is public and answer keys stay private", () => {
  const current = sqlFunction("portia_promo_current_test");
  assert.match(current, /q\.sort_order = answer_count limit 1/i);
  assert.match(current, /'question'[\s\S]*'id'[\s\S]*'type'[\s\S]*'text'[\s\S]*'options'[\s\S]*'index'[\s\S]*'total'/i);
  assert.doesNotMatch(current, /'answerKey'|'answer_key'|'questions'/i);
  const answer = sqlFunction("portia_promo_answer_question");
  assert.match(answer, /q\.sort_order = p_expected_question_index/i);
  assert.match(answer, /on conflict do nothing/i);
  assert.match(answer, /current_question_index = current_question_index \+ 1/i);
});

test("security regression: deadline boundary and repeated failure events fail closed once", () => {
  const current = sqlFunction("portia_promo_current_test");
  const expire = sqlFunction("portia_promo_expire_stale_attempt");
  const answer = sqlFunction("portia_promo_answer_question");
  const fail = sqlFunction("portia_promo_fail_attempt");
  assert.match(current, /portia_promo_expire_stale_attempt\(p_attempt_id\)/i);
  assert.match(expire, /deadline_at <= now\(\)/i);
  assert.match(answer, /now\(\) < a\.deadline_at/i);
  assert.match(fail, /a\.status = 'active'/i);
  assert.match(fail, /return found or exists[\s\S]*status = 'failed'/i);
  assert.doesNotMatch(fail, /technical_failure\s*=\s*coalesce/i, "a repeated signal must not rewrite the first reason");
});

test("security regression: close prunes history and scheduled cleanup never deletes unvalidated workflow rows", () => {
  const close = sqlFunction("portia_promo_close");
  assert.match(close, /insert into public\.portia_promo_results[\s\S]*delete from public\.portia_promo_(?:requests|qualification_requests)/i);
  assert.match(close, /row_number\(\) over \(partition by nickname_key order by created_at desc, id desc\)[\s\S]*history_order > 3/i);

  const cleanup = sqlFunction("portia_promo_cleanup");
  assert.match(cleanup, /portia_promo_attempt_buckets[\s\S]*interval '3 days'/i);
  assert.doesNotMatch(cleanup, /delete from public\.portia_promo_(?:requests|qualification_requests)/i);
  assert.doesNotMatch(cleanup, /delete from public\.portia_promo_(?:results|assignments|assignment_items|attempts|attempt_questions|answers|device_bindings)/i);
});

test("security regression: privileged deletion is owner-only and never resets bindings", () => {
  const reject = sqlFunction("portia_promo_reject_request");
  const remove = sqlFunction("portia_promo_delete_request");
  assert.match(remove, /portia_is_owner\(\)/i);
  assert.match(remove, /for update/i);
  assert.match(remove, /request-deleted/i);
  assert.doesNotMatch(reject + remove, /portia_promo_device_bindings|portia_promo_reset_device/i);
  const reviewer = route("reviewer");
  assert.match(reviewer, /command\.action === "reset-device" \|\| command\.action === "delete-request"/);
  assert.match(reviewer, /portia_promo_reject_request[\s\S]*portia_promo_delete_request/);
});
