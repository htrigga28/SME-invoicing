CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void');--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price_kobo" integer NOT NULL,
	"line_total_kobo" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_number_sequences" (
	"organisation_id" uuid NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_sequences_organisation_id_pk" PRIMARY KEY("organisation_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"from_status" "invoice_status",
	"to_status" "invoice_status" NOT NULL,
	"reason" text,
	"actor_user_id" uuid,
	"metadata_redacted" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_number" varchar(40) NOT NULL,
	"public_token" text NOT NULL,
	"public_access_enabled" boolean DEFAULT false NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"notes" text,
	"subtotal_kobo" integer DEFAULT 0 NOT NULL,
	"discount_kobo" integer DEFAULT 0 NOT NULL,
	"tax_kobo" integer DEFAULT 0 NOT NULL,
	"total_kobo" integer DEFAULT 0 NOT NULL,
	"amount_paid_kobo" integer DEFAULT 0 NOT NULL,
	"balance_due_kobo" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_number_sequences" ADD CONSTRAINT "invoice_number_sequences_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_status_events" ADD CONSTRAINT "invoice_status_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_status_events" ADD CONSTRAINT "invoice_status_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_status_events" ADD CONSTRAINT "invoice_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_line_items_org_invoice_id_idx" ON "invoice_line_items" USING btree ("organisation_id","invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_status_events_org_invoice_id_idx" ON "invoice_status_events" USING btree ("organisation_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_invoice_number_unique" ON "invoices" USING btree ("organisation_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_organisation_id_idx" ON "invoices" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "invoices_org_status_idx" ON "invoices" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "invoices_org_customer_id_idx" ON "invoices" USING btree ("organisation_id","customer_id");--> statement-breakpoint
CREATE INDEX "invoices_org_due_date_idx" ON "invoices" USING btree ("organisation_id","due_date");--> statement-breakpoint
CREATE INDEX "invoices_org_created_at_idx" ON "invoices" USING btree ("organisation_id","created_at");