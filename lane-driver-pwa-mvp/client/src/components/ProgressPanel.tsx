import { CheckCircle2Icon, ChevronDownIcon, CircleDashedIcon, ShieldAlertIcon, TimerResetIcon } from "lucide-react";
import { useState } from "react";
import { WEIGHTS } from "@shared/algorithm";
import { CATEGORY_META } from "@/components/LessonFeedCard";
import { ReadinessMeter } from "@/components/ReadinessMeter";
import { Button } from "@/components/ui/button";
import type { ProgressSummary, TopicProgress } from "@/lib/types";
import { percent } from "@/lib/utils";

export function ProgressPanel({ progress, onOpenPrivacy }: { progress: ProgressSummary | undefined; onOpenPrivacy: () => void }) {
  const topics = [...(progress?.topics ?? [])].sort((a, b) => b.priority - a.priority);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-10">
      <ReadinessMeter readiness={progress?.readiness} variant="large" />

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Your topics</h2>
          <span className="text-xs text-muted-foreground">Sorted by review priority</span>
        </div>
        <ul className="flex flex-col gap-2">
          {topics.map((topic) => (
            <TopicRow key={topic.topicId} topic={topic} />
          ))}
        </ul>
      </section>

      <FormulaExplainer />

      <Button variant="outline" onClick={onOpenPrivacy} className="self-center">
        Privacy & Terms
      </Button>
    </div>
  );
}

function TopicRow({ topic }: { topic: TopicProgress }) {
  const Category = CATEGORY_META[topic.category];
  const status =
    topic.attemptCount === 0
      ? topic.reviewLater
        ? { icon: TimerResetIcon, label: "Queued for review", tone: "text-lane" }
        : { icon: CircleDashedIcon, label: "Not started", tone: "text-muted-foreground" }
      : topic.complete
        ? { icon: CheckCircle2Icon, label: "Complete", tone: "text-success" }
        : topic.requiresKnowledgeCheck
          ? { icon: ShieldAlertIcon, label: "Needs a correct answer", tone: "text-lane" }
          : { icon: CircleDashedIcon, label: "In progress", tone: "text-muted-foreground" };

  return (
    <li className="flex items-center gap-3 rounded-2xl border bg-surface p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
        <Category.icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold">{topic.title}</p>
          <p className="font-display text-sm font-semibold">{percent(topic.mastery)}</p>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: percent(topic.mastery) }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className={`flex items-center gap-1 ${status.tone}`}>
            <status.icon className="size-3" /> {status.label}
          </span>
          <span className="text-muted-foreground">P {topic.priority.toFixed(2)}</span>
        </div>
      </div>
    </li>
  );
}

/** The formulas stay visible and explainable — to learners as well as the product team. */
function FormulaExplainer() {
  const [open, setOpen] = useState(false);
  const w = WEIGHTS;
  const rows = [
    ["Accuracy A", `${w.accuracy.c1}·first answer + ${w.accuracy.c2}·follow-up + ${w.accuracy.c3}·review history`],
    ["Work W", `${w.work.q}·answered + ${w.work.r}·retry + ${w.work.i}·activity + ${w.work.h}·help (assigned parts only)`],
    ["Attention N", `${w.attention.v}·video watched + ${w.attention.k}·key part + ${w.attention.e}·engagement`],
    ["Time T", "1.00 at a healthy pace; lower when very rushed (likely guessing) or very long (stuck)"],
    ["Mastery M", `${w.mastery.a}·A + ${w.mastery.w}·W + ${w.mastery.n}·N + ${w.mastery.t}·T`],
    ["Your topic score", `${w.smoothing.prior}·previous + ${w.smoothing.session}·this session`],
    ["Review priority P", `${w.priority.gap}·(1 − M) + ${w.priority.days}·days/7 + ${w.priority.skips}·skips/3 + ${w.priority.safety}·safety`],
    ["Readiness", "average topic mastery × 100"],
  ];

  return (
    <section className="rounded-2xl border bg-surface">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-4 text-left">
        <span>
          <span className="block font-display font-semibold">How Lane scores you</span>
          <span className="text-xs text-muted-foreground">Accuracy matters most. Watching alone never earns mastery.</span>
        </span>
        <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <dl className="flex flex-col gap-3 px-4 pb-4">
          {rows.map(([term, formula]) => (
            <div key={term}>
              <dt className="text-xs font-semibold tracking-wide text-accent uppercase">{term}</dt>
              <dd className="font-mono text-[13px] leading-snug text-foreground/85">{formula}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
