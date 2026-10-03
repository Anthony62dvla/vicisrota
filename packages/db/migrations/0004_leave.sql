CREATE TYPE "public"."leave_kind" AS ENUM('annual', 'sick', 'family', 'unpaid', 'compassionate', 'other');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('requested', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TABLE "leave_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"kind" "leave_kind" NOT NULL,
	"status" "leave_status" DEFAULT 'requested' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"days" numeric(4, 1),
	"hours" numeric(5, 2),
	"note" text,
	"requested_by_user_id" text,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_request_dates" CHECK ("leave_request"."ends_on" >= "leave_request"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "leave_year_start_month" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "days_per_week" numeric(3, 1) DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "irregular_hours" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leave_request_worker_idx" ON "leave_request" USING btree ("worker_id","starts_on");