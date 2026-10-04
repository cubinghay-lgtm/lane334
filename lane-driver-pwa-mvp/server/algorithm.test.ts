import { describe, expect, it } from "vitest";
import {
  calculateDriverReadinessScore,
  combineMastery,
  computeAccuracyScore,
  computeAttentionScore,
  computeHistoricalReviewRate,
  computeMastery,
  computeReviewPriority,
  computeTimeQualityScore,
  computeWorkScore,
  masteryBand,
  rankFeed,
  selectDailyReviewQueue,
  smoothMastery,
  type TopicState,
} from "@shared/algorithm";

describe("Accuracy score A = 0.60*C1 + 0.25*C2 + 0.15*C3", () => {
  it("correct immediately, no history → 0.675", () => {
    expect(computeAccuracyScore({ c1FirstAnswerCorrect: true })).toBe(0.675);
  });

  it("wrong first, correct after correction, no history → 0.325", () => {
    expect(computeAccuracyScore({ c1FirstAnswerCorrect: false, c2CorrectionAnswerCorrect: true })).toBe(0.325);
  });

  it("correct first and correct later → 0.75", () => {
    expect(computeAccuracyScore({ c1FirstAnswerCorrect: true, c3HistoricalReviewRate: 1 })).toBe(0.75);
  });

  it("wrong, no correction, no history → 0.075", () => {
    expect(computeAccuracyScore({ c1FirstAnswerCorrect: false })).toBe(0.075);
  });

  it("caps at 1.0 with a perfect record", () => {
    expect(
      computeAccuracyScore({ c1FirstAnswerCorrect: true, c2CorrectionAnswerCorrect: true, c3HistoricalReviewRate: 1 }),
    ).toBe(1);
  });
});

describe("Work score W = 0.40*Q + 0.30*R + 0.20*I + 0.10*H", () => {
  it("spec example: answered, corrected, skipped activity, opened help → 0.80", () => {
    expect(
      computeWorkScore({ qQuestionSubmitted: true, rRetryCompleted: true, iInteractiveCompleted: false, hHelpOpened: true }),
    ).toBe(0.8);
  });

  it("renormalizes when no interactive activity was assigned", () => {
    // 0.40 + 0.30 + 0.10 over applicable weights 0.80
    expect(
      computeWorkScore({
        qQuestionSubmitted: true,
        rRetryCompleted: true,
        iInteractiveCompleted: false,
        hHelpOpened: true,
        hasInteractiveItem: false,
      }),
    ).toBe(1);
  });

  it("a correct-first answer with nothing else assigned scores 0.40 / 0.50", () => {
    expect(
      computeWorkScore({
        qQuestionSubmitted: true,
        rRetryCompleted: false,
        iInteractiveCompleted: false,
        hHelpOpened: false,
        hasRetryItem: false,
        hasInteractiveItem: false,
      }),
    ).toBe(0.8);
  });
});

describe("Attention score N = 0.50*V + 0.30*K + 0.20*E", () => {
  it("spec example: full video, key segment, half the challenge → 0.90", () => {
    expect(
      computeAttentionScore({ videoCompletionRatio: 1, keyTimestampWatched: true, engagementActionsRatio: 0.5 }),
    ).toBe(0.9);
  });

  it("clamps video completion above 1", () => {
    expect(
      computeAttentionScore({ videoCompletionRatio: 1.4, keyTimestampWatched: true, engagementActionsRatio: 1 }),
    ).toBe(1);
  });
});

describe("Time-quality score T", () => {
  it.each([
    [18, 1.0], // r = 0.72
    [4, 0.45], // r = 0.16
    [12.5, 1.0], // r = 0.50 boundary
    [50, 1.0], // r = 2.00 boundary
    [10, 0.7], // r = 0.40
    [75, 0.75], // r = 3.00
    [100, 0.75], // r = 4.00 boundary
    [150, 0.55], // r = 6.00
    [0, 0.45],
  ])("%ss of a 25s benchmark → %s", (seconds, expected) => {
    expect(computeTimeQualityScore({ activeSeconds: seconds })).toBe(expected);
  });

  it("respects a custom benchmark", () => {
    expect(computeTimeQualityScore({ activeSeconds: 2, expectedBenchmarkSeconds: 2 })).toBe(1);
  });
});

