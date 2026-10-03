-- Row-level security for rota notices (same policy as 0001).
ALTER TABLE rota_notice ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE rota_notice FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON rota_notice
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
