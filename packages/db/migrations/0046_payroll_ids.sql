ALTER TABLE "organisation" ADD COLUMN "pay_item_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "payroll_id" text;