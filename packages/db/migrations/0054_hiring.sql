CREATE TYPE "public"."applicant_status" AS ENUM('new', 'shortlisted', 'interview', 'offered', 'hired', 'not_progressed');--> statement-breakpoint
CREATE TABLE "applicant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"job_post_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"contact_by" text,
	"about" text NOT NULL,
	"adjustments" text,
	"status" "applicant_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"hired_worker_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"role_id" uuid,
	"place" text,
	"hours" text,
	"pay" text,
	"description" text NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_job_post_id_job_post_id_fk" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_hired_worker_id_worker_id_fk" FOREIGN KEY ("hired_worker_id") REFERENCES "public"."worker"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_post" ADD CONSTRAINT "job_post_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_post" ADD CONSTRAINT "job_post_role_id_job_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_post" ADD CONSTRAINT "job_post_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applicant_post_idx" ON "applicant" USING btree ("job_post_id","created_at");--> statement-breakpoint
CREATE INDEX "job_post_org_idx" ON "job_post" USING btree ("organisation_id","created_at");--> statement-breakpoint
ALTER TABLE job_post ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE job_post FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON job_post
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE applicant ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE applicant FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON applicant
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
