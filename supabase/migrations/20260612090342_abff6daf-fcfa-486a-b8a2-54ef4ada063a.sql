
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rh';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'comex';
DO $$ BEGIN
  CREATE TYPE public.confidentiality_level AS ENUM ('public','restricted','comex','rh_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
