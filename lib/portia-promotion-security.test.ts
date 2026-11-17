import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20261113000000_portia_access_promotion.sql", import.meta.url), "utf8");

test("legacy nickname and Promotion-only token entry points lose API-role EXECUTE", () => {
  const legacy = [
    "portia_promo_bind_device(text, text, text)",
    "portia_promo_resolve_device(text)",
    "portia_promo_register_attempt(text, text, boolean)",
    "portia_promo_submit_request(text, text, text, text, text, text, text, text, text)",
    "portia_promo_public_status(text, text, text)",
    "portia_promo_start_test(uuid, text, text)",
    "portia_promo_current_test(uuid, text, text)",
    "portia_promo_heartbeat_test(uuid, text)",
    "portia_promo_answer_question(uuid, uuid, integer, jsonb, text, text)",
    "portia_promo_fail_attempt(uuid, text, text)",
  ];
  for (const signature of legacy) assert.ok(sql.includes(`revoke all on function public.${signature} from public, anon, authenticated;`), signature);
});

test("all participant wrappers require the approved access proof before old function calls", () => {
  for (const name of ["status", "submit"]) {
    const start = sql.indexOf(`create or replace function public.portia_promo_secure_${name}(`);
    const body = sql.slice(start, sql.indexOf("end; $$;", start));
    assert.match(body, /public\.portia_promo_participant_key\(p_access_hash\)/);
    assert.match(body, /if person_key is null then return/);
  }
  for (const name of ["start_test", "current_test", "heartbeat_test", "answer_question", "fail_attempt"]) {
    const start = sql.indexOf(`create or replace function public.portia_promo_secure_${name}(`);
    const body = sql.slice(start, sql.indexOf("end; $$;", start));
    assert.match(body, /if not public\.portia_promo_secure_attempt\(p_access_hash, p_attempt_id\) then return/);
  }
});

test("submit and test wrappers require a short-lived server signature before mutation", () => {
  const submit = sql.slice(sql.indexOf("create or replace function public.portia_promo_secure_submit"), sql.indexOf("end; $$;", sql.indexOf("create or replace function public.portia_promo_secure_submit")));
  assert.match(submit, /promo-submit-v1\|/);
  assert.match(submit, /p_issued_at < now_epoch - 300 or p_issued_at > now_epoch \+ 60/);
  assert.ok(submit.indexOf("code', 'unauthorized'") < submit.indexOf("public.portia_promo_submit_request("));
  const proof = sql.slice(sql.indexOf("create or replace function public.portia_promo_test_proof_valid"), sql.indexOf("end; $$;", sql.indexOf("create or replace function public.portia_promo_test_proof_valid")));
  assert.match(proof, /promo-test-v1\|/);
  for (const action of ["start", "current", "heartbeat", "answer", "fail"]) {
    const start = sql.indexOf(`create or replace function public.portia_promo_secure_${action === "answer" ? "answer_question" : action === "fail" ? "fail_attempt" : `${action}_test`}(`);
    const body = sql.slice(start, sql.indexOf("end; $$;", start));
    assert.ok(body.includes(`p_token_hash, '${action}', p_issued_at, p_signature`));
  }
});
