CREATE TYPE "public"."swap_status" AS ENUM('asked', 'agreed', 'approved', 'colleague_declined', 'manager_declined', 'withdrawn');--> statement-breakpoint
CREATE TABLE "shift_swap" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"from_shift_id" uuid NOT NULL,
	"from_worker_id" uuid NOT NULL,
	"to_shift_id" uuid NOT NULL,
	"to_worker_id" uuid NOT NULL,
	"status" "swap_status" DEFAULT 'asked' NOT NULL,
	"note" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"responded_at" timestamp with time zone,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift_swap" ADD CONSTRAINT "shift_swap_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap" ADD CONSTRAINT "shift_swap_from_shift_id_shift_id_fk" FOREIGN KEY ("from_shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap" ADD CONSTRAINT "shift_swap_from_worker_id_worker_id_fk" FOREIGN KEY ("from_worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap" ADD CONSTRAINT "shift_swap_to_shift_id_shift_id_fk" FOREIGN KEY ("to_shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap" ADD CONSTRAINT "shift_swap_to_worker_id_worker_id_fk" FOREIGN KEY ("to_worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap" ADD CONSTRAINT "shift_swap_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shift_swap_to_worker_idx" ON "shift_swap" USING btree ("to_worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_swap_open_idx" ON "shift_swap" USING btree ("from_shift_id") WHERE "shift_swap"."status" in ('asked', 'agreed');--> statement-breakpoint
ALTER TABLE "shift_swap" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shift_swap" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON shift_swap
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
