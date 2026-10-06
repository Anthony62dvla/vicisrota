ALTER TYPE "public"."leave_kind" ADD VALUE 'maternity';--> statement-breakpoint
ALTER TYPE "public"."leave_kind" ADD VALUE 'paternity';--> statement-breakpoint
ALTER TYPE "public"."leave_kind" ADD VALUE 'adoption';--> statement-breakpoint
ALTER TYPE "public"."leave_kind" ADD VALUE 'shared_parental';--> statement-breakpoint
ALTER TYPE "public"."leave_kind" ADD VALUE 'neonatal';--> statement-breakpoint
ALTER TYPE "public"."leave_kind" ADD VALUE 'parental';--> statement-breakpoint
ALTER TYPE "public"."leave_kind" ADD VALUE 'parental_bereavement';--> statement-breakpoint
ALTER TYPE "public"."leave_kind" ADD VALUE 'carers';--> statement-breakpoint
ALTER TYPE "public"."leave_kind" ADD VALUE 'dependants';--> statement-breakpoint
CREATE TABLE "keeping_in_touch_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"leave_request_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"worked_on" date NOT NULL,
	"note" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keeping_in_touch_day" ADD CONSTRAINT "keeping_in_touch_day_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keeping_in_touch_day" ADD CONSTRAINT "keeping_in_touch_day_leave_request_id_leave_request_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keeping_in_touch_day" ADD CONSTRAINT "keeping_in_touch_day_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keeping_in_touch_day" ADD CONSTRAINT "keeping_in_touch_day_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "keeping_in_touch_day_once_idx" ON "keeping_in_touch_day" USING btree ("leave_request_id","worked_on");--> statement-breakpoint
ALTER TABLE "keeping_in_touch_day" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "keeping_in_touch_day" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON keeping_in_touch_day
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
