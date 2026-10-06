CREATE TABLE "sponsor_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"event_date" date NOT NULL,
	"reported_on" date NOT NULL,
	"reference" text,
	"reported_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "sponsorship" jsonb;--> statement-breakpoint
ALTER TABLE "sponsor_report" ADD CONSTRAINT "sponsor_report_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_report" ADD CONSTRAINT "sponsor_report_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_report" ADD CONSTRAINT "sponsor_report_reported_by_user_id_user_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_report_duty_idx" ON "sponsor_report" USING btree ("worker_id","kind","event_date");--> statement-breakpoint
ALTER TABLE "sponsor_report" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sponsor_report" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON sponsor_report
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
