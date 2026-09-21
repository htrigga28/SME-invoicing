CREATE TABLE "communication_event_quarantine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(40) DEFAULT 'brevo' NOT NULL,
	"provider_event_id" varchar(200),
	"provider_event_key" varchar(300) NOT NULL,
	"provider_message_id" varchar(200),
	"correlation_communication_id" uuid,
	"event_type" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recipient_email" varchar(320),
	"reason" varchar(120) NOT NULL,
	"resolved_communication_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_event_quarantine_provider_event_key_unique" UNIQUE("provider_event_key")
);
--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "retry_claim_token" varchar(36);--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "retry_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "communication_event_quarantine" ADD CONSTRAINT "communication_event_quarantine_resolved_communication_id_communications_id_fk" FOREIGN KEY ("resolved_communication_id") REFERENCES "public"."communications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communication_event_quarantine_provider_event_unique" ON "communication_event_quarantine" USING btree ("provider","provider_event_id") WHERE "communication_event_quarantine"."provider_event_id" is not null;--> statement-breakpoint
CREATE INDEX "communication_event_quarantine_unresolved_message_idx" ON "communication_event_quarantine" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "communication_event_quarantine_unresolved_correlation_idx" ON "communication_event_quarantine" USING btree ("correlation_communication_id");