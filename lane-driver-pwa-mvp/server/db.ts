import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../drizzle/schema";
import { hazardPosts, hazardReports, hazardVotes, learners, learningEvents, topicMastery } from "../drizzle/schema";
import { AUTO_HIDE_REPORT_THRESHOLD } from "../shared/moderation";

export type Db = BetterSQLite3Database<typeof schema>;

const here = path.dirname(fileURLToPath(import.meta.url));
// Same relative location from server/ (tsx) and dist/ (bundled build).
const MIGRATIONS_DIR = path.resolve(here, "../drizzle/migrations");

/** Opens (and migrates) a database. Pass ":memory:" for tests. */
export function createDb(file = process.env.DATABASE_URL ?? "./data/lane.db"): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  seedCommunityBoard(db);
  return db;
}

/* ------------------------------------------------------------------------- */
/* Learners & privacy                                                        */
/* ------------------------------------------------------------------------- */

export function ensureLearner(db: Db, learnerId: string) {
  db.insert(learners).values({ id: learnerId }).onConflictDoNothing().run();
  return db.select().from(learners).where(eq(learners.id, learnerId)).get()!;
}

export function setAnalyticsOptOut(db: Db, learnerId: string, optOut: boolean) {
  db.update(learners).set({ analyticsOptOut: optOut }).where(eq(learners.id, learnerId)).run();
  if (optOut) db.delete(learningEvents).where(eq(learningEvents.learnerId, learnerId)).run();
}

export function learnerAnalyticsEnabled(db: Db, learnerId: string): boolean {
  const learner = db.select({ optOut: learners.analyticsOptOut }).from(learners).where(eq(learners.id, learnerId)).get();
  return learner ? !learner.optOut : false;
}

export function logLearningEvent(db: Db, event: typeof learningEvents.$inferInsert) {
  db.insert(learningEvents).values(event).run();
}

/** Removes every row tied to the learner (cascades to mastery, events, posts, votes, reports). */
export function deleteLearnerData(db: Db, learnerId: string) {
  db.transaction((tx) => {
    // Votes and reports this learner cast on other people's posts must be undone too.
    const voted = tx.select({ postId: hazardVotes.postId }).from(hazardVotes).where(eq(hazardVotes.learnerId, learnerId)).all();
    for (const { postId } of voted) {
      tx.update(hazardPosts).set({ upvotes: sql`max(${hazardPosts.upvotes} - 1, 0)` }).where(eq(hazardPosts.id, postId)).run();
    }
    const reported = tx
      .select({ postId: hazardReports.postId })
      .from(hazardReports)
      .where(eq(hazardReports.learnerId, learnerId))
      .all();
    for (const { postId } of reported) {
      tx.update(hazardPosts)
        .set({ reportCount: sql`max(${hazardPosts.reportCount} - 1, 0)` })
        .where(eq(hazardPosts.id, postId))
        .run();
    }
    tx.delete(learners).where(eq(learners.id, learnerId)).run();
  });
}

/* ------------------------------------------------------------------------- */
/* Topic mastery                                                             */
/* ------------------------------------------------------------------------- */

export function getTopicRows(db: Db, learnerId: string) {
  return db.select().from(topicMastery).where(eq(topicMastery.learnerId, learnerId)).all();
}

export function getTopicRow(db: Db, learnerId: string, topicId: string) {
  return db
    .select()
    .from(topicMastery)
    .where(and(eq(topicMastery.learnerId, learnerId), eq(topicMastery.topicId, topicId)))
    .get();
}

export function upsertTopicRow(
  db: Pick<Db, "insert">,
  learnerId: string,
  topicId: string,
  values: Partial<typeof topicMastery.$inferInsert>,
) {
  db.insert(topicMastery)
    .values({ learnerId, topicId, ...values })
    .onConflictDoUpdate({ target: [topicMastery.learnerId, topicMastery.topicId], set: { ...values, updatedAt: new Date() } })
    .run();
}

/** "Review later" or a scroll-past: counts toward X and queues the topic so it is never silently dropped. */
export function recordSkip(db: Db, learnerId: string, topicId: string, queueForReview: boolean) {
  const existing = getTopicRow(db, learnerId, topicId);
  upsertTopicRow(db, learnerId, topicId, {
    skipCount: (existing?.skipCount ?? 0) + 1,
    reviewLater: queueForReview || (existing?.reviewLater ?? false),
  });
}

