import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () =>
  timestamp("created_at")
    .notNull()
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`);

/** Anonymous learner: a random device id, no name or email. */
export const learners = sqliteTable("learners", {
  id: text("id").primaryKey(),
  analyticsOptOut: integer("analytics_opt_out", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/** Per-topic learner model updated after every interaction (the "self-learning" state). */
export const topicMastery = sqliteTable(
  "topic_mastery",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    topicId: text("topic_id").notNull(),
    mastery: real("mastery").notNull().default(0),
    sessionMastery: real("session_mastery").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    reviewAttempts: integer("review_attempts").notNull().default(0),
    reviewCorrect: integer("review_correct").notNull().default(0),
    knowledgeCheckPassed: integer("knowledge_check_passed", { mode: "boolean" }).notNull().default(false),
    lastFirstAnswerCorrect: integer("last_first_answer_correct", { mode: "boolean" }),
    videoCompletion: real("video_completion").notNull().default(0),
    keyWatched: integer("key_watched", { mode: "boolean" }).notNull().default(false),
    averageActiveSeconds: real("average_active_seconds").notNull().default(0),
    skipCount: integer("skip_count").notNull().default(0),
    helpCount: integer("help_count").notNull().default(0),
    retryCount: integer("retry_count").notNull().default(0),
    reviewLater: integer("review_later", { mode: "boolean" }).notNull().default(false),
    reviewPriority: real("review_priority").notNull().default(0),
    lastPracticedAt: timestamp("last_practiced_at"),
    lastReviewedAt: timestamp("last_reviewed_at"),
    updatedAt: createdAt(),
  },
  (table) => [uniqueIndex("topic_mastery_learner_topic").on(table.learnerId, table.topicId)],
);

/** Detailed per-interaction log. Skipped entirely when the learner opts out of analytics. */
export const learningEvents = sqliteTable(
  "learning_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull(),
    topicId: text("topic_id").notNull(),
    mode: text("mode", { enum: ["feed", "review", "test_out"] }).notNull(),
    firstAnswerCorrect: integer("first_answer_correct", { mode: "boolean" }).notNull(),
    followUpCorrect: integer("follow_up_correct", { mode: "boolean" }),
    accuracy: real("accuracy").notNull(),
    work: real("work").notNull(),
    attention: real("attention").notNull(),
    timeQuality: real("time_quality").notNull(),
    sessionMastery: real("session_mastery").notNull(),
    smoothedMastery: real("smoothed_mastery").notNull(),
    band: text("band").notNull(),
    activeSeconds: real("active_seconds").notNull(),
    videoCompletion: real("video_completion").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("learning_events_learner").on(table.learnerId)],
);

export const hazardPosts = sqliteTable(
  "hazard_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: text("author_id").references(() => learners.id, { onDelete: "cascade" }),
    authorLabel: text("author_label").notNull(),
    kind: text("kind", { enum: ["hazard", "test_tip"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    location: text("location"),
    upvotes: integer("upvotes").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("hazard_posts_kind").on(table.kind)],
);

export const hazardVotes = sqliteTable(
  "hazard_votes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => hazardPosts.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.learnerId] })],
);

export const hazardReports = sqliteTable(
  "hazard_reports",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => hazardPosts.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.learnerId] })],
);

export type TopicMasteryRow = typeof topicMastery.$inferSelect;
export type HazardPostRow = typeof hazardPosts.$inferSelect;
