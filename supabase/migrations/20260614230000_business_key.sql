-- Business Key model: each semantic object must declare its business key attribute.
-- The business key is the stable, domain-meaningful identifier (e.g. SKU for Product,
-- InvoiceId for Invoice) — NOT the technical system ID (SAP GUID, Mongo ObjectId).
-- entity_key in facts holds the *value* of the business key for each observed instance.

alter table semantic_objects
  add column if not exists business_key_attribute text;

alter table semantic_attributes
  add column if not exists is_business_key boolean not null default false;

alter table extraction_contracts
  add column if not exists is_business_key boolean not null default false;

-- Backfill: if an attribute named like *_id, *_key, *_sku, *_number exists as the
-- first attribute on an object, mark it as the business key candidate.
-- (Non-destructive heuristic — admins can override via UI.)
update semantic_attributes
set is_business_key = true
where id in (
  select distinct on (object_id) id
  from semantic_attributes
  where lower(attribute_name) similar to '%(\_id|\_key|\_sku|\_number|\_ref|\_code)%'
  order by object_id, position asc
);

-- Sync business_key_attribute on semantic_objects from the above
update semantic_objects so
set business_key_attribute = (
  select attribute_name from semantic_attributes
  where object_id = so.id and is_business_key = true
  order by position asc
  limit 1
)
where exists (
  select 1 from semantic_attributes where object_id = so.id and is_business_key = true
);
