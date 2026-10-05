CREATE TABLE "checklist_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	"role_id" uuid,
	"location_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_tick" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"item" smallint NOT NULL,
	"task" text NOT NULL,
	"worker_id" uuid,
	"ticked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handover" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"shift_id" uuid,
	"worker_id" uuid,
	"location_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_role_id_job_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_tick" ADD CONSTRAINT "checklist_tick_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_tick" ADD CONSTRAINT "checklist_tick_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_tick" ADD CONSTRAINT "checklist_tick_template_id_checklist_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_tick" ADD CONSTRAINT "checklist_tick_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_template_org_idx" ON "checklist_template" USING btree ("organisation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_tick_item_idx" ON "checklist_tick" USING btree ("shift_id","template_id","item");--> statement-breakpoint
CREATE INDEX "handover_org_idx" ON "handover" USING btree ("organisation_id","created_at");--> statement-breakpoint
ALTER TABLE checklist_template ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE checklist_template FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON checklist_template
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE checklist_tick ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE checklist_tick FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON checklist_tick
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE handover ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE handover FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON handover
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
