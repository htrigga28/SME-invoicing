CREATE TYPE "public"."communication_status" AS ENUM('pending', 'accepted', 'delivered', 'deferred', 'failed');--> statement-breakpoint
CREATE TABLE "communication_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"communication_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"provider" varchar(40) DEFAULT 'brevo' NOT NULL,
	"provider_event_key" varchar(300) NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata_redacted" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_events_provider_event_key_unique" UNIQUE("provider_event_key")
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"purpose" varchar(40) DEFAULT 'invoice_delivery' NOT NULL,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"provider" varchar(40) DEFAULT 'brevo' NOT NULL,
	"subject" varchar(300),
	"to_recipients" jsonb NOT NULL,
	"cc_recipients" jsonb NOT NULL,
	"provider_message_id" varchar(200),
	"status" "communication_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"deferred_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" varchar(300),
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_view_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(60) DEFAULT 'public_invoice_page' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "last_viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_communication_id_communications_id_fk" FOREIGN KEY ("communication_id") REFERENCES "public"."communications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_view_events" ADD CONSTRAINT "invoice_view_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_view_events" ADD CONSTRAINT "invoice_view_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communication_events_org_communication_idx" ON "communication_events" USING btree ("organisation_id","communication_id");--> statement-breakpoint
CREATE INDEX "communication_events_org_invoice_idx" ON "communication_events" USING btree ("organisation_id","invoice_id");--> statement-breakpoint
CREATE INDEX "communications_org_invoice_id_idx" ON "communications" USING btree ("organisation_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communications_provider_message_id_unique" ON "communications" USING btree ("provider_message_id") WHERE "communications"."provider_message_id" is not null;--> statement-breakpoint
CREATE INDEX "invoice_view_events_org_invoice_idx" ON "invoice_view_events" USING btree ("organisation_id","invoice_id");