CREATE TABLE "sales_forecast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"sales_on" date NOT NULL,
	"pence" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisation" ADD COLUMN "labour_target_percent" smallint;--> statement-breakpoint
ALTER TABLE "sales_forecast" ADD CONSTRAINT "sales_forecast_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_forecast_day_idx" ON "sales_forecast" USING btree ("organisation_id","sales_on");--> statement-breakpoint
ALTER TABLE "sales_forecast" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales_forecast" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "sales_forecast" USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid) WITH CHECK (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
