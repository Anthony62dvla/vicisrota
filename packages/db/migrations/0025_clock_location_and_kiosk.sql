CREATE TYPE "public"."clock_location_rule" AS ENUM('off', 'record', 'require');--> statement-breakpoint
CREATE TYPE "public"."clock_place" AS ENUM('at_work', 'away', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."clock_source" AS ENUM('phone', 'kiosk');--> statement-breakpoint
CREATE TABLE "kiosk_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_user_id" text,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kiosk_device_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "clock_event" ADD COLUMN "source" "clock_source" DEFAULT 'phone' NOT NULL;--> statement-breakpoint
ALTER TABLE "clock_event" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "clock_event" ADD COLUMN "place" "clock_place";--> statement-breakpoint
ALTER TABLE "clock_event" ADD COLUMN "distance_metres" integer;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "radius_metres" integer DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "clock_location_rule" "clock_location_rule" DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "pin_failures" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "pin_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kiosk_device" ADD CONSTRAINT "kiosk_device_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_device" ADD CONSTRAINT "kiosk_device_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_device" ADD CONSTRAINT "kiosk_device_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_event" ADD CONSTRAINT "clock_event_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;