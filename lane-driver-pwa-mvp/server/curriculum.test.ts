import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { EMERGENCY_CHECKLIST, isAnswerCorrect, LESSON_SEEDS } from "@shared/curriculum";
import { anonymousHandle, AUTO_HIDE_REPORT_THRESHOLD, moderatePost } from "@shared/moderation";
import { eq } from "drizzle-orm";
import { learningEvents } from "../drizzle/schema.js";
import { createDb, getTopicRow, type Db } from "./db.js";
import { appRouter } from "./routers.js";
import { createCallerFactory, createContext } from "./trpc.js";

const createCaller = createCallerFactory(appRouter);

function callerFor(db: Db, learnerId: string | null = randomUUID()) {
  return { learnerId, caller: createCaller(createContext(db, learnerId)) };
}

const baseInteraction = {
  mode: "feed" as const,
  followUp: null,
  interactiveAssigned: false,
  interactiveCompleted: false,
  helpOpened: false,
  videoCompletionRatio: 1,
  keyPartWatched: true,
  engagementRatio: null,
  activeSeconds: 20,
};

describe("curriculum integrity", () => {
  it("has unique lesson, topic, and Drive video ids", () => {
    for (const key of ["id", "topicId", "driveFileId"] as const) {
      const values = LESSON_SEEDS.map((lesson) => lesson[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it.each(LESSON_SEEDS.map((lesson) => [lesson.id, lesson] as const))("%s is answerable", (_id, lesson) => {
    expect(lesson.safetyWeight).toBeGreaterThanOrEqual(0.5);
    expect(lesson.safetyWeight).toBeLessThanOrEqual(1);
    const questions = [lesson.quiz, lesson.quiz.similarQuestion, lesson.quiz.harderQuestion];
    for (const question of questions) {
      if (question.options) expect(question.options).toContain(question.correctAnswer);
      expect(question.explanation.length).toBeGreaterThan(10);
    }
    if (lesson.quiz.type === "qte") {
      const qte = lesson.quiz.qteConfig!;
      expect(qte.actions.map((a) => a.id)).toContain(qte.targetAction);
      expect(qte.targetAction).toBe(lesson.quiz.correctAnswer);
      expect(qte.timeLimitSeconds).toBeGreaterThanOrEqual(3);
      expect(qte.timeLimitSeconds).toBeLessThanOrEqual(5);
    }
  });

  it("covers every emergency category with ordered steps", () => {
    for (const category of ["collision", "breakdown", "traffic_stop", "bad_weather"] as const) {
      const steps = EMERGENCY_CHECKLIST.filter((item) => item.category === category).map((item) => item.stepNumber);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
    }
  });

  it("accepts alternate spellings for fill-in-the-blank answers", () => {
    const question = LESSON_SEEDS.find((lesson) => lesson.topicId === "passing-bicyclists")!.quiz;
    expect(isAnswerCorrect(question, " 3 ")).toBe(true);
    expect(isAnswerCorrect(question, "Three")).toBe(true);
    expect(isAnswerCorrect(question, "4")).toBe(false);
  });
});

describe("moderation", () => {
  const ok = { title: "Faded crosswalk", body: "The crosswalk paint near the school is almost gone — watch for kids." };

  it("accepts a normal hazard report", () => {
    expect(moderatePost(ok)).toEqual({ ok: true });
  });

  it.each([
    [{ ...ok, body: "Call me at 415-555-0199 about it" }, /phone/],
    [{ ...ok, body: "email me at kid@example.com please" }, /email/],
    [{ ...ok, body: "Silver sedan 7ABC123 keeps speeding here" }, /license plates/],
    [{ ...ok, body: "See https://example.com for the map" }, /Links/],
    [{ ...ok, body: "This shitty intersection is the worst" }, /respectful/],
    [{ ...ok, body: "Great street racing spot after midnight" }, /unsafe/],
    [{ ...ok, title: "x" }, /title/],
  ])("rejects %j", (post, reason) => {
    const result = moderatePost(post);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(reason);
  });

  it("does not flag street names that contain blocked substrings", () => {
    expect(moderatePost({ ...ok, location: "Dickson St — fire retardant drop zone" })).toEqual({ ok: true });
  });

  it("derives anonymous handles from the device id", () => {
    expect(anonymousHandle("6f1c2a9e-0000-4000-8000-00000000beef")).toBe("Driver BEEF");
  });
});

describe("tRPC routers", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createDb(":memory:");
  });

  it("serves the curriculum without a learner id", async () => {
    const { caller } = callerFor(db, null);
    expect(await caller.curriculum.list()).toHaveLength(LESSON_SEEDS.length);
    await expect(caller.progress.summary()).rejects.toThrow(/learner/i);
  });

  it("rejects malformed learner ids", async () => {
    const { caller } = callerFor(db, "not-a-uuid");
    await expect(caller.progress.summary()).rejects.toThrow(/learner/i);
  });

  it("starts a new learner at zero readiness with safety-critical lessons first", async () => {
    const { caller } = callerFor(db);
    const progress = await caller.progress.summary();
    expect(progress.readiness).toMatchObject({ scoreOutOf100: 0, status: "Needs Foundation" });
    expect(progress.review.items).toHaveLength(0);
    const first = LESSON_SEEDS.find((lesson) => lesson.id === progress.feedOrder[0])!;
    expect(first.safetyWeight).toBe(0.95);
  });

  it("scores a correct first answer with the spec formulas and persists the learner model", async () => {
    const { caller, learnerId } = callerFor(db);
    const lesson = LESSON_SEEDS.find((l) => l.quiz.type === "multiple_choice")!;

    const outcome = await caller.learning.recordInteraction({ ...baseInteraction, lessonId: lesson.id, firstAnswerCorrect: true });

    // A = 0.675, W = 0.40/0.50 (no retry or activity assigned), N = 1, T = 1
    expect(outcome.result).toMatchObject({ accuracy: 0.675, work: 0.8, attention: 1, timeQuality: 1 });
    expect(outcome.result.sessionMastery).toBeCloseTo(0.55 * 0.675 + 0.15 * 0.8 + 0.2 + 0.1, 4);
    expect(outcome.result.smoothedMastery).toBe(outcome.result.sessionMastery);
    expect(outcome.priorMastery).toBeNull();

    const row = (await getTopicRow(db, learnerId!, lesson.topicId))!;
    expect(row).toMatchObject({ attemptCount: 1, correctCount: 1, reviewAttempts: 1, reviewCorrect: 1, knowledgeCheckPassed: true });
    expect(outcome.readiness.scoreOutOf100).toBe(Math.round((row.mastery / LESSON_SEEDS.length) * 100));
  });

  it("smooths the second session and uses earlier answers as C3 history", async () => {
    const { caller } = callerFor(db);
    const lessonId = LESSON_SEEDS[0].id;
    const first = await caller.learning.recordInteraction({ ...baseInteraction, lessonId, firstAnswerCorrect: true });
    const second = await caller.learning.recordInteraction({ ...baseInteraction, lessonId, firstAnswerCorrect: true });

    expect(second.result.accuracy).toBe(0.75); // C3 = 1 from the first session
    expect(second.priorMastery).toBe(first.result.smoothedMastery);
    expect(second.result.smoothedMastery).toBeCloseTo(0.7 * first.result.smoothedMastery + 0.3 * second.result.sessionMastery, 3);
  });

  it("credits the correction path (wrong → similar question right)", async () => {
    const { caller } = callerFor(db);
    const outcome = await caller.learning.recordInteraction({
      ...baseInteraction,
      lessonId: LESSON_SEEDS[0].id,
      firstAnswerCorrect: false,
      followUp: { kind: "correction", correct: true },
      helpOpened: true,
    });
    expect(outcome.result.accuracy).toBe(0.325);
    expect(outcome.result.work).toBe(1); // Q + R + H over 0.80 applicable weight
  });

  it("treats a passed test-out as first answer plus confirmation", async () => {
    const { caller } = callerFor(db);
    const outcome = await caller.learning.recordInteraction({
      ...baseInteraction,
      lessonId: LESSON_SEEDS[0].id,
      mode: "test_out",
      firstAnswerCorrect: true,
      videoCompletionRatio: 0.1,
      keyPartWatched: false,
    });
    expect(outcome.result.accuracy).toBe(0.925);
  });

  it("carries earlier video exposure into question-first review sessions", async () => {
    const { caller } = callerFor(db);
    const lessonId = LESSON_SEEDS[0].id;
    await caller.learning.recordInteraction({ ...baseInteraction, lessonId, firstAnswerCorrect: true });
    const review = await caller.learning.recordInteraction({
      ...baseInteraction,
      lessonId,
      mode: "review",
      firstAnswerCorrect: true,
      videoCompletionRatio: 0,
      keyPartWatched: false,
      engagementRatio: 1,
    });
    expect(review.result.attention).toBe(1);
  });

  it("queues 'review later' topics and clears them once practiced", async () => {
    const { caller } = callerFor(db);
    const lesson = LESSON_SEEDS[3];
    await caller.learning.reviewLater({ lessonId: lesson.id });

    let progress = await caller.progress.summary();
    expect(progress.review.items).toEqual([expect.objectContaining({ lessonId: lesson.id, reason: "review_later" })]);
    expect(progress.topics.find((t) => t.lessonId === lesson.id)).toMatchObject({ skipCount: 1, reviewLater: true });

    await caller.learning.recordInteraction({ ...baseInteraction, lessonId: lesson.id, mode: "review", firstAnswerCorrect: true });
    progress = await caller.progress.summary();
    expect(progress.topics.find((t) => t.lessonId === lesson.id)?.reviewLater).toBe(false);
    expect(progress.review.reviewedToday).toBe(1);
    expect(progress.review.items.map((i) => i.lessonId)).not.toContain(lesson.id);
  });

  it("requires a correct answer before a safety-critical topic counts as complete", async () => {
    const { caller } = callerFor(db);
    const lesson = LESSON_SEEDS.find((l) => l.requiresKnowledgeCheck)!;
    for (let i = 0; i < 6; i++) {
      await caller.learning.recordInteraction({
        ...baseInteraction,
        lessonId: lesson.id,
        firstAnswerCorrect: false,
        engagementRatio: 1,
        interactiveAssigned: true,
        interactiveCompleted: true,
        helpOpened: true,
        followUp: { kind: "correction", correct: false },
      });
    }
    const topic = (await caller.progress.summary()).topics.find((t) => t.lessonId === lesson.id)!;
    expect(topic.complete).toBe(false);
  });

  it("rejects unknown lessons and out-of-range inputs", async () => {
    const { caller } = callerFor(db);
    await expect(
      caller.learning.recordInteraction({ ...baseInteraction, lessonId: "lesson-99", firstAnswerCorrect: true }),
    ).rejects.toThrow(/Unknown lesson/);
    await expect(
      caller.learning.recordInteraction({ ...baseInteraction, lessonId: LESSON_SEEDS[0].id, firstAnswerCorrect: true, videoCompletionRatio: 3 }),
    ).rejects.toThrow();
  });

  describe("community board", () => {
    it("lists seeded posts, newest or top first", async () => {
      const { caller } = callerFor(db);
      const top = await caller.community.list({ sort: "top" });
      expect(top.length).toBeGreaterThan(0);
      expect(top.map((p) => p.upvotes)).toEqual([...top.map((p) => p.upvotes)].sort((a, b) => b - a));
      expect(await caller.community.list({ kind: "test_tip", sort: "new" })).toSatisfy((posts: typeof top) =>
        posts.every((p) => p.kind === "test_tip"),
      );
    });

    it("creates moderated posts under an anonymous handle", async () => {
      const { caller, learnerId } = callerFor(db);
      await caller.community.create({ kind: "hazard", title: "Sun glare at sunset", body: "Westbound glare makes the signal hard to see." });
      const mine = (await caller.community.list({ sort: "new" }))[0];
      expect(mine).toMatchObject({ title: "Sun glare at sunset", isMine: true, authorLabel: anonymousHandle(learnerId!) });
      expect(mine).not.toHaveProperty("authorId");

      await expect(
        caller.community.create({ kind: "hazard", title: "Call me", body: "Text 415-555-0199 for details" }),
      ).rejects.toThrow(/phone/);
    });

    it("rate-limits posting", async () => {
      const { caller } = callerFor(db);
      const post = { kind: "test_tip" as const, title: "Practice tip", body: "Practice parallel parking with cones." };
      for (let i = 0; i < 5; i++) await caller.community.create(post);
      await expect(caller.community.create(post)).rejects.toThrow(/try again later/);
    });

    it("toggles one upvote per learner", async () => {
      const { caller } = callerFor(db);
      const [post] = await caller.community.list({ sort: "top" });
      expect(await caller.community.toggleUpvote({ postId: post.id })).toEqual({ upvotes: post.upvotes + 1, hasVoted: true });
      expect(await caller.community.toggleUpvote({ postId: post.id })).toEqual({ upvotes: post.upvotes, hasVoted: false });
    });

    it(`hides a post after ${AUTO_HIDE_REPORT_THRESHOLD} reports from different learners`, async () => {
      const [post] = await callerFor(db).caller.community.list({ sort: "top" });
      for (let i = 0; i < AUTO_HIDE_REPORT_THRESHOLD; i++) {
        const { caller } = callerFor(db);
        const result = await caller.community.report({ postId: post.id, reason: "inaccurate" });
        expect(result.hidden).toBe(i === AUTO_HIDE_REPORT_THRESHOLD - 1);
      }
      const { caller } = callerFor(db);
      expect((await caller.community.list({ sort: "top" })).map((p) => p.id)).not.toContain(post.id);
    });

    it("ignores duplicate reports from the same learner", async () => {
      const { caller } = callerFor(db);
      const [post] = await caller.community.list({ sort: "top" });
      await caller.community.report({ postId: post.id, reason: "spam" });
      expect(await caller.community.report({ postId: post.id, reason: "spam" })).toEqual({ hidden: false, alreadyReported: true });
    });
  });

  describe("privacy", () => {
    it("skips the detailed event log when analytics are off, but keeps core progress", async () => {
      const { caller, learnerId } = callerFor(db);
      await caller.privacy.setAnalyticsOptOut({ optOut: true });
      expect(await caller.privacy.settings()).toEqual({ analyticsOptOut: true });
      await caller.learning.recordInteraction({ ...baseInteraction, lessonId: LESSON_SEEDS[0].id, firstAnswerCorrect: true });

      const events = await db.select().from(learningEvents).where(eq(learningEvents.learnerId, learnerId!)).all();
      expect(events).toHaveLength(0);
      expect((await getTopicRow(db, learnerId!, LESSON_SEEDS[0].topicId))?.attemptCount).toBe(1);
    });

    it("deletes all of a learner's data and undoes their votes", async () => {
      const { caller, learnerId } = callerFor(db);
      const [post] = await caller.community.list({ sort: "top" });
      await caller.community.toggleUpvote({ postId: post.id });
      await caller.community.create({ kind: "hazard", title: "Pothole", body: "Big pothole in the right lane." });
      await caller.learning.recordInteraction({ ...baseInteraction, lessonId: LESSON_SEEDS[0].id, firstAnswerCorrect: true });

      await caller.privacy.deleteMyData();

      expect(await getTopicRow(db, learnerId!, LESSON_SEEDS[0].topicId)).toBeUndefined();
      const others = await callerFor(db).caller.community.list({ sort: "new" });
      expect(others.map((p) => p.title)).not.toContain("Pothole");
      expect(others.find((p) => p.id === post.id)?.upvotes).toBe(post.upvotes);
    });
  });
});
