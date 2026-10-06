CREATE TABLE "guaranteed_hours_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"offered_on" date NOT NULL,
	"weekly_hours" numeric(4, 1) NOT NULL,
	"status" text DEFAULT 'offered' NOT NULL,
	"answered_on" date,
	"recorded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "contracted_hours" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "guaranteed_hours_offer" ADD CONSTRAINT "guaranteed_hours_offer_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guaranteed_hours_offer" ADD CONSTRAINT "guaranteed_hours_offer_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guaranteed_hours_offer" ADD CONSTRAINT "guaranteed_hours_offer_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guaranteed_hours_offer_worker_idx" ON "guaranteed_hours_offer" USING btree ("worker_id","offered_on");--> statement-breakpoint
ALTER TABLE "guaranteed_hours_offer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guaranteed_hours_offer" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "guaranteed_hours_offer" USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid) WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
