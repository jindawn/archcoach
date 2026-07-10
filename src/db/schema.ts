import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Built-in training scenarios, seeded from /scenarios/*.md at boot. */
export const scenarios = pgTable("scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  difficulty: text("difficulty").notNull(), // easy | medium | hard
  domain: text("domain").notNull(),
  backgroundMd: text("background_md").notNull(),
  constraints: jsonb("constraints").notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Local accounts used when LOCAL_MODE=false. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_auth_sessions_user").on(t.userId)],
);

/**
 * One architecture submission = one reviewable unit (v1 merges the
 * project/submission split; versioning arrives with multi-submission later).
 */
export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Null only for submissions created before authentication was enabled. */
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("real"), // real | training
  scenarioSlug: text("scenario_slug"),
  businessContext: text("business_context").notNull(),
  solutionMd: text("solution_md").notNull(),
  techStack: text("tech_stack"),
  constraints: jsonb("constraints").notNull().default({}),
  diagramSource: text("diagram_source"),
  diagramType: text("diagram_type"), // mermaid | plantuml | c4dsl
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clarifyingQuestions = pgTable(
  "clarifying_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    roleKey: text("role_key").notNull(),
    question: text("question").notNull(),
    whyMatters: text("why_matters").notNull(),
    answer: text("answer"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_questions_submission").on(t.submissionId)],
);

export const reviewSessions = pgTable(
  "review_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    // pending | reviewing | summarizing | generating_artifacts | completed | failed
    status: text("status").notNull().default("pending"),
    enabledRoles: jsonb("enabled_roles").notNull().$type<string[]>(),
    modelProfile: jsonb("model_profile").notNull().default({}),
    overallScore: doublePrecision("overall_score"),
    grade: text("grade"), // S | A | B | C | D
    summary: jsonb("summary"),
    error: text("error"),
    /** unguessable public slug; non-null means the report is shared read-only */
    shareSlug: text("share_slug").unique(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_sessions_submission").on(t.submissionId)],
);

export const roleReviews = pgTable(
  "role_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => reviewSessions.id, { onDelete: "cascade" }),
    roleKey: text("role_key").notNull(),
    status: text("status").notNull().default("pending"), // pending | running | completed | failed
    score: doublePrecision("score"),
    riskLevel: text("risk_level"), // low | medium | high | critical
    isBlocking: boolean("is_blocking"),
    result: jsonb("result"),
    promptVersion: text("prompt_version"),
    model: text("model"),
  },
  (t) => [uniqueIndex("uq_role_reviews_session_role").on(t.sessionId, t.roleKey)],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => reviewSessions.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // c4_diagram | improved_solution | adr | interview_script
    title: text("title").notNull(),
    content: text("content").notNull(),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_artifacts_session").on(t.sessionId)],
);

export const llmCallLogs = pgTable(
  "llm_call_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id"),
    task: text("task").notNull(), // clarify | role_review:<role> | summarize | artifact:<type>
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version"),
    inputHash: text("input_hash").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    costUsd: doublePrecision("cost_usd"),
    latencyMs: integer("latency_ms"),
    status: text("status").notNull(), // ok | retried | failed | degraded
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_call_logs_session").on(t.sessionId),
    index("idx_call_logs_hash").on(t.inputHash),
  ],
);

export type Scenario = typeof scenarios.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type ClarifyingQuestion = typeof clarifyingQuestions.$inferSelect;
export type ReviewSession = typeof reviewSessions.$inferSelect;
export type RoleReview = typeof roleReviews.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type LlmCallLog = typeof llmCallLogs.$inferSelect;
export type NewLlmCallLog = typeof llmCallLogs.$inferInsert;
