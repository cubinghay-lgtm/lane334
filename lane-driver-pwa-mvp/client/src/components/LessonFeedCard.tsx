import {
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CloudRainIcon,
  EyeIcon,
  FastForwardIcon,
  LightbulbIcon,
  MoreHorizontalIcon,
  PlayCircleIcon,
  RouteIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SignpostIcon,
  SparklesIcon,
  TimerResetIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MasteryBand, MasteryResult } from "@shared/algorithm";
import type { LessonItem } from "@shared/curriculum";
import { scoreInteraction } from "@shared/scoring";
import { LessonVideo, type LessonVideoHandle } from "@/components/LessonVideo";
import { QTEPlayer, type QteResult } from "@/components/QTEPlayer";
import { QuestionPanel } from "@/components/QuestionPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveStopwatch } from "@/hooks/useActiveStopwatch";
import { useInView } from "@/hooks/useInView";
import { enqueue, isNetworkError } from "@/lib/outbox";
import { trpc } from "@/lib/trpc";
import type { InteractionPayload, TopicProgress } from "@/lib/types";
import { cn, percent } from "@/lib/utils";

type Stage = "question" | "testOut" | "correct" | "confirm" | "correction" | "keySegment" | "done" | "queued";

export const CATEGORY_META: Record<LessonItem["category"], { label: string; icon: typeof SignpostIcon }> = {
  rules: { label: "Rules of the road", icon: SignpostIcon },
  weather: { label: "Weather & visibility", icon: CloudRainIcon },
  awareness: { label: "Awareness", icon: EyeIcon },
  freeway: { label: "Freeway", icon: RouteIcon },
  safety: { label: "Safety", icon: ShieldCheckIcon },
};

/** Routing copy — the bands are instructions for the app, never grades. */
const BAND_COPY: Record<MasteryBand, { title: string; body: string }> = {
  strong_mastery: { title: "Locked in", body: "Strong evidence you know this. It'll come back in a few days to stay fresh." },
  developing: { title: "Solid progress", body: "You've got the idea. A quick review later will make it stick." },
  needs_support: { title: "Getting there", body: "This one will come back soon for another look — that's how it sticks." },
  instruction_needed: {
    title: "Let's rebuild this one",
    body: "It's queued up with the key clip and a fresh question. Every pass makes it easier.",
  },
};

interface LessonFeedCardProps {
  lesson: LessonItem;
  mode: "feed" | "review";
  topic?: TopicProgress;
  reviewReason?: string;
  onNext?: () => void;
  /** False while another tab is showing — hiding the feed is not the same as scrolling past. */
  visible?: boolean;
}

interface Outcome {
  result: MasteryResult;
  prior: number | null;
  offline: boolean;
  testedOut: boolean;
}

