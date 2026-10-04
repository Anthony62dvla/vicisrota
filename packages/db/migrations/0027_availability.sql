CREATE TABLE "worker_unavailability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_unavailability_weekday" CHECK ("worker_unavailability"."weekday" between 1 and 7),
	CONSTRAINT "worker_unavailability_times" CHECK ("worker_unavailability"."starts_at" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and "worker_unavailability"."ends_at" ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' and "worker_unavailability"."ends_at" > "worker_unavailability"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "adjustments" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_unavailability" ADD CONSTRAINT "worker_unavailability_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_unavailability" ADD CONSTRAINT "worker_unavailability_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_unavailability_worker_idx" ON "worker_unavailability" USING btree ("worker_id");