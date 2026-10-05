CREATE TABLE "wellbeing_check_in" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"shift_id" uuid,
	"answer" smallint,
	"note" text,
	"shared" boolean DEFAULT false NOT NULL,
	"wants_chat" boolean DEFAULT false NOT NULL,
	"chat_handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wellbeing_check_in" ADD CONSTRAINT "wellbeing_check_in_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellbeing_check_in" ADD CONSTRAINT "wellbeing_check_in_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellbeing_check_in" ADD CONSTRAINT "wellbeing_check_in_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wellbeing_check_in_shift_idx" ON "wellbeing_check_in" USING btree ("worker_id","shift_id");--> statement-breakpoint
CREATE INDEX "wellbeing_check_in_org_idx" ON "wellbeing_check_in" USING btree ("organisation_id","created_at");--> statement-breakpoint
ALTER TABLE wellbeing_check_in ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE wellbeing_check_in FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON wellbeing_check_in
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