export function LessonFeedCard({ lesson, mode, topic, reviewReason, onNext, visible = true }: LessonFeedCardProps) {
  const { ref, active, near } = useInView<HTMLElement>();
  const videoRef = useRef<LessonVideoHandle>(null);
  const cardSeconds = useActiveStopwatch(active);
  const utils = trpc.useUtils();
  const record = trpc.learning.recordInteraction.useMutation();
  const reviewLater = trpc.learning.reviewLater.useMutation();
  const skip = trpc.learning.skip.useMutation();

  const [stage, setStage] = useState<Stage>("question");
  const [notice, setNotice] = useState<(() => void) | null>(null);
  const [keyWatched, setKeyWatched] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(mode === "feed");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [rushed, setRushed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const session = useRef({
    mode: mode as InteractionPayload["mode"],
    firstAnswerCorrect: null as boolean | null,
    followUp: null as InteractionPayload["followUp"],
    interactiveAssigned: false,
    interactiveCompleted: false,
    helpOpened: false,
    activeSeconds: 0,
    engagement: null as number | null,
    noticeShown: false,
    recorded: false,
    skipped: false,
  });

  const Category = CATEGORY_META[lesson.category];
  const quiz = lesson.quiz;
  const answered = session.current.firstAnswerCorrect !== null;

  /* ---------------------------------------------------------------------- */
  /* Recording                                                              */
  /* ---------------------------------------------------------------------- */

  const finish = async () => {
    const s = session.current;
    if (s.recorded || s.firstAnswerCorrect === null) return;
    s.recorded = true;
    setStage("done");

    const attention = videoRef.current?.snapshot() ?? { videoCompletionRatio: 0, keyPartWatched: false };
    const payload: InteractionPayload = {
      lessonId: lesson.id,
      mode: s.mode,
      firstAnswerCorrect: s.firstAnswerCorrect,
      followUp: s.followUp,
      interactiveAssigned: s.interactiveAssigned,
      interactiveCompleted: s.interactiveCompleted,
      helpOpened: s.helpOpened,
      videoCompletionRatio: Number(attention.videoCompletionRatio.toFixed(3)),
      keyPartWatched: attention.keyPartWatched,
      engagementRatio: s.engagement,
      activeSeconds: Math.min(3600, Number(s.activeSeconds.toFixed(1))),
    };
    const testedOut = s.mode === "test_out" && s.firstAnswerCorrect;

    try {
      const response = await record.mutateAsync(payload);
      setOutcome({ result: response.result, prior: response.priorMastery, offline: false, testedOut });
      void utils.progress.summary.invalidate();
    } catch (error) {
      if (!isNetworkError(error)) {
        toast.error("Couldn't save this lesson", { description: "Lane will show it again so your progress catches up." });
        setSaveFailed(true);
        return;
      }
      enqueue({ kind: "recordInteraction", input: payload });
      const estimate = scoreInteraction(lesson, payload, topic);
      setOutcome({ result: estimate.result, prior: estimate.priorMastery, offline: true, testedOut });
    }
  };

  const sendSkip = (queue: boolean) => {
    const input = { lessonId: lesson.id };
    const mutation = queue ? reviewLater : skip;
    mutation.mutate(input, {
      onSuccess: () => void utils.progress.summary.invalidate(),
      onError: (error) => isNetworkError(error) && enqueue({ kind: queue ? "reviewLater" : "skip", input }),
    });
  };

  // Scrolling past: save a partial interaction, or count an unanswered card as a skip (X).
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const leave = useRef((_scrolledPast: boolean) => {});
  leave.current = (scrolledPast) => {
    const s = session.current;
    if (s.firstAnswerCorrect !== null) {
      void finish();
    } else if (scrolledPast && !s.skipped && cardSeconds() >= 3) {
      s.skipped = true;
      sendSkip(false);
    }
  };

  const wasActive = useRef(false);
  useEffect(() => {
    if (active) wasActive.current = true;
    else if (wasActive.current && visibleRef.current) leave.current(true);
  }, [active]);

  // Backgrounding the app or unmounting saves answered work but never counts as a skip.
  useEffect(() => {
    const onHidden = () => document.visibilityState === "hidden" && leave.current(false);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      leave.current(false);
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Answer routing                                                         */
  /* ---------------------------------------------------------------------- */

  // Routing rule 1: answering before the key part plays gets a heads-up (once).
  const guardFirstAnswer = (proceed: () => void) => {
    const s = session.current;
    if (mode === "feed" && s.mode !== "test_out" && !s.noticeShown && !videoRef.current?.snapshot().keyPartWatched) {
      s.noticeShown = true;
      setNotice(() => proceed);
      return;
    }
    proceed();
  };

  const markFirstAnswer = (correct: boolean, qte?: QteResult) => {
    const s = session.current;
    s.firstAnswerCorrect = correct;
    s.activeSeconds = qte ? qte.reactionSeconds : cardSeconds();
    if (qte) {
      s.interactiveAssigned = true;
      s.interactiveCompleted = true;
      s.engagement = qte.timedOut ? 0 : 1;
    }
  };

  const onMainAnswer = (correct: boolean, qte?: QteResult) => {
    markFirstAnswer(correct, qte);
    if (correct) setRushed(provisionalScore() < 0.6);
    setStage(correct ? "correct" : "correction");
  };

  const onTestOutAnswer = (correct: boolean) => {
    markFirstAnswer(correct);
    if (correct) void finish();
    else setStage("correction");
  };

  const onConfirmAnswer = (correct: boolean) => {
    session.current.followUp = { kind: "confirmation", correct };
    void finish();
  };

  const onCorrectionAnswer = (correct: boolean, qte?: QteResult) => {
    const s = session.current;
    s.followUp = { kind: "correction", correct };
    if (qte) s.engagement = qte.timedOut ? 0 : 1;
    if (correct) {
      if (qte) {
        s.interactiveAssigned = true;
        s.interactiveCompleted = true;
      }
      void finish();
    } else {
      // Routing rule 4: a second miss assigns a short activity (key clip or reaction drill).
      s.interactiveAssigned = true;
      s.interactiveCompleted = false;
      setStage("keySegment");
    }
  };

  const completeKeySegment = () => {
    session.current.interactiveCompleted = true;
    void finish();
  };

  const startTestOut = () => {
    session.current.mode = "test_out";
    setNotice(null);
    setStage("testOut");
  };

  const queueForLater = () => {
    const s = session.current;
    setNotice(null);
    s.skipped = true;
    setStage("queued");
    sendSkip(true);
    toast("Added to Daily Review", { description: "Lane will bring this rule back — nothing gets dropped." });
  };

  const openHint = () => {
    session.current.helpOpened = true;
    setHintOpen(true);
  };

  const watchKeyPart = () => {
    setNotice(null);
    setVideoOpen(true);
    window.setTimeout(() => videoRef.current?.playKeySegment(), 50);
  };

  /** Routing rule 3 applied to correct-but-rushed answers: a provisional score under 0.60. */
  const provisionalScore = () => {
    const s = session.current;
    const attention = videoRef.current?.snapshot() ?? { videoCompletionRatio: 0, keyPartWatched: false };
    return scoreInteraction(
      lesson,
      {
        lessonId: lesson.id,
        mode: s.mode,
        firstAnswerCorrect: true,
        followUp: null,
        interactiveAssigned: s.interactiveAssigned,
        interactiveCompleted: s.interactiveCompleted,
        helpOpened: s.helpOpened,
        videoCompletionRatio: attention.videoCompletionRatio,
        keyPartWatched: attention.keyPartWatched,
        engagementRatio: s.engagement,
        activeSeconds: s.activeSeconds,
      },
      topic,
    ).result.sessionMastery;
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  const correctionQuestion = session.current.mode === "test_out" ? quiz : { ...quiz.similarQuestion };

  return (
    <article
      ref={ref}
      aria-label={lesson.title}
      className="relative flex h-full snap-start snap-always flex-col overflow-hidden bg-background"
    >
      {/* Clip */}
      {videoOpen ? (
        <div className="relative h-[40%] min-h-44 shrink-0">
          <LessonVideo ref={videoRef} lesson={lesson} active={active} near={near} onKeyWatched={() => setKeyWatched(true)} className="size-full" />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur">
                <Category.icon /> {Category.label}
              </Badge>
              {lesson.requiresKnowledgeCheck && (
                <Badge variant="hazard" className="bg-hazard/80 text-white backdrop-blur">
                  <ShieldAlertIcon /> Safety-critical
                </Badge>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setVideoOpen(true)}
          className="flex shrink-0 items-center gap-3 border-b bg-surface px-4 py-3 text-left"
        >
          <PlayCircleIcon className="size-8 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{lesson.videoTitle}</span>
            <span className="text-xs text-muted-foreground">Question first — rewatch the clip any time</span>
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </button>
      )}

      {/* Interaction panel */}
      <div data-scroll-panel className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-6">
        <header className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {mode === "review" && reviewReason && (
              <p className="mb-1 text-[11px] font-semibold tracking-widest text-lane uppercase">{reviewReason}</p>
            )}
            <h2 className="font-display text-xl leading-tight font-bold text-balance">{lesson.title}</h2>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{lesson.impactReason}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Lesson options" className="-mt-1 -mr-2 shrink-0">
                <MoreHorizontalIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{lesson.title}</DropdownMenuLabel>
              {mode === "feed" && (
                <DropdownMenuItem disabled={answered || stage !== "question"} onSelect={startTestOut}>
                  <FastForwardIcon /> I already know this
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={answered || stage === "queued"} onSelect={queueForLater}>
                <TimerResetIcon /> Review later
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openHint}>
                <LightbulbIcon /> Show the handbook rule
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {lesson.localizationNote && (
          <p className="mb-3 rounded-xl border border-lane/30 bg-lane/10 px-3 py-2 text-[13px] leading-snug text-lane">
            {lesson.localizationNote}
          </p>
        )}

        {notice && (
          <SkipNotice
            onAnswer={() => {
              const proceed = notice;
              setNotice(null);
              proceed();
            }}
            onWatch={watchKeyPart}
            onLater={queueForLater}
          />
        )}
        {/* Stays mounted under the notice so "Answer now" can resume the pending answer. */}
        <div key={stage} className={cn("flex flex-col gap-4", notice && "hidden")}>
          {stage === "question" &&
            (quiz.type === "qte" && quiz.qteConfig ? (
              <QTEPlayer config={quiz.qteConfig} prompt={quiz.prompt} guard={guardFirstAnswer} onComplete={(r) => onMainAnswer(r.correct, r)} />
            ) : (
              <QuestionPanel question={quiz} guard={guardFirstAnswer} onAnswer={(correct) => onMainAnswer(correct)} />
            ))}

          {stage === "testOut" && (
            <QuestionPanel
              eyebrow="Test out · harder question"
              question={quiz.harderQuestion}
              onAnswer={onTestOutAnswer}
            />
          )}

          {stage === "correct" && (
            <CorrectFeedback
              explanation={quiz.explanation}
              rushed={rushed}
              onConfirm={() => setStage("confirm")}
              onNext={() => void finish()}
            />
          )}

          {stage === "confirm" && (
            <QuestionPanel eyebrow="Lock it in · harder question" question={quiz.harderQuestion} onAnswer={onConfirmAnswer} />
          )}

          {stage === "correction" && (
            <>
              <RuleCard lesson={lesson} explanation={session.current.mode === "test_out" ? quiz.harderQuestion.explanation : quiz.explanation} />
              {correctionQuestion.type === "qte" && quiz.qteConfig ? (
                <QTEPlayer config={quiz.qteConfig} prompt={quiz.prompt} onComplete={(r) => onCorrectionAnswer(r.correct, r)} />
              ) : (
                <QuestionPanel eyebrow="Similar question" question={correctionQuestion} onAnswer={(correct) => onCorrectionAnswer(correct)} />
              )}
            </>
          )}

          {stage === "keySegment" && (
            <KeySegmentActivity
              lesson={lesson}
              keyWatched={keyWatched}
              onWatch={watchKeyPart}
              onDone={completeKeySegment}
            />
          )}

          {stage === "queued" && (
            <div className="flex animate-rise flex-col items-start gap-3 rounded-2xl border bg-surface p-4">
              <TimerResetIcon className="size-6 text-lane" />
              <p className="font-display text-lg font-semibold">Saved for Daily Review</p>
              <p className="text-sm text-muted-foreground">This rule is in your review queue. Lane brings skipped topics back so nothing slips.</p>
              {onNext && (
                <Button variant="secondary" onClick={onNext}>
                  Next lesson
                </Button>
              )}
            </div>
          )}

          {stage === "done" && <OutcomeSummary outcome={outcome} failed={saveFailed} onNext={onNext} />}
        </div>
      </div>

      <Dialog open={hintOpen} onOpenChange={setHintOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lesson.title}</DialogTitle>
            <DialogDescription>{lesson.caHandbookRef}</DialogDescription>
          </DialogHeader>
          <p className="text-[15px] leading-relaxed">{lesson.handbookSummary}</p>
          <p className="text-sm text-muted-foreground">{lesson.videoDescription}</p>
        </DialogContent>
      </Dialog>
    </article>
  );
}

/* ------------------------------------------------------------------------- */

function SkipNotice({ onAnswer, onWatch, onLater }: { onAnswer: () => void; onWatch: () => void; onLater: () => void }) {
  return (
    <div className="flex animate-rise flex-col gap-3 rounded-2xl border border-lane/40 bg-lane/10 p-4">
      <p className="font-display text-base font-semibold">You haven't seen the key part yet</p>
      <p className="text-sm leading-snug text-muted-foreground">
        This rule may matter on the permit test or in real driving. How do you want to go?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onAnswer}>
          Answer now
        </Button>
        <Button size="sm" variant="lane" onClick={onWatch}>
          <PlayCircleIcon /> Watch important part
        </Button>
        <Button size="sm" variant="outline" onClick={onLater}>
          Review later
        </Button>
      </div>
    </div>
  );
}

function CorrectFeedback({
  explanation,
  rushed,
  onConfirm,
  onNext,
}: {
  explanation: string;
  rushed: boolean;
  onConfirm: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex animate-rise flex-col gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
      <p className="flex items-center gap-2 font-display text-lg font-semibold text-success">
        <CheckCircle2Icon className="size-5" /> Correct!
      </p>
      <p className="text-[15px] leading-snug">{explanation}</p>
      {rushed && (
        <p className="text-sm text-muted-foreground">
          Your score on this topic is still building — a very fast answer or a skipped clip can mean a lucky guess. One harder
          question locks it in.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={rushed ? "default" : "secondary"} onClick={onConfirm}>
          <SparklesIcon /> Lock it in
        </Button>
        <Button size="sm" variant={rushed ? "ghost" : "default"} onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}

/** The anti-punishment correction: never "wrong" or "failed". */
function RuleCard({ lesson, explanation }: { lesson: LessonItem; explanation: string }) {
  const Category = CATEGORY_META[lesson.category];
  return (
    <div className="flex animate-rise flex-col gap-3 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-surface p-4">
      <p className="font-display text-lg leading-snug font-semibold">Almost. Here is the rule that changes the answer.</p>
      <div className="flex gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/20 text-accent">
          <Category.icon className="size-6" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] leading-snug font-medium">{lesson.handbookSummary}</p>
          <p className="text-sm leading-snug text-muted-foreground">{explanation}</p>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BookOpenIcon className="size-3.5" /> {lesson.caHandbookRef}
      </p>
    </div>
  );
}

function KeySegmentActivity({
  lesson,
  keyWatched,
  onWatch,
  onDone,
}: {
  lesson: LessonItem;
  keyWatched: boolean;
  onWatch: () => void;
  onDone: () => void;
}) {
  const [drillDone, setDrillDone] = useState(false);
  const qte = lesson.quiz.type === "qte" ? lesson.quiz.qteConfig : undefined;

  if (qte) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Let's practice it once more as a reaction drill. Take your time to read the options first.</p>
        {drillDone ? (
          <Button onClick={onDone}>Continue</Button>
        ) : (
          <QTEPlayer config={qte} prompt={lesson.quiz.prompt} onComplete={() => setDrillDone(true)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex animate-rise flex-col gap-3 rounded-2xl border bg-surface p-4">
      <p className="font-display text-base font-semibold">See the rule in action</p>
      <p className="text-sm leading-snug text-muted-foreground">
        Watch the important part of the clip — it shows exactly what the question is testing.
      </p>
      <p className="rounded-xl bg-background/60 p-3 text-[15px] leading-snug">{lesson.handbookSummary}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="lane" onClick={onWatch}>
          <PlayCircleIcon /> Watch important part
        </Button>
        <Button size="sm" disabled={!keyWatched} onClick={onDone}>
          {keyWatched ? "Got it" : "Got it (after the clip)"}
        </Button>
      </div>
    </div>
  );
}

function OutcomeSummary({ outcome, failed, onNext }: { outcome: Outcome | null; failed: boolean; onNext?: () => void }) {
  if (!outcome) {
    return (
      <div className="flex animate-rise flex-col items-start gap-3 rounded-2xl border bg-surface p-4 text-sm text-muted-foreground">
        {failed ? "This one didn't save, so it'll come back in your feed." : "Updating your driver profile…"}
        {failed && onNext && (
          <Button size="sm" variant="secondary" onClick={onNext}>
            Next lesson
          </Button>
        )}
      </div>
    );
  }

  const { result, prior, offline, testedOut } = outcome;
  const copy = testedOut
    ? { title: "Tested out", body: "You proved it with the harder question. Lane will check back on it later." }
    : BAND_COPY[result.band];
  const parts = [
    { key: "A", label: "Accuracy", value: result.accuracy },
    { key: "W", label: "Work", value: result.work },
    { key: "N", label: "Attention", value: result.attention },
    { key: "T", label: "Time", value: result.timeQuality },
  ];

  return (
    <div className="flex animate-rise flex-col gap-4 rounded-2xl border bg-surface p-4">
      <div>
        <p className="font-display text-lg font-semibold">{copy.title}</p>
        <p className="text-sm leading-snug text-muted-foreground">{copy.body}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Topic mastery</span>
          <span className="font-display font-semibold">
            {prior !== null && <span className="text-muted-foreground">{percent(prior)} → </span>}
            {percent(result.smoothedMastery)}
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-background">
          {prior !== null && <div className="absolute inset-y-0 left-0 bg-primary/30" style={{ width: percent(prior) }} />}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700"
            style={{ width: percent(result.smoothedMastery) }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {parts.map((part) => (
          <div key={part.key} className="rounded-xl bg-background/60 px-2 py-2 text-center">
            <p className="font-display text-base font-semibold">{percent(part.value)}</p>
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{part.label}</p>
          </div>
        ))}
      </div>

      {offline && <p className="text-xs text-lane">Saved offline — this syncs to your profile when you're back online.</p>}

      {onNext && (
        <Button onClick={onNext} className="self-start">
          Next lesson
        </Button>
      )}
    </div>
  );
}
