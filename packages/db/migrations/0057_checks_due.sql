ALTER TABLE "organisation" ADD COLUMN "checks_reminded_on" date;--> statement-breakpoint
ALTER TABLE "worker_check" ADD COLUMN "update_service" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_qualification" ADD COLUMN "reference" text;