describe("Mastery M = 0.55*A + 0.15*W + 0.20*N + 0.10*T", () => {
  // The spec's worked examples print M = 0.69125 / 0.61875 / 0.20225, but the
  // formula applied to their own component values gives the numbers below.
  it("Example A (already knows the topic) → 0.73125, developing", () => {
    expect(combineMastery(0.675, 0.4, 1, 1)).toBe(0.7313);
    expect(masteryBand(0.73125).band).toBe("developing");
  });

  it("Example B (watched but missed the rule) → 0.59875, needs support", () => {
    expect(combineMastery(0.325, 0.8, 1, 1)).toBe(0.5988);
    expect(masteryBand(0.59875).band).toBe("needs_support");
  });

  it("Example C (skipped and guessed) → 0.22625, instruction needed", () => {
    expect(combineMastery(0.075, 0.4, 0.4, 0.45)).toBe(0.2263);
    expect(masteryBand(0.22625).band).toBe("instruction_needed");
  });

  it("computeMastery reproduces Example A from raw inputs", () => {
    const result = computeMastery({
      accuracyInputs: { c1FirstAnswerCorrect: true },
      workInputs: { qQuestionSubmitted: true, rRetryCompleted: false, iInteractiveCompleted: false, hHelpOpened: false },
      attentionInputs: { videoCompletionRatio: 1, keyTimestampWatched: true, engagementActionsRatio: 1 },
      timeInputs: { activeSeconds: 20 },
    });
    expect(result).toMatchObject({
      accuracy: 0.675,
      work: 0.4,
      attention: 1,
      timeQuality: 1,
      sessionMastery: 0.7313,
      smoothedMastery: 0.7313,
      band: "developing",
      suggestedAction: "reinforce",
    });
  });

  it("weights sum to 1 so M stays within [0, 1]", () => {
    expect(combineMastery(1, 1, 1, 1)).toBe(1);
    expect(combineMastery(0, 0, 0, 0)).toBe(0);
  });

  it("band thresholds", () => {
    expect(masteryBand(0.8).band).toBe("strong_mastery");
    expect(masteryBand(0.79).band).toBe("developing");
    expect(masteryBand(0.6).band).toBe("developing");
    expect(masteryBand(0.4).band).toBe("needs_support");
    expect(masteryBand(0.39).band).toBe("instruction_needed");
  });
});

describe("Self-learning smoothing new = 0.70*old + 0.30*session", () => {
  it("dampens a single lucky or bad session", () => {
    expect(smoothMastery(0.4, 1)).toBe(0.58);
    expect(smoothMastery(0.9, 0.2)).toBe(0.69);
  });

  it("uses the session alone when there is no prior", () => {
    expect(smoothMastery(undefined, 0.62)).toBe(0.62);
  });

  it("feeds through computeMastery", () => {
    const result = computeMastery({
      accuracyInputs: { c1FirstAnswerCorrect: false },
      workInputs: { qQuestionSubmitted: true, rRetryCompleted: false, iInteractiveCompleted: false, hHelpOpened: false },
      attentionInputs: { videoCompletionRatio: 0.2, keyTimestampWatched: false, engagementActionsRatio: 0 },
      timeInputs: { activeSeconds: 4 },
      priorMastery: 0.8,
    });
    expect(result.smoothedMastery).toBeCloseTo(0.7 * 0.8 + 0.3 * result.sessionMastery, 3);
  });
});

describe("Historical review rate C3", () => {
  it("defaults to 0.5 without history", () => {
    expect(computeHistoricalReviewRate(0, 0)).toBe(0.5);
  });
  it("is the share of correct review evidence", () => {
    expect(computeHistoricalReviewRate(3, 4)).toBe(0.75);
  });
});

describe("Review priority P", () => {
  // The spec rounds these to ≈0.54 and ≈0.27; the formula gives 0.5202 and 0.3164.
  it("Topic 1: weak, recent, skipped once, max safety", () => {
    expect(
      computeReviewPriority({ currentMastery: 0.35, daysSinceLastPractice: 1, skipCount: 1, safetyWeight: 1 }),
    ).toBe(0.5202);
  });

  it("Topic 2: strong, nearly a week old", () => {
    expect(
      computeReviewPriority({ currentMastery: 0.85, daysSinceLastPractice: 6, skipCount: 0, safetyWeight: 0.7 }),
    ).toBe(0.3164);
  });

  it("the weak safety-critical topic outranks the strong one", () => {
    const weak = computeReviewPriority({ currentMastery: 0.35, daysSinceLastPractice: 1, skipCount: 1, safetyWeight: 1 });
    const strong = computeReviewPriority({ currentMastery: 0.85, daysSinceLastPractice: 6, skipCount: 0, safetyWeight: 0.7 });
    expect(weak).toBeGreaterThan(strong);
  });

  it("caps days at 7 and skips at 3, clamps safety to [0.5, 1]", () => {
    expect(computeReviewPriority({ currentMastery: 0, daysSinceLastPractice: 30, skipCount: 9, safetyWeight: 2 })).toBe(1);
    expect(computeReviewPriority({ currentMastery: 1, daysSinceLastPractice: 0, skipCount: 0, safetyWeight: 0 })).toBe(0.05);
  });
});

