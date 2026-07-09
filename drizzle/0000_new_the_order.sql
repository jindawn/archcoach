CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clarifying_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"role_key" text NOT NULL,
	"question" text NOT NULL,
	"why_matters" text NOT NULL,
	"answer" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"task" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text,
	"input_hash" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"cost_usd" double precision,
	"latency_ms" integer,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"enabled_roles" jsonb NOT NULL,
	"model_profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"overall_score" double precision,
	"grade" text,
	"summary" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"score" double precision,
	"risk_level" text,
	"is_blocking" boolean,
	"result" jsonb,
	"prompt_version" text,
	"model" text
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"difficulty" text NOT NULL,
	"domain" text NOT NULL,
	"background_md" text NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenarios_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'real' NOT NULL,
	"scenario_slug" text,
	"business_context" text NOT NULL,
	"solution_md" text NOT NULL,
	"tech_stack" text,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"diagram_source" text,
	"diagram_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarifying_questions" ADD CONSTRAINT "clarifying_questions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_reviews" ADD CONSTRAINT "role_reviews_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_artifacts_session" ON "artifacts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_questions_submission" ON "clarifying_questions" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_call_logs_session" ON "llm_call_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_call_logs_hash" ON "llm_call_logs" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_submission" ON "review_sessions" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_reviews_session_role" ON "role_reviews" USING btree ("session_id","role_key");