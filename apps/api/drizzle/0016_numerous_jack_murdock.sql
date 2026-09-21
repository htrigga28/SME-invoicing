ALTER TABLE "communication_event_quarantine" ALTER COLUMN "provider" SET DEFAULT 'resend';--> statement-breakpoint
ALTER TABLE "communication_events" ALTER COLUMN "provider" SET DEFAULT 'resend';--> statement-breakpoint
ALTER TABLE "communications" ALTER COLUMN "provider" SET DEFAULT 'resend';--> statement-breakpoint
UPDATE "communications" SET "provider" = 'resend' WHERE "provider" = 'brevo';--> statement-breakpoint
UPDATE "communication_events" SET "provider" = 'resend' WHERE "provider" = 'brevo';--> statement-breakpoint
UPDATE "communication_event_quarantine" SET "provider" = 'resend' WHERE "provider" = 'brevo';