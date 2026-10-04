-- The superadmin trail is evidence of what VicisRota staff did in customers' businesses: never changed or deleted.
CREATE FUNCTION platform_audit_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'platform_audit is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER platform_audit_append_only BEFORE UPDATE OR DELETE ON platform_audit
  FOR EACH ROW EXECUTE FUNCTION platform_audit_is_append_only();
