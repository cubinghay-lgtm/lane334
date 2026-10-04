/**
 * Lane Self-Learning Algorithm Engine
 *
 * Implements the 4 normalized component scores:
 * 1. Accuracy Score (A)
 * 2. Work Score (W)
 * 3. Attention Score (N)
 * 4. Time-Quality Score (T)
 *
 * Combined into Session Mastery (M) and Spaced Review Priority (P).
 *
 * Every function here is pure and shared by the server (authoritative scoring)
 * and the client (instant optimistic feedback), so the formulas stay visible
 * and explainable in exactly one place.
 */

export const WEIGHTS = {
  accuracy: { c1: 0.6, c2: 0.25, c3: 0.15 },
  work: { q: 0.4, r: 0.3, i: 0.2, h: 0.1 },
  attention: { v: 0.5, k: 0.3, e: 0.2 },
  mastery: { a: 0.55, w: 0.15, n: 0.2, t: 0.1 },
  smoothing: { prior: 0.7, session: 0.3 },
  priority: { gap: 0.5, days: 0.2, skips: 0.2, safety: 0.1 },
} as const;

export const DEFAULT_BENCHMARK_SECONDS = 25;
export const DEFAULT_HISTORICAL_REVIEW_RATE = 0.5;

export interface AccuracyInputs {
  c1FirstAnswerCorrect: boolean;
  /**
   * Result of the follow-up question answered after feedback: the similar
   * correction question after a miss, or the harder confirmation question after
   * a correct answer. Undefined when no follow-up was answered, which scores 0
   * (spec: "Correct immediately, no history: A = 0.60*1 + 0.25*0 + 0.15*0.5").
   */
  c2CorrectionAnswerCorrect?: boolean;
  c3HistoricalReviewRate?: number; // 0.0 to 1.0 (default 0.5)
}

export interface WorkInputs {
  qQuestionSubmitted: boolean;
  rRetryCompleted: boolean;
  iInteractiveCompleted: boolean;
  hHelpOpened: boolean;
  hasInteractiveItem?: boolean;
  hasRetryItem?: boolean;
}

export interface AttentionInputs {
  videoCompletionRatio: number; // 0.0 to 1.0
  keyTimestampWatched: boolean;
  engagementActionsRatio?: number; // 0.0 to 1.0
}

export interface TimeInputs {
  activeSeconds: number;
  expectedBenchmarkSeconds?: number; // default 25s
}

export type MasteryBand = "strong_mastery" | "developing" | "needs_support" | "instruction_needed";
export type SuggestedAction = "proceed" | "reinforce" | "show_correction" | "watch_key_video";

export interface MasteryResult {
  accuracy: number;
  work: number;
  attention: number;
  timeQuality: number;
  sessionMastery: number;
  smoothedMastery: number;
  band: MasteryBand;
  suggestedAction: SuggestedAction;
}

const clamp01 = (value: number) => Math.min(1.0, Math.max(0.0, value));
const round4 = (value: number) => Number(value.toFixed(4));

export function computeAccuracyScore(inputs: AccuracyInputs): number {
  const { c1, c2, c3 } = WEIGHTS.accuracy;
  const first = inputs.c1FirstAnswerCorrect ? 1.0 : 0.0;
  const correction = inputs.c2CorrectionAnswerCorrect ? 1.0 : 0.0;
  const history = clamp01(inputs.c3HistoricalReviewRate ?? DEFAULT_HISTORICAL_REVIEW_RATE);

  return clamp01(round4(c1 * first + c2 * correction + c3 * history));
}

/**
 * W = 0.40*Q + 0.30*R + 0.20*I + 0.10*H, renormalized over the components that
 * were actually assigned. Retry and interactive items count as assigned unless
 * the caller says otherwise, which reproduces the spec's worked examples.
 */
