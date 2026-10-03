-- Row-level security for clock events (same policy as 0001).
ALTER TABLE clock_event ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE clock_event FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON clock_event
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint

-- Clock times are evidence of hours worked: corrections go in the timesheet, never here.
CREATE FUNCTION clock_event_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'clock_event is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER clock_event_no_update_or_delete
  BEFORE UPDATE OR DELETE ON clock_event
  FOR EACH ROW EXECUTE FUNCTION clock_event_is_append_only();
