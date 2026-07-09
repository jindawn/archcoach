ALTER TABLE "review_sessions" ADD COLUMN "share_slug" text;--> statement-breakpoint
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_share_slug_unique" UNIQUE("share_slug");