export function computeWorkScore(inputs: WorkInputs): number {
  const { q, r, i, h } = WEIGHTS.work;
  let totalWeight = q; // Q is always required
  let weightedSum = (inputs.qQuestionSubmitted ? 1.0 : 0.0) * q;

  if (inputs.hasRetryItem ?? true) {
    totalWeight += r;
    weightedSum += (inputs.rRetryCompleted ? 1.0 : 0.0) * r;
  }

  if (inputs.hasInteractiveItem ?? true) {
    totalWeight += i;
    weightedSum += (inputs.iInteractiveCompleted ? 1.0 : 0.0) * i;
  }

  totalWeight += h; // H help opened
  weightedSum += (inputs.hHelpOpened ? 1.0 : 0.0) * h;

  const score = totalWeight > 0 ? weightedSum / totalWeight : 1.0;
  return clamp01(round4(score));
}

export function computeAttentionScore(inputs: AttentionInputs): number {
  const { v: vw, k: kw, e: ew } = WEIGHTS.attention;
  const v = clamp01(inputs.videoCompletionRatio);
  const k = inputs.keyTimestampWatched ? 1.0 : 0.0;
  const e = clamp01(inputs.engagementActionsRatio ?? (v > 0.8 ? 1.0 : 0.5));

  return clamp01(round4(vw * v + kw * k + ew * e));
}

/** Small diagnostic signal: flags likely guessing (too fast) or struggle (very slow). */
export function computeTimeQualityScore(inputs: TimeInputs): number {
  const benchmark = inputs.expectedBenchmarkSeconds ?? DEFAULT_BENCHMARK_SECONDS;
  const ratio = Math.max(0.01, inputs.activeSeconds / benchmark);

  if (ratio >= 0.5 && ratio <= 2.0) return 1.0; // healthy deliberative pace
  if (ratio >= 0.25 && ratio < 0.5) return 0.7;
  if (ratio < 0.25) return 0.45; // likely rushed/guess
  if (ratio <= 4.0) return 0.75; // deliberate or slight hesitation
  return 0.55; // very long stall/struggle
}

/** M = 0.55*A + 0.15*W + 0.20*N + 0.10*T */
export function combineMastery(accuracy: number, work: number, attention: number, timeQuality: number): number {
  const { a, w, n, t } = WEIGHTS.mastery;
  return round4(a * accuracy + w * work + n * attention + t * timeQuality);
}

/** new_mastery = 0.70*prior + 0.30*session. With no prior, the session stands alone. */
export function smoothMastery(priorMastery: number | undefined, sessionMastery: number): number {
  const prior = priorMastery ?? sessionMastery;
  return round4(WEIGHTS.smoothing.prior * prior + WEIGHTS.smoothing.session * sessionMastery);
}

export function masteryBand(mastery: number): { band: MasteryBand; suggestedAction: SuggestedAction } {
  if (mastery >= 0.8) return { band: "strong_mastery", suggestedAction: "proceed" };
  if (mastery >= 0.6) return { band: "developing", suggestedAction: "reinforce" };
  if (mastery >= 0.4) return { band: "needs_support", suggestedAction: "show_correction" };
  return { band: "instruction_needed", suggestedAction: "watch_key_video" };
}

export function computeMastery(params: {
  accuracyInputs: AccuracyInputs;
  workInputs: WorkInputs;
  attentionInputs: AttentionInputs;
  timeInputs: TimeInputs;
  priorMastery?: number;
}): MasteryResult {
  const accuracy = computeAccuracyScore(params.accuracyInputs);
  const work = computeWorkScore(params.workInputs);
  const attention = computeAttentionScore(params.attentionInputs);
  const timeQuality = computeTimeQualityScore(params.timeInputs);

  const sessionMastery = combineMastery(accuracy, work, attention, timeQuality);
  const smoothedMastery = smoothMastery(params.priorMastery, sessionMastery);

  return {
    accuracy,
    work,
    attention,
    timeQuality,
    sessionMastery,
    smoothedMastery,
    ...masteryBand(sessionMastery),
  };
}

/**
 * C3: share of earlier review evidence on this topic that was correct.
 * Falls back to 0.5 when there is no history yet.
 */
