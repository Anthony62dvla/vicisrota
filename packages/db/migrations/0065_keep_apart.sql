CREATE TABLE "keep_apart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"first_worker_id" uuid NOT NULL,
	"second_worker_id" uuid NOT NULL,
	"note" text,
	"review_on" date,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keep_apart_order" CHECK ("keep_apart"."first_worker_id" < "keep_apart"."second_worker_id")
);
--> statement-breakpoint
ALTER TABLE "keep_apart" ADD CONSTRAINT "keep_apart_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keep_apart" ADD CONSTRAINT "keep_apart_first_worker_id_worker_id_fk" FOREIGN KEY ("first_worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keep_apart" ADD CONSTRAINT "keep_apart_second_worker_id_worker_id_fk" FOREIGN KEY ("second_worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keep_apart" ADD CONSTRAINT "keep_apart_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "keep_apart_pair_idx" ON "keep_apart" USING btree ("first_worker_id","second_worker_id");--> statement-breakpoint
ALTER TABLE "keep_apart" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "keep_apart" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON keep_apart
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
