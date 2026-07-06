CREATE TYPE "public"."payment_refund_status" AS ENUM('pending', 'processing', 'needs_attention', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" varchar(40) DEFAULT 'paystack' NOT NULL,
	"provider_refund_id" varchar(120),
	"amount_kobo" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"status" "payment_refund_status" DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"customer_note" text,
	"merchant_note" text,
	"initiated_by_user_id" uuid,
	"processed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"needs_attention_at" timestamp with time zone,
	"provider_metadata_redacted" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_id_idx" ON "payment_refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_refunds_org_status_idx" ON "payment_refunds" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_provider_refund_unique" ON "payment_refunds" USING btree ("provider","provider_refund_id") WHERE "payment_refunds"."provider_refund_id" is not null;