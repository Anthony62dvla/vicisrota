CREATE TYPE "public"."concern_action_kind" AS ENUM('note', 'referral', 'status');--> statement-breakpoint
CREATE TYPE "public"."concern_category" AS ENUM('abuse_or_neglect', 'self_harm', 'colleague_conduct', 'health_and_safety', 'other');--> statement-breakpoint
CREATE TYPE "public"."concern_status" AS ENUM('open', 'in_progress', 'referred', 'closed');--> statement-breakpoint
CREATE TABLE "safeguarding_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"concern_id" uuid NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"kind" "concern_action_kind" NOT NULL,
	"referred_to" text,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safeguarding_concern" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"raised_by_user_id" text,
	"raised_by_name" text,
	"category" "concern_category" NOT NULL,
	"client_id" uuid,
	"about_person" text,
	"happened_on" date,
	"details" text NOT NULL,
	"immediate_danger" boolean DEFAULT false NOT NULL,
	"status" "concern_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safeguarding_concern_details_present" CHECK (length(trim("safeguarding_concern"."details")) > 0)
);
--> statement-breakpoint
ALTER TABLE "safeguarding_action" ADD CONSTRAINT "safeguarding_action_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_action" ADD CONSTRAINT "safeguarding_action_concern_id_safeguarding_concern_id_fk" FOREIGN KEY ("concern_id") REFERENCES "public"."safeguarding_concern"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_action" ADD CONSTRAINT "safeguarding_action_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_concern" ADD CONSTRAINT "safeguarding_concern_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_concern" ADD CONSTRAINT "safeguarding_concern_raised_by_user_id_user_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_concern" ADD CONSTRAINT "safeguarding_concern_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "safeguarding_action_concern_idx" ON "safeguarding_action" USING btree ("concern_id");--> statement-breakpoint
CREATE INDEX "safeguarding_concern_status_idx" ON "safeguarding_concern" USING btree ("organisation_id","status");