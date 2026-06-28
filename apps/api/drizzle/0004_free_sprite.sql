CREATE TYPE "public"."payment_status" AS ENUM('pending', 'successful', 'failed', 'abandoned', 'refunded');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"provider_reference" varchar(120) NOT NULL,
	"provider_access_code" text,
	"provider_authorization_url" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"amount_kobo" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	"channel" varchar(80),
	"gateway_response" text,
	"metadata_redacted" jsonb,
	"initialized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_reference_unique" ON "payments" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "payments_organisation_id_idx" ON "payments" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "payments_org_invoice_id_idx" ON "payments" USING btree ("organisation_id","invoice_id");--> statement-breakpoint
CREATE INDEX "payments_org_customer_id_idx" ON "payments" USING btree ("organisation_id","customer_id");--> statement-breakpoint
CREATE INDEX "payments_org_status_idx" ON "payments" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "payments_provider_reference_idx" ON "payments" USING btree ("provider_reference");