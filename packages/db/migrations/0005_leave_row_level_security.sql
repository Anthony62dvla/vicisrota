-- Row-level security for leave requests (same policy as 0001).
ALTER TABLE leave_request ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE leave_request FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON leave_request
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
