CREATE TYPE "public"."supervision_kind" AS ENUM('supervision', 'appraisal');--> statement-breakpoint
CREATE TABLE "supervision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"kind" "supervision_kind" NOT NULL,
	"held_on" date NOT NULL,
	"next_due_on" date,
	"recorded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supervision" ADD CONSTRAINT "supervision_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervision" ADD CONSTRAINT "supervision_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervision" ADD CONSTRAINT "supervision_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supervision_worker_idx" ON "supervision" USING btree ("worker_id","held_on");--> statement-breakpoint
-- Row-level security (same policy as 0001).
ALTER TABLE supervision ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE supervision FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON supervision
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
