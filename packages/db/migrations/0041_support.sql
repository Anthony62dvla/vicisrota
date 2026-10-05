CREATE TYPE "public"."support_status" AS ENUM('new', 'triaged', 'replied', 'closed');--> statement-breakpoint
CREATE TABLE "support_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid,
	"reporter_user_id" text,
	"reporter_role" text NOT NULL,
	"page" text,
	"error_ref" text,
	"what" text NOT NULL,
	"status" "support_status" DEFAULT 'new' NOT NULL,
	"triage" jsonb,
	"triaged_at" timestamp with time zone,
	"reply" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_report" ADD CONSTRAINT "support_report_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_report" ADD CONSTRAINT "support_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_report_created_idx" ON "support_report" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_report_reporter_idx" ON "support_report" USING btree ("reporter_user_id");