/* ------------------------------------------------------------------------- */
/* Community board                                                           */
/* ------------------------------------------------------------------------- */

export function listPosts(db: Db, learnerId: string | null, options: { kind?: "hazard" | "test_tip"; sort: "top" | "new" }) {
  const rows = db
    .select()
    .from(hazardPosts)
    .where(and(eq(hazardPosts.hidden, false), options.kind ? eq(hazardPosts.kind, options.kind) : undefined))
    .orderBy(...(options.sort === "top" ? [desc(hazardPosts.upvotes), desc(hazardPosts.id)] : [desc(hazardPosts.createdAt), desc(hazardPosts.id)]))
    .limit(50)
    .all();

  const voted = learnerId
    ? new Set(
        db.select({ postId: hazardVotes.postId }).from(hazardVotes).where(eq(hazardVotes.learnerId, learnerId)).all().map((v) => v.postId),
      )
    : new Set<number>();

  return rows.map(({ authorId, reportCount: _reportCount, hidden: _hidden, ...post }) => ({
    ...post,
    isMine: learnerId !== null && authorId === learnerId,
    hasVoted: voted.has(post.id),
  }));
}

export function toggleUpvote(db: Db, learnerId: string, postId: number) {
  return db.transaction((tx) => {
    const post = tx.select().from(hazardPosts).where(eq(hazardPosts.id, postId)).get();
    if (!post || post.hidden) return null;
    const existing = tx
      .select()
      .from(hazardVotes)
      .where(and(eq(hazardVotes.postId, postId), eq(hazardVotes.learnerId, learnerId)))
      .get();
    if (existing) {
      tx.delete(hazardVotes).where(and(eq(hazardVotes.postId, postId), eq(hazardVotes.learnerId, learnerId))).run();
    } else {
      tx.insert(hazardVotes).values({ postId, learnerId }).run();
    }
    const upvotes = Math.max(0, post.upvotes + (existing ? -1 : 1));
    tx.update(hazardPosts).set({ upvotes }).where(eq(hazardPosts.id, postId)).run();
    return { upvotes, hasVoted: !existing };
  });
}

export function reportPost(db: Db, learnerId: string, postId: number, reason: string) {
  return db.transaction((tx) => {
    const post = tx.select().from(hazardPosts).where(eq(hazardPosts.id, postId)).get();
    if (!post) return null;
    const inserted = tx.insert(hazardReports).values({ postId, learnerId, reason }).onConflictDoNothing().run();
    if (inserted.changes === 0) return { hidden: post.hidden, alreadyReported: true };
    const reportCount = post.reportCount + 1;
    const hidden = reportCount >= AUTO_HIDE_REPORT_THRESHOLD;
    tx.update(hazardPosts).set({ reportCount, hidden }).where(eq(hazardPosts.id, postId)).run();
    return { hidden, alreadyReported: false };
  });
}

const SEED_POSTS: Array<typeof hazardPosts.$inferInsert> = [
  {
    authorLabel: "Lane Team (sample)",
    kind: "hazard",
    title: "Overgrown hedges hide side streets",
    body: "Hedges along parts of Novato Blvd block your view of cars pulling out of side streets. Cover the brake and creep forward when turning out.",
    location: "Novato Blvd, Novato",
    upvotes: 12,
  },
  {
    authorLabel: "Lane Team (sample)",
    kind: "hazard",
    title: "Very short freeway on-ramp",
    body: "Some older on-ramps give you almost no room to get up to speed. Accelerate early, check your mirror and blind spot, and pick your gap before the ramp ends.",
    location: "US-101 on-ramps, Marin County",
    upvotes: 9,
  },
  {
    authorLabel: "Lane Team (sample)",
    kind: "test_tip",
    title: "Know your numbers",
    body: "The written test loves numbers: 3-second following distance, 3 feet for bikes, 100 feet to signal, 500 feet to dim high beams, 10 days to file an SR-1.",
    location: null,
    upvotes: 15,
  },
  {
    authorLabel: "Lane Team (sample)",
    kind: "test_tip",
    title: "Exaggerate your head checks",
    body: "On the drive test, make your shoulder checks obvious. The examiner can't score a blind-spot check they didn't see.",
    location: null,
    upvotes: 7,
  },
];

function seedCommunityBoard(db: Db) {
  const { count } = db.select({ count: sql<number>`count(*)` }).from(hazardPosts).get()!;
  if (count === 0) db.insert(hazardPosts).values(SEED_POSTS).run();
}
