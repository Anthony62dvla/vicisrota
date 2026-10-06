ALTER TABLE "location" ADD COLUMN "licensing" jsonb;--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "licensing" jsonb;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "personal_licence" jsonb;