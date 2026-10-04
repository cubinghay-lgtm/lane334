import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { isAnswerCorrect } from "@shared/curriculum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PanelQuestion {
  type?: "multiple_choice" | "fill_blank" | "qte";
  prompt: string;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
}

interface QuestionPanelProps {
  question: PanelQuestion;
  onAnswer: (correct: boolean, answer: string) => void;
  /** Lets the card intercept the first answer (e.g. the "clip not watched" notice). */
  guard?: (proceed: () => void) => void;
  eyebrow?: string;
}

/** Multiple choice or fill-in-the-blank. Shows right/wrong state briefly, then reports up. */
export function QuestionPanel({ question, onAnswer, guard, eyebrow }: QuestionPanelProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const isFill = question.type === "fill_blank" || !question.options;

  const submit = (answer: string) => {
    if (picked !== null || !answer.trim()) return;
    const proceed = () => {
      const correct = isAnswerCorrect(question, answer);
      setPicked(answer);
      window.setTimeout(() => onAnswer(correct, answer), correct ? 450 : 650);
    };
    guard ? guard(proceed) : proceed();
  };

  return (
    <div className="flex animate-rise flex-col gap-3">
      {eyebrow && <p className="text-[11px] font-semibold tracking-widest text-accent uppercase">{eyebrow}</p>}
      <p className="font-display text-[17px] leading-snug font-semibold text-balance">{question.prompt}</p>

      {isFill ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(typed);
          }}
        >
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Type your answer"
            inputMode={/^\d+$/.test(question.correctAnswer) ? "numeric" : "text"}
            disabled={picked !== null}
            aria-label="Your answer"
            className={cn(
              picked !== null && (isAnswerCorrect(question, picked) ? "border-success text-success" : "border-lane text-lane"),
            )}
          />
          <Button type="submit" disabled={picked !== null || !typed.trim()}>
            Check
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-2" role="list">
          {question.options!.map((option, index) => {
            const isPicked = picked === option;
            const showCorrect = picked !== null && option === question.correctAnswer;
            return (
              <button
                key={option}
                type="button"
                role="listitem"
                disabled={picked !== null}
                onClick={() => submit(option)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border bg-surface px-3.5 py-3 text-left text-[15px] leading-snug transition-all active:scale-[0.99]",
                  picked === null && "hover:border-primary/60 hover:bg-surface-2",
                  showCorrect && "border-success bg-success/10",
                  isPicked && !showCorrect && "border-lane bg-lane/10",
                  picked !== null && !isPicked && !showCorrect && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "mt-px grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold text-muted-foreground",
                    showCorrect && "border-success bg-success text-primary-foreground",
                    isPicked && !showCorrect && "border-lane bg-lane text-primary-foreground",
                  )}
                >
                  {showCorrect ? <CheckIcon className="size-3.5" /> : isPicked ? <XIcon className="size-3.5" /> : String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
