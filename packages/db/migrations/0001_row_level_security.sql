-- Row-level security: each business only ever sees its own rows.
-- The app sets app.organisation_id per transaction (see withOrganisation in src/client.ts).
-- FORCE applies the policy to the table owner too; only superusers bypass it.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['location', 'worker', 'pay_rate', 'shift', 'shift_break',
                           'compliance_decision', 'compliance_override', 'audit_event']
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

-- The audit trail is append-only: history cannot be edited or removed.
CREATE FUNCTION audit_event_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER audit_event_no_update_or_delete
  BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION audit_event_is_append_only();
