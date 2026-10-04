import { CarIcon, DatabaseIcon, EyeOffIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { acceptTerms, resetLearnerId } from "@/lib/learner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface LegalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First launch: the learner must accept before using the app. */
  requireAcceptance?: boolean;
}

export function LegalModal({ open, onOpenChange, requireAcceptance = false }: LegalModalProps) {
  const [tab, setTab] = useState<"privacy" | "terms">(requireAcceptance ? "terms" : "privacy");

  return (
    <Dialog open={open} onOpenChange={(next) => (!requireAcceptance || next) && onOpenChange(next)}>
      <DialogContent
        hideClose={requireAcceptance}
        onEscapeKeyDown={(event) => requireAcceptance && event.preventDefault()}
        onPointerDownOutside={(event) => requireAcceptance && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{requireAcceptance ? "Welcome to Lane" : "Privacy & Terms"}</DialogTitle>
          <DialogDescription>
            {requireAcceptance
              ? "Two quick promises before your first lesson."
              : "How Lane protects student drivers and their data."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-full bg-background p-1">
          {(["terms", "privacy"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={cn(
                "rounded-full py-2 text-sm font-semibold transition-colors",
                tab === option ? "bg-surface-2 text-foreground" : "text-muted-foreground",
              )}
            >
              {option === "terms" ? "Terms of Service" : "Privacy Policy"}
            </button>
          ))}
        </div>

        {tab === "terms" ? <Terms /> : <Privacy showControls={!requireAcceptance} />}

        {requireAcceptance && (
          <Button
            size="lg"
            className="h-auto py-3 whitespace-normal"
            onClick={() => {
              acceptTerms();
              onOpenChange(false);
            }}
          >
            I agree — and I'll never use Lane while driving
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Point({ icon: Icon, title, children }: { icon: typeof CarIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-accent" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm leading-snug text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function Terms() {
  return (
    <div className="flex flex-col gap-4">
      <Point icon={CarIcon} title="Zero distraction: never while driving">
        Use Lane only when parked or as a passenger. Using a phone while driving is illegal for drivers under 18 in
        California, even hands-free. If you need the emergency checklist, pull over and stop first.
      </Point>
      <Point icon={ShieldCheckIcon} title="A study tool, not the DMV">
        Lane helps you practice with the California Driver's Handbook. It is not affiliated with the DMV, doesn't
        replace the official handbook or a licensed instructor, and isn't legal advice.
      </Point>
      <Point icon={EyeOffIcon} title="Community rules">
        Ages 13 and up. Share real hazards and honest tips. No names, plates, contact info, or posts that encourage
        unsafe driving — those are blocked or removed after community reports.
      </Point>
    </div>
  );
}

function Privacy({ showControls }: { showControls: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Point icon={EyeOffIcon} title="Anonymous by design">
        No account, name, email, school, contacts, or location. Lane uses a random ID stored on this device.
      </Point>
      <Point icon={DatabaseIcon} title="Only what improves learning">
        Lesson answers, video progress, and answer timing — the signals behind your mastery and readiness scores.
        Community posts are public and shown under an anonymous handle.
      </Point>
      {showControls && <PrivacyControls />}
    </div>
  );
}

function PrivacyControls() {
  const settings = trpc.privacy.settings.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const setOptOut = trpc.privacy.setAnalyticsOptOut.useMutation({
    onSuccess: () => void utils.privacy.settings.invalidate(),
    onError: () => toast.error("Couldn't update that setting — are you online?"),
  });
  const deleteData = trpc.privacy.deleteMyData.useMutation({
    onSuccess: () => {
      resetLearnerId();
      toast.success("Your Lane data was deleted");
      window.setTimeout(() => window.location.reload(), 800);
    },
    onError: () => toast.error("Couldn't delete right now — try again when you're online."),
  });
  const [confirming, setConfirming] = useState(false);
  const optedOut = settings.data?.analyticsOptOut ?? false;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-background/50 p-4">
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold">Detailed learning analytics</span>
          <span className="block text-xs leading-snug text-muted-foreground">
            Turn off to stop storing per-question history. Your progress and readiness still save.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={!optedOut}
          disabled={!settings.data || setOptOut.isPending}
          onClick={() => setOptOut.mutate({ optOut: !optedOut })}
          className={cn(
            "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
            optedOut ? "bg-surface-2" : "bg-primary",
          )}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", optedOut ? "left-0.5" : "left-5.5")} />
        </button>
      </label>

      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Delete all progress, settings, and your posts? This can't be undone.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => deleteData.mutate()} disabled={deleteData.isPending}>
              Delete everything
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="self-start" onClick={() => setConfirming(true)}>
          <Trash2Icon /> Delete my data
        </Button>
      )}
    </div>
  );
}
