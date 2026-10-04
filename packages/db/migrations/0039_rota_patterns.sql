CREATE TABLE "rota_pattern" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"weeks" smallint NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rota_pattern_weeks" CHECK ("rota_pattern"."weeks" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "rota_pattern_shift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"pattern_id" uuid NOT NULL,
	"week_index" smallint NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"ends_next_day" boolean DEFAULT false NOT NULL,
	"worker_id" uuid,
	"role_id" uuid,
	"client_id" uuid,
	"location_id" uuid,
	"note" text,
	"travel_minutes" integer DEFAULT 0 NOT NULL,
	"lone_working" boolean DEFAULT false NOT NULL,
	"check_in_minutes" smallint DEFAULT 60 NOT NULL,
	"breaks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "rota_pattern_shift_week" CHECK ("rota_pattern_shift"."week_index" between 0 and 3 and "rota_pattern_shift"."weekday" between 0 and 6)
);
--> statement-breakpoint
ALTER TABLE "rota_pattern" ADD CONSTRAINT "rota_pattern_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_pattern" ADD CONSTRAINT "rota_pattern_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_pattern_shift" ADD CONSTRAINT "rota_pattern_shift_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_pattern_shift" ADD CONSTRAINT "rota_pattern_shift_pattern_id_rota_pattern_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."rota_pattern"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_pattern_shift" ADD CONSTRAINT "rota_pattern_shift_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_pattern_shift" ADD CONSTRAINT "rota_pattern_shift_role_id_job_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_pattern_shift" ADD CONSTRAINT "rota_pattern_shift_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_pattern_shift" ADD CONSTRAINT "rota_pattern_shift_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rota_pattern_org_name_idx" ON "rota_pattern" USING btree ("organisation_id",lower("name"));--> statement-breakpoint
CREATE INDEX "rota_pattern_shift_pattern_idx" ON "rota_pattern_shift" USING btree ("pattern_id");