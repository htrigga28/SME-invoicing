-- Branch migrations 0013-0015 never reached production (last production
-- migration predates them), so no deployed schema is rewritten here. The
-- UPDATEs below relabel rows created on dev/test by this branch's own
-- synthetic sends; no live provider traffic ever used the old label.
ALTER TABLE "communication_event_quarantine" ALTER COLUMN "provider" SET DEFAULT 'resend';--> statement-breakpoint
ALTER TABLE "communication_events" ALTER COLUMN "provider" SET DEFAULT 'resend';--> statement-breakpoint
ALTER TABLE "communications" ALTER COLUMN "provider" SET DEFAULT 'resend';--> statement-breakpoint
UPDATE "communications" SET "provider" = 'resend' WHERE "provider" = 'brevo';--> statement-breakpoint
UPDATE "communication_events" SET "provider" = 'resend' WHERE "provider" = 'brevo';--> statement-breakpoint
UPDATE "communication_event_quarantine" SET "provider" = 'resend' WHERE "provider" = 'brevo';