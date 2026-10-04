-- Row-level security for tips (same policy as 0001), and tip records that cannot be rewritten.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tip', 'tip_allocation', 'tip_share']
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

-- Shares are a legal record: once written they cannot be changed or deleted.
CREATE FUNCTION tip_share_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'tip_share is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER tip_share_no_update_or_delete
  BEFORE UPDATE OR DELETE ON tip_share
  FOR EACH ROW EXECUTE FUNCTION tip_share_is_append_only();
--> statement-breakpoint

-- An allocation cannot be deleted, and only the date it was paid can be recorded afterwards.
CREATE FUNCTION protect_tip_allocation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'tip_allocation records cannot be deleted';
  END IF;
  IF (NEW.period_from, NEW.period_to, NEW.total_pence, NEW.method, NEW.pay_by, NEW.organisation_id)
     IS DISTINCT FROM (OLD.period_from, OLD.period_to, OLD.total_pence, OLD.method, OLD.pay_by, OLD.organisation_id) THEN
    RAISE EXCEPTION 'only paid_at can change on a tip_allocation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER tip_allocation_protect
  BEFORE UPDATE OR DELETE ON tip_allocation
  FOR EACH ROW EXECUTE FUNCTION protect_tip_allocation();
--> statement-breakpoint

-- A shared-out tip cannot be changed or deleted either.
CREATE FUNCTION protect_allocated_tip() RETURNS trigger AS $$
BEGIN
  IF OLD.allocation_id IS NOT NULL THEN
    RAISE EXCEPTION 'tip % has been shared out and cannot be changed', OLD.id;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER tip_protect_allocated
  BEFORE UPDATE OR DELETE ON tip
  FOR EACH ROW EXECUTE FUNCTION protect_allocated_tip();
