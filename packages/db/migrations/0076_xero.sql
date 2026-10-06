CREATE TABLE "xero_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"tenant_name" text NOT NULL,
	"tokens" text NOT NULL,
	"connected_by_user_id" text,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "xero_connection" ADD CONSTRAINT "xero_connection_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_connection" ADD CONSTRAINT "xero_connection_connected_by_user_id_user_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "xero_connection_org_idx" ON "xero_connection" USING btree ("organisation_id");--> statement-breakpoint
ALTER TABLE "xero_connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "xero_connection" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "xero_connection" USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid) WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
