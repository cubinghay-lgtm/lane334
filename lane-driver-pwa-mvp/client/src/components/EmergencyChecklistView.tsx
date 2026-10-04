import { CarFrontIcon, CheckIcon, CloudLightningIcon, PhoneCallIcon, ShieldIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { EMERGENCY_CHECKLIST, type EmergencyChecklistItem } from "@shared/curriculum";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CATEGORIES: Array<{ id: EmergencyChecklistItem["category"]; label: string; icon: typeof CarFrontIcon }> = [
  { id: "collision", label: "Collision", icon: TriangleAlertIcon },
  { id: "traffic_stop", label: "Police stop", icon: ShieldIcon },
  { id: "breakdown", label: "Breakdown", icon: CarFrontIcon },
  { id: "bad_weather", label: "Bad weather", icon: CloudLightningIcon },
];

/** One-tap roadside protocols. Bundled with the app, so it works with no signal. */
export function EmergencyChecklistView() {
  const [category, setCategory] = useState<EmergencyChecklistItem["category"]>("collision");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const steps = EMERGENCY_CHECKLIST.filter((item) => item.category === category).sort((a, b) => a.stepNumber - b.stepNumber);

  const toggle = (id: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Roadside Emergency</h1>
        <p className="text-sm text-muted-foreground">Pull over and stop before using your phone. Works offline.</p>
      </div>

      <Button asChild variant="destructive" size="lg" className="h-14 rounded-2xl text-lg shadow-lg shadow-hazard/20">
        <a href="tel:911">
          <PhoneCallIcon className="size-5" /> Call 911
        </a>
      </Button>

      <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Emergency type">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={category === id}
            onClick={() => setCategory(id)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border bg-surface px-1 py-3 text-[11px] font-semibold transition-colors",
              category === id ? "border-lane bg-lane/10 text-lane" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-2.5">
        {steps.map((step) => {
          const done = checked.has(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => toggle(step.id)}
                aria-pressed={done}
                className={cn(
                  "flex w-full gap-3 rounded-2xl border bg-surface p-4 text-left transition-colors",
                  done && "border-success/50 bg-success/5",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border font-display text-sm font-bold",
                    done ? "border-success bg-success text-primary-foreground" : "text-lane",
                  )}
                >
                  {done ? <CheckIcon className="size-4" /> : step.stepNumber}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-display text-[15px] font-semibold">{step.title}</span>
                  <span className="text-sm leading-snug text-foreground/85">{step.instruction}</span>
                  {step.legalNote && <span className="text-xs leading-snug text-muted-foreground">{step.legalNote}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="text-xs leading-snug text-muted-foreground">
        General safety information, not legal advice. Always follow instructions from police, CHP, and emergency responders.
      </p>
    </div>
  );
}