describe("Driver readiness meter", () => {
  it("is empty with no topics", () => {
    expect(calculateDriverReadinessScore([]).status).toBe("Needs Foundation");
  });

  it.each([
    [[0.3, 0.4], 35, "Needs Foundation"],
    [[0.5, 0.6], 55, "Developing"],
    [[0.7, 0.76], 73, "Permit Test Ready"],
    [[0.9, 0.85, 0.88], 88, "Highway Confident"],
  ])("%j → %i (%s)", (masteries, score, status) => {
    const result = calculateDriverReadinessScore(masteries);
    expect(result.scoreOutOf100).toBe(score);
    expect(result.status).toBe(status);
  });

  it("requires breadth (80% of topics ≥ 0.70) for Highway Confident", () => {
    const result = calculateDriverReadinessScore([1, 1, 1, 1, 0.3]);
    expect(result.scoreOutOf100).toBe(86);
    expect(result.status).toBe("Highway Confident"); // 4 of 5 = 80%
    const narrow = calculateDriverReadinessScore([1, 1, 1, 1, 1, 1, 1, 0.6, 0.6, 0.6]);
    expect(narrow.scoreOutOf100).toBe(88);
    expect(narrow.status).toBe("Permit Test Ready"); // only 7 of 10 topics ≥ 0.70
  });
});

describe("Daily review queue", () => {
  const now = new Date("2026-10-04T18:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const topic = (overrides: Partial<TopicState> & { topicId: string }): TopicState => ({
    mastery: 0.6,
    lastPracticedAt: daysAgo(3),
    lastReviewedAt: null,
    skipCount: 0,
    safetyWeight: 0.8,
    reviewLater: false,
    lastFirstAnswerCorrect: true,
    attemptCount: 1,
    ...overrides,
  });

  it("mixes review-later, missed, today, yesterday and two-days-ago topics", () => {
    const { items } = selectDailyReviewQueue(
      [
        topic({ topicId: "later", reviewLater: true, skipCount: 1, attemptCount: 0, lastPracticedAt: null, mastery: 0 }),
        topic({ topicId: "missed", lastFirstAnswerCorrect: false, mastery: 0.3 }),
        topic({ topicId: "today", lastPracticedAt: daysAgo(0.1), mastery: 0.9 }),
        topic({ topicId: "yesterday", lastPracticedAt: daysAgo(1), mastery: 0.9 }),
        topic({ topicId: "two-days", lastPracticedAt: daysAgo(2), mastery: 0.9 }),
        topic({ topicId: "old", lastPracticedAt: daysAgo(10), mastery: 0.95 }),
        topic({ topicId: "never", attemptCount: 0, lastPracticedAt: null, mastery: 0 }),
      ],
      now,
      { cap: 5 },
    );

    expect(items.map((i) => i.topicId).sort()).toEqual(["later", "missed", "today", "two-days", "yesterday"]);
    expect(items.find((i) => i.topicId === "later")?.reason).toBe("review_later");
    expect(items.find((i) => i.topicId === "missed")?.reason).toBe("missed_last_time");
  });

  it("never includes unseen, unskipped topics (they belong to the feed)", () => {
    const { items } = selectDailyReviewQueue([topic({ topicId: "never", attemptCount: 0, lastPracticedAt: null })], now);
    expect(items).toHaveLength(0);
  });

  it("enforces the daily cap and excludes topics already reviewed today", () => {
    const topics = Array.from({ length: 10 }, (_, i) => topic({ topicId: `t${i}`, mastery: i / 10 }));
    topics[0] = { ...topics[0], lastReviewedAt: daysAgo(0.05) };
    topics[1] = { ...topics[1], lastReviewedAt: daysAgo(0.05) };

    const result = selectDailyReviewQueue(topics, now, { cap: 4 });
    expect(result.reviewedToday).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.topicId)).not.toContain("t0");
    expect(result.items.map((i) => i.topicId)).toEqual(["t2", "t3"]); // weakest remaining first
  });
});

describe("Feed ranking", () => {
  it("puts unseen safety-critical lessons first and mastered ones last", () => {
    const now = new Date("2026-10-04T18:00:00Z");
    const lessons = [
      { topicId: "mastered", safetyWeight: 0.9 },
      { topicId: "new-low", safetyWeight: 0.5 },
      { topicId: "new-high", safetyWeight: 1 },
    ];
    const state = new Map([["mastered", { mastery: 0.95, lastPracticedAt: now, skipCount: 0 }]]);
    expect(rankFeed(lessons, state, now).map((l) => l.topicId)).toEqual(["new-high", "new-low", "mastered"]);
  });
});
