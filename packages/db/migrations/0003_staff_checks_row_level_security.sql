-- Row-level security for the staff checks and training tables (same policy as 0001).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['worker_check', 'qualification', 'worker_qualification', 'shift_requirement']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organisation_id = nullif(current_setting(''app.organisation_id'', true), '''')::uuid)
         WITH CHECK (organisation_id = nullif(current_setting(''app.organisation_id'', true), '''')::uuid)',
      t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Existing care providers need enhanced DBS checks.
UPDATE organisation SET requires_enhanced_dbs = true WHERE sector = 'care';
