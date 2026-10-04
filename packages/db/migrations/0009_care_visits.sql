CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"postcode" text,
	"visit_notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "pays_travel_time" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "travel_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_travel_minutes" CHECK ("shift"."travel_minutes" between 0 and 240);