export function computeHistoricalReviewRate(reviewCorrect: number, reviewAttempts: number): number {
  if (reviewAttempts <= 0) return DEFAULT_HISTORICAL_REVIEW_RATE;
  return round4(clamp01(reviewCorrect / reviewAttempts));
}

/** P = 0.50*(1 - M) + 0.20*min(D/7, 1) + 0.20*min(X/3, 1) + 0.10*S */
export function computeReviewPriority(params: {
  currentMastery: number;
  daysSinceLastPractice: number;
  skipCount: number;
  safetyWeight: number; // 0.50 to 1.00
}): number {
  const { gap: gw, days: dw, skips: xw, safety: sw } = WEIGHTS.priority;
  const gap = Math.max(0.0, 1.0 - params.currentMastery);
  const timeFactor = Math.min(1.0, Math.max(0, params.daysSinceLastPractice) / 7.0);
  const skipFactor = Math.min(1.0, Math.max(0, params.skipCount) / 3.0);
  const safety = Math.min(1.0, Math.max(0.5, params.safetyWeight));

  return round4(gw * gap + dw * timeFactor + xw * skipFactor + sw * safety);
}

export type ReadinessStatus = "Needs Foundation" | "Developing" | "Permit Test Ready" | "Highway Confident";

export function calculateDriverReadinessScore(topicMasteries: number[]): {
  scoreOutOf100: number;
  status: ReadinessStatus;
  passedTopicsCount: number;
  totalTopicsCount: number;
} {
  if (topicMasteries.length === 0) {
    return {
      scoreOutOf100: 0,
      status: "Needs Foundation",
      passedTopicsCount: 0,
      totalTopicsCount: 0,
    };
  }

  const average = topicMasteries.reduce((acc, val) => acc + val, 0) / topicMasteries.length;
  const scoreOutOf100 = Math.round(average * 100);
  const passedTopicsCount = topicMasteries.filter((m) => m >= 0.7).length;

  let status: ReadinessStatus = "Needs Foundation";
  if (scoreOutOf100 >= 85 && passedTopicsCount >= Math.floor(topicMasteries.length * 0.8)) {
    status = "Highway Confident";
  } else if (scoreOutOf100 >= 70) {
    status = "Permit Test Ready";
  } else if (scoreOutOf100 >= 50) {
    status = "Developing";
  }

  return {
    scoreOutOf100,
    status,
    passedTopicsCount,
    totalTopicsCount: topicMasteries.length,
  };
}

/* ------------------------------------------------------------------------- */
/* Feed + daily review selection                                             */
/* ------------------------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days since last practice; never-practiced topics count as fully due (7+ days). */
export function daysSince(lastPracticedAt: Date | null | undefined, now: Date): number {
  if (!lastPracticedAt) return 7;
  return Math.max(0, (now.getTime() - lastPracticedAt.getTime()) / DAY_MS);
}

/** Calendar-day index in the learner's local time zone (offset as from Date#getTimezoneOffset). */
export function localDayIndex(date: Date, tzOffsetMinutes: number): number {
  return Math.floor((date.getTime() - tzOffsetMinutes * 60 * 1000) / DAY_MS);
}

export interface TopicState {
  topicId: string;
  mastery: number;
  lastPracticedAt: Date | null;
  lastReviewedAt: Date | null;
  skipCount: number;
  safetyWeight: number;
  reviewLater: boolean;
  lastFirstAnswerCorrect: boolean | null;
  attemptCount: number;
}

export type ReviewReason =
  | "review_later"
  | "skipped"
  | "missed_last_time"
  | "from_today"
  | "from_yesterday"
  | "from_two_days_ago"
  | "due";

export interface ReviewQueueItem {
  topicId: string;
  priority: number;
  reason: ReviewReason;
}

export function topicPriority(topic: TopicState, now: Date): number {
  return computeReviewPriority({
    currentMastery: topic.mastery,
    daysSinceLastPractice: daysSince(topic.lastPracticedAt, now),
    skipCount: topic.skipCount,
    safetyWeight: topic.safetyWeight,
  });
}

