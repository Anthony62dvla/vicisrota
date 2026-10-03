CREATE TYPE "public"."clock_kind" AS ENUM('in', 'break_start', 'break_end', 'out');--> statement-breakpoint
CREATE TABLE "clock_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"kind" "clock_kind" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clock_event" ADD CONSTRAINT "clock_event_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_event" ADD CONSTRAINT "clock_event_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_event" ADD CONSTRAINT "clock_event_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clock_event_shift_idx" ON "clock_event" USING btree ("shift_id","at");