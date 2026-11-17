-- Quick 261117-px5: rules text per qualification transition and a candidate-started check. Additive, forward-only.
-- APPLIED NOWHERE by the agent. The owner applies it by hand on an isolated test branch first, then production
-- (ОЖИДАЕТ ВЛАДЕЛЬЦА). The site works without it: the candidate sees only the fixed lines and a rules save is refused.
--
-- 1. rules_text column on the qualification bank (nullable, 1..4000 characters when present).
-- 2. portia_promo_current_test: a PREPARED attempt is now readable by its device-bound participant in either client mode
--    (the phone candidate has not chosen a mode before pressing the start button) and the projection carries
--    questionCount and rulesText. The question key stays null unless the attempt is active, so no question text leaks.
-- 3. portia_promo_bank_state: every qualification bank carries rulesText for the editor.
-- 4. portia_promo_save_qualification_rules: editor-only write of the rules text. It does NOT touch updated_at: the rules are
--    not part of the frozen question set, so the bank version and an open preview stay valid.

alter table public.portia_promo_qualification_banks add column if not exists rules_text text;
alter table public.portia_promo_qualification_banks drop constraint if exists portia_promo_qualification_banks_rules_text_check;
alter table public.portia_promo_qualification_banks add constraint portia_promo_qualification_banks_rules_text_check
  check (rules_text is null or length(rules_text) between 1 and 4000);

create or replace function public.portia_promo_current_test(p_attempt_id uuid, p_token_hash text, p_client_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb; answer_count integer; question_count integer;
begin
  if p_client_mode not in ('desktop', 'phone') then return null; end if;
  perform public.portia_promo_expire_stale_attempt(p_attempt_id);
  if not exists (
    select 1 from public.portia_promo_attempts a
    join public.portia_promo_qualification_requests r on r.id = a.request_id
    join public.portia_promo_device_bindings b on b.nickname_key = r.nickname_key
    where a.id = p_attempt_id and (a.client_mode = p_client_mode or a.status = 'prepared')
      and b.token_hash = p_token_hash and b.reset_at is null
  ) then return null; end if;
  select current_question_index into answer_count from public.portia_promo_attempts where id = p_attempt_id;
  select count(*) into question_count from public.portia_promo_attempt_questions where attempt_id = p_attempt_id;
  if answer_count = question_count and question_count > 0 then
    update public.portia_promo_attempts set status = 'grading', updated_at = now() where id = p_attempt_id and status = 'active';
    update public.portia_promo_qualification_requests r set status = 'grading', updated_at = now()
      from public.portia_promo_attempts a where a.id = p_attempt_id and a.request_id = r.id and a.status = 'grading';
  end if;
  select jsonb_build_object(
    'attemptId', a.id, 'nickname', r.nickname, 'titleId', r.title_id,
    'status', case when a.status in ('failed','passed') then a.status when a.status = 'grading' then 'submitted' else a.status end,
    'clientMode', case when a.status = 'prepared' then p_client_mode else a.client_mode end, 'deadlineAt', a.deadline_at,
    'terminalReason', case when a.technical_failure is null then null when a.technical_failure = 'timeout' then 'timeout' else 'technical' end,
    'result', case when a.status in ('passed','failed') and a.technical_failure is null then a.status else null end,
    'percent', a.final_percent,
    'questionCount', question_count,
    'rulesText', (select b.rules_text from public.portia_promo_qualification_banks b where b.transition_id = r.transition_id),
    'question', case when a.status = 'active' then (
      select jsonb_build_object('id', q.id, 'type', q.question_type, 'text', q.snapshot_text,
        'options', q.snapshot_options, 'index', q.sort_order, 'total', question_count)
      from public.portia_promo_attempt_questions q where q.attempt_id = a.id and q.sort_order = answer_count limit 1
    ) else null end
  ) into result
  from public.portia_promo_attempts a join public.portia_promo_qualification_requests r on r.id = a.request_id
  where a.id = p_attempt_id;
  return result;
end; $$;

create or replace function public.portia_promo_bank_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare task_rows jsonb; qualification_rows jsonb;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'targetTitleId', b.target_title_id, 'requiredCount', b.required_count,
    'version', md5(b.updated_at::text || coalesce((select max(i.updated_at)::text from public.portia_promo_task_items i where i.bank_id = b.id), '')),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'text', i.task_text, 'active', i.active, 'sortOrder', i.sort_order, 'updatedAt', i.updated_at
    ) order by i.sort_order, i.id) from public.portia_promo_task_items i where i.bank_id = b.id), '[]'::jsonb)
  ) order by b.target_title_id), '[]'::jsonb) into task_rows from public.portia_promo_task_banks b;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'transitionId', b.transition_id,
    'quotas', jsonb_build_object('single', b.single_count, 'multiple', b.multiple_count, 'freeText', b.free_text_count),
    'rulesText', coalesce(b.rules_text, ''),
    'version', md5(b.updated_at::text || coalesce((select max(q.updated_at)::text from public.portia_promo_qualification_questions q where q.bank_id = b.id), '')),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'text', q.question_text, 'type', q.question_type, 'active', q.active,
      'sortOrder', q.sort_order, 'updatedAt', q.updated_at, 'answerKey', q.answer_key,
      'options', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'text', o.option_text, 'sortOrder', o.sort_order
      ) order by o.sort_order) from public.portia_promo_qualification_options o where o.question_id = q.id), '[]'::jsonb)
    ) order by q.sort_order, q.id) from public.portia_promo_qualification_questions q where q.bank_id = b.id), '[]'::jsonb)
  ) order by b.transition_id), '[]'::jsonb) into qualification_rows from public.portia_promo_qualification_banks b;
  return jsonb_build_object('taskBanks', task_rows, 'qualificationBanks', qualification_rows, 'serverNow', now());
end; $$;

create or replace function public.portia_promo_save_qualification_rules(p_transition_id text, p_rules_text text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  rules_value text;
  bank_id_value uuid;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if p_transition_id is null or p_transition_id not in ('laboratory-assistant', 'assistant', 'virologist-specialist') then
    raise exception 'invalid-transition';
  end if;
  rules_value := nullif(pg_catalog.btrim(coalesce(p_rules_text, '')), '');
  if rules_value is not null and pg_catalog.length(rules_value) > 4000 then raise exception 'rules-too-long'; end if;
  -- updated_at is deliberately left alone: the rules are not part of the frozen question set, so the bank version stays valid.
  update public.portia_promo_qualification_banks set rules_text = rules_value
    where transition_id = p_transition_id
    returning id into bank_id_value;
  return bank_id_value;
end; $$;

revoke all on function public.portia_promo_save_qualification_rules(text, text) from public, anon, authenticated;
grant execute on function public.portia_promo_save_qualification_rules(text, text) to authenticated;
