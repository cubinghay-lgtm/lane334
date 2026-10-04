import type { ReadinessStatus } from "@shared/algorithm";
import type { Readiness } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_STEPS: Array<{ status: ReadinessStatus; from: number; color: string; hint: string }> = [
  { status: "Needs Foundation", from: 0, color: "#9aa8c7", hint: "Start with the safety-critical lessons." },
  { status: "Developing", from: 50, color: "#ffd166", hint: "Keep going — review is where it sticks." },
  { status: "Permit Test Ready", from: 70, color: "#5bc0be", hint: "You're ready for the written permit test." },
  { status: "Highway Confident", from: 85, color: "#6fffe9", hint: "Strong across the board, including freeway skills." },
];

export const statusColor = (status: ReadinessStatus) => STATUS_STEPS.find((s) => s.status === status)!.color;

function Ring({ score, color, size, stroke }: { score: number; color: string; size: number; stroke: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, score)) / 100)}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

/** Live Driver Readiness: average topic mastery × 100 with the four status bands. */
export function ReadinessMeter({
  readiness,
  variant = "compact",
  className,
}: {
  readiness: Readiness | undefined;
  variant?: "compact" | "large";
  className?: string;
}) {
  const score = readiness?.scoreOutOf100 ?? 0;
  const status = readiness?.status ?? "Needs Foundation";
  const color = statusColor(status);

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative grid place-items-center">
          <Ring score={score} color={color} size={38} stroke={4} />
          <span className="absolute font-display text-[11px] font-bold">{score}</span>
        </div>
        <div className="text-left leading-tight">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Readiness</p>
          <p className="text-[13px] font-semibold" style={{ color }}>
            {status}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative grid place-items-center">
        <Ring score={score} color={color} size={176} stroke={12} />
        <div className="absolute flex flex-col items-center">
          <span className="font-display text-5xl font-bold">{score}</span>
          <span className="text-xs tracking-widest text-muted-foreground uppercase">out of 100</span>
        </div>
      </div>
      <p className="font-display text-xl font-semibold" style={{ color }}>
        {status}
      </p>
      <div className="grid w-full grid-cols-4 gap-1.5">
        {STATUS_STEPS.map((step) => {
          const reached = score >= step.from;
          return (
            <div key={step.status} className="flex flex-col gap-1">
              <div className="h-1.5 rounded-full" style={{ background: reached ? step.color : "rgb(255 255 255 / 0.08)" }} />
              <p className={cn("text-[10px] leading-tight", reached ? "text-foreground" : "text-muted-foreground")}>
                {step.status}
                <span className="block text-muted-foreground">{step.from}+</span>
              </p>
            </div>
          );
        })}
      </div>
      {readiness && (
        <p className="text-sm text-muted-foreground">
          {readiness.passedTopicsCount} of {readiness.totalTopicsCount} topics at 70%+ mastery
        </p>
      )}
    </div>
  );
}
