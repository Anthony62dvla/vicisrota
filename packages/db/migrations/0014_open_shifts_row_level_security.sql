-- Row-level security for shift claims (same policy as 0001).
ALTER TABLE shift_claim ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE shift_claim FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON shift_claim
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
