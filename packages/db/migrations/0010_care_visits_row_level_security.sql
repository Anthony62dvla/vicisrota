-- Row-level security for clients (same policy as 0001).
ALTER TABLE client ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE client FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON client
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
