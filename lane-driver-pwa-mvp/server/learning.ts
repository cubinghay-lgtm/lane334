import {
  calculateDriverReadinessScore,
  computeHistoricalReviewRate,
  computeReviewPriority,
  daysSince,
  rankFeed,
  selectDailyReviewQueue,
  type TopicState,
} from "../shared/algorithm";
import { LESSON_SEEDS, type LessonItem } from "../shared/curriculum";
import { scoreInteraction, type InteractionInput } from "../shared/scoring";
import type { TopicMasteryRow } from "../drizzle/schema";
import { getTopicRow, getTopicRows, learnerAnalyticsEnabled, logLearningEvent, upsertTopicRow, type Db } from "./db";

/** Safety-critical topics only count as complete once the learner has answered correctly. */
export function isTopicComplete(lesson: LessonItem, row: TopicMasteryRow | undefined): boolean {
  if (!row || row.attemptCount === 0) return false;
  return row.mastery >= 0.6 && (!lesson.requiresKnowledgeCheck || row.knowledgeCheckPassed);
}

export function recordInteraction(db: Db, learnerId: string, lesson: LessonItem, input: InteractionInput, now = new Date()) {
  const row = getTopicRow(db, learnerId, lesson.topicId);
  const { result, followUpCorrect, retryCompleted, priorMastery } = scoreInteraction(lesson, input, row);

  // Every first answer becomes review evidence (C3) for later sessions; a
  // confirmation question adds one more data point ("increase the later-review score").
  const confirmation = input.followUp?.kind === "confirmation" ? input.followUp : null;
  const reviewAttempts = (row?.reviewAttempts ?? 0) + 1 + (confirmation ? 1 : 0);
  const reviewCorrect =
    (row?.reviewCorrect ?? 0) + (input.firstAnswerCorrect ? 1 : 0) + (confirmation?.correct ? 1 : 0);

  const attemptCount = (row?.attemptCount ?? 0) + 1;
  const skipCount = row?.skipCount ?? 0;
  const priority = computeReviewPriority({
    currentMastery: result.smoothedMastery,
    daysSinceLastPractice: 0,
    skipCount,
    safetyWeight: lesson.safetyWeight,
  });

  upsertTopicRow(db, learnerId, lesson.topicId, {
    mastery: result.smoothedMastery,
    sessionMastery: result.sessionMastery,
    attemptCount,
    correctCount: (row?.correctCount ?? 0) + (input.firstAnswerCorrect ? 1 : 0),
    reviewAttempts,
    reviewCorrect,
    knowledgeCheckPassed: Boolean(row?.knowledgeCheckPassed) || input.firstAnswerCorrect || followUpCorrect === true,
    lastFirstAnswerCorrect: input.firstAnswerCorrect,
    videoCompletion: Math.max(row?.videoCompletion ?? 0, input.videoCompletionRatio),
    keyWatched: Boolean(row?.keyWatched) || input.keyPartWatched,
    averageActiveSeconds: ((row?.averageActiveSeconds ?? 0) * (attemptCount - 1) + input.activeSeconds) / attemptCount,
    helpCount: (row?.helpCount ?? 0) + (input.helpOpened ? 1 : 0),
    retryCount: (row?.retryCount ?? 0) + (retryCompleted ? 1 : 0),
    reviewLater: false,
    reviewPriority: priority,
    lastPracticedAt: now,
    lastReviewedAt: input.mode === "review" ? now : (row?.lastReviewedAt ?? null),
  });

  if (learnerAnalyticsEnabled(db, learnerId)) {
    logLearningEvent(db, {
      learnerId,
      lessonId: lesson.id,
      topicId: lesson.topicId,
      mode: input.mode,
      firstAnswerCorrect: input.firstAnswerCorrect,
      followUpCorrect: followUpCorrect ?? null,
      accuracy: result.accuracy,
      work: result.work,
      attention: result.attention,
      timeQuality: result.timeQuality,
      sessionMastery: result.sessionMastery,
      smoothedMastery: result.smoothedMastery,
      band: result.band,
      activeSeconds: input.activeSeconds,
      videoCompletion: input.videoCompletionRatio,
    });
  }

  return { result, priority, priorMastery };
}

export function buildProgress(db: Db, learnerId: string, now = new Date(), tzOffsetMinutes = 0) {
  const rows = new Map(getTopicRows(db, learnerId).map((row) => [row.topicId, row]));

  const topics = LESSON_SEEDS.map((lesson) => {
    const row = rows.get(lesson.topicId);
    return {
      lessonId: lesson.id,
      topicId: lesson.topicId,
      title: lesson.title,
      category: lesson.category,
      safetyWeight: lesson.safetyWeight,
      requiresKnowledgeCheck: lesson.requiresKnowledgeCheck,
      mastery: row?.mastery ?? 0,
      attemptCount: row?.attemptCount ?? 0,
      reviewCorrect: row?.reviewCorrect ?? 0,
      reviewAttempts: row?.reviewAttempts ?? 0,
      historicalReviewRate: computeHistoricalReviewRate(row?.reviewCorrect ?? 0, row?.reviewAttempts ?? 0),
      videoCompletion: row?.videoCompletion ?? 0,
      keyWatched: row?.keyWatched ?? false,
      skipCount: row?.skipCount ?? 0,
      reviewLater: row?.reviewLater ?? false,
      lastPracticedAt: row?.lastPracticedAt ?? null,
      complete: isTopicComplete(lesson, row),
      priority: computeReviewPriority({
        currentMastery: row?.mastery ?? 0,
        daysSinceLastPractice: daysSince(row?.lastPracticedAt ?? null, now),
        skipCount: row?.skipCount ?? 0,
        safetyWeight: lesson.safetyWeight,
      }),
    };
  });

  const states: TopicState[] = LESSON_SEEDS.map((lesson) => {
    const row = rows.get(lesson.topicId);
    return {
      topicId: lesson.topicId,
      mastery: row?.mastery ?? 0,
      lastPracticedAt: row?.lastPracticedAt ?? null,
      lastReviewedAt: row?.lastReviewedAt ?? null,
      skipCount: row?.skipCount ?? 0,
      safetyWeight: lesson.safetyWeight,
      reviewLater: row?.reviewLater ?? false,
      lastFirstAnswerCorrect: row?.lastFirstAnswerCorrect ?? null,
      attemptCount: row?.attemptCount ?? 0,
    };
  });

  const lessonByTopic = new Map(LESSON_SEEDS.map((lesson) => [lesson.topicId, lesson.id]));
  const queue = selectDailyReviewQueue(states, now, { tzOffsetMinutes });

  return {
    topics,
    readiness: calculateDriverReadinessScore(topics.map((t) => t.mastery)),
    review: {
      ...queue,
      items: queue.items.map((item) => ({ ...item, lessonId: lessonByTopic.get(item.topicId)! })),
    },
    feedOrder: rankFeed(LESSON_SEEDS, new Map(states.map((s) => [s.topicId, s])), now).map((lesson) => lesson.id),
  };
}
