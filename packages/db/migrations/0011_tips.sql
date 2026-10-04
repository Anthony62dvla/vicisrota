CREATE TYPE "public"."tip_method" AS ENUM('hours', 'equal');--> statement-breakpoint
CREATE TYPE "public"."tip_source" AS ENUM('card', 'cash', 'service_charge');--> statement-breakpoint
CREATE TABLE "tip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"received_on" date NOT NULL,
	"amount_pence" integer NOT NULL,
	"source" "tip_source" NOT NULL,
	"note" text,
	"allocation_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tip_amount_positive" CHECK ("tip"."amount_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE "tip_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"total_pence" integer NOT NULL,
	"method" "tip_method" NOT NULL,
	"pay_by" date NOT NULL,
	"paid_at" timestamp with time zone,
	"request_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tip_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"hours" numeric(7, 2) NOT NULL,
	"pence" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "tipping_policy" text;--> statement-breakpoint
ALTER TABLE "tip" ADD CONSTRAINT "tip_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip" ADD CONSTRAINT "tip_allocation_id_tip_allocation_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."tip_allocation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip" ADD CONSTRAINT "tip_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_allocation" ADD CONSTRAINT "tip_allocation_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_allocation" ADD CONSTRAINT "tip_allocation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_share" ADD CONSTRAINT "tip_share_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_share" ADD CONSTRAINT "tip_share_allocation_id_tip_allocation_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."tip_allocation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_share" ADD CONSTRAINT "tip_share_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tip_org_received_idx" ON "tip" USING btree ("organisation_id","received_on");--> statement-breakpoint
CREATE INDEX "tip_share_worker_idx" ON "tip_share" USING btree ("worker_id");