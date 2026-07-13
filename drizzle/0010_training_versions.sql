ALTER TABLE "training_step_answers" ADD COLUMN "content_version" integer DEFAULT 0 NOT NULL;
ALTER TABLE "training_step_answers" ADD COLUMN "first_feedback" jsonb;
ALTER TABLE "training_step_answers" ADD COLUMN "final_feedback" jsonb;
CREATE TABLE "training_attempt_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "answer_snapshot" jsonb NOT NULL,
  "solution_md" text NOT NULL,
  "independence_score" double precision NOT NULL,
  "capability_scores" jsonb,
  "assessment_status" text DEFAULT 'pending' NOT NULL,
  "recommended_step_id" text,
  "submission_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "training_attempt_versions" ADD CONSTRAINT "training_attempt_versions_attempt_id_training_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."training_attempts"("id") ON DELETE cascade;
ALTER TABLE "training_attempt_versions" ADD CONSTRAINT "training_attempt_versions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null;
CREATE UNIQUE INDEX "uq_training_attempt_version" ON "training_attempt_versions" ("attempt_id","version");
CREATE INDEX "idx_training_versions_submission" ON "training_attempt_versions" ("submission_id");
INSERT INTO "training_attempt_versions" ("attempt_id", "version", "answer_snapshot", "solution_md", "independence_score", "capability_scores", "assessment_status", "recommended_step_id", "submission_id", "created_at")
SELECT a."id", 1,
  COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."created_at") FROM "training_step_answers" x WHERE x."attempt_id" = a."id"), '[]'::jsonb),
  COALESCE(s."solution_md", ''), COALESCE(a."independence_score", 100), a."capability_scores",
  CASE WHEN a."capability_scores" IS NULL THEN 'unavailable' ELSE 'completed' END,
  a."recommended_step_id", a."submission_id", a."created_at"
FROM "training_attempts" a
LEFT JOIN "submissions" s ON s."id" = a."submission_id"
WHERE a."status" = 'completed';
