CREATE TYPE "public"."check_kind" AS ENUM('right_to_work', 'dbs');--> statement-breakpoint
CREATE TYPE "public"."dbs_level" AS ENUM('basic', 'standard', 'enhanced', 'enhanced_barred');--> statement-breakpoint
CREATE TABLE "qualification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_requirement" (
	"organisation_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"qualification_id" uuid NOT NULL,
	CONSTRAINT "shift_requirement_shift_id_qualification_id_pk" PRIMARY KEY("shift_id","qualification_id")
);
--> statement-breakpoint
CREATE TABLE "worker_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"kind" "check_kind" NOT NULL,
	"checked_on" date NOT NULL,
	"expires_on" date,
	"dbs_level" "dbs_level",
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_qualification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"qualification_id" uuid NOT NULL,
	"achieved_on" date,
	"expires_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "requires_enhanced_dbs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "qualification" ADD CONSTRAINT "qualification_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requirement" ADD CONSTRAINT "shift_requirement_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requirement" ADD CONSTRAINT "shift_requirement_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requirement" ADD CONSTRAINT "shift_requirement_qualification_id_qualification_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_check" ADD CONSTRAINT "worker_check_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_check" ADD CONSTRAINT "worker_check_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_qualification" ADD CONSTRAINT "worker_qualification_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_qualification" ADD CONSTRAINT "worker_qualification_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_qualification" ADD CONSTRAINT "worker_qualification_qualification_id_qualification_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_check_worker_idx" ON "worker_check" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "worker_qualification_worker_idx" ON "worker_qualification" USING btree ("worker_id");