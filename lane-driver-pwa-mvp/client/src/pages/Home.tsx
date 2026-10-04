import {
  CloudOffIcon,
  DownloadIcon,
  GaugeIcon,
  MenuIcon,
  MessagesSquareIcon,
  PlaySquareIcon,
  RepeatIcon,
  ShieldCheckIcon,
  SirenIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { rankFeed, type ReviewReason } from "@shared/algorithm";
import { LESSON_SEEDS, type LessonItem } from "@shared/curriculum";
import { EmergencyChecklistView } from "@/components/EmergencyChecklistView";
import { HazardBoard } from "@/components/HazardBoard";
import { LegalModal } from "@/components/LegalModal";
import { LessonFeedCard } from "@/components/LessonFeedCard";
import { ProgressPanel } from "@/components/ProgressPanel";
import { ReadinessMeter } from "@/components/ReadinessMeter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { hasAcceptedTerms } from "@/lib/learner";
import { flushOutbox } from "@/lib/outbox";
import { trpc, tzOffsetMinutes } from "@/lib/trpc";
import type { ProgressSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "feed" | "review" | "sos" | "board" | "you";
const TABS: Tab[] = ["feed", "review", "sos", "board", "you"];

/** Deep links such as the manifest's SOS shortcut (/?tab=sos). */
function initialTab(): Tab {
  const requested = new URLSearchParams(window.location.search).get("tab");
  return TABS.includes(requested as Tab) ? (requested as Tab) : "feed";
}

/** Guardrail: the feed comes in short sets with a clear stopping point, never an endless scroll. */
const FEED_SET_SIZE = 6;

const REVIEW_REASON_COPY: Record<ReviewReason, string> = {
  review_later: "You saved this for later",
  skipped: "Skipped earlier",
  missed_last_time: "Tricky last time",
  from_today: "From today",
  from_yesterday: "From yesterday",
  from_two_days_ago: "From 2 days ago",
  due: "Due for review",
};

const lessonById = new Map(LESSON_SEEDS.map((lesson) => [lesson.id, lesson]));

function orderLessons(ids: string[]): LessonItem[] {
  return ids.map((id) => lessonById.get(id)).filter((lesson): lesson is LessonItem => Boolean(lesson));
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mustAccept, setMustAccept] = useState(() => !hasAcceptedTerms());
  const [legalOpen, setLegalOpen] = useState(mustAccept);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  const utils = trpc.useUtils();
  const progress = trpc.progress.summary.useQuery({ tzOffsetMinutes: tzOffsetMinutes() }, { retry: 1 });

  // The feed order is ranked by priority P once per round, then frozen so cards never reshuffle mid-scroll.
  const [feedLessons, setFeedLessons] = useState<LessonItem[] | null>(null);
  const [setsShown, setSetsShown] = useState(1);
  useEffect(() => {
    if (feedLessons) return;
    if (progress.data) setFeedLessons(orderLessons(progress.data.feedOrder));
    else if (progress.isError) setFeedLessons(rankFeed(LESSON_SEEDS, new Map(), new Date()));
  }, [progress.data, progress.isError, feedLessons]);

  const newRound = () => {
    setFeedLessons(progress.data ? orderLessons(progress.data.feedOrder) : rankFeed(LESSON_SEEDS, new Map(), new Date()));
    setSetsShown(1);
  };

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const sync = async () => {
      const sent = await flushOutbox((item) => {
        if (item.kind === "recordInteraction") return utils.client.learning.recordInteraction.mutate(item.input);
        if (item.kind === "reviewLater") return utils.client.learning.reviewLater.mutate(item.input);
        return utils.client.learning.skip.mutate(item.input);
      });
      if (sent > 0) {
        // Several triggers can share one flush; a fixed id keeps it to a single toast.
        toast.success(`Synced ${sent} offline ${sent === 1 ? "lesson" : "lessons"}`, { id: "outbox-sync" });
        void utils.progress.summary.invalidate();
      }
    };
    const onOnline = () => {
      update();
      void sync();
    };
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    void sync();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, [utils]);

  const reviewCount = progress.data?.review.items.length ?? 0;
  const nav: Array<{ id: Tab; label: string; icon: LucideIcon; badge?: number }> = [
    { id: "feed", label: "Learn", icon: PlaySquareIcon },
    { id: "review", label: "Review", icon: RepeatIcon, badge: reviewCount },
    { id: "sos", label: "SOS", icon: SirenIcon },
    { id: "board", label: "Board", icon: MessagesSquareIcon },
    { id: "you", label: "You", icon: GaugeIcon },
  ];

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background sm:border-x">
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b bg-background/85 px-4 pt-safe backdrop-blur-lg">
        <div className="flex h-14 items-center gap-2">
          <img src="/icons/icon.svg" alt="" className="size-7" />
          <span className="font-display text-xl font-bold tracking-tight">Lane</span>
          {!online && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <CloudOffIcon className="size-3" /> Offline
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setTab("you")} aria-label="Driver readiness details" className="rounded-full px-1 py-1">
            <ReadinessMeter readiness={progress.data?.readiness} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <MenuIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setLegalOpen(true)}>
                <ShieldCheckIcon /> Privacy & Terms
              </DropdownMenuItem>
              {installEvent && (
                <DropdownMenuItem
                  onSelect={() => {
                    void installEvent.prompt();
                    setInstallEvent(null);
                  }}
                >
                  <DownloadIcon /> Install Lane
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <section className={cn("h-full", tab !== "feed" && "hidden")} aria-label="Lesson feed">
          <FeedView
            lessons={feedLessons}
            setsShown={setsShown}
            progress={progress.data}
            visible={tab === "feed"}
            onMore={() => setSetsShown((n) => n + 1)}
            onNewRound={newRound}
            onReview={() => setTab("review")}
          />
        </section>
        {tab === "review" && <ReviewView progress={progress.data} loading={progress.isLoading} onLearn={() => setTab("feed")} />}
        {tab === "sos" && (
          <div className="h-full overflow-y-auto">
            <EmergencyChecklistView />
          </div>
        )}
        {tab === "board" && (
          <div className="h-full overflow-y-auto">
            <HazardBoard />
          </div>
        )}
        {tab === "you" && (
          <div className="h-full overflow-y-auto">
            <ProgressPanel progress={progress.data} onOpenPrivacy={() => setLegalOpen(true)} />
          </div>
        )}
      </main>

      <nav className="z-20 shrink-0 border-t bg-background/90 pb-safe backdrop-blur-lg" aria-label="Sections">
        <ul className="grid grid-cols-5">
          {nav.map(({ id, label, icon: Icon, badge }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "relative flex w-full flex-col items-center gap-1 pt-2.5 pb-1 text-[11px] font-semibold transition-colors",
                  tab === id ? (id === "sos" ? "text-hazard" : "text-accent") : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-[22px]", id === "sos" && "text-hazard")} />
                {label}
                {Boolean(badge) && (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-lane px-1 text-[10px] leading-4 font-bold text-primary-foreground">
                    {badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <LegalModal
        open={legalOpen}
        requireAcceptance={mustAccept}
        onOpenChange={(open) => {
          setLegalOpen(open);
          if (!open) setMustAccept(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function useSnapScroller() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTo = (index: number) => {
    const child = ref.current?.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return { ref, scrollTo };
}

function FeedView({
  lessons,
  setsShown,
  progress,
  visible,
  onMore,
  onNewRound,
  onReview,
}: {
  lessons: LessonItem[] | null;
  setsShown: number;
  progress: ProgressSummary | undefined;
  visible: boolean;
  onMore: () => void;
  onNewRound: () => void;
  onReview: () => void;
}) {
  const { ref, scrollTo } = useSnapScroller();
  const topics = useMemo(() => new Map(progress?.topics.map((t) => [t.lessonId, t])), [progress]);

  if (!lessons) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground" role="status">
        Building your feed…
      </div>
    );
  }

  const shown = lessons.slice(0, FEED_SET_SIZE * setsShown);
  const finishedCurriculum = shown.length >= lessons.length;

  return (
    <div ref={ref} className="h-full snap-y snap-mandatory overflow-y-scroll scrollbar-none">
      {shown.map((lesson, index) => (
        <div key={lesson.id} className="h-full snap-start snap-always">
          <LessonFeedCard
            lesson={lesson}
            mode="feed"
            topic={topics.get(lesson.id)}
            visible={visible}
            onNext={() => scrollTo(index + 1)}
          />
        </div>
      ))}
      <div className="grid h-full snap-start snap-always place-items-center px-6">
        <div className="flex max-w-sm animate-rise flex-col items-center gap-4 text-center">
          <div className="grid size-16 place-items-center rounded-3xl bg-primary/15 text-accent">
            <ShieldCheckIcon className="size-8" />
          </div>
          <h2 className="font-display text-2xl font-bold">
            {finishedCurriculum ? "You've seen every lesson" : "That's a set — nice driving"}
          </h2>
          <p className="text-[15px] leading-snug text-muted-foreground">
            {finishedCurriculum
              ? "Spaced review is what makes rules stick. Lane will bring topics back as they come due."
              : "Short sessions beat long ones. This is a great place to stop — or keep going if you've got time."}
          </p>
          {progress?.readiness && (
            <ReadinessMeter readiness={progress.readiness} className="rounded-2xl border bg-surface px-4 py-3" />
          )}
          <div className="flex flex-col gap-2 self-stretch">
            {(progress?.review.items.length ?? 0) > 0 && (
              <Button onClick={onReview}>
                <RepeatIcon /> Daily Review ({progress!.review.items.length})
              </Button>
            )}
            {finishedCurriculum ? (
              <Button variant="secondary" onClick={onNewRound}>
                Start a new round
              </Button>
            ) : (
              <Button variant="secondary" onClick={onMore}>
                One more set
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewView({ progress, loading, onLearn }: { progress: ProgressSummary | undefined; loading: boolean; onLearn: () => void }) {
  // Snapshot the queue when a session starts so finished items don't vanish mid-review.
  const [session, setSession] = useState<ProgressSummary["review"]["items"] | null>(null);
  const { ref, scrollTo } = useSnapScroller();
  const topics = useMemo(() => new Map(progress?.topics.map((t) => [t.lessonId, t])), [progress]);

  if (session) {
    return (
      <div ref={ref} className="h-full snap-y snap-mandatory overflow-y-scroll scrollbar-none">
        {session.map((item, index) => (
          <div key={item.lessonId} className="h-full snap-start snap-always">
            <LessonFeedCard
              lesson={lessonById.get(item.lessonId)!}
              mode="review"
              topic={topics.get(item.lessonId)}
              reviewReason={REVIEW_REASON_COPY[item.reason]}
              onNext={() => scrollTo(index + 1)}
            />
          </div>
        ))}
        <div className="grid h-full snap-start place-items-center px-6">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <h2 className="font-display text-2xl font-bold">Review done for now</h2>
            <p className="text-[15px] text-muted-foreground">Retrieval practice like this is how rules move into long-term memory.</p>
            <Button onClick={() => setSession(null)}>Back to Review</Button>
          </div>
        </div>
      </div>
    );
  }

  const review = progress?.review;
  const items = review?.items ?? [];

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 pt-6 pb-10">
      <div>
        <h1 className="font-display text-2xl font-bold">Daily Review</h1>
        <p className="text-sm text-muted-foreground">
          Picked by priority: weaker, older, skipped, and safety-critical topics come first. Capped at {review?.cap ?? 6} a day.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Checking what's due…</p>}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border bg-surface p-5">
          <p className="font-display text-lg font-semibold">
            {review && review.reviewedToday > 0 ? "All caught up for today" : "Nothing due yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {review && review.reviewedToday > 0
              ? "You've hit today's review goal. Come back tomorrow — spacing it out is the point."
              : "Learn a few lessons first. Lane schedules them for review automatically."}
          </p>
          <Button variant="secondary" onClick={onLearn}>
            Go to lessons
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const lesson = lessonById.get(item.lessonId)!;
              return (
                <li key={item.lessonId} className="flex items-center justify-between gap-3 rounded-2xl border bg-surface p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lesson.title}</p>
                    <p className="text-xs text-lane">{REVIEW_REASON_COPY[item.reason]}</p>
                  </div>
                  <span className="shrink-0 font-display text-xs text-muted-foreground">P {item.priority.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
          <Button size="lg" onClick={() => setSession(items)}>
            <RepeatIcon /> Start review ({items.length})
          </Button>
        </>
      )}
    </div>
  );
}
