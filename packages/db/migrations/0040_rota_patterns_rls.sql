-- Row-level security for rota patterns (same policy as 0001).
ALTER TABLE rota_pattern ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE rota_pattern FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON rota_pattern
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE rota_pattern_shift ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE rota_pattern_shift FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON rota_pattern_shift
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
