-- PORTIA schema fingerprint, format 'portia-fingerprint-v1'.
--
-- READ-ONLY: one SELECT over pg_catalog (plus the PORTIA bucket row and the PORTIA cron job).
-- No DDL, no DML, no transaction control, no rows of user data, no secrets, no role passwords,
-- no raw cron command text (only its sha256 and an "is the expected command" flag).
-- The owner may paste this file into the production Supabase SQL Editor (decision D5). Defence in depth:
-- wrap it when running, i.e.  begin read only;  <this query>;  rollback;
-- (the wrapper is operator instruction text only and is NOT part of this file).
-- The property "single read-only statement" is enforced statically by lib/phase16-fingerprint.test.ts.
--
-- Run as the SQL Editor / CLI default admin role (postgres). That role can read cron.job; a role without
-- SELECT or with RLS-filtered cron.job reports cron.visible = false, which is NOT the same as "job missing".
--
-- Output: ONE jsonb value. Compare two outputs with scripts/phase16-fingerprint-compare.mjs.
-- Excluded on purpose (they legitimately differ between hosted projects): OIDs, table owners, timestamps,
-- column ordinals, extension versions, ACL grantors. ACLs report only the grantees PUBLIC, anon,
-- authenticated and the Supabase admin-API role; a NULL ACL is expanded with acldefault() so default
-- privileges show up as a diff. Compare outputs only when pg_major and search_path are equal (the comparator
-- refuses otherwise): type and expression text depends on search_path.
--
-- NOT YET EXECUTED against a live Postgres: syntax and semantics are calibrated in plan 16-10 (assumption A11).

