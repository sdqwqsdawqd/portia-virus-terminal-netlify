import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const setup = readFileSync(new URL("../supabase/portia_setup.sql", import.meta.url), "utf8");
const apply = readFileSync(new URL("../supabase/phase14_apply.sql", import.meta.url), "utf8");

const tables = [
  "portia_promo_device_bindings",
  "portia_promo_attempt_buckets",
  "portia_promo_requests",
  "portia_promo_task_banks",
  "portia_promo_task_items",
  "portia_promo_assignments",
  "portia_promo_assignment_items",
  "portia_promo_qualification_requests",
  "portia_promo_qualification_banks",
  "portia_promo_qualification_questions",
  "portia_promo_qualification_options",
  "portia_promo_attempts",
  "portia_promo_attempt_questions",
  "portia_promo_answers",
  "portia_promo_results",
  "portia_promo_audit_events",
];

test("promotion SQL defines separate normalized ordinary and qualification tables", () => {
  for (const table of tables) {
    assert.match(setup, new RegExp(`create table if not exists public\\.${table}\\b`, "i"), table);
    assert.match(setup, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} RLS`);
    assert.match(setup, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"), `${table} grants`);
  }
  assert.match(setup, /portia_promo_assignment_items[\s\S]*snapshot_text text not null/i);
  assert.match(setup, /portia_promo_attempt_questions[\s\S]*answer_key jsonb not null/i);
  assert.match(setup, /portia_promo_results[\s\S]*compact jsonb not null/i);
});

test("promotion SQL enforces one active ordinary and qualification request per nickname", () => {
  assert.match(setup, /create unique index if not exists portia_promo_one_active_request[\s\S]*on public\.portia_promo_requests \(nickname_key\)[\s\S]*where status in \('pending', 'claimed', 'assigned', 'awaiting-sheet-change'\)/i);
  assert.match(setup, /create unique index if not exists portia_promo_one_active_qualification_request[\s\S]*on public\.portia_promo_qualification_requests \(nickname_key\)[\s\S]*where status in \('pending', 'claimed', 'approved', 'testing', 'grading'\)/i);
});

test("promotion SQL keeps secrets private and bounds untrusted text", () => {
  assert.doesNotMatch(setup, /grant\s+select[^;]*portia_promo_(device_bindings|attempt_buckets|attempt_questions|answers)[^;]*\b(anon|authenticated)\b/i);
  for (const privateColumn of ["token_hash", "ip_bucket", "answer_key", "reviewer_id", "internal_note"]) {
    assert.match(setup, new RegExp(`\\b${privateColumn}\\b`, "i"), privateColumn);
  }
  assert.match(setup, /nickname_key text not null check \(length\(nickname_key\) between 1 and 64\)/i);
  assert.match(setup, /snapshot_text text not null check \(length\(snapshot_text\) between 1 and 4000\)/i);
});

const rpcNames = [
  "portia_promo_bind_device",
  "portia_promo_resolve_device",
  "portia_promo_reset_device",
  "portia_promo_reviewer_state",
  "portia_promo_approve_assignment",
  "portia_promo_bank_state",
  "portia_promo_bank_command",
  "portia_promo_register_attempt",
  "portia_promo_submit_request",
  "portia_promo_public_status",
  "portia_promo_claim_request",
  "portia_promo_release_request",
  "portia_promo_reject_request",
  "portia_promo_delete_request",
  "portia_promo_confirm_assignment",
  "portia_promo_confirm_test",
  "portia_promo_start_test",
  "portia_promo_expire_stale_attempt",
  "portia_promo_heartbeat_test",
  "portia_promo_answer_question",
  "portia_promo_fail_attempt",
  "portia_promo_grade_answer",
  "portia_promo_finalize_attempt",
  "portia_promo_override_failure",
  "portia_promo_release_retake",
  "portia_promo_close",
  "portia_promo_cleanup",
];

test("promotion SQL RPCs are security-definer functions with pinned search paths", () => {
  for (const name of rpcNames) {
    const start = setup.toLowerCase().indexOf(`create or replace function public.${name}`);
    assert.ok(start >= 0, name);
    const body = setup.slice(start, setup.indexOf("$$;", start) + 3);
    assert.match(body, /security definer/i, `${name} security definer`);
    assert.match(body, /set search_path = ''/i, `${name} search path`);
    assert.match(setup, new RegExp(`revoke all on function public\\.${name}\\(`, "i"), `${name} revoke`);
  }
});

test("promotion PL/pgSQL bodies terminate their outer block before the dollar quote", () => {
  for (const [label, source] of [["setup", setup], ["apply", apply]] as const) {
    const bodies = source.match(/create or replace function public\.portia_promo_[\s\S]*?\$\$;/gi) ?? [];
    assert.ok(bodies.length >= rpcNames.length, `${label} promotion function count`);
    for (const body of bodies) {
      const name = body.match(/function public\.([a-z0-9_]+)/i)?.[1] ?? label;
      assert.match(body, /end;\s*\$\$;$/i, `${name} final END must be terminated inside the PL/pgSQL body`);
      assert.doesNotMatch(body, /end\s+\$\$;$/i, `${name} cannot rely on the CREATE statement semicolon`);
    }
  }
});

test("promotion SQL reviewer transitions require promo and claim conditionally", () => {
  const reviewerRpcs = ["reset_device", "reviewer_state", "approve_assignment", "bank_state", "bank_command", "claim_request", "release_request", "reject_request", "delete_request", "confirm_assignment", "confirm_test", "grade_answer", "finalize_attempt", "override_failure", "release_retake", "close"];
  for (const suffix of reviewerRpcs) {
    const start = setup.toLowerCase().indexOf(`create or replace function public.portia_promo_${suffix}`);
    const body = setup.slice(start, setup.indexOf("$$;", start) + 3);
    assert.match(body, /portia_has_tab_grant\('promo'\)/i, suffix);
  }
  assert.match(setup, /portia_promo_claim_request[\s\S]*status = 'claimed'[\s\S]*where id = p_request_id and status = 'pending' and reviewer_id is null/i);
});

test("promotion SQL closes transactionally, retains three results and schedules bounded cleanup", () => {
  assert.match(setup, /portia_promo_close[\s\S]*insert into public\.portia_promo_results[\s\S]*delete from public\.portia_promo_(requests|qualification_requests)/i);
  assert.match(setup, /row_number\(\) over \(partition by nickname_key order by created_at desc, id desc\)[\s\S]*where history_order > 3/i);
  assert.match(setup, /portia_promo_cleanup[\s\S]*interval '3 days'/i);
  assert.match(setup, /portia-promo-cleanup/i);
  assert.match(setup, /cron\.job_run_details[\s\S]*interval '7 days'/i);
});

test("destructive request RPCs lock and remove only the selected request graph", () => {
  for (const name of ["reject_request", "delete_request"]) {
    const start = setup.indexOf(`create or replace function public.portia_promo_${name}`);
    const body = setup.slice(start, setup.indexOf("$$;", start) + 3);
    assert.match(body, /for update/i);
    assert.match(body, /delete from public\.portia_promo_(?:requests|qualification_requests)/i);
    assert.doesNotMatch(body, /portia_promo_device_bindings|portia_promo_reset_device/i);
  }
  const rejectStart = setup.indexOf("create or replace function public.portia_promo_reject_request");
  const reject = setup.slice(rejectStart, setup.indexOf("$$;", rejectStart) + 3);
  assert.match(reject, /status in \('claimed', 'assigned'\)/i);
  assert.match(reject, /status in \('claimed', 'approved', 'testing', 'grading'\)/i);
  assert.match(reject, /insert into public\.portia_promo_results[\s\S]*'rejected'/i);
  assert.match(reject, /where history_order > 3/i);
  const deleteStart = setup.indexOf("create or replace function public.portia_promo_delete_request");
  const remove = setup.slice(deleteStart, setup.indexOf("$$;", deleteStart) + 3);
  assert.match(remove, /delete from public\.portia_promo_results result[\s\S]*requestId[\s\S]*assignmentId[\s\S]*attemptId/i);
  assert.match(setup, /portia_promo_assignments[\s\S]*request_id uuid not null unique references public\.portia_promo_requests\(id\) on delete cascade/i);
  assert.match(setup, /portia_promo_assignment_items[\s\S]*assignment_id uuid not null references public\.portia_promo_assignments\(id\) on delete cascade/i);
  assert.match(setup, /portia_promo_attempt_questions[\s\S]*attempt_id uuid not null references public\.portia_promo_attempts\(id\) on delete cascade/i);
  assert.match(setup, /portia_promo_answers[\s\S]*attempt_id uuid not null references public\.portia_promo_attempts\(id\) on delete cascade/i);
});

test("public promotion status is explicit and submit owns atomic admission", () => {
  assert.match(setup, /portia_promo_public_status[\s\S]*jsonb_build_object[\s\S]*qualificationPassed[\s\S]*recent_results/i);
  const submitStart = setup.indexOf("create or replace function public.portia_promo_submit_request");
  const submit = setup.slice(submitStart, setup.indexOf("$$;", submitStart) + 3);
  assert.match(submit, /token_hash = p_token_hash and reset_at is null[\s\S]*for update/i);
  assert.match(submit, /bound_by_token is not null[\s\S]*device-denied/i);
  assert.match(submit, /insert into public\.portia_promo_device_bindings/i);
  assert.match(submit, /insert into public\.portia_promo_(requests|qualification_requests)/i);
  assert.match(setup, /portia_promo_register_attempt[\s\S]*until_at > now\(\)[\s\S]*return until_at/i);
  assert.doesNotMatch(setup, /grant select on (table )?public\.portia_promo_/i);
});

test("request admission binds, throttles and creates inside one transaction", () => {
  const submitStart = setup.indexOf("create or replace function public.portia_promo_submit_request");
  const submit = setup.slice(submitStart, setup.indexOf("$$;", submitStart) + 3);
  assert.match(submit, /p_bucket_key text[\s\S]*p_ip_bucket text/i);
  assert.match(submit, /pg_advisory_xact_lock[\s\S]*promo:bucket:[\s\S]*promo:nickname:[\s\S]*promo:token:/i);
  assert.match(submit, /portia_promo_attempt_buckets[\s\S]*for update/i);
  assert.match(submit, /insert into public\.portia_promo_device_bindings/i);
  assert.match(submit, /insert into public\.portia_promo_(?:requests|qualification_requests)/i);
  assert.match(submit, /jsonb_build_object\('code', '(?:created|throttled|device-denied|active-request)'/i);
});

test("qualification answers compare-and-set the expected question index", () => {
  assert.match(setup, /portia_promo_attempts[\s\S]*current_question_index integer not null default 0/i);
  const answerStart = setup.indexOf("create or replace function public.portia_promo_answer_question");
  const answer = setup.slice(answerStart, setup.indexOf("$$;", answerStart) + 3);
  assert.match(answer, /p_expected_question_index integer/i);
  assert.match(answer, /current_question_index[\s\S]*for update/i);
  assert.match(answer, /q\.sort_order = p_expected_question_index/i);
  assert.match(answer, /set current_question_index = current_question_index \+ 1/i);
  assert.match(answer, /'conflict'/i);
});

test("qualification attempts use immutable mode and a server-side heartbeat lease", () => {
  assert.match(setup, /portia_promo_attempts[\s\S]*last_seen_at timestamptz[\s\S]*lease_expires_at timestamptz/i);
  const confirmStart = setup.indexOf("create or replace function public.portia_promo_confirm_test");
  const confirm = setup.slice(confirmStart, setup.indexOf("$$;", confirmStart) + 3);
  assert.match(confirm, /insert into public\.portia_promo_attempts[\s\S]*client_mode[\s\S]*p_client_mode/i);
  const currentStart = setup.indexOf("create or replace function public.portia_promo_current_test");
  const current = setup.slice(currentStart, setup.indexOf("$$;", currentStart) + 3);
  assert.doesNotMatch(current, /set client_mode\s*=/i);
  const heartbeatStart = setup.indexOf("create or replace function public.portia_promo_heartbeat_test");
  const heartbeat = setup.slice(heartbeatStart, setup.indexOf("$$;", heartbeatStart) + 3);
  assert.match(heartbeat, /token_hash = p_token_hash[\s\S]*reset_at is null/i);
  assert.match(heartbeat, /lease_expires_at = now\(\) \+ interval '45 seconds'/i);
  for (const name of ["portia_promo_start_test", "portia_promo_current_test", "portia_promo_answer_question"]) {
    const start = setup.indexOf(`create or replace function public.${name}`);
    const body = setup.slice(start, setup.indexOf("$$;", start) + 3);
    assert.match(body, /portia_promo_expire_stale_attempt\(p_attempt_id\)/i, name);
  }
});

test("all Phase 14 table and function definitions stay normalized across both SQL sources", () => {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
  const functionNames = [...apply.matchAll(/create or replace function public\.(portia_promo_[a-z_]+)/gi)].map((match) => match[1]);
  const tableNames = [...apply.matchAll(/create table if not exists public\.(portia_promo_[a-z_]+)/gi)].map((match) => match[1]);
  for (const name of functionNames) {
    const extract = (source: string) => {
      const start = source.toLowerCase().indexOf(`create or replace function public.${name}`);
      assert.ok(start >= 0, `${name} mirrored`);
      return source.slice(start, source.indexOf("$$;", start) + 3);
    };
    assert.equal(normalize(extract(setup)), normalize(extract(apply)), name);
  }
  for (const name of tableNames) {
    const extract = (source: string) => {
      const start = source.toLowerCase().indexOf(`create table if not exists public.${name}`);
      assert.ok(start >= 0, `${name} mirrored`);
      return source.slice(start, source.indexOf("\n);", start) + 3);
    };
    assert.equal(normalize(extract(setup)), normalize(extract(apply)), name);
  }
});

test("reviewer bank RPCs expose versioned private configuration and immutable confirmation stays separate", () => {
  const start = setup.indexOf("create or replace function public.portia_promo_bank_state");
  const body = setup.slice(start, setup.indexOf("$$;", start) + 3);
  for (const field of ["requiredCount", "quotas", "answerKey", "version"]) assert.ok(body.includes(`'${field}'`), field);
  assert.match(setup, /portia_promo_bank_command[\s\S]*save-task-bank[\s\S]*save-task-item[\s\S]*save-qualification-bank[\s\S]*save-question/i);
  assert.match(setup, /portia_promo_confirm_assignment[\s\S]*portia_promo_assignment_items/i);
  assert.match(setup, /portia_promo_confirm_test[\s\S]*portia_promo_attempt_questions/i);
  assert.match(setup, /portia_promo_confirm_assignment\(p_request_id uuid, p_bank_id uuid, p_bank_version text, p_items jsonb\)/i);
  assert.match(setup, /portia_promo_confirm_assignment[\s\S]*source\.bank_id = p_bank_id[\s\S]*bank\.target_title_id = request_target/i);
  assert.match(setup, /portia_promo_confirm_test[\s\S]*source\.bank_id = p_bank_id[\s\S]*bank\.transition_id = request_transition/i);
  assert.doesNotMatch(setup.slice(setup.indexOf("create or replace function public.portia_promo_confirm_assignment"), setup.indexOf("$$;", setup.indexOf("create or replace function public.portia_promo_confirm_assignment"))), /snapshot_text text/);
});

test("promotion SQL owner apply file mirrors contracts and is explicitly manual", () => {
  assert.match(apply, /PHASE 14/i);
  assert.match(apply, /OWNER-RUN ONLY/i);
  assert.match(apply, /begin;/i);
  assert.match(apply, /portia_is_owner\(\)/i);
  for (const table of tables) assert.match(apply, new RegExp(`public\\.${table}\\b`, "i"), table);
  for (const rpc of rpcNames) assert.match(apply, new RegExp(`public\\.${rpc}\\b`, "i"), rpc);
  assert.match(apply, /POST-APPLY ASSERTIONS/i);
  assert.match(apply, /ROLLBACK GUIDANCE/i);
  const setupSubmit = setup.slice(setup.indexOf("create or replace function public.portia_promo_submit_request"), setup.indexOf("$$;", setup.indexOf("create or replace function public.portia_promo_submit_request")) + 3);
  const applySubmit = apply.slice(apply.indexOf("create or replace function public.portia_promo_submit_request"), apply.indexOf("$$;", apply.indexOf("create or replace function public.portia_promo_submit_request")) + 3);
  for (const contract of [/reset_at is null[\s\S]*for update/i, /pg_advisory_xact_lock/i, /jsonb_build_object\('code', 'device-denied'/i]) {
    assert.match(setupSubmit, contract);
    assert.match(applySubmit, contract);
  }
});
