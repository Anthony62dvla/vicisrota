CREATE TABLE "night_health_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"offered_on" date NOT NULL,
	"outcome" text DEFAULT 'offered' NOT NULL,
	"recorded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "child_work_permit" jsonb;--> statement-breakpoint
ALTER TABLE "night_health_assessment" ADD CONSTRAINT "night_health_assessment_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_health_assessment" ADD CONSTRAINT "night_health_assessment_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_health_assessment" ADD CONSTRAINT "night_health_assessment_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "night_health_worker_idx" ON "night_health_assessment" USING btree ("worker_id","offered_on");--> statement-breakpoint
ALTER TABLE "night_health_assessment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "night_health_assessment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "night_health_assessment" USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid) WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
