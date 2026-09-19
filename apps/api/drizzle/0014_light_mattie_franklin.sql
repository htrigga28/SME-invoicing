CREATE TYPE "public"."communication_recipient_status" AS ENUM('pending', 'accepted', 'delivered', 'deferred', 'failed');--> statement-breakpoint
ALTER TYPE "public"."communication_status" ADD VALUE 'submission_uncertain';--> statement-breakpoint
ALTER TYPE "public"."communication_status" ADD VALUE 'in_progress';--> statement-breakpoint
ALTER TYPE "public"."communication_status" ADD VALUE 'partially_failed';--> statement-breakpoint
CREATE TABLE "communication_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"communication_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"recipient_type" varchar(10) DEFAULT 'to' NOT NULL,
	"status" "communication_recipient_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"deferred_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "provider_idempotency_key" varchar(36);--> statement-breakpoint
UPDATE "communications" SET "provider_idempotency_key" = gen_random_uuid()::text WHERE "provider_idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "communications" ALTER COLUMN "provider_idempotency_key" SET NOT NULL;--> statement-breakpoint
-- t021-view-backfill-begin
UPDATE "invoices" SET "view_count" = 1, "last_viewed_at" = COALESCE("last_viewed_at", "viewed_at") WHERE "viewed_at" IS NOT NULL AND "view_count" = 0;
-- t021-view-backfill-end
--> statement-breakpoint
-- t021-recipient-backfill-begin
INSERT INTO "communication_recipients" ("organisation_id", "communication_id", "invoice_id", "email", "recipient_type", "status", "accepted_at", "delivered_at", "deferred_at", "failed_at", "failure_reason", "created_at", "updated_at")
SELECT
	c."organisation_id",
	c."id",
	c."invoice_id",
	recipient."email",
	recipient."recipient_type",
	CASE c."status"
		WHEN 'accepted' THEN 'accepted'::"communication_recipient_status"
		WHEN 'delivered' THEN 'delivered'::"communication_recipient_status"
		WHEN 'deferred' THEN 'deferred'::"communication_recipient_status"
		WHEN 'failed' THEN 'failed'::"communication_recipient_status"
		ELSE 'pending'::"communication_recipient_status"
	END,
	c."accepted_at",
	c."delivered_at",
	c."deferred_at",
	c."failed_at",
	c."failure_reason",
	c."created_at",
	c."updated_at"
FROM "communications" c
CROSS JOIN LATERAL (
	SELECT jsonb_array_elements_text(c."to_recipients") AS "email", 'to' AS "recipient_type"
	UNION
	SELECT jsonb_array_elements_text(c."cc_recipients"), 'cc'
) AS recipient
ON CONFLICT DO NOTHING;
-- t021-recipient-backfill-end
--> statement-breakpoint
ALTER TABLE "communication_recipients" ADD CONSTRAINT "communication_recipients_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_recipients" ADD CONSTRAINT "communication_recipients_communication_id_communications_id_fk" FOREIGN KEY ("communication_id") REFERENCES "public"."communications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_recipients" ADD CONSTRAINT "communication_recipients_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communication_recipients_communication_idx" ON "communication_recipients" USING btree ("organisation_id","communication_id");--> statement-breakpoint
CREATE INDEX "communication_recipients_org_invoice_idx" ON "communication_recipients" USING btree ("organisation_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_recipients_communication_email_unique" ON "communication_recipients" USING btree ("communication_id","email");--> statement-breakpoint
CREATE INDEX "communications_provider_idempotency_key_idx" ON "communications" USING btree ("provider_idempotency_key");