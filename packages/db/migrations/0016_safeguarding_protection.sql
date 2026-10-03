-- Row-level security for safeguarding records (same policy as 0001).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['safeguarding_concern', 'safeguarding_action']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organisation_id = nullif(current_setting(''app.organisation_id'', true), '''')::uuid)
         WITH CHECK (organisation_id = nullif(current_setting(''app.organisation_id'', true), '''')::uuid)',
      t);
  END LOOP;
END $$;
--> statement-breakpoint

-- What was reported is kept exactly as it was written: only the status can change, and concerns are never deleted.
CREATE FUNCTION protect_safeguarding_concern() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'safeguarding concerns cannot be deleted';
  END IF;
  IF (NEW.organisation_id, NEW.raised_by_name, NEW.category, NEW.about_person, NEW.happened_on, NEW.details, NEW.immediate_danger, NEW.created_at)
     IS DISTINCT FROM (OLD.organisation_id, OLD.raised_by_name, OLD.category, OLD.about_person, OLD.happened_on, OLD.details, OLD.immediate_danger, OLD.created_at) THEN
    RAISE EXCEPTION 'only the status of a safeguarding concern can change';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER safeguarding_concern_protect
  BEFORE UPDATE OR DELETE ON safeguarding_concern
  FOR EACH ROW EXECUTE FUNCTION protect_safeguarding_concern();
--> statement-breakpoint

CREATE FUNCTION safeguarding_action_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'safeguarding_action is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER safeguarding_action_no_update_or_delete
  BEFORE UPDATE OR DELETE ON safeguarding_action
  FOR EACH ROW EXECUTE FUNCTION safeguarding_action_is_append_only();
