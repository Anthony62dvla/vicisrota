-- Row-level security for alert contacts and the text message log (same policy as 0001).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alert_contact', 'sms_message']
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
