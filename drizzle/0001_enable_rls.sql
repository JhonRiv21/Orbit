-- Defence in depth for the shared Supabase project. The app connects with its
-- own role, which RLS does not apply to; anon and authenticated must never
-- reach this schema. RLS without policies makes "deny" the default if a grant
-- or a PostgREST exposure of the schema ever slips in. Never touches
-- pgrst.db_schemas.

ALTER TABLE orbit.satellites  ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE orbit.ingest_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA orbit FROM anon;
    REVOKE ALL ON SCHEMA orbit FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA orbit FROM authenticated;
    REVOKE ALL ON SCHEMA orbit FROM authenticated;
  END IF;
END $$;
