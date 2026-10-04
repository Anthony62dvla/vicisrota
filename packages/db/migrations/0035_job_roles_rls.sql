-- Row-level security for job roles and who can work them (same policy as 0001).
ALTER TABLE job_role ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE job_role FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON job_role
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE worker_role ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE worker_role FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON worker_role
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
