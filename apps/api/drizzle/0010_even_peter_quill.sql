CREATE TABLE "receipt_number_sequences" (
	"organisation_id" uuid NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_number_sequences_organisation_id_pk" PRIMARY KEY("organisation_id")
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"receipt_number" varchar(40) NOT NULL,
	"public_token" text NOT NULL,
	"public_access_enabled" boolean DEFAULT true NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"amount_kobo" integer NOT NULL,
	"payment_provider" varchar(40) NOT NULL,
	"payment_reference" varchar(120) NOT NULL,
	"payment_channel" varchar(80),
	"paid_at" timestamp with time zone NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_name" varchar(200) NOT NULL,
	"business_email" varchar(320),
	"business_phone" varchar(50),
	"business_address" text,
	"customer_name" varchar(200) NOT NULL,
	"customer_email" varchar(320) NOT NULL,
	"customer_phone" varchar(50),
	"customer_billing_address" text,
	"invoice_number" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipt_number_sequences" ADD CONSTRAINT "receipt_number_sequences_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipts_organisation_id_idx" ON "receipts" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "receipts_org_issued_at_idx" ON "receipts" USING btree ("organisation_id","issued_at");--> statement-breakpoint
CREATE INDEX "receipts_org_customer_id_idx" ON "receipts" USING btree ("organisation_id","customer_id");--> statement-breakpoint
CREATE INDEX "receipts_org_invoice_id_idx" ON "receipts" USING btree ("organisation_id","invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_payment_reference_idx" ON "receipts" USING btree ("payment_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_payment_id_unique" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_org_receipt_number_unique" ON "receipts" USING btree ("organisation_id","receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_public_token_unique" ON "receipts" USING btree ("public_token");