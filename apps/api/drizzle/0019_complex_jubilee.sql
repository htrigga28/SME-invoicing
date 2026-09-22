CREATE TABLE "automation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"resource_type" varchar(60) NOT NULL,
	"resource_id" uuid NOT NULL,
	"scheduled_for" date NOT NULL,
	"run_at" timestamp with time zone,
	"idempotency_key" varchar(200) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"claim_token" varchar(36),
	"claimed_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"last_error" varchar(500),
	"payload_redacted" jsonb,
	"completed_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "organisation_reminder_settings" (
	"organisation_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoice_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"scheduled_for" date NOT NULL,
	"invoice_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_summary" varchar(500),
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoice_schedule_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"catalogue_item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price_kobo" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoice_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"anchor_day" integer NOT NULL,
	"anchor_month" integer NOT NULL,
	"start_date" date NOT NULL,
	"next_issue_date" date NOT NULL,
	"end_date" date,
	"due_terms_days" integer DEFAULT 14 NOT NULL,
	"auto_send" boolean DEFAULT false NOT NULL,
	"to_recipients" jsonb NOT NULL,
	"cc_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email_subject" varchar(300),
	"customer_reference" varchar(120),
	"notes" text,
	"discount_kobo" integer DEFAULT 0 NOT NULL,
	"tax_kobo" integer DEFAULT 0 NOT NULL,
	"last_generated_at" timestamp with time zone,
	"last_invoice_id" uuid,
	"last_error" varchar(500),
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"relative_days" integer NOT NULL,
	"subject_template" varchar(300) NOT NULL,
	"body_template" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "automatic_reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "automatic_reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "scheduled_send_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "scheduled_send_to" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "scheduled_send_cc" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "scheduled_send_subject" varchar(300);--> statement-breakpoint
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_reminder_settings" ADD CONSTRAINT "organisation_reminder_settings_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_reminder_settings" ADD CONSTRAINT "organisation_reminder_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_occurrences" ADD CONSTRAINT "recurring_invoice_occurrences_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_occurrences" ADD CONSTRAINT "recurring_invoice_occurrences_schedule_id_recurring_invoice_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."recurring_invoice_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_occurrences" ADD CONSTRAINT "recurring_invoice_occurrences_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_schedule_line_items" ADD CONSTRAINT "recurring_invoice_schedule_line_items_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_schedule_line_items" ADD CONSTRAINT "recurring_invoice_schedule_line_items_schedule_id_recurring_invoice_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."recurring_invoice_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_schedule_line_items" ADD CONSTRAINT "recurring_invoice_schedule_line_items_catalogue_item_id_catalogue_items_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_schedules" ADD CONSTRAINT "recurring_invoice_schedules_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_schedules" ADD CONSTRAINT "recurring_invoice_schedules_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_schedules" ADD CONSTRAINT "recurring_invoice_schedules_last_invoice_id_invoices_id_fk" FOREIGN KEY ("last_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_schedules" ADD CONSTRAINT "recurring_invoice_schedules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_steps" ADD CONSTRAINT "reminder_steps_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_jobs_org_status_scheduled_idx" ON "automation_jobs" USING btree ("organisation_id","status","scheduled_for");--> statement-breakpoint
CREATE INDEX "automation_jobs_org_resource_idx" ON "automation_jobs" USING btree ("organisation_id","resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_occurrences_schedule_date_unique" ON "recurring_invoice_occurrences" USING btree ("schedule_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "recurring_occurrences_org_idx" ON "recurring_invoice_occurrences" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "recurring_line_items_schedule_idx" ON "recurring_invoice_schedule_line_items" USING btree ("organisation_id","schedule_id");--> statement-breakpoint
CREATE INDEX "recurring_schedules_org_idx" ON "recurring_invoice_schedules" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "recurring_schedules_org_status_idx" ON "recurring_invoice_schedules" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "recurring_schedules_org_next_idx" ON "recurring_invoice_schedules" USING btree ("organisation_id","next_issue_date");--> statement-breakpoint
CREATE INDEX "reminder_steps_org_idx" ON "reminder_steps" USING btree ("organisation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_steps_org_day_unique" ON "reminder_steps" USING btree ("organisation_id","relative_days");