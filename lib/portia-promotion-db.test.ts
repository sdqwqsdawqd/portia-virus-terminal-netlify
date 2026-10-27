import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const setup = readFileSync(new URL("../supabase/portia_setup.sql", import.meta.url), "utf8");

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