with
ext as (
  -- Allowlist only: other installed extensions legitimately differ between projects.
  select a.n as k, jsonb_build_object('present', exists (select 1 from pg_extension e where e.extname = a.n)) as v
  from unnest(array['pg_cron', 'pgcrypto', 'pg_net', 'uuid-ossp', 'plpgsql']) as a(n)
),
relset as (
  -- PORTIA relations of any kind, views/matviews in public that depend on them, and the two storage tables
  -- whose policies PORTIA relies on.
  select c.oid as rid, n.nspname::text as nsp, c.relname::text as name, c.relkind as kind, c.relacl as racl,
    c.relowner as rowner, c.relrowsecurity as rls, c.relforcerowsecurity as frls, c.reloptions as ropts
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where (n.nspname = 'public' and c.relkind in ('r', 'S', 'v', 'm', 'p', 'f') and c.relname like 'portia\_%')
    or (n.nspname = 'storage' and c.relname in ('objects', 'buckets'))
    or (n.nspname = 'public' and c.relkind in ('v', 'm') and exists (
      select 1
      from pg_rewrite rw
      join pg_depend d on d.objid = rw.oid and d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass
      join pg_class t on t.oid = d.refobjid
      where rw.ev_class = c.oid and t.oid <> c.oid and t.relnamespace = 'public'::regnamespace and t.relname like 'portia\_%'
    ))
),
fnset as (
  -- PORTIA functions, plus any other public SECURITY DEFINER function or function whose body mentions portia_.
  select p.oid as fid,
    'public.' || p.proname::text || '(' || pg_get_function_identity_arguments(p.oid) || ')' as k,
    p.prokind as kind, p.prosecdef as secdef, p.provolatile as vol, p.proconfig as cfg, p.prosrc as src,
    p.proacl as facl, p.proowner as fowner, pg_get_function_result(p.oid) as res
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'portia\_%' or p.prosecdef or position('portia_' in p.prosrc) > 0)
),
acl_src as (
  select 'rel' as t, r.nsp || '.' || r.name as k,
    coalesce(r.racl, acldefault(case when r.kind = 'S' then 's' else 'r' end, r.rowner)) as a
  from relset r
  union all
  select 'col', r.nsp || '.' || r.name || '.' || att.attname::text, att.attacl
  from relset r
  join pg_attribute att on att.attrelid = r.rid
  where r.nsp = 'public' and r.kind in ('r', 'p', 'f') and att.attnum > 0 and not att.attisdropped and att.attacl is not null
  union all
  select 'fn', f.k, coalesce(f.facl, acldefault('f', f.fowner))
  from fnset f
  union all
  select 'nsp', n.nspname::text, coalesce(n.nspacl, acldefault('n', n.nspowner))
  from pg_namespace n
  where n.nspname in ('public', 'storage')
  union all
  select 'defacl', pg_get_userbyid(d.defaclrole)::text || ':' || d.defaclobjtype::text, d.defaclacl
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
),
acl_g as (
  select distinct s.t, s.k,
    (case x.grantee when 0 then 'PUBLIC' else pg_get_userbyid(x.grantee)::text end)
      || ':' || x.privilege_type || (case when x.is_grantable then '+grant' else '' end) as g
  from acl_src s
  cross join lateral aclexplode(s.a) x
  where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon', 'authenticated', 'service_role')
),
acl_j as (
  select t, k, jsonb_agg(g order by g collate "C") as acl
  from acl_g
  group by t, k
),
roles as (
  select r.rolname::text as k,
    jsonb_build_object(
      'bypassrls', r.rolbypassrls,
      'super', r.rolsuper,
      'member_of', (
        select coalesce(jsonb_agg(pg_get_userbyid(m.roleid)::text order by pg_get_userbyid(m.roleid)::text collate "C"), '[]'::jsonb)
        from pg_auth_members m
        where m.member = r.oid
      )
    ) as v
  from pg_roles r
  where r.rolname in ('anon', 'authenticated', 'authenticator', 'service_role')
),
nsp as (
  select n.nspname::text as k,
    jsonb_build_object('acl', coalesce((select j.acl from acl_j j where j.t = 'nsp' and j.k = n.nspname::text), '[]'::jsonb)) as v
  from pg_namespace n
  where n.nspname in ('public', 'storage')
),
dacl as (
  select pg_get_userbyid(d.defaclrole)::text || ':' || d.defaclobjtype::text as k,
    jsonb_build_object('acl', coalesce((select j.acl from acl_j j where j.t = 'defacl' and j.k = pg_get_userbyid(d.defaclrole)::text || ':' || d.defaclobjtype::text), '[]'::jsonb)) as v
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
),
rel as (
  select r.nsp || '.' || r.name as k,
    jsonb_build_object(
      'relkind', r.kind::text,
      'rls', r.rls,
      'force_rls', r.frls,
      'options', (select jsonb_agg(o order by o collate "C") from unnest(r.ropts) o),
      'viewdef', case when r.kind in ('v', 'm') then pg_get_viewdef(r.rid) end,
      'acl', coalesce((select j.acl from acl_j j where j.t = 'rel' and j.k = r.nsp || '.' || r.name), '[]'::jsonb)
    ) as v
  from relset r
),
col as (
  select r.nsp || '.' || r.name || '.' || att.attname::text as k,
    jsonb_build_object(
      'type', format_type(att.atttypid, att.atttypmod),
      'notnull', att.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid),
      'identity', att.attidentity::text,
      'generated', att.attgenerated::text,
      'acl', case when att.attacl is null then null else
        coalesce((select j.acl from acl_j j where j.t = 'col' and j.k = r.nsp || '.' || r.name || '.' || att.attname::text), '[]'::jsonb) end
    ) as v
  from relset r
  join pg_attribute att on att.attrelid = r.rid
  left join pg_attrdef d on d.adrelid = att.attrelid and d.adnum = att.attnum
  where r.nsp = 'public' and r.kind in ('r', 'p', 'f') and att.attnum > 0 and not att.attisdropped
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
trg as (
  select r.name || '.' || t.tgname::text as k,
    jsonb_build_object('def', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled::text) as v
  from pg_trigger t
  join relset r on r.rid = t.tgrelid
  where r.nsp = 'public' and not t.tgisinternal
),
fn as (
  select f.k,
    jsonb_build_object(
      'kind', f.kind::text,
      'returns', f.res,
      'secdef', f.secdef,
      'volatility', f.vol::text,
      'config', (select coalesce(jsonb_agg(o order by o collate "C"), '[]'::jsonb) from unnest(f.cfg) o),
      'src_sha256', encode(sha256(convert_to(replace(f.src, chr(13), ''), 'UTF8')), 'hex'),
      'acl', coalesce((select j.acl from acl_j j where j.t = 'fn' and j.k = f.k), '[]'::jsonb)
    ) as v
  from fnset f
),
pol as (
  select r.nsp || '.' || r.name || ':' || p.polname::text as k,
    jsonb_build_object(
      'cmd', p.polcmd::text,
      'permissive', p.polpermissive,
      'roles', (
        select coalesce(jsonb_agg(q.r order by q.r collate "C"), '[]'::jsonb)
        from (select case when u = 0 then 'PUBLIC' else pg_get_userbyid(u)::text end as r from unnest(p.polroles) u) q
      ),
      'using', pg_get_expr(p.polqual, p.polrelid),
      'check', pg_get_expr(p.polwithcheck, p.polrelid)
    ) as v
  from pg_policy p
  join relset r on r.rid = p.polrelid
),
pub as (
  select pt.pubname::text || ':' || pt.tablename::text as k, jsonb_build_object('present', true) as v
  from pg_publication_tables pt
  where pt.schemaname = 'public' and pt.tablename like 'portia\_%'
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
),
cronmeta as (
  -- The CASE keeps has_table_privilege from running when pg_cron is absent.
  select to_regclass('cron.job') is not null as present,
    case when to_regclass('cron.job') is null then false else has_table_privilege('cron.job', 'select') end as can_select,
    case when to_regclass('cron.job') is null then false else coalesce((
      select c.relrowsecurity and not (select u.rolsuper or u.rolbypassrls from pg_roles u where u.rolname = current_user)
      from pg_class c
      where c.oid = to_regclass('cron.job')
    ), false) end as rls_filtered
)
select jsonb_build_object(
  'schema', 'portia-fingerprint-v1',
  'pg_major', current_setting('server_version_num')::int / 10000,
  'search_path', current_setting('search_path'),
  'sections', jsonb_build_object(
    'extensions', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from ext),
    'roles', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from roles),
    'schemas', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from nsp),
    'default_acls', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from dacl),
    'tables', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from rel),
    'columns', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from col),
    'constraints', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from con),
    'indexes', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from idx),
    'triggers', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from trg),
    'functions', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from fn),
    'policies', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from pol),
    'publications', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from pub),
    'bucket', (select coalesce(jsonb_object_agg(k, v order by k collate "C"), '{}'::jsonb) from bkt),
    -- cron.job must not be named outside a string literal: a project without pg_cron would fail to parse.
    -- query_to_xml runs only the given SELECT, so this stays read-only; the literal is evaluated only when
    -- the role may read cron.job. Raw command text is never emitted, only its hash.
    'cron', (
      select case when not m.present then jsonb_build_object('present', false) else jsonb_build_object(
        'present', true,
        'visible', m.can_select and not m.rls_filtered,
        'select_privilege', m.can_select,
        'rls_filtered', m.rls_filtered,
        'jobs', case when m.can_select then (
          select coalesce(jsonb_object_agg(j.jobname, jsonb_build_object(
            'schedule', j.schedule,
            'active', j.active,
            'username', j.username,
            'command_sha256', encode(sha256(convert_to(replace(j.command, chr(13), ''), 'UTF8')), 'hex'),
            'command_is_expected', replace(j.command, chr(13), '') = 'select public.portia_promo_cleanup()'
          ) order by j.jobname collate "C"), '{}'::jsonb)
          from xmltable(
            '/table/row'
            passing query_to_xml('select jobname, schedule, active, username, command from cron.job where jobname = ''portia-promo-cleanup''', false, false, '')
            columns jobname text path 'jobname', schedule text path 'schedule', active text path 'active', username text path 'username', command text path 'command'
          ) j
        ) end
      ) end
      from cronmeta m
    )
  )
) as fingerprint;
