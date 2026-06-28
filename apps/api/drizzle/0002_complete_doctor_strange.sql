CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(50),
	"billing_address" text,
	"created_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_organisation_id_idx" ON "customers" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "customers_org_archived_at_idx" ON "customers" USING btree ("organisation_id","archived_at");--> statement-breakpoint
CREATE INDEX "customers_org_email_idx" ON "customers" USING btree ("organisation_id","email");--> statement-breakpoint
CREATE INDEX "customers_org_name_idx" ON "customers" USING btree ("organisation_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_active_email_unique" ON "customers" USING btree ("organisation_id",lower("email")) WHERE "customers"."archived_at" is null;