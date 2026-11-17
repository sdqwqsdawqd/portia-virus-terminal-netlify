-- PORTIA: rewrite the old virus class names to the new ones inside stored content (Phase 20, D-35 / D-36b). Forward-only.
--
-- Why: the owner renamed the nine class values of the axes mind, behavior and appearance (same levels):
--   mind:        Рубедо -> Люцидиум   Альбедо -> Транзитиум   Нигредо -> Обливиум
--   behavior:    Фобус  -> Стабилар   Ареус   -> Импульсар    Селенус -> Инфернар
--   appearance:  Нюктея -> Изоморф    Морфея  -> Полиморф     Дедалея -> Ксеноморф
-- The site already reads the old names as the new ones (20-20, normalizePortiaContent), so nothing breaks before this runs;
-- this migration makes the stored data match.
--
-- What changes: public.portia_content only, payload -> 'viruses' and payload -> 'recycledViruses' (arrays only; a missing key is not created),
-- classification.mind / .behavior / .appearance of each element, and only when the value is exactly one of the nine old names (string).
-- What does not change: every other payload key, every other element key, the other classification axes (danger, spread, transmission, escapeRisk),
-- array order, rows without old names, rows whose payload is not a JSON object, the "Информация" texts, updated_by.
-- Rows that do change get revision + 1 and updated_at = now(), so an editor that still holds the old copy gets a 409 instead of silently
-- overwriting the data (the content API compares revision).
-- Data-only: no schema, grants, policies, functions, triggers or other tables. Idempotent: a second run finds no old names and updates no row.
-- The whole value is computed inside the UPDATE from the current row (not from a snapshot taken before), so a save that lands while this
-- runs cannot be overwritten by a stale copy. Production: applied by the owner only.

with class_map(old_name, new_name) as (
  values
    ('Рубедо', 'Люцидиум'),
    ('Альбедо', 'Транзитиум'),
    ('Нигредо', 'Обливиум'),
    ('Фобус', 'Стабилар'),
    ('Ареус', 'Импульсар'),
    ('Селенус', 'Инфернар'),
    ('Нюктея', 'Изоморф'),
    ('Морфея', 'Полиморф'),
    ('Дедалея', 'Ксеноморф')
)
update public.portia_content as c
set payload = c.payload || coalesce((
      select jsonb_object_agg(k.key, (
        select coalesce(jsonb_agg(
          case
            when jsonb_typeof(a.elem) = 'object' and jsonb_typeof(a.elem -> 'classification') = 'object'
            then jsonb_set(a.elem, '{classification}', (a.elem -> 'classification') || coalesce((
              select jsonb_object_agg(e.key, to_jsonb(m.new_name))
              from jsonb_each(a.elem -> 'classification') as e(key, value)
              join class_map as m on m.old_name = (e.value #>> '{}')
              where e.key in ('mind', 'behavior', 'appearance') and jsonb_typeof(e.value) = 'string'
            ), '{}'::jsonb))
            else a.elem
          end
          order by a.ord
        ), '[]'::jsonb)
        from jsonb_array_elements(c.payload -> k.key) with ordinality as a(elem, ord)
      ))
      from (values ('viruses'), ('recycledViruses')) as k(key)
      where jsonb_typeof(c.payload -> k.key) = 'array'
    ), '{}'::jsonb),
    revision = c.revision + 1,
    updated_at = now()
where jsonb_typeof(c.payload) = 'object'
  and c.payload is distinct from (
  c.payload || coalesce((
      select jsonb_object_agg(k.key, (
        select coalesce(jsonb_agg(
          case
            when jsonb_typeof(a.elem) = 'object' and jsonb_typeof(a.elem -> 'classification') = 'object'
            then jsonb_set(a.elem, '{classification}', (a.elem -> 'classification') || coalesce((
              select jsonb_object_agg(e.key, to_jsonb(m.new_name))
              from jsonb_each(a.elem -> 'classification') as e(key, value)
              join class_map as m on m.old_name = (e.value #>> '{}')
              where e.key in ('mind', 'behavior', 'appearance') and jsonb_typeof(e.value) = 'string'
            ), '{}'::jsonb))
            else a.elem
          end
          order by a.ord
        ), '[]'::jsonb)
        from jsonb_array_elements(c.payload -> k.key) with ordinality as a(elem, ord)
      ))
      from (values ('viruses'), ('recycledViruses')) as k(key)
      where jsonb_typeof(c.payload -> k.key) = 'array'
    ), '{}'::jsonb)
);
