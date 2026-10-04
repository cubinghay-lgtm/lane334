/**
 * Maps one card interaction onto the four component formulas. Shared so the
 * server's authoritative score and the client's offline estimate always agree.
 */
import { computeHistoricalReviewRate, computeMastery, type MasteryResult } from "./algorithm";
import type { LessonItem } from "./curriculum";

export interface InteractionInput {
  lessonId: string;
  mode: "feed" | "review" | "test_out";
  firstAnswerCorrect: boolean;
  /** Correction after a miss, or the harder confirmation after a correct answer. */
  followUp: { kind: "correction" | "confirmation"; correct: boolean } | null;
  interactiveAssigned: boolean;
  interactiveCompleted: boolean;
  helpOpened: boolean;
  videoCompletionRatio: number;
  keyPartWatched: boolean;
  engagementRatio: number | null;
  activeSeconds: number;
}

export interface TopicHistory {
  mastery: number;
  attemptCount: number;
  reviewCorrect: number;
  reviewAttempts: number;
  videoCompletion: number;
  keyWatched: boolean;
}

/** Healthy answer time b for whichever question the learner answered first. */
export function benchmarkSeconds(lesson: LessonItem, mode: InteractionInput["mode"]): number {
  if (mode === "test_out") return lesson.quiz.harderQuestion.type === "fill_blank" ? 20 : 25;
  if (lesson.quiz.type === "qte" && lesson.quiz.qteConfig) return lesson.quiz.qteConfig.timeLimitSeconds / 2;
  return lesson.quiz.expectedSeconds ?? 25;
}

export function scoreInteraction(
  lesson: LessonItem,
  input: InteractionInput,
  history?: TopicHistory,
): { result: MasteryResult; followUpCorrect: boolean | undefined; retryCompleted: boolean; priorMastery: number | null } {
  const hasHistory = (history?.attemptCount ?? 0) > 0;

  // A passed test-out answers the harder confirmation question directly, so it
  // stands in for both the first answer and the confirmation follow-up.
  const followUpCorrect =
    input.mode === "test_out" && input.firstAnswerCorrect ? true : input.followUp ? input.followUp.correct : undefined;
  const retryAssigned = !input.firstAnswerCorrect;
  const retryCompleted = retryAssigned && input.followUp?.kind === "correction";

  // Review sessions are question-first: earlier exposure to the clip still counts as attention.
  const carryOver = input.mode === "review" && history;
  const videoCompletionRatio = carryOver
    ? Math.max(input.videoCompletionRatio, history.videoCompletion)
    : input.videoCompletionRatio;
  const keyPartWatched = input.keyPartWatched || Boolean(carryOver && history.keyWatched);

  const result = computeMastery({
    accuracyInputs: {
      c1FirstAnswerCorrect: input.firstAnswerCorrect,
      c2CorrectionAnswerCorrect: followUpCorrect,
      c3HistoricalReviewRate: computeHistoricalReviewRate(history?.reviewCorrect ?? 0, history?.reviewAttempts ?? 0),
    },
    workInputs: {
      qQuestionSubmitted: true,
      rRetryCompleted: retryCompleted,
      iInteractiveCompleted: input.interactiveAssigned && input.interactiveCompleted,
      hHelpOpened: input.helpOpened,
      hasRetryItem: retryAssigned,
      hasInteractiveItem: input.interactiveAssigned,
    },
    attentionInputs: {
      videoCompletionRatio,
      keyTimestampWatched: keyPartWatched,
      engagementActionsRatio: input.engagementRatio ?? undefined,
    },
    timeInputs: { activeSeconds: input.activeSeconds, expectedBenchmarkSeconds: benchmarkSeconds(lesson, input.mode) },
    priorMastery: hasHistory ? history!.mastery : undefined,
  });

  return { result, followUpCorrect, retryCompleted, priorMastery: hasHistory ? history!.mastery : null };
}
