ALTER TABLE "communications" ADD COLUMN "idempotency_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "provider_request_snapshot" jsonb;