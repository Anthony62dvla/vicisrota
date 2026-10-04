-- Row-level security for lone working check-ins (same policy as 0001).
ALTER TABLE lone_work_check ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE lone_work_check FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON lone_work_check
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint

-- Check-ins are a safety record: they cannot be changed or deleted.
CREATE FUNCTION lone_work_check_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'lone_work_check is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER lone_work_check_no_update_or_delete
  BEFORE UPDATE OR DELETE ON lone_work_check
  FOR EACH ROW EXECUTE FUNCTION lone_work_check_is_append_only();
