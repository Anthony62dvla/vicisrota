ALTER TABLE "shift" ADD COLUMN "split_group_id" uuid;--> statement-breakpoint
CREATE INDEX "shift_split_group_idx" ON "shift" USING btree ("split_group_id");