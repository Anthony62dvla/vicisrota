ALTER TABLE "organisation" ADD COLUMN "trial_ends_at" timestamp with time zone DEFAULT now() + interval '30 days';--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "charity_number" text;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "charity_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "past_due_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "plan_band" integer;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "left_on" date;--> statement-breakpoint
ALTER TABLE "organisation" ADD CONSTRAINT "organisation_stripe_customer_id_unique" UNIQUE("stripe_customer_id");