import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../drizzle/schema.js";
import { hazardPosts, hazardReports, hazardVotes, learners, learningEvents, topicMastery } from "../drizzle/schema.js";
import { AUTO_HIDE_REPORT_THRESHOLD } from "../shared/moderation.js";

export type Db = LibSQLDatabase<typeof schema>;

const here = path.dirname(fileURLToPath(import.meta.url));

/** Same relative location from server/ (tsx), dist/ (bundled build), and the Vercel function. */
function migrationsFolder(): string {
  const candidates = [path.resolve(here, "../drizzle/migrations"), path.resolve(process.cwd(), "drizzle/migrations")];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "meta/_journal.json"))) ?? candidates[0];
}

/**
 * Where the data lives:
 * - TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN): hosted libSQL/Turso — use this on Vercel.
 * - DATABASE_URL: a local SQLite file (default ./data/lane.db), or ":memory:".
 * - On Vercel with no database connected: a temporary file that resets between cold starts.
 */
export function resolveDatabaseConfig(override?: string): { url: string; authToken?: string; local: boolean } {
  const remote = override ? undefined : (process.env.TURSO_DATABASE_URL ?? process.env.LIBSQL_URL);
  if (remote) {
    return { url: remote, authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN, local: false };
  }
  const file = override ?? process.env.DATABASE_URL ?? (process.env.VERCEL ? "/tmp/lane.db" : "./data/lane.db");
  if (file === ":memory:" || file.startsWith("file:")) return { url: file, local: true };
  return { url: `file:${path.resolve(file)}`, local: true };
}

/** Opens, migrates, and seeds a database. Pass ":memory:" or a file path for tests. */
export async function createDb(override?: string): Promise<Db> {
  const config = resolveDatabaseConfig(override);
  if (config.url.startsWith("file:")) {
    fs.mkdirSync(path.dirname(config.url.slice("file:".length)), { recursive: true });
  }

  // The HTTP client is pure JavaScript (serverless-friendly); the native driver is only loaded for local files.
  const { createClient } = config.local ? await import("@libsql/client/sqlite3") : await import("@libsql/client/http");
  const client = createClient({ url: config.url.replace(/^libsql:/, "https:"), authToken: config.authToken });
  if (config.local) await client.execute("PRAGMA foreign_keys = ON");

  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  await seedCommunityBoard(db);
  return db;
}

/* ------------------------------------------------------------------------- */
/* Learners & privacy                                                        */
/* ------------------------------------------------------------------------- */

export async function ensureLearner(db: Db, learnerId: string) {
  await db.insert(learners).values({ id: learnerId }).onConflictDoNothing();
  return (await db.select().from(learners).where(eq(learners.id, learnerId)).get())!;
}

export async function setAnalyticsOptOut(db: Db, learnerId: string, optOut: boolean) {
  await db.update(learners).set({ analyticsOptOut: optOut }).where(eq(learners.id, learnerId));
  if (optOut) await db.delete(learningEvents).where(eq(learningEvents.learnerId, learnerId));
}

export async function learnerAnalyticsEnabled(db: Db, learnerId: string): Promise<boolean> {
  const learner = await db.select({ optOut: learners.analyticsOptOut }).from(learners).where(eq(learners.id, learnerId)).get();
  return learner ? !learner.optOut : false;
}

export async function logLearningEvent(db: Db, event: typeof learningEvents.$inferInsert) {
  await db.insert(learningEvents).values(event);
}

