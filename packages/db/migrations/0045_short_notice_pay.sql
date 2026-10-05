CREATE TYPE "public"."short_notice_kind" AS ENUM('cancelled', 'moved', 'shortened');--> statement-breakpoint
CREATE TABLE "short_notice_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"kind" "short_notice_kind" NOT NULL,
	"shift_starts_at" timestamp with time zone NOT NULL,
	"shift_ends_at" timestamp with time zone NOT NULL,
	"lost_minutes" integer NOT NULL,
	"notice_hours" integer NOT NULL,
	"pence" integer NOT NULL,
	"waived_at" timestamp with time zone,
	"waived_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "short_notice_hours" smallint;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "short_notice_pay_percent" smallint DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "short_notice_payment" ADD CONSTRAINT "short_notice_payment_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_notice_payment" ADD CONSTRAINT "short_notice_payment_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_notice_payment" ADD CONSTRAINT "short_notice_payment_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "short_notice_payment_worker_idx" ON "short_notice_payment" USING btree ("worker_id","shift_starts_at");--> statement-breakpoint
-- Row-level security (same policy as 0001).
ALTER TABLE short_notice_payment ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE short_notice_payment FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON short_notice_payment
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
