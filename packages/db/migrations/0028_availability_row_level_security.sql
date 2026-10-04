-- Row-level security for staff availability (same policy as 0001).
ALTER TABLE "worker_unavailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "worker_unavailability" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "worker_unavailability"
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
