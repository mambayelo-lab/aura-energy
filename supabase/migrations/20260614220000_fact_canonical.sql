-- Canonical Fact model: add object_type alias column and unit at top level
-- object_name already serves as object_type; we add object_type as a generated alias for clarity
alter table facts add column if not exists object_type text generated always as (object_name) stored;
alter table facts add column if not exists unit text;

-- Populate unit from value_jsonb where present
update facts set unit = value_jsonb->>'unit' where unit is null and value_jsonb ? 'unit';

-- Index for canonical queries: (mission_id, object_type, entity_key)
create index if not exists facts_mission_object_entity on facts (mission_id, object_name, entity_key);
create index if not exists facts_mission_attr on facts (mission_id, attribute_name);

-- Ensure causal_rules has is_active column (may not exist)
alter table causal_rules add column if not exists is_active boolean not null default true;
