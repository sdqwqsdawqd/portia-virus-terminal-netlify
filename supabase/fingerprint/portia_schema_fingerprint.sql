-- PORTIA schema fingerprint, format 'portia-fingerprint-v1'.
--
-- READ-ONLY: one SELECT over pg_catalog (plus the PORTIA bucket row and the PORTIA cron job).
-- No DDL, no DML, no transaction control, no rows of user data, no secrets, no role passwords.
-- The owner may paste this file as-is into the production Supabase SQL Editor (decision D5);
-- the property is enforced statically by lib/phase16-fingerprint.test.ts.
--
-- Output: ONE jsonb value. Compare two outputs with scripts/phase16-fingerprint-compare.mjs.
-- Excluded on purpose (they legitimately differ between hosted projects): OIDs, owners, timestamps,
-- column ordinals, extension versions. Only the grantees PUBLIC, anon, authenticated, service_role are
-- reported in ACLs; a NULL ACL is expanded with acldefault() so default privileges show up as a diff.
-- Only compare outputs with the same pg_major. Type and expression text depends on search_path; run it
-- with the default search_path (SQL Editor and CLI both do).
--
-- NOT YET EXECUTED against a live Postgres: syntax/semantics are calibrated in plan 16-10 (assumption A11).

with
ext as (
  select e.extname::text as k, to_jsonb(true) as v
  from pg_extension e
),
rel as (
  select c.relname::text as k,
    jsonb_build_object(
      'relkind', c.relkind::text,
      'rls', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity,
      'acl', (
        select coalesce(jsonb_agg(g order by g collate "C"), '[]'::jsonb)
        from (
          select distinct (case a.grantee when 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end)
            || ':' || a.privilege_type || (case when a.is_grantable then '+grant' else '' end) as g
          from aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's' else 'r' end, c.relowner))) a
          where a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated', 'service_role')
        ) s
      )
    ) as v
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'S') and c.relname like 'portia\_%'
),
col as (
  select c.relname::text || '.' || a.attname::text as k,
    jsonb_build_object(
      'type', format_type(a.atttypid, a.atttypmod),
      'notnull', a.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid),
      'identity', a.attidentity::text,
      'generated', a.attgenerated::text,
      'acl', case when a.attacl is null then null else (
        select coalesce(jsonb_agg(g order by g collate "C"), '[]'::jsonb)
        from (
          select distinct (case x.grantee when 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end)
            || ':' || x.privilege_type || (case when x.is_grantable then '+grant' else '' end) as g
          from aclexplode(a.attacl) x
          where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon', 'authenticated', 'service_role')
        ) s
      ) end
    ) as v
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'portia\_%'
    and a.attnum > 0 and not a.attisdropped
),
con as (
  select c.relname::text || '.' || k.conname::text as k,
    jsonb_build_object(
      'type', k.contype::text,
      'def', pg_get_constraintdef(k.oid),
      'validated', k.convalidated
    ) as v
  from pg_constraint k
  join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  -- 'n' (NOT NULL) rows exist only on newer majors; attnotnull in columns already covers them.
  where n.nspname = 'public' and c.relname like 'portia\_%' and k.contype <> 'n'
),
idx as (
  select c.relname::text || '.' || ic.relname::text as k,
    jsonb_build_object(
      'def', pg_get_indexdef(i.indexrelid),
      'unique', i.indisunique,
      'valid', i.indisvalid
    ) as v
  from pg_index i
  join pg_class c on c.oid = i.indrelid
  join pg_class ic on ic.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname like 'portia\_%'
),
fn as (
  select 'public.' || p.proname::text || '(' || pg_get_function_identity_arguments(p.oid) || ')' as k,
    jsonb_build_object(
      'kind', p.prokind::text,
      'returns', pg_get_function_result(p.oid),
      'secdef', p.prosecdef,
      'volatility', p.provolatile::text,
      'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
      'src_sha256', encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'),
      'acl', (
        select coalesce(jsonb_agg(g order by g collate "C"), '[]'::jsonb)
        from (
          select distinct (case a.grantee when 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end)
            || ':' || a.privilege_type || (case when a.is_grantable then '+grant' else '' end) as g
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          where a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated', 'service_role')
        ) s
      )
    ) as v
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'portia\_%'
),
pol as (
  select ns.nspname::text || '.' || c.relname::text || ':' || p.polname::text as k,
    jsonb_build_object(
      'cmd', p.polcmd::text,
      'permissive', p.polpermissive,
      'roles', (
        select coalesce(jsonb_agg(r order by r collate "C"), '[]'::jsonb)
        from (select case when u = 0 then 'PUBLIC' else pg_get_userbyid(u) end as r from unnest(p.polroles) u) s
      ),
      'using', pg_get_expr(p.polqual, p.polrelid),
      'check', pg_get_expr(p.polwithcheck, p.polrelid)
    ) as v
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace ns on ns.oid = c.relnamespace
  where (ns.nspname = 'public' and c.relname like 'portia\_%')
    or (ns.nspname = 'storage' and c.relname = 'objects' and p.polname like '%PORTIA%')
),
bkt as (
  select b.id::text as k,
    jsonb_build_object(
      'name', b.name,
      'public', b.public,
      'file_size_limit', b.file_size_limit,
      'allowed_mime_types', (select jsonb_agg(m order by m collate "C") from unnest(b.allowed_mime_types) m)
    ) as v
  from storage.buckets b
  where b.id = 'portia-media'
)
select jsonb_build_object(
  'schema', 'portia-fingerprint-v1',
  'pg_major', current_setting('server_version_num')::int / 10000,
  'sections', jsonb_build_object(
    'extensions', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from ext),
    'tables', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from rel),
    'columns', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from col),
    'constraints', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from con),
    'indexes', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from idx),
    'functions', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from fn),
    'policies', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from pol),
    'bucket', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from bkt),
    -- cron.job must not be named outside a string literal: a project without pg_cron would fail to parse.
    -- query_to_xml runs only the given SELECT, so this stays read-only; the literal is evaluated only in the else branch.
    'cron', case when to_regclass('cron.job') is null then null else (
      select coalesce(jsonb_object_agg(j.jobname, jsonb_build_object('schedule', j.schedule, 'command', j.command, 'active', j.active) order by j.jobname collate "C"), '{}'::jsonb)
      from xmltable(
        '/table/row'
        passing query_to_xml('select jobname, schedule, command, active from cron.job where jobname = ''portia-promo-cleanup''', false, false, '')
        columns jobname text path 'jobname', schedule text path 'schedule', command text path 'command', active text path 'active'
      ) j
    ) end
  )
) as fingerprint;
