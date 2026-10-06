CREATE TYPE "public"."shift_kind" AS ENUM('standard', 'sleep_in', 'waking_night');--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "sleep_in_pence" integer;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "kind" "shift_kind" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entry" ADD COLUMN "awake_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_awake" CHECK ("time_entry"."awake_minutes" >= 0 and "time_entry"."awake_minutes" * interval '1 minute' <= "time_entry"."ends_at" - "time_entry"."starts_at");