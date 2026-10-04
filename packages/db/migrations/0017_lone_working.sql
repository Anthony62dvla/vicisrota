CREATE TYPE "public"."lone_check_kind" AS ENUM('start', 'ok', 'finished', 'help', 'resolved');--> statement-breakpoint
CREATE TABLE "lone_work_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"kind" "lone_check_kind" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "lone_working" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "check_in_minutes" smallint DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "lone_work_check" ADD CONSTRAINT "lone_work_check_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lone_work_check" ADD CONSTRAINT "lone_work_check_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lone_work_check" ADD CONSTRAINT "lone_work_check_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lone_work_check_shift_idx" ON "lone_work_check" USING btree ("shift_id","created_at");--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_check_in_minutes" CHECK ("shift"."check_in_minutes" between 15 and 240);