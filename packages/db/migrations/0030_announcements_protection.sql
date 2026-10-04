-- Row-level security for announcements and read confirmations (same policy as 0001).
ALTER TABLE announcement ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE announcement FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON announcement
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE announcement_read ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE announcement_read FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON announcement_read
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint

-- A confirmation must refer to the words the person read, so posted wording never changes.
-- Only archiving is allowed, and announcements are kept rather than deleted.
CREATE FUNCTION announcement_wording_is_fixed() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'announcements are kept; archive instead';
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.needs_confirmation IS DISTINCT FROM OLD.needs_confirmation OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
    RAISE EXCEPTION 'announcement wording cannot be changed; post a new one';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER announcement_fixed
  BEFORE UPDATE OR DELETE ON announcement
  FOR EACH ROW EXECUTE FUNCTION announcement_wording_is_fixed();
--> statement-breakpoint

CREATE FUNCTION announcement_read_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'announcement_read is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER announcement_read_no_update_or_delete
  BEFORE UPDATE OR DELETE ON announcement_read
  FOR EACH ROW EXECUTE FUNCTION announcement_read_is_append_only();
