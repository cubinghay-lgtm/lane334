import { TimerIcon, ZapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { QuizQuestion } from "@shared/curriculum";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QteConfig = NonNullable<QuizQuestion["qteConfig"]>;

export interface QteResult {
  correct: boolean;
  timedOut: boolean;
  actionId: string | null;
  reactionSeconds: number;
}

interface QTEPlayerProps {
  config: QteConfig;
  prompt: string;
  onComplete: (result: QteResult) => void;
  guard?: (proceed: () => void) => void;
}

type Phase = "ready" | "approach" | "hazard" | "result";
const APPROACH_MS = 1400;

/**
 * Quick-Time Reaction Event: a short approach, then a hazard appears and the
 * learner has 3–5 seconds to pick the defensive move.
 */
export function QTEPlayer({ config, prompt, onComplete, guard }: QTEPlayerProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [remaining, setRemaining] = useState(1);
  const [result, setResult] = useState<QteResult | null>(null);
  const hazardStart = useRef(0);
  const frame = useRef(0);
  const done = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const finish = (actionId: string | null) => {
    if (done.current) return;
    done.current = true;
    cancelAnimationFrame(frame.current);
    const outcome: QteResult = {
      correct: actionId === config.targetAction,
      timedOut: actionId === null,
      actionId,
      reactionSeconds: (performance.now() - hazardStart.current) / 1000,
    };
    setResult(outcome);
    setPhase("result");
    window.setTimeout(() => onComplete(outcome), 900);
  };

  useEffect(() => {
    if (phase !== "approach") return;
    // The reaction buttons must be on screen before the clock starts.
    const root = rootRef.current;
    const panel = root?.closest<HTMLElement>("[data-scroll-panel]");
    if (root && panel) {
      const overflow = root.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
      if (overflow > 0) panel.scrollBy({ top: overflow + 16, behavior: "smooth" });
    }
    const timer = window.setTimeout(() => {
      hazardStart.current = performance.now();
      setPhase("hazard");
    }, APPROACH_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "hazard") return;
    const limitMs = config.timeLimitSeconds * 1000;
    const tick = () => {
      const left = 1 - (performance.now() - hazardStart.current) / limitMs;
      setRemaining(Math.max(0, left));
      if (left <= 0) finish(null);
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => (guard ? guard(() => setPhase("approach")) : setPhase("approach"));

  return (
    <div ref={rootRef} className="flex animate-rise flex-col gap-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-lane uppercase">
        <ZapIcon className="size-3.5" /> Quick reaction · {config.timeLimitSeconds}s
      </p>
      <p className="font-display text-[17px] leading-snug font-semibold text-balance">{prompt.replace(/^Quick Reaction:\s*/, "")}</p>

      <div className="relative overflow-hidden rounded-2xl border bg-[#101a36]">
        <QteScene visual={config.visual} phase={phase} />

        {phase === "hazard" && (
          <div className="absolute inset-x-0 top-0 h-1.5 bg-black/40" aria-hidden>
            <div
              className={cn("h-full origin-left", remaining > 0.35 ? "bg-lane" : "bg-hazard")}
              style={{ transform: `scaleX(${remaining})` }}
            />
          </div>
        )}

        {phase === "hazard" && (
          <p className="absolute top-3 left-3 rounded-full bg-hazard px-2.5 py-1 text-xs font-bold text-white shadow-lg">
            {config.hazardDescription}
          </p>
        )}

        {phase === "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-background/55 backdrop-blur-[2px]">
            <Button variant="lane" size="lg" onClick={start} className="shadow-lg">
              <TimerIcon /> Start the drive
            </Button>
          </div>
        )}

        {phase === "result" && result && (
          <div
            className={cn(
              "absolute inset-x-3 bottom-3 animate-rise rounded-xl px-3 py-2 text-sm font-semibold",
              result.correct ? "bg-success text-primary-foreground" : "bg-lane text-primary-foreground",
            )}
          >
            {result.correct
              ? `Nice reaction — ${result.reactionSeconds.toFixed(1)}s`
              : result.timedOut
                ? "Time's up. Let's look at the rule."
                : "Almost. Let's look at the rule."}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {config.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={phase !== "hazard"}
            onClick={() => finish(action.id)}
            className={cn(
              "min-h-14 rounded-2xl border bg-surface px-3 py-2 text-left text-[13px] leading-tight font-semibold transition-all active:scale-[0.97]",
              phase === "hazard" && "border-lane/40 hover:bg-surface-2",
              phase !== "hazard" && "opacity-45",
              phase === "result" && action.id === config.targetAction && "border-success bg-success/15 opacity-100",
              phase === "result" && result?.actionId === action.id && !result.correct && "border-lane bg-lane/10 opacity-100",
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Top-down scene illustrations                                              */
/* ------------------------------------------------------------------------- */

function Car({ x, y, color, rotate = 0, className }: { x: number; y: number; color: string; rotate?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`} className={className}>
      <rect x={-11} y={-19} width={22} height={38} rx={6} fill={color} />
      <rect x={-8} y={-11} width={16} height={9} rx={2} fill="#0b132b" opacity={0.65} />
      <rect x={-8} y={8} width={16} height={6} rx={2} fill="#0b132b" opacity={0.45} />
    </g>
  );
}

function HazardRing({ x, y, show }: { x: number; y: number; show: boolean }) {
  if (!show) return null;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={20} fill="none" stroke="#ef476f" strokeWidth={3} className="origin-center animate-pulse-ring [transform-box:fill-box]" />
      <circle r={20} fill="none" stroke="#ef476f" strokeWidth={2} opacity={0.8} />
    </g>
  );
}

function QteScene({ visual, phase }: { visual: QteConfig["visual"]; phase: Phase }) {
  const moving = phase !== "ready";
  const hazard = phase === "hazard" || phase === "result";
  const approach = cn("transition-transform ease-out", moving ? "duration-[1400ms]" : "duration-0");

  return (
    <svg viewBox="0 0 320 190" className="block h-auto w-full" role="img" aria-label="Driving scenario illustration">
      <rect width={320} height={190} fill="#13203f" />
      {visual === "intersection" && (
        <>
          <rect x={125} width={70} height={190} fill="#2a3557" />
          <rect y={60} width={320} height={70} fill="#2a3557" />
          {[0, 30, 150, 170].map((y) => (
            <rect key={`v${y}`} x={158} y={y} width={4} height={18} fill="#ffd166" opacity={0.7} />
          ))}
          {[10, 50, 250, 290].map((x) => (
            <rect key={`h${x}`} x={x} y={93} width={18} height={4} fill="#ffd166" opacity={0.7} />
          ))}
          <g className={approach} style={{ transform: moving ? "translateY(-28px)" : "none" }}>
            <Car x={177} y={180} color="#5bc0be" />
          </g>
          <g className={approach} style={{ transform: moving ? "translateX(30px)" : "none" }}>
            <Car x={60} y={77} color="#9aa8c7" rotate={90} />
          </g>
          <g className={approach} style={{ transform: moving ? "translateX(-34px)" : "none" }}>
            <g transform="translate(290 112)">
              <rect x={-12} y={-3} width={24} height={6} rx={3} fill="#ffd166" />
              <circle cx={-10} cy={0} r={5} fill="none" stroke="#ffd166" strokeWidth={2} />
              <circle cx={10} cy={0} r={5} fill="none" stroke="#ffd166" strokeWidth={2} />
            </g>
          </g>
          <HazardRing x={256} y={112} show={hazard} />
        </>
      )}

      {visual === "siren" && (
        <>
          <rect x={90} width={140} height={190} fill="#2a3557" />
          {[0, 45, 90, 135, 180].map((y) => (
            <rect key={y} x={158} y={y} width={4} height={24} fill="#ffd166" opacity={0.7} />
          ))}
          <rect x={86} width={4} height={190} fill="#eef2ff" opacity={0.5} />
          <rect x={230} width={4} height={190} fill="#eef2ff" opacity={0.5} />
          <Car x={195} y={70} color="#5bc0be" />
          <g className={approach} style={{ transform: moving ? "translateY(-40px)" : "none" }}>
            <g transform="translate(195 205)">
              <rect x={-13} y={-24} width={26} height={48} rx={5} fill="#eef2ff" />
              <rect x={-11} y={-20} width={10} height={6} rx={2} fill="#ef476f" className={hazard ? "animate-pulse" : ""} />
              <rect x={1} y={-20} width={10} height={6} rx={2} fill="#4f8bff" className={hazard ? "animate-pulse" : ""} />
              <rect x={-3} y={-4} width={6} height={16} fill="#ef476f" />
              <rect x={-8} y={1} width={16} height={6} fill="#ef476f" />
            </g>
          </g>
          <HazardRing x={195} y={165} show={hazard} />
        </>
      )}

      {visual === "lane-change" && (
        <>
          <rect x={80} width={160} height={190} fill="#2a3557" />
          {[0, 45, 90, 135, 180].map((y) => (
            <rect key={y} x={158} y={y} width={4} height={24} fill="#eef2ff" opacity={0.6} />
          ))}
          <g className={approach} style={{ transform: moving ? "translateY(-20px)" : "none" }}>
            <Car x={200} y={110} color="#5bc0be" />
            <circle cx={189} cy={92} r={3} fill="#ffd166" className={moving ? "animate-pulse" : ""} />
          </g>
          <path d="M 188 100 L 130 150 L 160 150 Z" fill="#ffd166" opacity={hazard ? 0.12 : 0.05} />
          <g className={approach} style={{ transform: moving ? "translateY(-18px)" : "none" }}>
            <g transform="translate(122 150)">
              <rect x={-5} y={-16} width={10} height={32} rx={5} fill="#ff9f68" />
              <circle cx={0} cy={-2} r={5} fill="#0b132b" />
            </g>
          </g>
          <HazardRing x={122} y={132} show={hazard} />
          <Car x={120} y={30} color="#9aa8c7" />
        </>
      )}

      {visual === "blind-curve" && (
        <>
          <path d="M 120 190 C 120 110 160 70 320 60 L 320 140 C 210 140 200 160 200 190 Z" fill="#2a3557" />
          <path d="M 160 190 C 160 130 190 100 320 100" fill="none" stroke="#ffd166" strokeWidth={3} strokeDasharray="14 12" opacity={0.7} />
          <rect x={0} y={0} width={150} height={70} rx={14} fill="#1f5c4a" opacity={0.9} />
          <circle cx={140} cy={60} r={30} fill="#1f5c4a" />
          {[150, 112].map((y) => (
            <g key={y} transform={`translate(212 ${y + 5}) rotate(-10)`}>
              <rect x={-10} y={-17} width={20} height={34} rx={5} fill="#3a506b" />
            </g>
          ))}
          <g className={approach} style={{ transform: moving ? "translateY(-30px)" : "none" }}>
            <Car x={170} y={190} color="#5bc0be" rotate={10} />
          </g>
          <g
            className="transition-transform duration-700 ease-out"
            style={{ transform: hazard ? "translateX(-22px)" : "none" }}
          >
            <circle cx={222} cy={136} r={6} fill="#ef476f" stroke="#eef2ff" strokeWidth={1.5} />
          </g>
          <HazardRing x={200} y={136} show={hazard} />
        </>
      )}
    </svg>
  );
}
