CREATE TYPE "public"."roll_call_expected" AS ENUM('clocked_in', 'not_clocked_in');--> statement-breakpoint
CREATE TABLE "roll_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"started_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "roll_call_person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"roll_call_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"expected" "roll_call_expected" NOT NULL,
	"place" text,
	"safe_at" timestamp with time zone,
	"marked_by_self" boolean DEFAULT false NOT NULL,
	"marked_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "roll_call" ADD CONSTRAINT "roll_call_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call" ADD CONSTRAINT "roll_call_started_by_user_id_user_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call" ADD CONSTRAINT "roll_call_ended_by_user_id_user_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_person" ADD CONSTRAINT "roll_call_person_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_person" ADD CONSTRAINT "roll_call_person_roll_call_id_roll_call_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."roll_call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_person" ADD CONSTRAINT "roll_call_person_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_person" ADD CONSTRAINT "roll_call_person_marked_by_user_id_user_id_fk" FOREIGN KEY ("marked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roll_call_person_call_idx" ON "roll_call_person" USING btree ("roll_call_id");--> statement-breakpoint
-- Row-level security (same policy as 0001).
ALTER TABLE roll_call ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE roll_call FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON roll_call
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE roll_call_person ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE roll_call_person FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON roll_call_person
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
