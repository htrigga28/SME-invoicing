CREATE TYPE "public"."organisation_payment_account_status" AS ENUM('pending_confirmation', 'active', 'verification_delayed', 'disabled');--> statement-breakpoint
CREATE TABLE "organisation_payment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"provider" varchar(40) DEFAULT 'paystack' NOT NULL,
	"provider_subaccount_code" varchar(120),
	"bank_code" varchar(40) NOT NULL,
	"bank_name" varchar(200) NOT NULL,
	"account_name" varchar(200) NOT NULL,
	"account_number_last4" varchar(4) NOT NULL,
	"status" "organisation_payment_account_status" NOT NULL,
	"verified_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"provider_metadata_redacted" jsonb,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisation_payment_accounts" ADD CONSTRAINT "organisation_payment_accounts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_payment_accounts" ADD CONSTRAINT "organisation_payment_accounts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organisation_payment_accounts_organisation_id_idx" ON "organisation_payment_accounts" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "organisation_payment_accounts_org_provider_idx" ON "organisation_payment_accounts" USING btree ("organisation_id","provider");--> statement-breakpoint
CREATE INDEX "organisation_payment_accounts_org_status_idx" ON "organisation_payment_accounts" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "organisation_payment_accounts_subaccount_code_unique" ON "organisation_payment_accounts" USING btree ("provider_subaccount_code") WHERE "organisation_payment_accounts"."provider_subaccount_code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "organisation_payment_accounts_active_unique" ON "organisation_payment_accounts" USING btree ("organisation_id","provider") WHERE "organisation_payment_accounts"."status" = 'active';