/**
 * Builds today's capped review set: one pick from each bucket the spec asks to
 * mix (review-later, skipped, previously incorrect, today, yesterday, two days
 * ago), then fills the rest by priority P. Topics already reviewed today are
 * excluded and count against the cap, so the queue always ends.
 */
export function selectDailyReviewQueue(
  topics: TopicState[],
  now: Date,
  options: { cap?: number; tzOffsetMinutes?: number } = {},
): { items: ReviewQueueItem[]; reviewedToday: number; cap: number } {
  const cap = options.cap ?? 6;
  const tz = options.tzOffsetMinutes ?? 0;
  const today = localDayIndex(now, tz);

  const reviewedToday = topics.filter(
    (t) => t.lastReviewedAt && localDayIndex(t.lastReviewedAt, tz) === today,
  ).length;
  const remaining = Math.max(0, cap - reviewedToday);

  const eligible = topics
    .filter((t) => t.attemptCount > 0 || t.reviewLater || t.skipCount > 0)
    .filter((t) => !(t.lastReviewedAt && localDayIndex(t.lastReviewedAt, tz) === today))
    .map((t) => ({ topic: t, priority: topicPriority(t, now) }))
    .sort((a, b) => b.priority - a.priority);

  const practicedDaysAgo = (t: TopicState, days: number) =>
    t.lastPracticedAt !== null && today - localDayIndex(t.lastPracticedAt, tz) === days;

  const buckets: Array<{ reason: ReviewReason; match: (t: TopicState) => boolean }> = [
    { reason: "review_later", match: (t) => t.reviewLater },
    { reason: "skipped", match: (t) => t.skipCount > 0 },
    { reason: "missed_last_time", match: (t) => t.lastFirstAnswerCorrect === false },
    { reason: "from_today", match: (t) => practicedDaysAgo(t, 0) },
    { reason: "from_yesterday", match: (t) => practicedDaysAgo(t, 1) },
    { reason: "from_two_days_ago", match: (t) => practicedDaysAgo(t, 2) },
  ];

  const items: ReviewQueueItem[] = [];
  const picked = new Set<string>();

  for (const bucket of buckets) {
    if (items.length >= remaining) break;
    const hit = eligible.find((c) => !picked.has(c.topic.topicId) && bucket.match(c.topic));
    if (hit) {
      picked.add(hit.topic.topicId);
      items.push({ topicId: hit.topic.topicId, priority: hit.priority, reason: bucket.reason });
    }
  }

  for (const candidate of eligible) {
    if (items.length >= remaining) break;
    if (picked.has(candidate.topic.topicId)) continue;
    picked.add(candidate.topic.topicId);
    items.push({ topicId: candidate.topic.topicId, priority: candidate.priority, reason: "due" });
  }

  items.sort((a, b) => b.priority - a.priority);
  return { items, reviewedToday, cap };
}

/**
 * Orders the feed by priority P (highest first). Unseen topics have M = 0 and
 * D = 7, so new safety-critical lessons lead; ties keep curriculum order.
 */
export function rankFeed<T extends { topicId: string; safetyWeight: number }>(
  lessons: T[],
  stateByTopic: Map<string, Pick<TopicState, "mastery" | "lastPracticedAt" | "skipCount">>,
  now: Date,
): Array<T & { priority: number }> {
  return lessons
    .map((lesson, index) => {
      const state = stateByTopic.get(lesson.topicId);
      const priority = computeReviewPriority({
        currentMastery: state?.mastery ?? 0,
        daysSinceLastPractice: daysSince(state?.lastPracticedAt ?? null, now),
        skipCount: state?.skipCount ?? 0,
        safetyWeight: lesson.safetyWeight,
      });
      return { lesson: { ...lesson, priority }, index };
    })
    .sort((a, b) => b.lesson.priority - a.lesson.priority || a.index - b.index)
    .map((entry) => entry.lesson);
}
