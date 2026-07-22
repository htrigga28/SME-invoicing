CREATE TYPE "public"."marketing_waitlist_entry_status" AS ENUM('waiting', 'invited', 'joined', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "marketing_waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_normalized" varchar(320) NOT NULL,
	"full_name" varchar(200),
	"company_name" varchar(200),
	"role" varchar(120),
	"source" varchar(80),
	"status" "marketing_waitlist_entry_status" DEFAULT 'waiting' NOT NULL,
	"utm_source" varchar(200),
	"utm_medium" varchar(200),
	"utm_campaign" varchar(200),
	"utm_content" varchar(200),
	"utm_term" varchar(200),
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_waitlist_email_normalized_unique" ON "marketing_waitlist_entries" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "marketing_waitlist_status_idx" ON "marketing_waitlist_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_waitlist_created_at_idx" ON "marketing_waitlist_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "marketing_waitlist_source_idx" ON "marketing_waitlist_entries" USING btree ("source");