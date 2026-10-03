CREATE TYPE "public"."notice_kind" AS ENUM('added', 'cancelled', 'given_to_you', 'taken_by_colleague');--> statement-breakpoint
CREATE TABLE "rota_notice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"kind" "notice_kind" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notice_hours" integer NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rota_notice" ADD CONSTRAINT "rota_notice_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_notice" ADD CONSTRAINT "rota_notice_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_notice" ADD CONSTRAINT "rota_notice_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rota_notice_worker_idx" ON "rota_notice" USING btree ("worker_id","created_at");