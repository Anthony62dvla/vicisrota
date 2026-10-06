CREATE TABLE "staffing_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"location_id" uuid,
	"role_id" uuid,
	"weekdays" smallint[] NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"min_people" smallint NOT NULL,
	"strict" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staffing_level_min_people" CHECK ("staffing_level"."min_people" between 1 and 99)
);
--> statement-breakpoint
ALTER TABLE "staffing_level" ADD CONSTRAINT "staffing_level_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffing_level" ADD CONSTRAINT "staffing_level_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffing_level" ADD CONSTRAINT "staffing_level_role_id_job_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staffing_level_org_idx" ON "staffing_level" USING btree ("organisation_id");--> statement-breakpoint
ALTER TABLE staffing_level ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE staffing_level FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON staffing_level
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
