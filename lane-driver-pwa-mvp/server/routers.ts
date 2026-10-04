import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { EMERGENCY_CHECKLIST, getLessonById, LESSON_SEEDS } from "../shared/curriculum.js";
import { anonymousHandle, moderatePost, POST_LIMITS } from "../shared/moderation.js";
import { hazardPosts } from "../drizzle/schema.js";
import {
  deleteLearnerData,
  ensureLearner,
  listPosts,
  recordSkip,
  reportPost,
  setAnalyticsOptOut,
  toggleUpvote,
} from "./db.js";
import { buildProgress, recordInteraction } from "./learning.js";
import { learnerProcedure, publicProcedure, router } from "./trpc.js";

const ratio = z.number().min(0).max(1);
const lessonId = z.string().max(40);

function requireLesson(id: string) {
  const lesson = getLessonById(id);
  if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: `Unknown lesson ${id}` });
  return lesson;
}

const POSTS_PER_HOUR = 5;
const recentPosts = new Map<string, number[]>();

function checkPostRateLimit(learnerId: string, now = Date.now()) {
  const windowStart = now - 60 * 60 * 1000;
  const recent = (recentPosts.get(learnerId) ?? []).filter((t) => t > windowStart);
  if (recent.length >= POSTS_PER_HOUR) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You've shared a lot this hour — try again later." });
  }
  recentPosts.set(learnerId, [...recent, now]);
}

export const appRouter = router({
  curriculum: router({
    list: publicProcedure.query(() => LESSON_SEEDS),
    emergencyChecklist: publicProcedure.query(() => EMERGENCY_CHECKLIST),
  }),

  progress: router({
    summary: learnerProcedure
      .input(z.object({ tzOffsetMinutes: z.number().int().min(-840).max(840).default(0) }).optional())
      .query(({ ctx, input }) => buildProgress(ctx.db, ctx.learnerId, new Date(), input?.tzOffsetMinutes ?? 0)),
  }),

  learning: router({
    recordInteraction: learnerProcedure
      .input(
        z.object({
          lessonId,
          mode: z.enum(["feed", "review", "test_out"]),
          firstAnswerCorrect: z.boolean(),
          followUp: z.object({ kind: z.enum(["correction", "confirmation"]), correct: z.boolean() }).nullable(),
          interactiveAssigned: z.boolean(),
          interactiveCompleted: z.boolean(),
          helpOpened: z.boolean(),
          videoCompletionRatio: ratio,
          keyPartWatched: z.boolean(),
          engagementRatio: ratio.nullable(),
          activeSeconds: z.number().min(0).max(60 * 60),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const lesson = requireLesson(input.lessonId);
        const outcome = await recordInteraction(ctx.db, ctx.learnerId, lesson, input);
        const progress = await buildProgress(ctx.db, ctx.learnerId);
        return { ...outcome, readiness: progress.readiness };
      }),

    reviewLater: learnerProcedure.input(z.object({ lessonId })).mutation(async ({ ctx, input }) => {
      await recordSkip(ctx.db, ctx.learnerId, requireLesson(input.lessonId).topicId, true);
      return { queued: true };
    }),

    skip: learnerProcedure.input(z.object({ lessonId })).mutation(async ({ ctx, input }) => {
      await recordSkip(ctx.db, ctx.learnerId, requireLesson(input.lessonId).topicId, false);
      return { skipped: true };
    }),
  }),

  community: router({
    list: publicProcedure
      .input(z.object({ kind: z.enum(["hazard", "test_tip"]).optional(), sort: z.enum(["top", "new"]).default("top") }))
      .query(({ ctx, input }) => listPosts(ctx.db, ctx.learnerId, input)),

    create: learnerProcedure
      .input(
        z.object({
          kind: z.enum(["hazard", "test_tip"]),
          title: z.string().max(POST_LIMITS.title.max * 2),
          body: z.string().max(POST_LIMITS.body.max * 2),
          location: z.string().max(POST_LIMITS.location.max * 2).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const verdict = moderatePost(input);
        if (!verdict.ok) throw new TRPCError({ code: "BAD_REQUEST", message: verdict.reason });
        checkPostRateLimit(ctx.learnerId);
        const location = input.location?.trim() || null;
        return (await ctx.db
          .insert(hazardPosts)
          .values({
            authorId: ctx.learnerId,
            authorLabel: anonymousHandle(ctx.learnerId),
            kind: input.kind,
            title: input.title.trim(),
            body: input.body.trim(),
            location,
          })
          .returning({ id: hazardPosts.id }))[0];
      }),

    toggleUpvote: learnerProcedure.input(z.object({ postId: z.number().int() })).mutation(async ({ ctx, input }) => {
      const result = await toggleUpvote(ctx.db, ctx.learnerId, input.postId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      return result;
    }),

    report: learnerProcedure
      .input(z.object({ postId: z.number().int(), reason: z.enum(["unsafe", "inaccurate", "personal_info", "offensive", "spam"]) }))
      .mutation(async ({ ctx, input }) => {
        const result = await reportPost(ctx.db, ctx.learnerId, input.postId, input.reason);
        if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
        return result;
      }),
  }),

  privacy: router({
    settings: learnerProcedure.query(async ({ ctx }) => {
      const learner = await ensureLearner(ctx.db, ctx.learnerId);
      return { analyticsOptOut: learner.analyticsOptOut };
    }),

    setAnalyticsOptOut: learnerProcedure.input(z.object({ optOut: z.boolean() })).mutation(async ({ ctx, input }) => {
      await setAnalyticsOptOut(ctx.db, ctx.learnerId, input.optOut);
      return { analyticsOptOut: input.optOut };
    }),

    deleteMyData: learnerProcedure.mutation(async ({ ctx }) => {
      await deleteLearnerData(ctx.db, ctx.learnerId);
      return { deleted: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