/** Removes every row tied to the learner, and undoes the votes and reports they cast on other posts. */
export async function deleteLearnerData(db: Db, learnerId: string) {
  const votedOn = db.select({ id: hazardVotes.postId }).from(hazardVotes).where(eq(hazardVotes.learnerId, learnerId));
  const reported = db.select({ id: hazardReports.postId }).from(hazardReports).where(eq(hazardReports.learnerId, learnerId));
  const ownPosts = db.select({ id: hazardPosts.id }).from(hazardPosts).where(eq(hazardPosts.authorId, learnerId));

  // Explicit deletes (not FK cascades) so this behaves the same on every libSQL host. Runs as one atomic batch.
  await db.batch([
    db
      .update(hazardPosts)
      .set({ upvotes: sql`max(${hazardPosts.upvotes} - 1, 0)` })
      .where(inArray(hazardPosts.id, votedOn)),
    db
      .update(hazardPosts)
      .set({ reportCount: sql`max(${hazardPosts.reportCount} - 1, 0)` })
      .where(inArray(hazardPosts.id, reported)),
    db.delete(hazardVotes).where(inArray(hazardVotes.postId, ownPosts)),
    db.delete(hazardReports).where(inArray(hazardReports.postId, ownPosts)),
    db.delete(hazardVotes).where(eq(hazardVotes.learnerId, learnerId)),
    db.delete(hazardReports).where(eq(hazardReports.learnerId, learnerId)),
    db.delete(hazardPosts).where(eq(hazardPosts.authorId, learnerId)),
    db.delete(learningEvents).where(eq(learningEvents.learnerId, learnerId)),
    db.delete(topicMastery).where(eq(topicMastery.learnerId, learnerId)),
    db.delete(learners).where(eq(learners.id, learnerId)),
  ]);
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

export async function upsertTopicRow(
  db: Db,
  learnerId: string,
  topicId: string,
  values: Partial<typeof topicMastery.$inferInsert>,
) {
  await db
    .insert(topicMastery)
    .values({ learnerId, topicId, ...values })
    .onConflictDoUpdate({ target: [topicMastery.learnerId, topicMastery.topicId], set: { ...values, updatedAt: new Date() } });
}

/** "Review later" or a scroll-past: counts toward X and queues the topic so it is never silently dropped. */
export async function recordSkip(db: Db, learnerId: string, topicId: string, queueForReview: boolean) {
  await db
    .insert(topicMastery)
    .values({ learnerId, topicId, skipCount: 1, reviewLater: queueForReview })
    .onConflictDoUpdate({
      target: [topicMastery.learnerId, topicMastery.topicId],
      set: {
        skipCount: sql`${topicMastery.skipCount} + 1`,
        reviewLater: queueForReview ? true : sql`${topicMastery.reviewLater}`,
        updatedAt: new Date(),
      },
    });
}

/* ------------------------------------------------------------------------- */
/* Community board                                                           */
/* ------------------------------------------------------------------------- */

export async function listPosts(
  db: Db,
  learnerId: string | null,
  options: { kind?: "hazard" | "test_tip"; sort: "top" | "new" },
) {
  const rows = await db
    .select()
    .from(hazardPosts)
    .where(and(eq(hazardPosts.hidden, false), options.kind ? eq(hazardPosts.kind, options.kind) : undefined))
    .orderBy(...(options.sort === "top" ? [desc(hazardPosts.upvotes), desc(hazardPosts.id)] : [desc(hazardPosts.createdAt), desc(hazardPosts.id)]))
    .limit(50)
    .all();

  const voted = learnerId
    ? new Set(
        (await db.select({ postId: hazardVotes.postId }).from(hazardVotes).where(eq(hazardVotes.learnerId, learnerId)).all()).map(
          (v) => v.postId,
        ),
      )
    : new Set<number>();

  return rows.map(({ authorId, reportCount: _reportCount, hidden: _hidden, ...post }) => ({
    ...post,
    isMine: learnerId !== null && authorId === learnerId,
    hasVoted: voted.has(post.id),
  }));
}

/** Each step is a single atomic statement, so concurrent votes can't lose updates. */
export async function toggleUpvote(db: Db, learnerId: string, postId: number) {
  const post = await db.select().from(hazardPosts).where(eq(hazardPosts.id, postId)).get();
  if (!post || post.hidden) return null;

  const added = await db.insert(hazardVotes).values({ postId, learnerId }).onConflictDoNothing();
  const hasVoted = added.rowsAffected > 0;
  if (!hasVoted) {
    await db.delete(hazardVotes).where(and(eq(hazardVotes.postId, postId), eq(hazardVotes.learnerId, learnerId)));
  }
  const [updated] = await db
    .update(hazardPosts)
    .set({ upvotes: hasVoted ? sql`${hazardPosts.upvotes} + 1` : sql`max(${hazardPosts.upvotes} - 1, 0)` })
    .where(eq(hazardPosts.id, postId))
    .returning({ upvotes: hazardPosts.upvotes });
  return { upvotes: updated.upvotes, hasVoted };
}

export async function reportPost(db: Db, learnerId: string, postId: number, reason: string) {
  const post = await db.select().from(hazardPosts).where(eq(hazardPosts.id, postId)).get();
  if (!post) return null;

  const inserted = await db.insert(hazardReports).values({ postId, learnerId, reason }).onConflictDoNothing();
  if (inserted.rowsAffected === 0) return { hidden: post.hidden, alreadyReported: true };

  const [updated] = await db
    .update(hazardPosts)
    .set({
      reportCount: sql`${hazardPosts.reportCount} + 1`,
      hidden: sql`${hazardPosts.reportCount} + 1 >= ${AUTO_HIDE_REPORT_THRESHOLD}`,
    })
    .where(eq(hazardPosts.id, postId))
    .returning({ hidden: hazardPosts.hidden });
  return { hidden: updated.hidden, alreadyReported: false };
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

async function seedCommunityBoard(db: Db) {
  const row = await db.select({ count: sql<number>`count(*)` }).from(hazardPosts).get();
  if ((row?.count ?? 0) === 0) await db.insert(hazardPosts).values(SEED_POSTS);
}
