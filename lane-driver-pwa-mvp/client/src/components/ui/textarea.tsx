import type * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full resize-none rounded-xl border bg-background/60 px-3.5 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-accent sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
