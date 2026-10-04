CREATE TYPE "public"."role_colour" AS ENUM('teal', 'blue', 'purple', 'pink', 'orange', 'green', 'grey');--> statement-breakpoint
CREATE TABLE "job_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"colour" "role_colour" DEFAULT 'teal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_role" (
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "worker_role_worker_id_role_id_pk" PRIMARY KEY("worker_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "job_role" ADD CONSTRAINT "job_role_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role" ADD CONSTRAINT "worker_role_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role" ADD CONSTRAINT "worker_role_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role" ADD CONSTRAINT "worker_role_role_id_job_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_role_org_name_idx" ON "job_role" USING btree ("organisation_id",lower("name"));--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_role_id_job_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_role"("id") ON DELETE set null ON UPDATE no action;