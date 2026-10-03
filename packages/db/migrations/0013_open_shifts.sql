CREATE TYPE "public"."claim_status" AS ENUM('requested', 'approved', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TABLE "shift_claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"status" "claim_status" DEFAULT 'requested' NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "cover_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shift_claim" ADD CONSTRAINT "shift_claim_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_claim" ADD CONSTRAINT "shift_claim_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_claim" ADD CONSTRAINT "shift_claim_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_claim" ADD CONSTRAINT "shift_claim_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shift_claim_shift_idx" ON "shift_claim" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_claim_open_idx" ON "shift_claim" USING btree ("shift_id","worker_id") WHERE "shift_claim"."status" = 'requested';